import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { giudicaConsegna, MAX_CARATTERI_CONSEGNA, MIN_CARATTERI_CONSEGNA } from "@/lib/eventi/consegna";
import { statoPortaConsegna, testoPorta } from "@/lib/eventi/portaConsegna";
import { MESSAGGIO_TETTO, TETTO_LETTURE_CONSEGNA } from "@/lib/eventi/rilettura";
import { segnalaGuasto } from "@/lib/guasti/registra";

// La risposta alla domanda posta in diretta. Un gesto solo per chi scrive, tre
// scritture distinte sotto, e l'ORDINE È LA PROPRIETÀ:
//   1. il TESTO si salva (session client → la policy di insert su
//      consegne_evento chiama puo_consegnare_evento: è quella la porta, non
//      niente di quello che si legge qui);
//   2. si alza il CONTATORE delle letture, che è quello che limita: prima della
//      chiamata, mai dopo — un tentativo bloccato non deve pagare una chiamata
//      che verrebbe comunque scartata (il pattern di assistente_conversazioni e
//      workshop_tutor_log);
//   3. poi si giudica e si scrivono le prove.
// Se il giudizio fallisce, la consegna resta salvata e `valutata_il` a null: lo
// studente non perde il testo che ha scritto, e un secondo tentativo lo fa una
// PERSONA — rigiudicare costa una chiamata, quindi nessun ritentativo automatico
// (la regola del 19/09; qui il messaggio invita a riprovare, ma è lo studente a
// premere).
//
// Node runtime: l'SDK Anthropic non gira su edge.
export const runtime = "nodejs";

