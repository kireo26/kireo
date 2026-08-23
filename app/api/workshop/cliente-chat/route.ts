import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  MODELLO_CLIENTE_WORKSHOP,
  MAX_CARATTERI_MESSAGGIO_WORKSHOP,
  WORKSHOP_CLIENTE_PROMPTS,
  chiusuraCliente,
  REGOLE_CONVERSAZIONE_CLIENTE,
} from "@/lib/workshop/config";
import { getStatoChatTappa } from "@/lib/workshop/chatTappa";

export const runtime = "nodejs";

const FALLBACK_RISPOSTA_CLIENTE = "Scusa, mi si è accavallato un pensiero. Ripeti?";

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
    .select("id, workshop_id, ruolo_id")
    .eq("id", iscrizioneId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (!iscrizione) {
    return erroreDiCortesia("Iscrizione non trovata.", 403);
  }

  const { data: workshop } = await supabase.from("workshop").select("slug").eq("id", iscrizione.workshop_id).maybeSingle();
  const workshopSlug = workshop?.slug;
  const promptBase = workshopSlug ? WORKSHOP_CLIENTE_PROMPTS[workshopSlug] : undefined;
  if (!workshopSlug || !promptBase) {
    return erroreDiCortesia("Workshop non configurato.", 404);
  }

  // Tetto per tappa. Contato PRIMA di scrivere: al tetto non si registra nulla
  // e non si paga nessuna chiamata AI.
  const { data: ruoloRiga } = await supabase
    .from("workshop_ruoli")
    .select("slug")
    .eq("id", iscrizione.ruolo_id)
    .maybeSingle();
  const stato = await getStatoChatTappa(supabase, iscrizioneId, workshopSlug, ruoloRiga?.slug ?? "");

  if (stato.chiusa) {
    return erroreDiCortesia(
      `Per questa tappa hai già parlato abbastanza con il cliente. Torna al progetto e consegna la tappa.`,
      429,
    );
  }

  // CHIUSURA DETERMINISTICA. Il messaggio che raggiunge il MINIMO della tappa
  // riceve una risposta vera del cliente (l'ultima cosa scritta dallo studente
  // la merita) e SUBITO SOTTO la battuta di chiusura scritta da noi. Chiudere
  // era una regola del prompt: non funzionava — provata dal vivo, il cliente
  // continuava a fare domande oltre il minimo. Ciò che possiamo imporre nel
  // codice non si chiede a un modello.
  const raggiungeMinimo = stato.minimo > 0 && stato.inviati + 1 >= stato.minimo;
  // Il tetto resta la rete per i casi senza minimo (nessuna tappa aperta): lì
  // la chiusura arriva senza risposta AI, come prima.
  const raggiungeTetto = stato.inviati + 1 >= stato.tetto;

  const systemPrompt = promptBase + REGOLE_CONVERSAZIONE_CLIENTE;

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

  // Tetto raggiunto senza minimo (nessuna tappa aperta): la chiusura è la
  // nostra, non dell'AI. Registrata comunque come turno "cliente" per non
  // lasciare due "user" consecutivi nella history.
  if (raggiungeTetto && !raggiungeMinimo) {
    const chiusura = chiusuraCliente(workshopSlug);
    const { error: erroreChiusura } = await supabase.rpc("invia_risposta_cliente_workshop", {
      p_iscrizione_id: iscrizioneId,
      p_contenuto: chiusura,
    });
    if (erroreChiusura) console.error("Errore nel salvataggio della chiusura del cliente:", erroreChiusura);
    return NextResponse.json({ risposta: chiusura, chiusa: true });
  }

  const { data: storico } = await supabase
    .from("workshop_chat_cliente")
    .select("mittente, contenuto")
    .eq("iscrizione_id", iscrizioneId)
    .order("created_at", { ascending: true });

  // La chiusura deterministica aggiunge un SECONDO turno "cliente" di fila
  // (risposta vera + battuta di chiusura). La history però si rilegge tutta a
  // ogni turno, anche quella delle tappe già chiuse: due "assistant"
  // consecutivi arriverebbero all'API, che vuole ruoli alternati e risponde
  // 400 — lo stesso guasto già pagato con i due "user" consecutivi. Qui si
  // fondono in un turno solo prima di spedire.
  const messaggiAPI: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of storico ?? []) {
    const role = (m.mittente === "studente" ? "user" : "assistant") as "user" | "assistant";
    const ultimo = messaggiAPI[messaggiAPI.length - 1];
    if (ultimo && ultimo.role === role) ultimo.content += `\n\n${m.contenuto}`;
    else messaggiAPI.push({ role, content: m.contenuto });
  }

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
    const testoFinale = testoRisposta || FALLBACK_RISPOSTA_CLIENTE;

    const { error: erroreRisposta } = await supabase.rpc("invia_risposta_cliente_workshop", {
      p_iscrizione_id: iscrizioneId,
      p_contenuto: testoFinale,
    });
    if (erroreRisposta) {
      console.error("Errore nel salvataggio della risposta del cliente:", erroreRisposta);
    }

    // Raggiunto il minimo: subito sotto la risposta vera, la battuta di
    // chiusura del personaggio. Testo nostro, nessuna chiamata AI, sempre in
    // carattere — ed è il codice a garantirla, non il prompt a chiederla.
    if (raggiungeMinimo) {
      const chiusura = chiusuraCliente(workshopSlug);
      const { error: erroreChiusura } = await supabase.rpc("invia_risposta_cliente_workshop", {
        p_iscrizione_id: iscrizioneId,
        p_contenuto: chiusura,
      });
      if (erroreChiusura) console.error("Errore nel salvataggio della chiusura del cliente:", erroreChiusura);
      return NextResponse.json({ risposta: testoFinale, chiusura, chiusa: true });
    }

    return NextResponse.json({ risposta: testoFinale, chiusa: false });
  } catch (errore) {
    // Log dettagliato per Vercel: con un APIError di Anthropic (modello
    // inesistente, chiave non valida, rate limit...) status/type/message
    // dicono esattamente cosa è successo, invece del solo oggetto generico.
    if (errore instanceof Anthropic.APIError) {
      console.error(
        `Errore API Anthropic (chat cliente workshop): status=${errore.status} type=${errore.type ?? "sconosciuto"} messaggio=${errore.message}`,
      );
    } else {
      console.error("Errore chiamata Anthropic (chat cliente workshop):", errore);
    }

    // Anche in caso di errore, registra un turno "cliente" (di cortesia):
    // senza questo, la history letta alla chiamata successiva avrebbe due
    // messaggi "user" consecutivi (il messaggio appena inviato + quello
    // dopo) — l'API Anthropic richiede ruoli sempre alternati e rifiuta
    // quella richiesta con un 400, un guasto che altrimenti non si ripara
    // mai da solo dopo il primo fallimento.
    const { error: erroreFallback } = await supabase.rpc("invia_risposta_cliente_workshop", {
      p_iscrizione_id: iscrizioneId,
      p_contenuto: FALLBACK_RISPOSTA_CLIENTE,
    });
    if (erroreFallback) {
      console.error("Errore nel salvataggio della risposta di fallback:", erroreFallback);
    }

    return erroreDiCortesia("Il cliente non è disponibile in questo momento. Riprova più tardi.", 503);
  }
}
