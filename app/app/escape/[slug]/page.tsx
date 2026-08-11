import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { accessoreDaMappa, getMissione } from "@/lib/escape/config";
import { costruisciRestituzione, type AreaTop } from "@/lib/escape/restituzione";
import type { Payload } from "@/lib/escape/tipi";
import EscapePlayer from "@/components/escape/EscapePlayer";
import IniziaMissione from "@/components/escape/IniziaMissione";
import EsitoMissione, { type AreaEsito } from "@/components/escape/EsitoMissione";

export const metadata = { title: "Missione — KIREO" };

export default async function MissionePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mission = getMissione(slug);
  if (!mission) notFound();

  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("mission_attempt")
    .select("id, stato")
    .eq("student_id", contesto.userId)
    .eq("mission_slug", slug)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const Intestazione = (
    <div>
      <Link href="/app/escape" className="text-xs text-kireo-muted hover:text-kireo-light">← Missioni</Link>
      <h1 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">{mission.titolo}</h1>
      <p className="mt-1 text-sm text-kireo-muted">{mission.sottotitolo}</p>
    </div>
  );

  // Nessun tentativo: intro + avvio.
  if (!attempt) {
    return (
      <div className="space-y-6">
        {Intestazione}
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
          <p className="text-sm text-kireo-light/90">{mission.descrizione}</p>
          <div className="mt-5">
            <IniziaMissione missionSlug={slug} />
          </div>
        </div>
      </div>
    );
  }

  // Completata: restituzione narrativa (v2) + profilo aggregato + motivazioni.
  if (attempt.stato === "completata") {
    const { data: prove } = await supabase.from("evidence").select("area_slug, motivazione, peso").eq("attempt_id", attempt.id);
    const areeToccate = Array.from(new Set((prove ?? []).map((p) => p.area_slug).filter((a): a is string => Boolean(a))));

    // "Perché lo diciamo": una riga per AZIONE, non una per coppia azione-area.
    // Le motivazioni degli step strutturati sono indipendenti dall'area (l'area
    // sta in area_slug), quindi righe della stessa azione condividono lo stesso
    // testo e si raggruppano; le aree vengono elencate insieme. Si mostrano solo
    // le 8 più significative (per peso).
    type Gruppo = { testo: string; aree: string[]; areeViste: Set<string>; peso: number };
    const gruppi = new Map<string, Gruppo>();
    for (const p of prove ?? []) {
      if (!p.motivazione) continue;
      const g: Gruppo = gruppi.get(p.motivazione) ?? { testo: p.motivazione, aree: [], areeViste: new Set<string>(), peso: 0 };
      const nome = p.area_slug ? getAreaBySlug(p.area_slug)?.nome ?? p.area_slug : null;
      if (nome && !g.areeViste.has(nome)) {
        g.areeViste.add(nome);
        g.aree.push(nome);
      }
      g.peso = Math.max(g.peso, Number(p.peso) || 0);
      gruppi.set(p.motivazione, g);
    }
    const spiegazioni = Array.from(gruppi.values())
      .sort((a, b) => b.peso - a.peso)
      .slice(0, 8)
      .map((g) => ({ testo: g.testo, aree: g.aree }));

    let aree: AreaEsito[] = [];
    if (areeToccate.length > 0) {
      const { data: segnali } = await supabase
        .from("area_signal")
        .select("area_slug, interest_score, performance_score, self_efficacy_score, curiosity_score, status")
        .eq("student_id", contesto.userId)
        .in("area_slug", areeToccate);
      aree = (segnali ?? [])
        .map((s) => ({
          slug: s.area_slug,
          nome: getAreaBySlug(s.area_slug)?.nome ?? s.area_slug,
          status: s.status as AreaEsito["status"],
          interest: s.interest_score,
          performance: s.performance_score,
          self_efficacy: s.self_efficacy_score,
          curiosity: s.curiosity_score,
        }))
        .sort((a, b) => b.interest + b.curiosity - (a.interest + a.curiosity));
    }

    // restituzione: costruita dalle risposte autorevoli (step_response) + le
    // aree principali. Retro-compatibile con un tentativo v1 (blocchi vuoti).
    const { data: righeResp } = await supabase.from("step_response").select("step_id, payload").eq("attempt_id", attempt.id);
    const mappa = new Map<string, Payload>();
    for (const r of righeResp ?? []) mappa.set(r.step_id, r.payload as Payload);
    const areeTop: AreaTop[] = aree.slice(0, 3).map((a) => ({ slug: a.slug, nome: a.nome, status: a.status }));
    const restituzione = costruisciRestituzione(accessoreDaMappa(mappa), areeTop);

    return (
      <div className="space-y-6">
        {Intestazione}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-kireo-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-kireo-muted">
            Hai già completato questa missione. Puoi rigiocarla: le scelte possono cambiare e le tue ipotesi si affinano.
          </p>
          <div className="flex-none">
            <IniziaMissione missionSlug={slug} etichetta="Rigioca la missione" />
          </div>
        </div>
        <EsitoMissione titolo={mission.titolo} restituzione={restituzione} aree={aree} spiegazioni={spiegazioni} />
      </div>
    );
  }

  // In corso: player, riprendibile dalle risposte già salvate.
  const { data: righe } = await supabase.from("step_response").select("step_id, payload").eq("attempt_id", attempt.id);
  const risposteIniziali = (righe ?? []).map((r) => ({ step_id: r.step_id, payload: r.payload as Payload }));

  return (
    <div className="space-y-6">
      {Intestazione}
      <EscapePlayer missionSlug={slug} attemptId={attempt.id} risposteIniziali={risposteIniziali} />
    </div>
  );
}
