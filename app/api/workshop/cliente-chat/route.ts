import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { MODELLO_CLIENTE_WORKSHOP, MAX_CARATTERI_MESSAGGIO_WORKSHOP, WORKSHOP_CLIENTE_PROMPTS } from "@/lib/workshop/config";

export const runtime = "nodejs";

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

// La chiave Anthropic non lascia mai il server. Lo storico della
// conversazione si legge dal DB (workshop_chat_cliente), non dal client:
// evita che uno studente possa iniettare una history falsa nella richiesta.
export async function POST(request: NextRequest) {
  let body: { iscrizioneId?: unknown; messaggio?: unknown };
  try {
    body = await request.json();
  } catch {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const iscrizioneId = body.iscrizioneId;
  const messaggio = body.messaggio;
  if (typeof iscrizioneId !== "string" || typeof messaggio !== "string" || !messaggio.trim()) {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }
  if (messaggio.length > MAX_CARATTERI_MESSAGGIO_WORKSHOP) {
    return erroreDiCortesia(`Il messaggio è troppo lungo (max ${MAX_CARATTERI_MESSAGGIO_WORKSHOP} caratteri).`, 400);
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
    .select("id, workshop_id")
    .eq("id", iscrizioneId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (!iscrizione) {
    return erroreDiCortesia("Iscrizione non trovata.", 403);
  }

  const { data: workshop } = await supabase.from("workshop").select("slug").eq("id", iscrizione.workshop_id).maybeSingle();
  const workshopSlug = workshop?.slug;
  const systemPrompt = workshopSlug ? WORKSHOP_CLIENTE_PROMPTS[workshopSlug] : undefined;
  if (!systemPrompt) {
    return erroreDiCortesia("Workshop non configurato.", 404);
  }

  // Registra il messaggio dello studente: la funzione applica il tetto di
  // messaggi per iscrizione (vincolo DB reale, non solo applicativo).
  const { error: erroreInvio } = await supabase.rpc("invia_messaggio_chat_cliente", {
    p_iscrizione_id: iscrizioneId,
    p_contenuto: messaggio.trim(),
  });
  if (erroreInvio) {
    if (erroreInvio.message?.includes("troppi_messaggi_chat_cliente")) {
      return erroreDiCortesia("Hai raggiunto il numero massimo di messaggi con il cliente per questo workshop.", 429);
    }
    return erroreDiCortesia("Non è stato possibile inviare il messaggio. Riprova.", 500);
  }

  const { data: storico } = await supabase
    .from("workshop_chat_cliente")
    .select("mittente, contenuto")
    .eq("iscrizione_id", iscrizioneId)
    .order("created_at", { ascending: true });

  const messaggiAPI = (storico ?? []).map((m) => ({
    role: (m.mittente === "studente" ? "user" : "assistant") as "user" | "assistant",
    content: m.contenuto,
  }));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY non configurata: impossibile contattare il cliente simulato.");
    return erroreDiCortesia("Il cliente non è disponibile in questo momento. Riprova più tardi.", 503);
  }

  try {
    const client = new Anthropic({ apiKey });
    const risposta = await client.messages.create({
      model: MODELLO_CLIENTE_WORKSHOP,
      max_tokens: 300,
      system: systemPrompt,
      messages: messaggiAPI,
    });

    const testoRisposta = risposta.content[0]?.type === "text" ? risposta.content[0].text : "";

    const { error: erroreRisposta } = await supabase.rpc("invia_risposta_cliente_workshop", {
      p_iscrizione_id: iscrizioneId,
      p_contenuto: testoRisposta || "Scusa, mi si è accavallato un pensiero. Ripeti?",
    });
    if (erroreRisposta) {
      console.error("Errore nel salvataggio della risposta del cliente:", erroreRisposta);
    }

    return NextResponse.json({ risposta: testoRisposta });
  } catch (errore) {
    console.error("Errore chiamata Anthropic (chat cliente workshop):", errore);
    return erroreDiCortesia("Il cliente non è disponibile in questo momento. Riprova più tardi.", 503);
  }
}
