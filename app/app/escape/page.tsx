import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { MISSIONI } from "@/lib/escape/config";

export const metadata = { title: "Missioni — KIREO" };

type StatoAttempt = "in_corso" | "completata" | "abbandonata";

// Legge lo stato dei tentativi dello studente per le missioni. Non esplode se
// la tabella non esiste ancora (migration non applicata): degrada a "nessun
// tentativo", stesso pattern di getValoriRadar.
async function getStatiAttempt(userId: string): Promise<Record<string, StatoAttempt>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("mission_attempt").select("mission_slug, stato").eq("student_id", userId);
    if (error) return {};
    const stati: Record<string, StatoAttempt> = {};
    for (const r of data ?? []) {
      // se esistono più tentativi, "completata" prevale sulla visualizzazione
      if (stati[r.mission_slug] !== "completata") stati[r.mission_slug] = r.stato as StatoAttempt;
    }
    return stati;
  } catch {
    return {};
  }
}

export default async function EscapeHome() {
  const contesto = await getAppContext();
  const stati = await getStatiAttempt(contesto.userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">Missioni di orientamento</h1>
        <p className="mt-1 max-w-2xl text-sm text-kireo-muted">
          Situazioni reali in cui scegli, allochi, decidi. Da ciò che fai proviamo a capire — come ipotesi, mai come verdetto — cosa ti attiva di più. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MISSIONI.map((m) => {
          const stato = stati[m.slug];
          const etichetta = stato === "completata" ? "Rivedi l'esito" : stato === "in_corso" ? "Riprendi" : "Inizia";
          return (
            <Link key={m.slug} href={`/app/escape/${m.slug}`} className="group rounded-2xl border border-white/5 bg-kireo-card p-6 transition hover:border-kireo-green/50">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-kireo-muted">{m.tipo === "cross-area" ? "Ampio spettro" : "Focalizzata"}</span>
                {stato === "completata" && <span className="text-[11px] text-kireo-green-light">Completata</span>}
                {stato === "in_corso" && <span className="text-[11px] text-kireo-orange">In corso</span>}
              </div>
              <h2 className="mt-3 font-heading text-lg font-semibold text-kireo-light">{m.titolo}</h2>
              <p className="mt-1 text-sm text-kireo-muted">{m.sottotitolo}</p>
              <p className="mt-4 text-sm font-semibold text-kireo-green-light group-hover:underline">{etichetta} →</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
