import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTest, SLUG_T3 } from "@/lib/test/config";
import { calcolaEvidenzeTest, calcolaEvidenzeT2, calcolaEvidenzeT3 } from "@/lib/test/scoring";
import { T3_FROZEN_ITEM_ID, type CandidateCongelate } from "@/lib/test/assembla-t3";

export const runtime = "nodejs";

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

// Finalizza un test attitudinale: legge le risposte AUTOREVOLI dal DB (mai
// quelle inviate dal client), calcola le prove (scoring deterministico dal
// config), le persiste e aggrega il profilo tramite registra_evidenze_test
// (SECURITY DEFINER). Usa la sessione dello studente (nessun service-role): la
// funzione RPC verifica l'ownership via auth.uid(). Stesso schema di
// /api/escape/finalizza.
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
    .from("test_attempt")
    .select("id, test_slug, stato")
    .eq("id", body.attemptId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!attempt) return erroreDiCortesia("Tentativo non trovato.", 404);

  // risposte autorevoli dal DB
  const { data: righe } = await supabase.from("test_response").select("item_id, payload").eq("attempt_id", attempt.id);
  const test = getTest(attempt.test_slug);

  // scoring deterministico → prove (gestisce negativi, scelte forzate e assi/aree
  // sotto zero, che semplicemente non generano prove). T1 misura le aree, T2 gli assi.
  let evidenze;
  if (attempt.test_slug === SLUG_T3) {
    // T3: riassembla dagli item congelati (mai rilette da area_signal) + risposte.
    const frozen = (righe ?? []).find((r) => r.item_id === T3_FROZEN_ITEM_ID);
    const congelate = (frozen?.payload as CandidateCongelate | undefined) ?? { candidate: [], asseDominante: null };
    const risposte = new Map<string, { opzioneId?: string }>();
    for (const r of righe ?? []) {
      if (r.item_id === T3_FROZEN_ITEM_ID) continue;
      risposte.set(r.item_id, (r.payload as { opzioneId?: string }) ?? {});
    }
    evidenze = calcolaEvidenzeT3(congelate, attempt.id, risposte).evidenze;
  } else if (test?.misura === "assi") {
    const risposte = new Map<string, { opzioneId?: string; ordine?: string[]; allocazioni?: Record<string, number>; valore?: number }>();
    for (const r of righe ?? []) risposte.set(r.item_id, (r.payload as { opzioneId?: string; ordine?: string[]; allocazioni?: Record<string, number>; valore?: number }) ?? {});
    evidenze = calcolaEvidenzeT2(attempt.test_slug, risposte);
  } else {
    const risposte = new Map<string, string>();
    for (const r of righe ?? []) {
      const opzioneId = (r.payload as { opzioneId?: string })?.opzioneId;
      if (opzioneId) risposte.set(r.item_id, opzioneId);
    }
    evidenze = calcolaEvidenzeTest(attempt.test_slug, risposte);
  }

  const { error: erroreRpc } = await supabase.rpc("registra_evidenze_test", {
    p_attempt_id: attempt.id,
    p_evidenze: evidenze,
  });
  if (erroreRpc) {
    console.error("Test — errore registra_evidenze_test:", erroreRpc);
    return erroreDiCortesia("Non è stato possibile salvare l'esito del test. Riprova.", 500);
  }

  return NextResponse.json({ ok: true });
}
