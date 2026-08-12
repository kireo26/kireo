import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { getTest } from "@/lib/test/config";
import TestPlayer from "@/components/test/TestPlayer";
import IniziaTest from "@/components/test/IniziaTest";
import EsitoTest, { type AreaEsitoTest } from "@/components/test/EsitoTest";
import EsitoT2, { type AsseEsito, type SpiegazioneAsse } from "@/components/test/EsitoT2";
import { assegnaProfilo } from "@/lib/test/profili";
import { calcolaDivergenza } from "@/lib/test/divergenza";
import type { AsseStile } from "@/lib/escape/tipi";

const ASSI: AsseStile[] = ["analitico", "relazionale", "creativo", "operativo"];

export const metadata = { title: "Test — KIREO" };

export default async function TestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const test = getTest(slug);
  if (!test) notFound();

  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("test_attempt")
    .select("id, stato")
    .eq("student_id", contesto.userId)
    .eq("test_slug", slug)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const Intestazione = (
    <div>
      <Link href="/app/test" className="text-xs text-kireo-muted hover:text-kireo-light">← Test</Link>
      <h1 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">{test.titolo}</h1>
      <p className="mt-1 text-sm text-kireo-muted">{test.sottotitolo}</p>
    </div>
  );

  // Nessun tentativo: intro + avvio.
  if (!attempt) {
    return (
      <div className="space-y-6">
        {Intestazione}
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
          <p className="text-sm text-kireo-light/90">{test.descrizione}</p>
          <div className="mt-5">
            <IniziaTest testSlug={slug} />
          </div>
        </div>
      </div>
    );
  }

  // Completato — T2 (assi): profilo di stile, quattro dimensioni, punto cieco,
  // motivazioni a scomparsa, ed eventuale divergenza test↔missioni.
  if (attempt.stato === "completata" && test.misura === "assi") {
    // Profilo e barre: dallo style_signal aggregato (test + missioni).
    const { data: segnali } = await supabase
      .from("style_signal")
      .select("asse, punteggio")
      .eq("student_id", contesto.userId);
    const punteggi: Record<AsseStile, number> = { analitico: 0, relazionale: 0, creativo: 0, operativo: 0 };
    for (const s of segnali ?? []) punteggi[s.asse as AsseStile] = Number(s.punteggio) || 0;
    const profilo = assegnaProfilo(punteggi);
    const assi: AsseEsito[] = ASSI.map((a) => ({ asse: a, valore: punteggi[a] }));

    // "Perché lo diciamo": motivazioni di STILE di questo tentativo, per asse.
    const { data: proveTest } = await supabase
      .from("evidence")
      .select("asse, motivazione")
      .eq("test_attempt_id", attempt.id)
      .not("asse", "is", null);
    const motPerAsse = new Map<AsseStile, string[]>();
    for (const p of proveTest ?? []) {
      if (!p.asse || !p.motivazione) continue;
      const arr = motPerAsse.get(p.asse as AsseStile) ?? [];
      arr.push(p.motivazione);
      motPerAsse.set(p.asse as AsseStile, arr);
    }
    const spiegazioni: SpiegazioneAsse[] = ASSI.map((a) => ({ asse: a, motivazioni: (motPerAsse.get(a) ?? []).slice(0, 3) }));

    // Divergenza: confronto asse dominante test vs missioni, con ≥ 2 missioni.
    const { data: proveAsse } = await supabase
      .from("evidence")
      .select("asse, valore, peso, fonte")
      .eq("student_id", contesto.userId)
      .not("asse", "is", null);
    const { count: missioniCompletate } = await supabase
      .from("mission_attempt")
      .select("id", { count: "exact", head: true })
      .eq("student_id", contesto.userId)
      .eq("stato", "completata");
    const divergenza = calcolaDivergenza(
      (proveAsse ?? []).map((p) => ({ asse: p.asse as AsseStile, valore: Number(p.valore) || 0, peso: Number(p.peso) || 0, fonte: String(p.fonte) })),
      missioniCompletate ?? 0,
    );

    return (
      <div className="space-y-6">
        {Intestazione}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-kireo-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-kireo-muted">Hai già fatto questo test. Puoi rifarlo quando vuoi: le tue risposte possono cambiare, e con loro le ipotesi.</p>
          <div className="flex-none">
            <IniziaTest testSlug={slug} etichetta="Rifai il test" />
          </div>
        </div>
        <EsitoT2 profilo={profilo} assi={assi} spiegazioni={spiegazioni} divergenza={divergenza} />
      </div>
    );
  }

  // Completato — T1 (aree): le aree emerse, con status e motivazioni. Mai i punteggi grezzi.
  if (attempt.stato === "completata" && test.misura === "aree") {
    const { data: prove } = await supabase.from("evidence").select("area_slug, motivazione").eq("test_attempt_id", attempt.id).is("asse", null);
    const motivazioniPerArea = new Map<string, string[]>();
    for (const p of prove ?? []) {
      if (!p.area_slug) continue;
      const arr = motivazioniPerArea.get(p.area_slug) ?? [];
      if (p.motivazione) arr.push(p.motivazione);
      motivazioniPerArea.set(p.area_slug, arr);
    }
    const areeToccate = Array.from(motivazioniPerArea.keys());

    let aree: AreaEsitoTest[] = [];
    if (areeToccate.length > 0) {
      const { data: segnali } = await supabase
        .from("area_signal")
        .select("area_slug, interest_score, status")
        .eq("student_id", contesto.userId)
        .in("area_slug", areeToccate);
      const ordinePerScore = new Map((segnali ?? []).map((s) => [s.area_slug, s.interest_score as number]));
      const statusPerArea = new Map((segnali ?? []).map((s) => [s.area_slug, s.status as AreaEsitoTest["status"]]));
      aree = [...areeToccate]
        .sort((a, b) => (ordinePerScore.get(b) ?? 0) - (ordinePerScore.get(a) ?? 0))
        .slice(0, 5)
        .map((areaSlug) => ({
          slug: areaSlug,
          nome: getAreaBySlug(areaSlug)?.nome ?? areaSlug,
          status: statusPerArea.get(areaSlug) ?? "emergente",
          motivazioni: (motivazioniPerArea.get(areaSlug) ?? []).slice(0, 2),
        }));
    }

    return (
      <div className="space-y-6">
        {Intestazione}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-kireo-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-kireo-muted">Hai già fatto questo test. Puoi rifarlo quando vuoi: le tue risposte possono cambiare, e con loro le ipotesi.</p>
          <div className="flex-none">
            <IniziaTest testSlug={slug} etichetta="Rifai il test" />
          </div>
        </div>
        <EsitoTest titolo={test.titolo} aree={aree} />
      </div>
    );
  }

  // In corso: player, riprendibile dalle risposte già salvate.
  const { data: righe } = await supabase.from("test_response").select("item_id, payload").eq("attempt_id", attempt.id);
  const risposteIniziali = (righe ?? []).map((r) => ({ item_id: r.item_id, payload: r.payload as { opzioneId?: string; ordine?: string[]; allocazioni?: Record<string, number>; valore?: number } }));

  return (
    <div className="space-y-6">
      {Intestazione}
      <TestPlayer testSlug={slug} attemptId={attempt.id} risposteIniziali={risposteIniziali} />
    </div>
  );
}
