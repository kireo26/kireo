import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { MODELLO_CLIENTE_WORKSHOP } from "@/lib/workshop/config";
import { WORKSHOP_ELABORATO, WORKSHOP_TUTOR_CONTESTO } from "@/lib/workshop/elaborato-config";

export const runtime = "nodejs";

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

type FeedbackFinale = {
  punti_forza: string[];
  aree_miglioramento: string[];
  domanda_stimolante: string;
};

// Consegna finale dell'elaborato online (Workshop 2.0): legge il
// contenuto già salvato in DB (mai quello del client — sempre l'ultimo
// autosave confermato), genera un feedback finale con Anthropic e scrive
// l'esito tramite la funzione SECURITY DEFINER consegna_progetto_workshop
// (l'unica autorizzata a scrivere stato/feedback_ai/consegnato_at — la
// RLS blocca qualunque scrittura diretta di questi campi da parte dello
// studente). Se l'AI fallisce, la consegna resta comunque valida con
// feedback nullo — stessa filosofia già in uso per workshop_consegne.
export async function POST(request: NextRequest) {
  let body: { iscrizioneId?: unknown; workshopSlug?: unknown; ruoloSlug?: unknown };
  try {
    body = await request.json();
  } catch {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const { iscrizioneId, workshopSlug, ruoloSlug } = body;
  if (typeof iscrizioneId !== "string" || typeof workshopSlug !== "string" || typeof ruoloSlug !== "string") {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const elaboratoConfig = WORKSHOP_ELABORATO[workshopSlug]?.[ruoloSlug];
  if (!elaboratoConfig) {
    return erroreDiCortesia("Questo progetto non è ancora configurato.", 404);
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
    .select("id, workshop(slug, titolo), workshop_ruoli(slug, titolo)")
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

  const { data: elaborato } = await supabase
    .from("workshop_elaborati")
    .select("contenuto")
    .eq("iscrizione_id", iscrizioneId)
    .maybeSingle();

  const contenuto = (elaborato?.contenuto ?? {}) as Record<string, unknown>;
  if (Object.keys(contenuto).length === 0) {
    return erroreDiCortesia("Compila almeno una sezione prima di consegnare il progetto.", 400);
  }

  let feedback: FeedbackFinale | null = null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const contesto = WORKSHOP_TUTOR_CONTESTO[workshopSlug];
      const systemPrompt = `Sei un mentor esperto in orientamento professionale per studenti delle scuole superiori italiane (16-19 anni). Stai valutando l'elaborato finale del ruolo "${ruoloIscritto?.titolo ?? ruoloSlug}" nel workshop "${workshopIscritto?.titolo ?? workshopSlug}"${contesto ? `, per un cliente con questi vincoli: ${contesto.vincoli}` : ""}. Ti viene fornito il contenuto delle sezioni compilate dallo studente in formato JSON. Fornisci un feedback strutturato, incoraggiante ma onesto, sul lavoro nel suo insieme. Tono diretto, caldo, mai paternalistico, mai una promessa di risultato garantito. Rispondi SOLO con JSON valido in questo formato, senza altro testo:
{"punti_forza": ["...", "...", "..."], "aree_miglioramento": ["...", "..."], "domanda_stimolante": "..."}`;

      const client = new Anthropic({ apiKey });
      const risposta = await client.messages.create({
        model: MODELLO_CLIENTE_WORKSHOP,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: `Contenuto dell'elaborato:\n\n${JSON.stringify(contenuto, null, 2)}` }],
      });

      const testo = risposta.content[0]?.type === "text" ? risposta.content[0].text : "{}";
      const parsed = JSON.parse(testo.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsed.punti_forza) && Array.isArray(parsed.aree_miglioramento) && typeof parsed.domanda_stimolante === "string") {
        feedback = parsed;
      }
    } catch (errore) {
      if (errore instanceof Anthropic.APIError) {
        console.error(`Errore API Anthropic (feedback finale workshop): status=${errore.status} type=${errore.type ?? "sconosciuto"} messaggio=${errore.message}`);
      } else {
        console.error("Errore analisi AI elaborato finale workshop:", errore);
      }
    }
  }

  const { error: erroreConsegna } = await supabase.rpc("consegna_progetto_workshop", {
    p_iscrizione_id: iscrizioneId,
    p_feedback: feedback,
  });
  if (erroreConsegna) {
    console.error("Errore nella consegna del progetto workshop:", erroreConsegna);
    return erroreDiCortesia("Non è stato possibile registrare la consegna. Riprova.", 500);
  }

  return NextResponse.json({ feedback });
}