// «Riprova fra un momento» NON è il consiglio giusto qui, e la ragione è
// strutturale: il testo è già salvato, quindi un secondo invio non ripete la
// consegna — cade sul `23505` e fa RILEGGERE quello che c'è. Funziona, ma solo
// finché questa pagina resta aperta: dopo un ricaricamento `statoPortaConsegna`
// risponde `gia_consegnata` e il campo non viene più reso, quindi non c'è più
// niente da premere. Da qui il bottone «Fai rileggere la risposta» sulla pagina
// della diretta (components/live/RileggiConsegna.tsx): è la stessa chiamata, resa
// raggiungibile anche dopo. Il messaggio dice cosa è successo e dove si torna, e
// NON promette che ci ripassiamo noi: nessun secondo passaggio automatico esiste
// (vedi la nota in testa a 20260927150000).
//
// «Puoi farla rileggere da qui» è vero solo sotto il tetto: all'ultima lettura
// consentita questo testo lascia il posto a MESSAGGIO_TETTO, perché un invito a
// premere un bottone che sta sparendo è la specie di casa (una cosa scritta che
// dichiara uno stato diverso da quello vero).
const MESSAGGIO_GUASTO =
  "Abbiamo salvato la tua risposta, ma non siamo riusciti a leggerla adesso. Non è un giudizio su quello che hai scritto: è un problema nostro. Il testo è al sicuro: puoi farla rileggere da qui, o riaprendo questa pagina.";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { testo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, messaggio: "Richiesta non valida." }, { status: 400 });
  }

  const testoInviato = typeof body.testo === "string" ? body.testo.trim() : "";
  if (testoInviato.length < MIN_CARATTERI_CONSEGNA || testoInviato.length > MAX_CARATTERI_CONSEGNA) {
    return NextResponse.json(
      { ok: false, messaggio: `La risposta deve stare fra ${MIN_CARATTERI_CONSEGNA} e ${MAX_CARATTERI_CONSEGNA} caratteri.` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, messaggio: "Sessione scaduta." }, { status: 401 });

  // RLS legge solo eventi approvati: un id di bozza risulta semplicemente assente.
  const { data: evento } = await supabase
    .from("eventi")
    .select("id, titolo, domanda_consegna, data_inizio, data_fine, pubblico")
    .eq("id", id)
    .maybeSingle();
  if (!evento || evento.pubblico !== "studenti" || !evento.domanda_consegna) {
    return NextResponse.json({ ok: false, messaggio: "Questo incontro non ha una domanda finale." }, { status: 404 });
  }

  const { data: righeAree } = await supabase.from("eventi_aree").select("area_slug").eq("evento_id", id);
  const aree = (righeAree ?? []).map((r) => r.area_slug as string);

  // ── 1. il testo, prima di tutto il resto
  let testo = testoInviato;
  const { data: inserita, error: erroreInsert } = await supabase
    .from("consegne_evento")
    .insert({ evento_id: id, student_id: user.id, testo: testoInviato })
    .select("id, testo, valutata_il")
    .single();

  if (erroreInsert) {
    // Già consegnata: non è un errore, è un secondo tentativo dopo un giudizio
    // fallito. Si rilegge il testo AUTOREVOLE (quello salvato, non quello
    // arrivato adesso) e si rigiudica.
    if (erroreInsert.code === "23505") {
      const { data: esistente } = await supabase
        .from("consegne_evento")
        .select("testo, valutata_il")
        .eq("evento_id", id)
        .eq("student_id", user.id)
        .maybeSingle();
      if (!esistente) {
        // Il 23505 dice che la riga c'è e la rilettura non la trova: è la latenza
        // di propagazione già osservata su questo progetto fra una scrittura e la
        // lettura immediata dello stesso dato. Qui non si indovina, si registra.
        await segnalaGuasto(
          { processo: "eventi/consegna", specie: "scrittura_consegna_evento", motivo: "riletta_assente" },
          "Consegna evento — il 23505 dice che la consegna esiste ma la rilettura non la trova",
        );
        return NextResponse.json({ ok: false, messaggio: MESSAGGIO_GUASTO }, { status: 500 });
      }
      if (esistente.valutata_il) {
        return NextResponse.json({ ok: false, messaggio: testoPorta("gia_consegnata") }, { status: 409 });
      }
      testo = esistente.testo;
    } else if (erroreInsert.code === "42501") {
      // La porta ha detto no. Il PERCHÉ si calcola solo qui, nel ramo del
      // rifiuto: un no che non dice quale passo manca manda a cercare.
      const porta = await statoPortaConsegna(supabase, evento, user.id);
      return NextResponse.json({ ok: false, messaggio: porta.testo || testoPorta("non_ho_potuto_controllare") }, { status: 403 });
    } else {
      await segnalaGuasto(
        { processo: "eventi/consegna", specie: "scrittura_consegna_evento", motivo: "insert_consegna", dettaglio: erroreInsert },
        "Consegna evento — insert fallito",
      );
      return NextResponse.json({ ok: false, messaggio: MESSAGGIO_GUASTO }, { status: 500 });
    }
  } else {
    testo = inserita.testo;
  }

  // `di_prova` si legge qui e non più giù: da quando l'esaurimento delle
  // letture registra un guasto, serve già al blocco del tetto — e una misura
  // che non distingue il robot dagli studenti veri è una misura che mente.
  const { data: profilo } = await supabase.from("profiles").select("di_prova").eq("id", user.id).maybeSingle();
  const diProva = profilo?.di_prova === true;

  // ── 2. il tetto, PRIMA della chiamata
  // Un errore qui non fa proseguire: se non sappiamo limitare, non spendiamo.
  // Fallire chiuso su una porta che protegge una spesa è il verso giusto — meglio
  // una lettura che non arriva di una che nessuno conta.
  const { data: letture, error: erroreTetto } = await supabase.rpc("apri_lettura_consegna", { p_evento_id: id });
  if (erroreTetto) {
    if (/troppe_letture/.test(erroreTetto.message ?? "")) {
      // 429 e non 403: il prodotto non sta dicendo che non puoi, sta dicendo che
      // ci ha già provato quanto sa fare. È anche la differenza che legge il
      // banco, dove un 429 è un cancello che morde e un 5xx è un guasto nostro.
      return NextResponse.json({ ok: false, messaggio: MESSAGGIO_TETTO }, { status: 429 });
    }
    await segnalaGuasto(
      { processo: "eventi/consegna", specie: "scrittura_consegna_evento", motivo: "apri_lettura", dettaglio: erroreTetto },
      "Consegna evento — il contatore delle letture non si è alzato: nessuna chiamata è stata fatta",
    );
    return NextResponse.json({ ok: false, messaggio: MESSAGGIO_GUASTO }, { status: 500 });
  }
  // Questa era l'ultima lettura consentita: da qui in avanti il bottone non
  // c'è più, quindi il messaggio di guasto non può invitare a ripremerlo.
  const ultimaLettura = Number(letture) >= TETTO_LETTURE_CONSEGNA;
  const messaggioGuasto = ultimaLettura ? MESSAGGIO_TETTO : MESSAGGIO_GUASTO;

  /**
   * L'ESAURIMENTO SI REGISTRA UNA VOLTA, ED È UN FATTO DIVERSO DAL FALLIMENTO.
   *
   * Ogni tentativo andato male lascia già la sua riga (`prove_consegna_evento`
   * o `scrittura_consegna_evento`): quella dice *cosa* non ha funzionato, ed è
   * rumore normale. Cinque fallimenti di fila sullo stesso testo dicono un'altra
   * cosa — che quella consegna non è più recuperabile da sola, e che uno
   * studente resta con una risposta che nessuno giudicherà. **Lo studente lo sa
   * (glielo dice MESSAGGIO_TETTO); noi no.** E non lo scopriremmo mai
   * aspettando: nessuno scrive a un sito per dire che un bottone non ha
   * funzionato.
   *
   * SI REGISTRA ALLA QUINTA, non alla sesta pressione: il rifiuto
   * `troppe_letture` arriva solo se lo studente riprova ancora, e un allarme
   * che dipende da un gesto in più è un allarme che non suona. Per la stessa
   * ragione non si registra *a ogni* fallimento: una riga per tentativo
   * renderebbe illeggibile proprio la riga che conta.
   */
  const segnalaEsaurimento = async (motivo: string) => {
    if (!ultimaLettura) return;
    await segnalaGuasto(
      { processo: "eventi/consegna", specie: "consegna_esaurita", motivo, dettaglio: { eventoId: id, letture: Number(letture) }, diProva },
      `Consegna evento — letture esaurite (${TETTO_LETTURE_CONSEGNA}) senza riuscire: il testo resta non valutato`,
    );
  };

  // ── 3. il giudizio
  const chiave = process.env.ANTHROPIC_API_KEY;

  const esito = await giudicaConsegna(
    chiave ? new Anthropic({ apiKey: chiave }) : null,
    evento.titolo,
    evento.domanda_consegna,
    aree,
    testo,
    diProva,
  );

  if (!esito.ok) {
    // `senza_credito` è un ESITO del prodotto (la risposta non ha agganciato
    // nessuna area), non un guasto: si dice allo studente e non si registra fra
    // le cose rotte. Gli altri tre sono nostri.
    if (esito.motivo === "senza_credito") {
      // Letta, e non ne è emersa nessuna area. È un esito, non un guasto —
      // quindi la consegna va segnata come LETTA: altrimenti resterebbe
      // `valutata_il` nulla e indistinguibile da una lettura non arrivata, e la
      // pagina continuerebbe a offrire di farla rileggere (una chiamata a
      // pagamento per giro, sempre con la stessa risposta).
      const { error: erroreLetta } = await supabase.rpc("segna_consegna_letta", { p_evento_id: id });
      if (erroreLetta) {
        await segnalaGuasto(
          { processo: "eventi/consegna", specie: "scrittura_consegna_evento", motivo: "segna_letta", dettaglio: erroreLetta, diProva },
          "Consegna evento — non è stato possibile segnare la consegna come letta",
        );
      }
      return NextResponse.json({
        ok: true,
        credito: false,
        messaggio:
          "Abbiamo salvato la tua risposta. Da quello che hai scritto non è emerso abbastanza per dire qualcosa sulle aree di questo incontro — non è un giudizio su di te, è quello che queste righe possono mostrare.",
      });
    }
    await segnalaGuasto(
      { processo: "eventi/consegna", specie: "prove_consegna_evento", motivo: esito.motivo, diProva },
      `Consegna evento — il giudizio non è arrivato (${esito.motivo})`,
    );
    await segnalaEsaurimento(esito.motivo);
    return NextResponse.json({ ok: false, messaggio: messaggioGuasto }, { status: 500 });
  }

  // ── 4. le prove
  const { error: erroreProve } = await supabase.rpc("registra_evidenze_consegna_evento", {
    p_evento_id: id,
    p_evidenze: esito.prove,
  });
  if (erroreProve) {
    await segnalaGuasto(
      { processo: "eventi/consegna", specie: "scrittura_consegna_evento", motivo: "registra_evidenze", dettaglio: erroreProve, diProva },
      "Consegna evento — le prove non si sono salvate",
    );
    await segnalaEsaurimento("registra_evidenze");
    return NextResponse.json({ ok: false, messaggio: messaggioGuasto }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    credito: true,
    // NON «lo trovi fra le aree della tua home»: una consegna pesa ~1,0, cioè
    // confidence ~0,10, e la barra per entrare in classifica è 0,40. Chi ci
    // andasse a guardare non troverebbe niente, e la conclusione non sarebbe
    // «serve altro»: sarebbe che il prodotto dice cose a caso. Questo testo dice
    // il vero in tutti e due i versi — è entrata, e non si vedrà ancora.
    //
    // E non conta niente, né la prima volta né l'area: la versione precedente
    // diceva «è la prima cosa che hai scritto su quest'area», falsa alla seconda
    // consegna sulla stessa area e al singolare su un evento che ne ha due. Qui
    // non c'è nessun numero e nessun singolare, quindi non c'è niente che possa
    // diventare falso: vale alla prima consegna e alla quinta.
    //
    // E NON RIPETE IL TITOLO. A schermo sopra c'è già «Risposta consegnata»
    // (`ConsegnaEvento.tsx`): la versione precedente cominciava con le stesse
    // due parole, e chi leggeva le leggeva due volte. Questa continua il
    // titolo invece di ricominciare — quindi il titolo è parte della frase, e
    // `npm run test:consegna-evento` pretende che resti quello.
    messaggio:
      "Ed è entrata nel tuo profilo. Una risposta sola non basta a dire qualcosa su di te — conta insieme a tutto quello che hai già fatto, e a quello che farai dopo.",
  });
}
