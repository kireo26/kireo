import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { chiamaJson } from "@/lib/ai/chiamaJson";
import { inviaEmail } from "@/lib/email/brevo";
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
  punti_forza: [],
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

  // Override di test: minuti invece di giorni per il cooldown di OGNI
  // tappa, per collaudare il gating senza aspettare giorni veri (vedi
  // CLAUDE.md per come usarlo).
  const cooldownMinutiOverride = process.env.WORKSHOP_COOLDOWN_MINUTI ? Number(process.env.WORKSHOP_COOLDOWN_MINUTI) : null;

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
  let revisoriFalliti = 0;

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

      const cooldownMs =
        cooldownMinutiOverride !== null && !Number.isNaN(cooldownMinutiOverride)
          ? cooldownMinutiOverride * 60_000
          : fase.cooldownGiorni * 86_400_000;
      const dueDa = new Date(riga.consegnata_at).getTime() + cooldownMs;
      if (Date.now() < dueDa) {
        saltate++;
        continue;
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
      };

      let revisione: RevisioneTappa = REVISIONE_VUOTA;
      let esitoRevisioneStato: EsitoGenerazione = "non_riuscita";
      const esitoRevisione = await chiamaJson(client, {
        model: MODELLO_CLIENTE_WORKSHOP,
        maxTokens: 700,
        system: promptRevisore(ctx),
        user: JSON.stringify(contenutoTappa, null, 2),
      });
      if (esitoRevisione.ok) {
        const parsed = esitoRevisione.dati as Record<string, unknown>;
        if (
          Array.isArray(parsed.punti_forza) &&
          Array.isArray(parsed.da_migliorare) &&
          typeof parsed.domanda === "string" &&
          typeof parsed.commento_breve === "string" &&
          typeof parsed.punteggio_fiducia === "number"
        ) {
          revisione = {
            punti_forza: parsed.punti_forza as string[],
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
          revisoriFalliti++;
          console.error(`Revisione di forma non valida (iscrizione ${riga.iscrizione_id}, tappa ${riga.fase_id})`);
        }
      } else {
        revisoriFalliti++;
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
            system: promptCliente,
            messages: [{ role: "user", content: promptReazioneClienteUser(sintesi, fase.reazioneCliente) }],
          });
          reazioneCliente = rispostaReazione.content[0]?.type === "text" ? rispostaReazione.content[0].text : "";
        } catch (erroreReazione) {
          // Contata nell'alert come gli altri guasti AI (prima era solo un
          // console.error). NON blocca l'avanzamento: la reazione del cliente è
          // colore, non punteggio — a differenza della revisione, che è giudizio.
          revisoriFalliti++;
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
          model: MODELLO_CLIENTE_WORKSHOP,
          maxTokens: 700,
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
            revisoriFalliti++;
            console.error(`Feedback finale di forma non valida (iscrizione ${riga.iscrizione_id})`);
          }
        } else {
          revisoriFalliti++;
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

      const indiceFase = fasi.findIndex((f) => f.id === fase.id);
      const prossimaFase = fasi[indiceFase + 1] ?? null;

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
  let escapeFalliti = 0;
  try {
    const dayFa = new Date(Date.now() - 86_400_000).toISOString();
    const { data: righeEscape, error: erroreEscape } = await supabase
      .from("revisore_esiti")
      .select("attempt_id")
      .eq("revisore_esito", "non_riuscito")
      .gte("aggiornato_il", dayFa);
    if (erroreEscape) console.error("Alert revisore — errore lettura revisore_esiti:", erroreEscape);
    escapeFalliti = righeEscape?.length ?? 0;
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
      .select("id")
      .eq("stato", "completata")
      .gte("started_at", dayFaTest);
    if (erroreTest) console.error("Alert test — errore lettura test_attempt:", erroreTest);
    const ids = (completati ?? []).map((a) => a.id);
    if (ids.length > 0) {
      const { data: conEvidenze } = await supabase.from("evidence").select("test_attempt_id").in("test_attempt_id", ids);
      const conEv = new Set((conEvidenze ?? []).map((e) => e.test_attempt_id));
      testSenzaEsito = ids.filter((id) => !conEv.has(id)).length;
    }
  } catch (erroreTest) {
    console.error("Alert test — eccezione conteggio senza esito:", erroreTest);
  }

  const totaleFalliti = revisoriFalliti + escapeFalliti;
  if (totaleFalliti > 0 || testSenzaEsito > 0) {
    const html = `<p>Nelle ultime 24 ore, segnali di osservabilità da controllare:</p>
<ul>
  <li>Escape — proposte finali non lette dal revisore (24h): <strong>${escapeFalliti}</strong></li>
  <li>Workshop — tentativi AI falliti (questa esecuzione del cron): <strong>${revisoriFalliti}</strong></li>
  <li>Test attitudinali — tentativi completati senza nessuna prova in evidence (24h): <strong>${testSenzaEsito}</strong></li>
</ul>
<p>I guasti AI sono chiamate fallite, estrazioni JSON fallite o risposte di forma inattesa. Sui workshop si contano i <strong>tentativi</strong>, non le tappe: una tappa che fallisce viene ritentata fino a ${MAX_TENTATIVI_REVISIONE} giri di cron, quindi lo stesso guasto può comparire per più giorni di fila — è persistenza, non moltiplicazione. Le «revisioni non riuscite» dei workshop si trovano con:</p>
<pre>select iscrizione_id, fase_id, tentativi_revisione, revisione_esito
from public.workshop_fasi_stato
where revisione_esito is not null and revisione_esito &lt;&gt; 'riuscita';</pre>
<p>I «test senza esito» sono tentativi finiti a cui lo scoring non ha prodotto righe: raro e spesso legittimo, ma se il numero cresce va guardato — potrebbe essere uno scoring che torna vuoto per un bug.</p>
<p>Per i dettagli Escape, interroga la vista <code>revisore_esiti</code>:</p>
<pre>select * from public.revisore_esiti
where revisore_esito = 'non_riuscito'
  and aggiornato_il &gt; now() - interval '24 hours';</pre>
<p>Per i workshop, cerca in questa esecuzione del cron le righe di log <code>Errore generazione revisione/feedback ... motivo=...</code>.</p>`;
    const esitoMail = await inviaEmail(EMAIL_ADMIN, `KIREO — osservabilità (24h): ${totaleFalliti} revisori, ${testSenzaEsito} test senza esito`, html, "Mario");
    if (!esitoMail.ok) console.error(`Alert osservabilità — invio email fallito: ${esitoMail.motivo}`);
  }

  return NextResponse.json({ processate, saltate, errori, revisoriFalliti, escapeFalliti, testSenzaEsito });
}
