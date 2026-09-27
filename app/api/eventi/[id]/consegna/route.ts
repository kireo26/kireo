import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { giudicaConsegna, MAX_CARATTERI_CONSEGNA, MIN_CARATTERI_CONSEGNA } from "@/lib/eventi/consegna";
import { statoPortaConsegna, testoPorta } from "@/lib/eventi/portaConsegna";
import { segnalaGuasto } from "@/lib/guasti/registra";

// La risposta alla domanda posta in diretta. Un gesto solo per chi scrive, due
// scritture distinte sotto, e l'ORDINE È LA PROPRIETÀ:
//   1. il TESTO si salva (session client → la policy di insert su
//      consegne_evento chiama puo_consegnare_evento: è quella la porta, non
//      niente di quello che si legge qui);
//   2. poi si giudica e si scrivono le prove.
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

  // ── 2. il giudizio
  const chiave = process.env.ANTHROPIC_API_KEY;
  const { data: profilo } = await supabase.from("profiles").select("di_prova").eq("id", user.id).maybeSingle();
  const diProva = profilo?.di_prova === true;

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
    return NextResponse.json({ ok: false, messaggio: MESSAGGIO_GUASTO }, { status: 500 });
  }

  // ── 3. le prove
  const { error: erroreProve } = await supabase.rpc("registra_evidenze_consegna_evento", {
    p_evento_id: id,
    p_evidenze: esito.prove,
  });
  if (erroreProve) {
    await segnalaGuasto(
      { processo: "eventi/consegna", specie: "scrittura_consegna_evento", motivo: "registra_evidenze", dettaglio: erroreProve, diProva },
      "Consegna evento — le prove non si sono salvate",
    );
    return NextResponse.json({ ok: false, messaggio: MESSAGGIO_GUASTO }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    credito: true,
    // NON «lo trovi fra le aree della tua home»: una consegna pesa ~1,0, cioè
    // confidence ~0,10, e la barra per entrare in classifica è 0,40. Chi ci
    // andasse a guardare non troverebbe niente, e la conclusione non sarebbe
    // «serve altro»: sarebbe che il prodotto dice cose a caso. Questo testo dice
    // il vero in tutti e due i versi — è entrata, e non si vedrà ancora.
    messaggio:
      "Risposta consegnata, ed è entrata nel tuo profilo. Una risposta sola non basta a dire qualcosa su di te — ma è la prima cosa che hai scritto su quest'area, e le altre si sommano a questa.",
  });
}
