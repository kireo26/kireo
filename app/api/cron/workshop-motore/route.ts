import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { chiamaJson } from "@/lib/ai/chiamaJson";
import { inviaEmail } from "@/lib/email/brevo";
import { REGOLA_LINGUA_INVARIANTE } from "@/lib/lingua/accordoGenere";
import { MODELLO_CLIENTE_WORKSHOP, WORKSHOP_CLIENTE_NOME, WORKSHOP_CLIENTE_PROMPTS } from "@/lib/workshop/config";
import { WORKSHOP_ELABORATO, WORKSHOP_TUTOR_CONTESTO } from "@/lib/workshop/elaborato-config";
import { serializzaValoreSezione, type FeedbackFinale, type RevisioneTappa, type ValoreSezione } from "@/lib/workshop/elaboratoValore";
import { promptRevisore, promptReazioneClienteUser, promptFeedbackFinale, type CtxTappa } from "@/lib/workshop/prompt-revisore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Destinatario dell'alert guasti-revisore. Usata solo per identificare Mario
// (l'admin del progetto), mai passata a servizi non correlati.
const EMAIL_ADMIN = "mario.izzo@hotmail.it";

const REVISIONE_VUOTA: RevisioneTappa = {
  cosa_regge: [],
  da_migliorare: [],
  domanda: "",
  commento_breve: "",
  punteggio_fiducia: 0,
};

// Quanti GIRI DI CRON provare prima di arrendersi su una tappa. chiamaJson fa
// già 1 retry interno, quindi 3 giri = fino a 6 chiamate reali distribuite su
// ~3 giorni. Arrendersi non significa mai uno zero silenzioso: la tappa avanza
// (lo studente non resta bloccato) ma marcata, e la barra della fiducia
// accorcia il denominatore invece di contare 0 su 25.
const MAX_TENTATIVI_REVISIONE = 3;

// Tetto di token in USCITA per le due chiamate che scrivono testo letto dallo
// studente. Erano 700 entrambe, ed erano strette: due tappe su sei hanno
// fallito il PRIMO giro di cron per intero, su due workshop diversi — e una
// risposta troncata non produce mezza revisione, ma ZERO (estraiJson non trova
// la graffa di chiusura), quindi un giro buttato e, in produzione dove il cron
// gira una volta al giorno, un giorno di attesa in più per lo studente.
//
// DA DOVE VENGONO I DUE NUMERI. Misurati sulle risposte riuscite osservate:
// una revisione completa sta sui 1.800-1.900 caratteri (3 punti_forza da ~190,
// 3 da_migliorare da ~220, domanda ~220, commento ~220, più chiavi e graffe),
// che in italiano fanno ~525 token — il rapporto ~3,5 caratteri per token
// torna con la stima indipendente fatta sulla risposta vera. Una revisione
// verbosa, con gli stessi campi ma metà più lunghi, arriva intorno agli 800.
// 1200 tiene quel caso con margine. Il FEEDBACK FINALE legge il progetto
// INTERO, tutte e quattro le tappe: stessa forma, item più ricchi, ~1000 token
// nel caso verboso.
//
// SUL FEEDBACK FINALE IL MARGINE È DELIBERATAMENTE PIÙ LARGO DEL NECESSARIO
// (2000, non i ~1400 che basterebbero). Non è imprecisione: è il testo che
// chiude lo stage, si genera UNA volta sola per progetto, e se si tronca tre
// giri di fila il progetto si chiude con feedback null — un giudizio finale
// che non si recupera se non rigiocando quattro tappe. Il costo di un tetto
// largo è zero quando non serve; il costo di uno stretto è quello, ed è già
// successo una volta (tappa 4 di palestra/salute, 2026-08-30).
//
// Un tetto è un LIMITE, non un'allocazione: quello che non viene generato non
// si paga. Alzarlo costa zero sulle risposte normali e, nel caso peggiore in
// cui il modello lo riempisse davvero, qualche millesimo di dollaro. Non è
// invece una diagnosi: se i fallimenti fossero di chiamata (chiave, rate
// limit, sovraccarico) alzarlo non cambierebbe niente — per questo
// `chiamaJson` ora distingue il motivo `troncata` e registra i token usati.
const MAX_TOKEN_REVISIONE = 1200;
const MAX_TOKEN_FEEDBACK_FINALE = 2000;

