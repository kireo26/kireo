import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WORKSHOP_ELABORATO } from "@/lib/workshop/elaborato-config";
import { sezioniIncomplete, type ValoreSezione } from "@/lib/workshop/elaboratoValore";

export const runtime = "nodejs";

function erroreDiCortesia(testo: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ errore: testo, ...extra }, { status });
}

// Consegna di UNA tappa (Workshop 2.0 v2) — non l'intero progetto: quello
// lo chiude automaticamente il cron quando revisiona l'ultima tappa (vedi
// /api/cron/workshop-motore). Le sezioni minime si verificano qui contro
// il contenuto autorevole letto dal DB (mai quello del client): la
// funzione SQL consegna_fase_workshop() verifica invece ciò che è
// realmente tamper-proof (proprietà, stato della tappa, conteggio reale
// dei messaggi in chat) — vedi il commento nella migration per il
// ragionamento su questa divisione.
export async function POST(request: NextRequest) {
  let body: { iscrizioneId?: unknown; workshopSlug?: unknown; ruoloSlug?: unknown; faseId?: unknown };
  try {
    body = await request.json();
  } catch {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const { iscrizioneId, workshopSlug, ruoloSlug, faseId } = body;
  if (typeof iscrizioneId !== "string" || typeof workshopSlug !== "string" || typeof ruoloSlug !== "string" || typeof faseId !== "string") {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const fase = WORKSHOP_ELABORATO[workshopSlug]?.[ruoloSlug]?.fasi.find((f) => f.id === faseId);
  if (!fase) {
    return erroreDiCortesia("Questa tappa non è ancora configurata.", 404);
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
    .select("id, workshop(slug), workshop_ruoli(slug)")
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
  const contenuto = (elaborato?.contenuto ?? {}) as Record<string, ValoreSezione>;

  const incomplete = sezioniIncomplete(fase, contenuto);
  if (incomplete.length > 0) {
    return erroreDiCortesia("Ci sono ancora sezioni da completare prima di consegnare questa tappa.", 400, { sezioniIncomplete: incomplete });
  }

  const { error: erroreConsegna } = await supabase.rpc("consegna_fase_workshop", {
    p_iscrizione_id: iscrizioneId,
    p_fase_id: faseId,
    p_chat_minima: fase.chatMinima,
  });

  if (erroreConsegna) {
    if (erroreConsegna.message?.includes("chat_minima_non_raggiunta")) {
      return erroreDiCortesia(`Parla ancora un po' col cliente prima di consegnare (almeno ${fase.chatMinima} messaggi da parte tua).`, 400);
    }
    if (erroreConsegna.message?.includes("fase_non_aperta")) {
      return erroreDiCortesia("Questa tappa non è (più) aperta.", 400);
    }
    return erroreDiCortesia("Non è stato possibile consegnare la tappa. Riprova.", 500);
  }

  return NextResponse.json({ ok: true });
}
