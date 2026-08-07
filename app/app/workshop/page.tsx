import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app/studentContext";

export const metadata = { title: "Workshop — KIREO" };

export default async function WorkshopListaPage() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  const [{ data: workshops }, { data: iscrizioni }] = await Promise.all([
    supabase.from("workshop").select("id, slug, titolo, sottotitolo, descrizione, durata_giorni").eq("attivo", true).order("ordine"),
    supabase
      .from("workshop_iscrizioni")
      .select("workshop_id, workshop_ruoli(titolo)")
      .eq("student_id", contesto.userId),
  ]);

  const ruoloPerWorkshop = new Map<string, string>();
  for (const iscrizione of iscrizioni ?? []) {
    const ruolo = Array.isArray(iscrizione.workshop_ruoli) ? iscrizione.workshop_ruoli[0] : iscrizione.workshop_ruoli;
    if (ruolo) ruoloPerWorkshop.set(iscrizione.workshop_id, ruolo.titolo);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Workshop</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Progetti reali, multidisciplinari</h1>
        <p className="mt-3 text-kireo-muted">
          Scegli un progetto, scegli il tuo ruolo e lavora in autonomia — puoi confrontarti con gli altri studenti che coprono
          le altre aree dello stesso progetto.
        </p>
      </div>

      {!workshops || workshops.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">Nessun workshop disponibile al momento.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {workshops.map((ws) => {
            const ruoloIscritto = ruoloPerWorkshop.get(ws.id);
            return (
              <li key={ws.id}>
                <Link href={`/app/workshop/${ws.slug}`} className="block h-full rounded-2xl border border-white/5 bg-kireo-card p-6 transition-colors hover:border-kireo-green">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-heading text-lg font-semibold leading-[1.25] text-kireo-light">{ws.titolo}</h2>
                    {ruoloIscritto ? (
                      <span className="flex-none rounded-full bg-kireo-green/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-kireo-green-light">
                        Iscritto · {ruoloIscritto}
                      </span>
                    ) : (
                      <span className="flex-none rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-kireo-muted">
                        {ws.durata_giorni} giorni
                      </span>
                    )}
                  </div>
                  {ws.sottotitolo && <p className="mt-1 text-xs text-kireo-muted">{ws.sottotitolo}</p>}
                  {ws.descrizione && <p className="mt-3 text-sm text-kireo-light/90">{ws.descrizione}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