// Esito di una generazione AI, gemello dei tre stati del revisore Escape.
// 'forma_non_valida' = JSON tornato ma di forma inattesa: prima cadeva in un
// `else` che non c'era, quindi non produceva nulla E non veniva contato.
type EsitoGenerazione = "riuscita" | "non_riuscita" | "forma_non_valida";

// Motore del tempo di Workshop 2.0 v2: per ogni tappa 'consegnata' il cui
// cooldown è passato, genera la revisione del tutor + la reazione in
// carattere del cliente (prompt cablati da lib/workshop/prompt-revisore.ts,
// forniti da Mario — non re-inventati qui), aggiorna la fiducia, apre la
// tappa successiva (o chiude l'intero progetto con un feedback finale
// separato se è l'ultima) e notifica lo studente. Protetta da CRON_SECRET
// (header Authorization: Bearer <secret>, la convenzione standard di
// Vercel Cron) — nessuna sessione studente qui, per questo usa la service
// role key (bypassa la RLS) invece del client cookie-based usato da ogni
// altra route del progetto.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!cronSecret || header !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY non configurata: il motore workshop non può generare revisione/reazione.");
    return NextResponse.json({ errore: "Chiave Anthropic non configurata." }, { status: 503 });
  }

  const supabase = createServiceRoleClient();
  const client = new Anthropic({ apiKey });

  // IL RAFFREDDAMENTO SALTA PER I PROFILI DI PROVA, E PER NESSUN ALTRO.
  //
  // Prima qui c'era `WORKSHOP_COOLDOWN_MINUTI`, una variabile d'ambiente che
  // azzerava il cooldown di TUTTI: per la durata di una prova, e per tutto il
  // tempo in cui ci si dimenticava di toglierla, nessuno studente vero aveva
  // più i due giorni fra una tappa e l'altra. Era anche l'unica cosa in tutta
  // questa architettura che chiedeva a qualcuno di ricordarsi di spegnere
  // qualcosa — e un interruttore di collaudo che si dimentica acceso è una
  // questione di quando, non di se.
  //
  // Adesso il robot non ha bisogno che il mondo cambi per lui: ha bisogno di
  // essere riconoscibile. È lo stesso principio del flag applicato al TEMPO
  // invece che alle misure.

  const { data: righe, error: erroreSelect } = await supabase
    .from("workshop_fasi_stato")
    .select(
      "id, iscrizione_id, fase_id, consegnata_at, tentativi_revisione, workshop_iscrizioni(student_id, workshop_id, ruolo_id, workshop(slug, titolo), workshop_ruoli(slug, titolo, area_slug))",
    )
    .eq("stato", "consegnata");

  if (erroreSelect) {
    console.error("Errore lettura tappe consegnate:", erroreSelect);
    return NextResponse.json({ errore: "Errore di lettura." }, { status: 500 });
  }

  let processate = 0;
  let saltate = 0;
  let errori = 0;
  // Revisori/feedback che hanno restituito un esito non_riuscito (chiamata o
  // estrazione JSON fallita) in QUESTA esecuzione: alimenta l'alert email in
  // fondo, insieme ai non_riuscito di Escape delle ultime 24h.
  //
  // Due contatori, non uno: una passata del robot ne produce quanti ne produce,
  // e mescolarli col numero di produzione fa arrivare a Mario una mail che
  // riporta guasti di studenti che non esistono. Il secondo si stampa nella
  // risposta JSON — chi lancia il robot è davanti al terminale — e non entra
  // mai nella mail.
  let revisoriFalliti = 0;
  let revisoriFallitiProva = 0;
  // Vale per la riga in corso: la assegna il controllo del raffreddamento, che
  // il predicato lo chiede comunque.
  let rigaDiProva = false;
  const segnalaFallito = () => { if (rigaDiProva) revisoriFallitiProva++; else revisoriFalliti++; };

  for (const riga of righe ?? []) {
    try {
      const iscrizione = Array.isArray(riga.workshop_iscrizioni) ? riga.workshop_iscrizioni[0] : riga.workshop_iscrizioni;
      const workshop = iscrizione ? (Array.isArray(iscrizione.workshop) ? iscrizione.workshop[0] : iscrizione.workshop) : null;
      const ruolo = iscrizione ? (Array.isArray(iscrizione.workshop_ruoli) ? iscrizione.workshop_ruoli[0] : iscrizione.workshop_ruoli) : null;
      if (!iscrizione || !workshop || !ruolo || !riga.consegnata_at) {
        saltate++;
        continue;
      }

      const fasi = WORKSHOP_ELABORATO[workshop.slug]?.[ruolo.slug]?.fasi;
      const fase = fasi?.find((f) => f.id === riga.fase_id);
      if (!fasi || !fase) {
        saltate++;
        continue;
      }

      // `e_profilo_di_prova` è la stessa funzione che usano le misure: una
      // sola definizione del predicato, non due che col tempo divergono.
      const { data: diProva } = await supabase.rpc("e_profilo_di_prova", { p_student_id: iscrizione.student_id });
      rigaDiProva = diProva === true;
      if (!rigaDiProva) {
        const dueDa = new Date(riga.consegnata_at).getTime() + fase.cooldownGiorni * 86_400_000;
        if (Date.now() < dueDa) {
          saltate++;
          continue;
        }
      }

      const { data: elaborato } = await supabase
        .from("workshop_elaborati")
        .select("contenuto, fiducia")
        .eq("iscrizione_id", riga.iscrizione_id)
        .maybeSingle();

      const contenuto = (elaborato?.contenuto ?? {}) as Record<string, ValoreSezione>;
      const fiduciaPrima = elaborato?.fiducia ?? 0;

      const contenutoTappa: Record<string, unknown> = {};
      for (const sezione of fase.sezioni) {
        if (contenuto[sezione.id] !== undefined) contenutoTappa[sezione.id] = contenuto[sezione.id];
      }

      // Calcolata QUI e non più giù prima di `avanza_fase_workshop`: serve
      // anche al revisore, a cui chiediamo una domanda che apra il passo
      // successivo — senza saperlo, la direzione se la inventava.
      const indiceFase = fasi.findIndex((f) => f.id === fase.id);
      const prossimaFase = fasi[indiceFase + 1] ?? null;

      const nomeCliente = WORKSHOP_CLIENTE_NOME[workshop.slug] ?? "il cliente";
      const ctx: CtxTappa = {
        workshopTitolo: workshop.titolo,
        ruoloTitolo: ruolo.titolo,
        tappaTitolo: fase.titolo,
        tappaObiettivo: fase.obiettivo,
        clienteNome: nomeCliente,
        clienteVincoli: WORKSHOP_TUTOR_CONTESTO[workshop.slug]?.vincoli ?? "",
        revisioneFocus: fase.revisioneFocus,
        fiduciaMax: fase.fiduciaMax,
        // id → titolo: il contenuto viaggia keyed per id, lo studente vede i
        // titoli. Senza questa mappa il revisore scriveva «(sezione X)»,
        // copiando il segnaposto dell'esempio invece di nominare la sezione.
        sezioni: fase.sezioni.map((s) => ({ id: s.id, titolo: s.titolo })),
        prossimaTappa: prossimaFase ? { titolo: prossimaFase.titolo, obiettivo: prossimaFase.obiettivo } : null,
      };

      let revisione: RevisioneTappa = REVISIONE_VUOTA;
      let esitoRevisioneStato: EsitoGenerazione = "non_riuscita";
      const esitoRevisione = await chiamaJson(client, {
        diProva: rigaDiProva,
        model: MODELLO_CLIENTE_WORKSHOP,
        maxTokens: MAX_TOKEN_REVISIONE,
        system: promptRevisore(ctx),
        user: JSON.stringify(contenutoTappa, null, 2),
      });
      if (esitoRevisione.ok) {
        const parsed = esitoRevisione.dati as Record<string, unknown>;
        // LE DUE CHIAVI, come dalla parte del lettore (`cosaRegge()`): il
        // prompt della revisione chiede `cosa_regge` dal 2026-08-31, ma una
        // risposta con la chiave vecchia resta una risposta buona — e questo è
        // il punto in cui si decide se il lavoro di uno studente esiste o no.
        //
        // È QUI CHE LA RINOMINA NON ERA ARRIVATA, ed è costata ogni revisione
        // di mezza passata: tre tentativi a tappa, poi REVISIONE_VUOTA e la
        // fiducia a zero su un lavoro giusto. Il compilatore non poteva
        // vederlo: `parsed` è un Record<string, unknown>, e su un Record
        // qualunque chiave è legale. Il confine JSON è l'unico posto dove i
        // tipi smettono di guardare, ed è anche l'unico che decide se una
        // risposta si salva o si butta.
        const cosaRegge = parsed.cosa_regge ?? parsed.punti_forza;
        if (
          Array.isArray(cosaRegge) &&
          Array.isArray(parsed.da_migliorare) &&
          typeof parsed.domanda === "string" &&
          typeof parsed.commento_breve === "string" &&
          typeof parsed.punteggio_fiducia === "number"
        ) {
          revisione = {
            cosa_regge: cosaRegge as string[],
            da_migliorare: parsed.da_migliorare as string[],
            domanda: parsed.domanda,
            commento_breve: parsed.commento_breve,
            punteggio_fiducia: Math.max(0, Math.min(fase.fiduciaMax, Math.round(parsed.punteggio_fiducia as number))),
          };
          esitoRevisioneStato = "riuscita";
        } else {
          // Il ramo che prima non esisteva: JSON valido, forma sbagliata →
          // niente revisione, e ora lo si conta come tutti gli altri guasti.
          esitoRevisioneStato = "forma_non_valida";
          segnalaFallito();
          console.error(`Revisione di forma non valida (iscrizione ${riga.iscrizione_id}, tappa ${riga.fase_id})`);
        }
      } else {
        segnalaFallito();
        console.error(`Errore generazione revisione (iscrizione ${riga.iscrizione_id}, tappa ${riga.fase_id}): motivo=${esitoRevisione.motivo}`);
      }

      const fiduciaDopo = Math.max(0, Math.min(100, fiduciaPrima + revisione.punteggio_fiducia));

      let reazioneCliente = "";
      const promptCliente = WORKSHOP_CLIENTE_PROMPTS[workshop.slug];
      if (promptCliente) {
        try {
          const sintesi = fase.sezioni
            .map((s) => `${s.titolo}: ${serializzaValoreSezione(s, contenuto[s.id]) || "(non compilata)"}`)
            .join("\n\n");
          const rispostaReazione = await client.messages.create({
            model: MODELLO_CLIENTE_WORKSHOP,
            max_tokens: 300,
            // La REGOLA sulla lingua sì, quella sul REGISTRO no — e la ragione
            // di prima («il cliente parla di sé in prima persona») era giusta
            // a metà: parla di sé in prima persona, ma parla ALLO STUDENTE in
            // seconda. Passata 2 del banco: «te lo sei inventato?», detto da
            // Gianni. Per chi legge non c'è nessuna differenza fra sentirsi
            // dare del maschile dal cliente o dal revisore.
            // Il registro da revisore resta fuori: in bocca a Tonino sarebbe
            // fuori carattere, e lì la ragione regge ancora.
            system: promptCliente + REGOLA_LINGUA_INVARIANTE,
            messages: [{ role: "user", content: promptReazioneClienteUser(sintesi, fase.reazioneCliente) }],
          });
          reazioneCliente = rispostaReazione.content[0]?.type === "text" ? rispostaReazione.content[0].text : "";
        } catch (erroreReazione) {
          // Contata nell'alert come gli altri guasti AI (prima era solo un
          // console.error). NON blocca l'avanzamento: la reazione del cliente è
          // colore, non punteggio — a differenza della revisione, che è giudizio.
          segnalaFallito();
          console.error(`Errore generazione reazione cliente (iscrizione ${riga.iscrizione_id}, tappa ${riga.fase_id}):`, erroreReazione);
        }
      }

      // Feedback finale, SOLO per l'ultima tappa: chiamata AI separata
      // (forma diversa dalla revisione per-tappa, vedi
      // lib/workshop/prompt-revisore.ts), basata sul contenuto COMPLETO
      // del progetto (tutte le tappe), non solo su questa.
      let feedbackFinale: FeedbackFinale | null = null;
      // 'riuscita' di default: se non è l'ultima tappa non c'è feedback finale
      // da generare, quindi non c'è niente che possa fallire.
      let esitoFinaleStato: EsitoGenerazione = "riuscita";
      if (fase.ultima) {
        esitoFinaleStato = "non_riuscita";
        const esitoFinale = await chiamaJson(client, {
          diProva: rigaDiProva,
          model: MODELLO_CLIENTE_WORKSHOP,
          maxTokens: MAX_TOKEN_FEEDBACK_FINALE,
          system: promptFeedbackFinale(ctx, fiduciaDopo),
          user: JSON.stringify(contenuto, null, 2),
        });
        if (esitoFinale.ok) {
          const parsed = esitoFinale.dati as Record<string, unknown>;
          if (
            Array.isArray(parsed.punti_forza) &&
            Array.isArray(parsed.da_migliorare) &&
            typeof parsed.messaggio_chiusura === "string" &&
            typeof parsed.chiusura_cliente === "string" &&
            typeof parsed.punteggio_area === "number"
          ) {
            feedbackFinale = {
              punti_forza: parsed.punti_forza as string[],
              da_migliorare: parsed.da_migliorare as string[],
              messaggio_chiusura: parsed.messaggio_chiusura,
              chiusura_cliente: parsed.chiusura_cliente,
              punteggio_area: Math.max(0, Math.min(100, Math.round(parsed.punteggio_area as number))),
            };
            esitoFinaleStato = "riuscita";
          } else {
            esitoFinaleStato = "forma_non_valida";
            segnalaFallito();
            console.error(`Feedback finale di forma non valida (iscrizione ${riga.iscrizione_id})`);
          }
        } else {
          segnalaFallito();
          console.error(`Errore generazione feedback finale (iscrizione ${riga.iscrizione_id}): motivo=${esitoFinale.motivo}`);
        }
      }

      // ── Ritentativo o resa ────────────────────────────────────────────────
      // Il feedback finale conta quanto la revisione: `punteggio_area` (dentro
      // feedback_ai) è la fonte che collegherà i workshop al profilo, e uno 0 al
      // posto di un'assenza rientrerebbe in evidence al cross-feed
      // reintroducendo «non misurato = zero».
      const tentativiPrima = Number(riga.tentativi_revisione) || 0;
      const esitoPeggiore: EsitoGenerazione =
        esitoRevisioneStato !== "riuscita" ? esitoRevisioneStato : esitoFinaleStato;

      if (esitoPeggiore !== "riuscita" && tentativiPrima + 1 < MAX_TENTATIVI_REVISIONE) {
        // Non si avanza: la tappa resta 'consegnata' e il prossimo giro ritenta.
        await supabase
          .from("workshop_fasi_stato")
          .update({ tentativi_revisione: tentativiPrima + 1 })
          .eq("id", riga.id);
        errori++;
        continue;
      }

      // MARCARE PRIMA DI AVANZARE: se l'avanzamento fallisse a metà, resterebbe
      // una riga marcata ma ancora 'consegnata' → il giro dopo la vede al
      // massimo dei tentativi e si arrende di nuovo (si auto-ripara), invece di
      // lasciare una tappa avanzata con esito NULL indistinguibile da una riuscita.
      await supabase
        .from("workshop_fasi_stato")
        .update({ tentativi_revisione: tentativiPrima + 1, revisione_esito: esitoRevisioneStato })
        .eq("id", riga.id);

      // Nota: punteggio_area (0-100, il "voto" complessivo del progetto)
      // resta salvato dentro feedback_ai per lo studente, ma NON diventa
      // il peso della riga activity_log — quel peso è fisso per tipo in
      // tutta la piattaforma (workshop_pcto=25, come ogni altro tipo di
      // attività), e usare un numero variabile 0-100 lì romperebbe
      // l'assunzione additiva di score_aree/il radar attitudinale.
      const { error: erroreAvanza } = await supabase.rpc("avanza_fase_workshop", {
        p_iscrizione_id: riga.iscrizione_id,
        p_fase_id: riga.fase_id,
        p_prossima_fase_id: prossimaFase?.id ?? null,
        p_revisione: revisione,
        p_reazione_cliente: reazioneCliente || null,
        p_punteggio_fiducia: revisione.punteggio_fiducia,
        p_ultima: Boolean(fase.ultima),
        p_area_slug: ruolo.area_slug,
        p_feedback_finale: feedbackFinale,
      });

      if (erroreAvanza) {
        console.error(`Errore avanzamento tappa (iscrizione ${riga.iscrizione_id}, tappa ${riga.fase_id}):`, erroreAvanza);
        errori++;
        continue;
      }

      const notifiche = [{ student_id: iscrizione.student_id, tipo: "workshop_tappa_revisionata", riferimento_id: riga.iscrizione_id }];
      if (prossimaFase) {
        notifiche.push({ student_id: iscrizione.student_id, tipo: "workshop_tappa_aperta", riferimento_id: riga.iscrizione_id });
      }
      const { error: erroreNotifica } = await supabase.from("notifiche_studenti").insert(notifiche);
      if (erroreNotifica) {
        console.error(`Errore inserimento notifiche (iscrizione ${riga.iscrizione_id}):`, erroreNotifica);
      }

      processate++;
    } catch (erroreRiga) {
      console.error("Errore elaborazione riga workshop_fasi_stato:", erroreRiga);
      errori++;
    }
  }

  // ── Alert guasti-revisore (osservabilità) ───────────────────────────────
  // Un revisore AI che fallisce non deve più restare visibile solo per 30
  // minuti nei log di Vercel. Il cron è l'unico job giornaliero del progetto:
  // qui raccoglie i non_riuscito di Escape delle ultime 24h (dalla vista
  // revisore_esiti) e quelli dei revisori workshop di QUESTA esecuzione, e —
  // solo se ce n'è almeno uno — manda una mail all'admin. Nessun riepilogo
  // "tutto ok": silenzio quando non c'è niente da correggere. Best-effort: un
  // errore di invio non fa fallire il cron.
  // Gli id dei profili di prova, letti una volta sola e usati da tutti e tre i
  // contatori sotto.
  //
  // IL CRITERIO, per chi verrà a metterci il quarto: quello che descrive gli
  // STUDENTI si esclude, quello che descrive il MODELLO si separa — la passata
  // del robot su venticinque ruoli è il campione più grande che avremo, e
  // buttarlo sarebbe uno spreco. Qui sotto tutti e tre descrivono il modello:
  // la guardia sulla lingua è già separata, gli altri due sono esclusi solo
  // perché il banco non gioca ancora né le missioni né i test. È una scelta
  // che scade, e ognuna delle due righe dice quando. Il predicato `e_profilo_di_prova` esiste ed è la sola
  // definizione, ma da PostgREST non si può usare dentro un filtro: qui si
  // legge la stessa colonna che il predicato legge, e si esclude in memoria.
  // Se la lettura fallisce l'insieme resta vuoto e i numeri tornano quelli di
  // prima — sovrastimati, mai sottostimati: un alert che grida di troppo si
  // corregge, uno che tace no.
  const idDiProva = new Set<string>();
  try {
    const { data: prova, error: erroreProva } = await supabase.from("profiles").select("id").eq("di_prova", true);
    if (erroreProva) console.error("Alert — errore lettura profili di prova:", erroreProva);
    for (const p of prova ?? []) idDiProva.add(p.id);
  } catch (erroreProva) {
    console.error("Alert — eccezione lettura profili di prova:", erroreProva);
  }

  let escapeFalliti = 0;
  try {
    const dayFa = new Date(Date.now() - 86_400_000).toISOString();
    const { data: righeEscape, error: erroreEscape } = await supabase
      .from("revisore_esiti")
      .select("attempt_id, student_id")
      .eq("revisore_esito", "non_riuscito")
      .gte("aggiornato_il", dayFa);
    if (erroreEscape) console.error("Alert revisore — errore lettura revisore_esiti:", erroreEscape);
    // SI ESCLUDE OGGI, MA IL CRITERIO DICE «SEPARA»: questo numero conta
    // revisori che si sono arresi, quindi descrive il MODELLO, non gli
    // studenti — la stessa famiglia della guardia sulla lingua. Se ne sta
    // fuori solo perché il banco le missioni Escape non le gioca: escludere
    // un insieme vuoto non toglie niente a nessuno.
    //
    // IL GIORNO IN CUI IL ROBOT IMPARERÀ A GIOCARE LE MISSIONI, questa riga va
    // cambiata in una separazione — due contatori, come per la guardia — o
    // butteremo via il campione migliore proprio quando comincia a esistere.
    // Serve lo stesso filtro spezzato in due: `revisore_esiti` ha già
    // `student_id`, quindi non è un meccanismo nuovo, è un `if`.
    escapeFalliti = (righeEscape ?? []).filter((r) => !idDiProva.has(r.student_id)).length;
  } catch (erroreEscape) {
    console.error("Alert revisore — eccezione lettura revisore_esiti:", erroreEscape);
  }

  // ── Test attitudinali completati SENZA esito (osservabilità) ──────────────
  // Un tentativo 'completata' senza NESSUNA riga in evidence: o le risposte non
  // hanno fatto emergere niente (raro e legittimo), o lo scoring è tornato vuoto
  // per un bug — l'unico "rotto" dei test che non si vede (un fallimento vero
  // dà 500 e lascia il tentativo 'in_corso', vedi /api/test/finalizza). Contatore,
  // non diagnosi: zero → silenzio, se cresce è un segnale da guardare. Il cron
  // gira con la service-role, quindi legge i tentativi di tutti gli studenti.
  let testSenzaEsito = 0;
  try {
    const dayFaTest = new Date(Date.now() - 86_400_000).toISOString();
    const { data: completati, error: erroreTest } = await supabase
      .from("test_attempt")
      .select("id, student_id")
      .eq("stato", "completata")
      .gte("started_at", dayFaTest);
    if (erroreTest) console.error("Alert test — errore lettura test_attempt:", erroreTest);
    // Stessa storia della riga di Escape sopra: un tentativo completato senza
    // nessuna prova è uno SCORING che non ha prodotto niente — è il motore che
    // si descrive, non lo studente. Si esclude finché il banco i test non li
    // gioca; quando li giocherà, qui vanno due numeri e non uno.
    const ids = (completati ?? []).filter((a) => !idDiProva.has(a.student_id)).map((a) => a.id);
    if (ids.length > 0) {
      const { data: conEvidenze } = await supabase.from("evidence").select("test_attempt_id").in("test_attempt_id", ids);
      const conEv = new Set((conEvidenze ?? []).map((e) => e.test_attempt_id));
      testSenzaEsito = ids.filter((id) => !conEv.has(id)).length;
    }
  } catch (erroreTest) {
    console.error("Alert test — eccezione conteggio senza esito:", erroreTest);
  }

  // ── Guardia sulla lingua invariante (osservabilità) ───────────────────────
  // Due numeri, non una diagnosi: quante volte la guardia è intervenuta (la
  // prima risposta di un revisore conteneva una forma accordata al genere) e
  // quante volte lo studente ha comunque letto una forma accordata. Servono a
  // sostituire, fra qualche settimana, la stima fatta su una consegna-fixture
  // (~8% su 24 chiamate) con il tasso vero della produzione. Se la tabella non
  // esiste ancora (migrazione non applicata) si resta a zero, in silenzio.
  let guardiaInterventi = 0, guardiaAncoraAccordato = 0;
  let guardiaInterventiProva = 0, guardiaAncoraAccordatoProva = 0;
  try {
    const dayFaGuardia = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { data: righeGuardia, error: erroreGuardia } = await supabase
      .from("guardia_lingua_giorno")
      .select("interventi, ancora_accordato, di_prova")
      .gte("giorno", dayFaGuardia);
    if (erroreGuardia) console.error("Alert guardia lingua — errore lettura:", erroreGuardia);
    // SI SEPARA, non si esclude: i due numeri rispondono a due domande. Quello
    // di produzione dice il tasso vero sui testi degli studenti; quello di
    // prova dice com'è andata la passata del robot, su venticinque ruoli in un
    // colpo — il campione più grande che avremo. Sommarli, com'è successo fino
    // al 2026-08-31, fa leggere gli undici interventi del robot come una
    // statistica sugli studenti.
    for (const r of righeGuardia ?? []) {
      if (r.di_prova) {
        guardiaInterventiProva += r.interventi ?? 0;
        guardiaAncoraAccordatoProva += r.ancora_accordato ?? 0;
      } else {
        guardiaInterventi += r.interventi ?? 0;
        guardiaAncoraAccordato += r.ancora_accordato ?? 0;
      }
    }
  } catch (erroreGuardia) {
    console.error("Alert guardia lingua — eccezione lettura:", erroreGuardia);
  }

  const totaleFalliti = revisoriFalliti + escapeFalliti;
  // La mail parte SOLO sul giro programmato. Il robot del banco lancia un giro
  // per tappa — un centinaio in una passata completa — e cento mail rendono
  // inutile la centounesima: chi le riceve deve poter continuare a fidarsi che
  // una mail significhi qualcosa. Chi lancia il cron a mano il suo esito ce
  // l'ha già, nella risposta JSON, ed è davanti al terminale.
  //
  // È il chiamante a dichiararsi (`?alert=no`) invece del `x-vercel-cron`:
  // quell'header non è nel contratto pubblico di Vercel, e un alert che tace
  // perché una piattaforma ha cambiato un'intestazione è il guasto peggiore
  // che questa route possa avere. Il default resta «manda».
  const alertRichiesto = new URL(request.url).searchParams.get("alert") !== "no";
  if (alertRichiesto && (totaleFalliti > 0 || testSenzaEsito > 0 || guardiaAncoraAccordato > 0)) {
    const html = `<p>Nelle ultime 24 ore, segnali di osservabilità da controllare:</p>
<ul>
  <li>Escape — proposte finali non lette dal revisore (24h): <strong>${escapeFalliti}</strong></li>
  <li>Workshop — tentativi AI falliti (questa esecuzione del cron): <strong>${revisoriFalliti}</strong></li>
  <li>Test attitudinali — tentativi completati senza nessuna prova in evidence (24h): <strong>${testSenzaEsito}</strong></li>
  <li>Lingua — la guardia è intervenuta <strong>${guardiaInterventi}</strong> volte (24h); in <strong>${guardiaAncoraAccordato}</strong> lo studente ha comunque letto una forma accordata al genere</li>
</ul>${
      guardiaInterventiProva > 0
        ? `<p>Fuori dal conto qui sopra, dai <strong>profili di prova</strong> (il robot del banco, non studenti): ${guardiaInterventiProva} interventi della guardia, ${guardiaAncoraAccordatoProva} testi ancora accordati. Sono su testi veri generati dagli stessi revisori, quindi dicono qualcosa sul modello — ma non sono un tasso di produzione e non vanno letti come tale.</p>`
        : ""
    }
<p>I guasti AI sono chiamate fallite, estrazioni JSON fallite o risposte di forma inattesa. Sui workshop si contano i <strong>tentativi</strong>, non le tappe: una tappa che fallisce viene ritentata fino a ${MAX_TENTATIVI_REVISIONE} giri di cron, quindi lo stesso guasto può comparire per più giorni di fila — è persistenza, non moltiplicazione. Le «revisioni non riuscite» dei workshop si trovano con:</p>
<pre>select iscrizione_id, fase_id, tentativi_revisione, revisione_esito
from public.workshop_fasi_stato
where revisione_esito is not null and revisione_esito &lt;&gt; 'riuscita';</pre>
<p>I «test senza esito» sono tentativi finiti a cui lo scoring non ha prodotto righe: raro e spesso legittimo, ma se il numero cresce va guardato — potrebbe essere uno scoring che torna vuoto per un bug.</p>
<p>La riga sulla <strong>lingua</strong> non è un guasto: il primo numero è lavoro che la guardia ha fatto (una chiamata in più, testo poi corretto), il secondo è l'unico che conta davvero — quante volte la seconda risposta è tornata comunque accordata, o è fallita e si è spedita la prima. La guardia non trattiene mai un feedback per una questione di grammatica. Il tasso di intervento dice se la regola scritta nei prompt sta funzionando: la stima di partenza, misurata su una consegna-fixture, era ~8%.</p>
<p>Per i dettagli Escape, interroga la vista <code>revisore_esiti</code>:</p>
<pre>select * from public.revisore_esiti
where revisore_esito = 'non_riuscito'
  and aggiornato_il &gt; now() - interval '24 hours';</pre>
<p>Per i workshop, cerca in questa esecuzione del cron le righe di log <code>Errore generazione revisione/feedback ... motivo=...</code>. Il motivo dice cosa fare: <code>troncata</code> = la risposta si è fermata al tetto dei token, si alza il tetto nel chiamante (i log riportano anche quanti token su quanti); <code>chiamata</code> = l'API non ha risposto, si guarda lo <code>status</code> nella riga <code>chiamaJson — errore API</code> lì accanto; <code>estrazione</code> = ha risposto ma senza JSON dentro, ed è l'unico dei tre che riguarda il prompt.</p>`;
    const esitoMail = await inviaEmail(EMAIL_ADMIN, `KIREO — osservabilità (24h): ${totaleFalliti} revisori, ${testSenzaEsito} test senza esito`, html, "Mario");
    if (!esitoMail.ok) console.error(`Alert osservabilità — invio email fallito: ${esitoMail.motivo}`);
  }

  return NextResponse.json({
    processate,
    saltate,
    errori,
    revisoriFalliti,
    revisoriFallitiProva,
    escapeFalliti,
    testSenzaEsito,
    guardiaInterventi,
    guardiaAncoraAccordato,
    guardiaInterventiProva,
    guardiaAncoraAccordatoProva,
    alertInviato: alertRichiesto,
  });
}
