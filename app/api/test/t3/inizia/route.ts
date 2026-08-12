import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SLUG_T3 } from "@/lib/test/config";
import { selezionaCandidate, T3_FROZEN_ITEM_ID, type CandidateCongelate } from "@/lib/test/assembla-t3";
import type { AsseStile } from "@/lib/escape/tipi";

export const runtime = "nodejs";

// Avvia T3: crea il tentativo E congela le aree candidate in una riga sintetica
// di test_response (nessuna migrazione: si riusa la tabella). Il congelamento
// all'avvio è la garanzia del punto 3 del design: se un altro test modifica
// area_signal a metà, T3 non cambia le domande sotto i piedi dello studente.
// Se le aree candidate sono meno di 3, NON crea il tentativo e risponde
// { fallback: true } — la pagina mostra l'invito a fare prima T1.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errore: "Devi accedere con il tuo profilo studente." }, { status: 401 });

  // Tentativo in corso già esistente? Assicura solo che la riga di congelamento ci sia.
  const { data: esistente } = await supabase
    .from("test_attempt")
    .select("id")
    .eq("student_id", user.id)
    .eq("test_slug", SLUG_T3)
    .eq("stato", "in_corso")
    .maybeSingle();

  // Candidate dal profilo (lettura-own, sempre permessa).
  const { data: segnali } = await supabase
    .from("area_signal")
    .select("area_slug, interest_score")
    .eq("student_id", user.id);
  const candidate = selezionaCandidate((segnali ?? []).map((s) => ({ area_slug: s.area_slug, interest_score: Number(s.interest_score) || 0 })));

  if (candidate.length < 3) {
    // Sotto le 3 candidate: nessun tentativo, la pagina mostra il fallback.
    return NextResponse.json({ fallback: true });
  }

  // Asse dominante (da style_signal) per l'enfasi degli item di tensione. Null se
  // lo studente non ha ancora fatto T2 — gli item di tensione restano validi.
  const { data: stili } = await supabase
    .from("style_signal")
    .select("asse, punteggio")
    .eq("student_id", user.id)
    .order("punteggio", { ascending: false })
    .limit(1);
  const asseDominante = (stili?.[0]?.asse as AsseStile | undefined) ?? null;

  const congelate: CandidateCongelate = { candidate, asseDominante };

  let attemptId = esistente?.id as string | undefined;
  if (!attemptId) {
    const { data: creato, error } = await supabase
      .from("test_attempt")
      .insert({ student_id: user.id, test_slug: SLUG_T3 })
      .select("id")
      .single();
    if (error || !creato) return NextResponse.json({ errore: "Non è stato possibile avviare il test. Riprova." }, { status: 500 });
    attemptId = creato.id;
  }

  // Congela le candidate (upsert idempotente sulla riga sintetica).
  const { error: erroreFreeze } = await supabase
    .from("test_response")
    .upsert({ attempt_id: attemptId, item_id: T3_FROZEN_ITEM_ID, payload: congelate }, { onConflict: "attempt_id,item_id" });
  if (erroreFreeze) return NextResponse.json({ errore: "Non è stato possibile avviare il test. Riprova." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
