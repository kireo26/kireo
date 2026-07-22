import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { buildSystemPrompt } from "@/lib/assistente/prompt";
import { isAreaAttiva, MODELLO_ASSISTENTE, MAX_MESSAGGI_CONVERSAZIONE, MAX_CARATTERI_MESSAGGIO } from "@/lib/assistente/config";

export const runtime = "nodejs";

type MessaggioInput = { role: "user" | "assistant"; content: string };

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

// Route server-side per l'assistente digitale: la chiave Anthropic non
// lascia mai il server (letta da process.env, mai esposta al client). Le
// conversazioni non si salvano da nessuna parte qui — la history arriva
// dal client ad ogni richiesta (vive solo nella sessione del browser) e
// non viene mai scritta su tabella: solo activity_log (chat_assistente,
// nessun contenuto) e il contatore assistente_conversazioni (solo
// student_id/area_slug/data, mai il testo) toccano il database.
export async function POST(request: NextRequest) {
  let body: { areaSlug?: unknown; messages?: unknown; nuovaConversazione?: unknown };
  try {
    body = await request.json();
  } catch {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const areaSlug = body.areaSlug;
  const messages = body.messages;
  const nuovaConversazione = body.nuovaConversazione === true;

  if (typeof areaSlug !== "string" || !Array.isArray(messages)) {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const area = getAreaBySlug(areaSlug);
  if (!area || !isAreaAttiva(areaSlug)) {
    return erroreDiCortesia("L'assistente digitale di quest'area non è ancora attivo.", 400);
  }

  // Solo studenti autenticati: nessuna eccezione, un profilo mancante o un
  // ruolo diverso da "studente" viene sempre respinto (guardia NULL-safe:
  // profilo?.ruolo !== "studente" blocca correttamente anche quando il
  // profilo non esiste ancora, invece di lasciar passare un caso limite).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return erroreDiCortesia("Devi accedere con il tuo profilo studente per parlare con l'assistente digitale.", 401);
  }

  const { data: profilo } = await supabase.from("profiles").select("ruolo").eq("id", user.id).maybeSingle();
  if (profilo?.ruolo !== "studente") {
    return erroreDiCortesia("L'assistente digitale è disponibile solo per il profilo studente.", 403);
  }

  const messaggi = messages as MessaggioInput[];
  if (messaggi.length === 0 || messaggi.length > MAX_MESSAGGI_CONVERSAZIONE) {
    return erroreDiCortesia(
      "Hai raggiunto il numero massimo di messaggi per questa conversazione. Puoi iniziare una nuova conversazione.",
      400,
    );
  }
  for (const m of messaggi) {
    if (
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string" ||
      !m.content.trim() ||
      m.content.length > MAX_CARATTERI_MESSAGGIO
    ) {
      return erroreDiCortesia("Richiesta non valida.", 400);
    }
  }
  if (messaggi[messaggi.length - 1].role !== "user") {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  // Limite di 3 conversazioni/giorno: solo all'avvio di una nuova
  // conversazione (il client lo segnala quando la history locale era
  // vuota). Il conteggio vero è nel trigger DB (vincolo reale, non solo
  // applicativo — chiude anche la finestra di corsa tra due richieste
  // quasi simultanee): qui ci si limita a intercettare il suo errore e
  // restituire un messaggio gentile invece del messaggio tecnico grezzo.
  if (nuovaConversazione) {
    const { error: erroreConversazione } = await supabase
      .from("assistente_conversazioni")
      .insert({ student_id: user.id, area_slug: areaSlug });
    if (erroreConversazione) {
      if (erroreConversazione.message?.includes("troppe_conversazioni_oggi")) {
        return erroreDiCortesia(
          "Hai raggiunto il numero massimo di conversazioni con l'assistente digitale per oggi. Riprova domani!",
          429,
        );
      }
      return erroreDiCortesia("Non è stato possibile avviare una nuova conversazione. Riprova più tardi.", 500);
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY non configurata: impossibile contattare l'assistente digitale.");
    return erroreDiCortesia("L'assistente digitale non è disponibile in questo momento. Riprova più tardi.", 503);
  }

  // Prima interazione della giornata: riusa il cap DB esistente di
  // activity_log (1 riga/giorno per studente+area+tipo) — nessun contenuto
  // salvato, solo il segnale che oggi c'è stata un'interazione con
  // l'assistente in quest'area. Le chiamate successive lo stesso giorno
  // violano l'indice unico (23505): da ignorare in silenzio, non un errore.
  await supabase
    .from("activity_log")
    .insert({ student_id: user.id, area_slug: areaSlug, tipo_attivita: "chat_assistente", peso: 3 });

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(area);

  let anthropicStream;
  try {
    anthropicStream = client.messages.stream({
      model: MODELLO_ASSISTENTE,
      max_tokens: 1024,
      // Il system prompt è fisso per area: prompt caching per non
      // ripagarlo ad ogni messaggio (sotto la soglia minima cacheabile di
      // Haiku 4.5 — 4096 token — finché il prompt resta breve come oggi,
      // il marker non ha ancora effetto ma non costa nulla lasciarlo).
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: messaggi.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (errore) {
    console.error("Errore nell'avvio dello stream Anthropic:", errore);
    return erroreDiCortesia("L'assistente digitale non è disponibile in questo momento. Riprova più tardi.", 503);
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (errore) {
        console.error("Errore durante lo streaming dell'assistente:", errore);
        controller.enqueue(
          encoder.encode("\n\nMi dispiace, qualcosa è andato storto. Riprova tra qualche istante."),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
