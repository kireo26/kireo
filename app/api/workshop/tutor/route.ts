import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { MODELLO_CLIENTE_WORKSHOP, MAX_CARATTERI_MESSAGGIO_WORKSHOP } from "@/lib/workshop/config";
import { WORKSHOP_ELABORATO, WORKSHOP_TUTOR_CONTESTO } from "@/lib/workshop/elaborato-config";
import { buildTutorSystemPrompt } from "@/lib/workshop/tutorPrompt";

export const runtime = "nodejs";

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

type Body = {
  iscrizioneId?: unknown;
  workshopSlug?: unknown;
  ruoloSlug?: unknown;
  faseId?: unknown;
  sezioneId?: unknown;
  modo?: unknown;
  testoCorrente?: unknown;
};

// AI-tutor per l'elaborato online (Workshop 2.0): "aiuto" prima di
// iniziare una sezione, "revisione" su un testo già scritto. Riusa
// l'API Anthropic come le altre route workshop — chiave lato server,
// nessuno storico salvato (il tutor non ha memoria fra una richiesta e
// l'altra, coerente col compito).
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const { iscrizioneId, workshopSlug, ruoloSlug, faseId, sezioneId, modo, testoCorrente } = body;

  if (
    typeof iscrizioneId !== "string" ||
    typeof workshopSlug !== "string" ||
    typeof ruoloSlug !== "string" ||
    typeof faseId !== "string" ||
    typeof sezioneId !== "string" ||
    (modo !== "aiuto" && modo !== "revisione") ||
    (testoCorrente !== undefined && typeof testoCorrente !== "string")
  ) {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const testo = typeof testoCorrente === "string" ? testoCorrente.slice(0, MAX_CARATTERI_MESSAGGIO_WORKSHOP) : "";

  if (modo === "revisione" && !testo.trim()) {
    return erroreDiCortesia("Scrivi qualcosa nella sezione prima di chiedere una revisione.", 400);
  }

  const fase = WORKSHOP_ELABORATO[workshopSlug]?.[ruoloSlug]?.fasi.find((f) => f.id === faseId);
  const sezione = fase?.sezioni.find((s) => s.id === sezioneId);
  if (!fase || !sezione) {
    return erroreDiCortesia("Questa sezione non è ancora configurata.", 404);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return erroreDiCortesia("Devi accedere con il tuo profilo studente.", 401);
  }

  const { data: iscrizione } = await supabase
    .from("workshop_iscrizioni")
    .select("id, workshop_id, ruolo_id, workshop(slug), workshop_ruoli(slug, titolo)")
    .eq("id", iscrizioneId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (!iscrizione) {
    return erroreDiCortesia("Iscrizione non trovata.", 403);
  }

  const workshopIscritto = Array.isArray(iscrizione.workshop) ? iscrizione.workshop[0] : iscrizione.workshop;
  const ruoloIscritto = Array.isArray(iscrizione.workshop_ruoli) ? iscrizione.workshop_ruoli[0] : iscrizione.workshop_ruoli;
  if (workshopIscritto?.slug !== workshopSlug || ruoloIscritto?.slug !== ruoloSlug) {
    return erroreDiCortesia("Iscrizione non coerente con questo workshop.", 403);
  }

  // Registra la richiesta PRIMA di chiamare Anthropic: il trigger DB
  // applica il tetto giornaliero (vincolo reale, chiude anche la finestra
  // di corsa fra due richieste quasi simultanee) — se il tetto è già
  // raggiunto non paghiamo per una chiamata che scarteremmo comunque.
  const { error: erroreLog } = await supabase
    .from("workshop_tutor_log")
    .insert({ iscrizione_id: iscrizioneId, sezione_id: sezioneId, modo });
  if (erroreLog) {
    if (erroreLog.message?.includes("troppe_richieste_tutor_oggi")) {
      return erroreDiCortesia("Hai raggiunto il numero massimo di richieste al tutor per oggi. Riprova domani!", 429);
    }
    return erroreDiCortesia("Non è stato possibile contattare il tutor. Riprova.", 500);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY non configurata: impossibile contattare il tutor AI.");
    return erroreDiCortesia("Il tutor non è disponibile in questo momento. Riprova più tardi.", 503);
  }

  const contesto = WORKSHOP_TUTOR_CONTESTO[workshopSlug] ?? {
    cliente: "il cliente di questo progetto",
    vincoli: "i vincoli descritti nel kit materiali",
  };

  const systemPrompt = buildTutorSystemPrompt({
    workshopTitolo: workshopSlug,
    ruoloTitolo: ruoloIscritto?.titolo ?? ruoloSlug,
    sezioneTitolo: sezione.titolo,
    cliente: contesto.cliente,
    vincoli: contesto.vincoli,
    modo,
  });

  const messaggioUtente =
    modo === "revisione"
      ? `Ecco cosa ho scritto finora per questa sezione ("${sezione.titolo}"):\n\n${testo}\n\nDammi una revisione.`
      : `Devo lavorare a questa sezione: "${sezione.titolo}". La consegna è: ${sezione.prompt}${sezione.hint ? `\nSuggerimento: ${sezione.hint}` : ""}${testo.trim() ? `\n\nHo già scritto qualcosa: ${testo}` : ""}\n\nAiutami a iniziare.`;

  try {
    const client = new Anthropic({ apiKey });
    const risposta = await client.messages.create({
      model: MODELLO_CLIENTE_WORKSHOP,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: messaggioUtente }],
    });

    const testoRisposta = risposta.content[0]?.type === "text" ? risposta.content[0].text : "";
    return NextResponse.json({ risposta: testoRisposta || "Non sono riuscito a rispondere. Riprova tra qualche istante." });
  } catch (errore) {
    if (errore instanceof Anthropic.APIError) {
      console.error(`Errore API Anthropic (tutor workshop): status=${errore.status} type=${errore.type ?? "sconosciuto"} messaggio=${errore.message}`);
    } else {
      console.error("Errore chiamata Anthropic (tutor workshop):", errore);
    }
    return erroreDiCortesia("Il tutor non è disponibile in questo momento. Riprova più tardi.", 503);
  }
}
