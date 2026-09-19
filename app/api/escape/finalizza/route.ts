import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { accessoreDaMappa, getMissione, mandatoScelto } from "@/lib/escape/config";
import { calcolaEvidenze } from "@/lib/escape/scoring";
import type { Payload, PayloadAlloca, PayloadLavori } from "@/lib/escape/tipi";
import { segnalaGuasto } from "@/lib/guasti/registra";

export const runtime = "nodejs";

// Il nome con cui questo processo si presenta nella tabella dei guasti.
const PROCESSO = "escape/finalizza";

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

// Finalizza una missione Escape: legge le risposte AUTOREVOLI dal DB (mai
// quelle inviate dal client), calcola le prove (step strutturati deterministici
// + step aperti via Haiku), le persiste e aggrega il profilo tramite
// registra_evidence (SECURITY DEFINER), poi salva diario e portfolio. Usa la
// sessione dello studente (nessun service-role): la funzione RPC verifica
// l'ownership via auth.uid().
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erroreDiCortesia("Devi accedere con il tuo profilo studente.", 401);

  let body: { attemptId?: string };
  try {
    body = await request.json();
  } catch {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }
  if (!body.attemptId) return erroreDiCortesia("Tentativo mancante.", 400);

  // attempt del chiamante
  const { data: attempt } = await supabase
    .from("mission_attempt")
    .select("id, mission_slug, stato")
    .eq("id", body.attemptId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!attempt) return erroreDiCortesia("Tentativo non trovato.", 404);

  // risposte autorevoli dal DB
  const { data: righe } = await supabase
    .from("step_response")
    .select("step_id, payload")
    .eq("attempt_id", attempt.id);

  const risposte = new Map<string, Payload>();
  for (const r of righe ?? []) risposte.set(r.step_id, r.payload as Payload);

  // missione RISOLTA dalle risposte (mandato + materiali letti): così il motore
  // di scoring vede gli stessi dossier/voci che lo studente ha effettivamente
  // avuto davanti.
  const get = accessoreDaMappa(risposte);
  const mission = getMissione(attempt.mission_slug, get);
  if (!mission) return erroreDiCortesia("Missione non trovata.", 404);

  // motore di scoring (AI solo se la chiave è configurata; altrimenti solo
  // prove strutturate, la missione si completa comunque)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
  // Fix E: senza chiave, gli step aperti (proposta, riflessione, «non
  // approfondire») vengono SALTATI in silenzio — nessuna prova di Bravura dalla
  // proposta, per esempio. Prima non lo sapeva nessuno; ora resta traccia con
  // studente/missione/causa. (Il caso in cui la chiave c'è ma la chiamata FALLISCE
  // è già loggato in chiamaHaikuJson.) È un guasto di configurazione, non dello
  // studente: la missione si completa comunque, con le sole prove strutturate.
  // Serve a separare il contatore della guardia sulla lingua (vedi chiamaJson)
  // e le righe di `guasti`: non cambia niente di quello che lo studente riceve.
  // Se la lettura fallisce si conta come produzione, che è il comportamento
  // giusto per chi non sa. Sta QUI sopra, e non più sotto la chiamata al
  // motore, perché anche il guasto di configurazione deve sapere se sta
  // parlando del robot del banco o di uno studente vero.
  const { data: profiloChiamante } = await supabase.from("profiles").select("di_prova").eq("id", user.id).maybeSingle();
  const diProva = profiloChiamante?.di_prova === true;

  if (!anthropic) {
    await segnalaGuasto(
      { processo: PROCESSO, specie: "prove_missione", motivo: "ANTHROPIC_API_KEY assente", diProva },
      `Escape Fix E — ANTHROPIC_API_KEY assente: prove aperte NON calcolate. studente=${user.id} missione=${attempt.mission_slug} attempt=${attempt.id}`,
    );
  }
  const { evidenze, revisoreEsito } = await calcolaEvidenze(mission, risposte, anthropic, diProva);

  // UNA MISSIONE CHE NON HA PRODOTTO NIENTE NON SI COMPLETA — e qui, a
  // differenza dei test, NESSUN RITENTATIVO AUTOMATICO. È la differenza fra le
  // due che si dimentica per prima: rifinalizzare un test non costa niente
  // (lo scoring è deterministico), rifinalizzare una missione costa fino a tre
  // chiamate AI, perché gli step aperti vengono ricalcolati da capo. Quindi il
  // tentativo resta aperto e a riaprirlo dev'essere una persona: non il
  // client, non un cron, non un testo che dice «riprova fra poco».
  //
  // Per questo il messaggio qui sotto NON invita a riprovare, e quella scelta
  // di testo è parte della regola, non una rifinitura. La guardia gemella in
  // `registra_evidence` (20260919140000) tiene comunque l'invariante per
  // qualunque chiamante; questo ramo esiste perché il guasto abbia un nome e
  // perché lo studente legga una frase onesta invece di un errore di sistema.
  //
  // LE CHIAMATE SONO GIÀ STATE PAGATE quando arriviamo qui: la riga in
  // `guasti` serve anche a dire che sono state spese per niente.
  if (evidenze.length === 0) {
    await segnalaGuasto(
      {
        processo: PROCESSO,
        specie: "esito_missione",
        motivo: "nessuna prova",
        dettaglio: `missione=${attempt.mission_slug} attempt=${attempt.id} passi=${righe?.length ?? 0} revisore=${revisoreEsito ?? "—"}`,
        diProva,
      },
      `Errore escape/finalizza — nessuna prova: la missione NON viene completata. studente=${user.id} missione=${attempt.mission_slug} attempt=${attempt.id}`,
    );
    // LA CLAUSOLA «è un problema nostro, non un giudizio» non è un
    // addolcimento: è quello che il prodotto dice GIÀ nella stessa situazione
    // sul feedback finale dei workshop (components/workshop/elaborato/
    // ElaboratoEditor.tsx) e sulla revisione di una tappa. Due posti che
    // affrontano lo stesso caso e dicono cose diverse sono la malattia di
    // casa; qui la frase è la stessa, adattata solo dove il contesto lo
    // impone — «quello che hai fatto» invece di «il tuo lavoro», perché una
    // partita non è un elaborato.
    return erroreDiCortesia(
      "Non siamo riusciti a ricavare niente da questa partita: è un problema nostro, non un giudizio su quello che hai fatto. Il tentativo resta aperto — lo abbiamo segnalato, e ci guardiamo noi.",
      500,
    );
  }

  // persiste prove + aggrega profilo (idempotente)
  const { error: erroreRpc } = await supabase.rpc("registra_evidence", {
    p_attempt_id: attempt.id,
    p_evidenze: evidenze,
  });
  if (erroreRpc) {
    // Qui la missione è finita e il profilo NON si è aggiornato: è la classe
    // di guasto che si vede solo mesi dopo, quando qualcuno si chiede perché
    // un'area non è mai salita.
    //
    // «RIPROVA» RESTA, ed è deliberato: la regola del ramo qui sopra vieta il
    // ritentativo AUTOMATICO, non quello di una persona. Qui il guasto è
    // transitorio (rete, database), quindi un secondo tentativo può davvero
    // riuscire, e chi lo fa è lo studente.
    //
    // DA FARE QUANDO SI PASSA DI QUI: dopo due tentativi falliti smettere di
    // proporlo. Oggi il messaggio invita a riprovare all'infinito, e ogni giro
    // ricalcola gli step aperti — fino a tre chiamate AI a vuoto. Serve un
    // conteggio dei fallimenti per tentativo, che oggi non esiste da nessuna
    // parte (le righe in `guasti` ci sono, ma non sono pensate per essere
    // lette dalla route mentre risponde).
    await segnalaGuasto(
      { processo: PROCESSO, specie: "esito_missione", motivo: "registra_evidence", dettaglio: erroreRpc, diProva },
      "Escape — errore registra_evidence:",
    );
    return erroreDiCortesia("Non è stato possibile salvare l'esito della missione. Riprova.", 500);
  }

  // Esito del revisore della proposta finale, nei tre stati (o null se lo
  // studente non ha scritto la proposta). Persistito sul tentativo: così il
  // display distingue «letta ma parlava di altre aree» / «letta, nessuna area
  // riconosciuta» / «non siamo riusciti a leggerla» invece di indovinare dal
  // conteggio delle prove, e i 'non_riuscito' (guasti nostri) restano
  // interrogabili (vista revisore_esiti) invece di sparire nei log. Scrittura
  // best-effort: un errore qui non deve far fallire una missione già salvata.
  const { error: erroreEsito } = await supabase.from("mission_attempt").update({ revisore_esito: revisoreEsito }).eq("id", attempt.id);
  if (erroreEsito)
    await segnalaGuasto(
      { processo: PROCESSO, specie: "esito_missione", motivo: "revisore_esito", dettaglio: erroreEsito, diProva },
      "Escape — errore scrittura revisore_esito:",
    );

  // diario (dalla riflessione) + portfolio (dalla proposta) — idempotenti:
  // cancella eventuali righe di un finalize precedente per questo attempt.
  const testoDi = (stepId: string) => {
    const p = risposte.get(stepId) as { testo?: string } | undefined;
    return p?.testo?.trim() ?? "";
  };
  const riflessione = testoDi("s5_riflessione");
  const proposta = testoDi("s4_proposta");

  await supabase.from("journal_entry").delete().eq("attempt_id", attempt.id);
  if (riflessione) {
    await supabase.from("journal_entry").insert({ student_id: user.id, attempt_id: attempt.id, testo: riflessione });
  }

  // Portfolio: l'artefatto della missione (mandato + piano + testo), design 5.3.
  // La Stanza 3.1 è un'allocazione (Missioni 01-03) o un piano di lavori
  // (Missione 04): si salva ciò che c'è.
  await supabase.from("portfolio_item").delete().eq("attempt_id", attempt.id);
  if (proposta) {
    const mandato = mandatoScelto(get);
    const s3 = risposte.get("s3_budget") as (PayloadAlloca & PayloadLavori) | undefined;
    await supabase.from("portfolio_item").insert({
      student_id: user.id,
      attempt_id: attempt.id,
      titolo: `La mia proposta — ${mission.titolo}`,
      contenuto: { mandato: mandato?.label ?? null, allocazione: s3?.allocazioni ?? {}, piano: s3?.selezionati ?? undefined, testo: proposta },
    });
  }

  return NextResponse.json({ ok: true });
}
