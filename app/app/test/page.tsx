import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { TEST_META } from "@/lib/test/config";

export const metadata = { title: "Test attitudinali — KIREO" };

type StatoAttempt = "in_corso" | "completata" | "abbandonata";

// Stato dei tentativi dello studente sui test. Non esplode se la tabella non
// esiste ancora (migrazioni non applicate): degrada a "nessun tentativo",
// stesso pattern di getStatiAttempt in /app/escape.
async function getStatiTest(userId: string): Promise<Record<string, StatoAttempt>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("test_attempt").select("test_slug, stato").eq("student_id", userId);
    if (error) return {};
    const stati: Record<string, StatoAttempt> = {};
    for (const r of data ?? []) {
      if (stati[r.test_slug] !== "completata") stati[r.test_slug] = r.stato as StatoAttempt;
    }
    return stati;
  } catch {
    return {};
  }
}

export default async function TestHome() {
  const contesto = await getAppContext();
  const stati = await getStatiTest(contesto.userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">Test attitudinali</h1>
        <p className="mt-1 max-w-2xl text-sm text-kireo-muted">
          Poche domande concrete per capire da dove parti. Non misurano cosa «vorresti fare da grande»: guardano dove va la tua attenzione. Da qui nascono delle ipotesi — mai verdetti — che le missioni serviranno a mettere alla prova. Nessun cronometro: puoi fermarti e riprendere.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEST_META.map((t) => {
          const stato = stati[t.slug];
          const etichetta = stato === "completata" ? "Rivedi o rifai" : stato === "in_corso" ? "Riprendi" : "Inizia";
          return (
            <Link key={t.slug} href={`/app/test/${t.slug}`} className="group rounded-2xl border border-white/5 bg-kireo-card p-6 transition hover:border-kireo-green/50">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-kireo-muted">{t.durata}</span>
                {stato === "completata" && <span className="text-[11px] text-kireo-green-light">Completato</span>}
                {stato === "in_corso" && <span className="text-[11px] text-kireo-orange">In corso</span>}
              </div>
              <h2 className="mt-3 font-heading text-lg font-semibold text-kireo-light">{t.titolo}</h2>
              <p className="mt-1 text-sm text-kireo-muted">{t.sottotitolo}</p>
              <p className="mt-4 text-sm font-semibold text-kireo-green-light group-hover:underline">{etichetta} →</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
