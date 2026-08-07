import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { MODELLO_CLIENTE_WORKSHOP, MAX_FILE_SIZE_CONSEGNA, TIPI_FILE_CONSEGNA_CONSENTITI } from "@/lib/workshop/config";

export const runtime = "nodejs";

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

type FeedbackAI = {
  punti_forza: string[];
  aree_miglioramento: string[];
  domanda_stimolante: string;
};

// Upload della consegna su Storage (bucket privato) + analisi automatica
// del file da parte dell'AI. La chiave Anthropic resta lato server; se
// l'analisi fallisce l'upload resta comunque valido (feedback_ai null),
// mai un errore bloccante per un problema del solo feedback.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return erroreDiCortesia("Devi accedere con il tuo profilo studente.", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const iscrizioneId = formData.get("iscrizioneId");
  const ruoloSlug = formData.get("ruoloSlug");
  const workshopTitolo = formData.get("workshopTitolo");

  if (!(file instanceof File) || typeof iscrizioneId !== "string" || typeof ruoloSlug !== "string") {
    return erroreDiCortesia("Dati mancanti.", 400);
  }

  if (file.size > MAX_FILE_SIZE_CONSEGNA) {
    return erroreDiCortesia("File troppo grande (max 10 MB).", 400);
  }
  if (!TIPI_FILE_CONSEGNA_CONSENTITI.includes(file.type)) {
    return erroreDiCortesia("Tipo di file non supportato.", 400);
  }

  const { data: iscrizione } = await supabase
    .from("workshop_iscrizioni")
    .select("id")
    .eq("id", iscrizioneId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!iscrizione) {
    return erroreDiCortesia("Iscrizione non trovata.", 403);
  }

  const estensione = file.name.split(".").pop() ?? "bin";
  const percorso = `${user.id}/${iscrizioneId}/${Date.now()}.${estensione}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: erroreUpload } = await supabase.storage.from("workshop-consegne").upload(percorso, fileBuffer, {
    contentType: file.type,
    upsert: false,
  });
  if (erroreUpload) {
    console.error("Errore upload consegna workshop:", erroreUpload);
    return erroreDiCortesia("Non è stato possibile caricare il file. Riprova.", 500);
  }

  let feedbackAI: FeedbackAI | null = null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const isImmagine = file.type.startsWith("image/");
  const isPDF = file.type === "application/pdf";

  if (apiKey && (isImmagine || isPDF)) {
    try {
      const systemPromptFeedback = `Sei un mentor esperto in orientamento professionale per studenti delle scuole superiori italiane (16-19 anni). Stai analizzando un lavoro prodotto nell'ambito del workshop "${workshopTitolo || "KIREO"}", per il ruolo "${ruoloSlug}". Fornisci un feedback strutturato, incoraggiante ma onesto. Tono diretto, caldo, mai paternalistico, mai una promessa di risultato garantito. Rispondi SOLO con JSON valido in questo formato, senza altro testo:
{"punti_forza": ["...", "...", "..."], "aree_miglioramento": ["...", "..."], "domanda_stimolante": "..."}`;

      const base64 = fileBuffer.toString("base64");
      const contenuto = isImmagine
        ? [
            { type: "image" as const, source: { type: "base64" as const, media_type: file.type as "image/png" | "image/jpeg", data: base64 } },
            { type: "text" as const, text: `Analizza questo lavoro prodotto per il ruolo di ${ruoloSlug}.` },
          ]
        : [
            { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } },
            { type: "text" as const, text: `Analizza questo documento prodotto per il ruolo di ${ruoloSlug}.` },
          ];

      const client = new Anthropic({ apiKey });
      const risposta = await client.messages.create({
        model: MODELLO_CLIENTE_WORKSHOP,
        max_tokens: 600,
        system: systemPromptFeedback,
        messages: [{ role: "user", content: contenuto }],
      });

      const testo = risposta.content[0]?.type === "text" ? risposta.content[0].text : "{}";
      const parsed = JSON.parse(testo.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsed.punti_forza) && Array.isArray(parsed.aree_miglioramento) && typeof parsed.domanda_stimolante === "string") {
        feedbackAI = parsed;
      }
    } catch (errore) {
      console.error("Errore analisi AI consegna workshop:", errore);
    }
  }

  const { data: consegna, error: erroreDb } = await supabase
    .from("workshop_consegne")
    .insert({
      iscrizione_id: iscrizioneId,
      file_nome: file.name,
      file_percorso: percorso,
      file_tipo: file.type,
      file_dimensione: file.size,
      feedback_ai: feedbackAI,
      stato: feedbackAI ? "analizzato" : "caricato",
    })
    .select("id, file_nome, file_tipo, file_dimensione, feedback_ai, stato, created_at")
    .single();

  if (erroreDb) {
    if (erroreDb.message?.includes("troppe_consegne")) {
      return erroreDiCortesia("Hai raggiunto il numero massimo di consegne per questo workshop.", 429);
    }
    return erroreDiCortesia("Il file è stato caricato ma non è stato possibile salvarne i dati. Riprova.", 500);
  }

  const { data: signedUrlData } = await supabase.storage.from("workshop-consegne").createSignedUrl(percorso, 3600);

  return NextResponse.json({ consegna, signedUrl: signedUrlData?.signedUrl ?? null });
}
