import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { accessoreDaMappa, getMissione, mandatoScelto } from "@/lib/escape/config";
import { calcolaEvidenze } from "@/lib/escape/scoring";
import type { Payload, PayloadAlloca } from "@/lib/escape/tipi";

export const runtime = "nodejs";

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
  const evidenze = await calcolaEvidenze(mission, risposte, anthropic);

  // persiste prove + aggrega profilo (idempotente)
  const { error: erroreRpc } = await supabase.rpc("registra_evidence", {
    p_attempt_id: attempt.id,
    p_evidenze: evidenze,
  });
  if (erroreRpc) {
    console.error("Escape — errore registra_evidence:", erroreRpc);
    return erroreDiCortesia("Non è stato possibile salvare l'esito della missione. Riprova.", 500);
  }

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

  // Portfolio: l'artefatto "La mia proposta per l'ex mercato di Via Sanzio"
  // (mandato + allocazione + testo), come da design 5.3.
  await supabase.from("portfolio_item").delete().eq("attempt_id", attempt.id);
  if (proposta) {
    const mandato = mandatoScelto(get);
    const allocazione = (risposte.get("s3_budget") as PayloadAlloca | undefined)?.allocazioni ?? {};
    await supabase.from("portfolio_item").insert({
      student_id: user.id,
      attempt_id: attempt.id,
      titolo: `La mia proposta — ${mission.titolo}`,
      contenuto: { mandato: mandato?.label ?? null, allocazione, testo: proposta },
    });
  }

  return NextResponse.json({ ok: true });
}
