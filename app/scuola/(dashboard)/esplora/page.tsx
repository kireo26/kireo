import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import { cercaEnti } from "@/lib/app/esplora";
import { AREE } from "@/data/aree";
import CardEnte from "@/components/app/CardEnte";
import ProponiIncontroButton from "@/components/scuola/ProponiIncontroButton";

const TIPI = [
  { value: "universita", label: "Università" },
  { value: "its", label: "ITS Academy" },
  { value: "academy", label: "Accademia (AFAM)" },
  { value: "ente_professionale", label: "Ente di formazione professionale" },
];

const ETICHETTA_STATO_PROPOSTA: Record<string, string> = {
  inviata: "In attesa di risposta",
  accettata: "Accettata",
  rifiutata: "Rifiutata",
  ritirata: "Ritirata",
};

export default async function ScuolaEsploraPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; area?: string; tipo?: string; provincia?: string; eventi?: string }>;
}) {
  const params = await searchParams;
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  const risultati = await cercaEnti(supabase, {
    query: params.q,
    areaSlug: params.area,
    tipo: params.tipo,
    provincia: params.provincia,
    soloConEventi: params.eventi === "1",
  });

  const { data: proposte } = await supabase
    .from("proposte_incontro")
    .select("id, istituzione_id, stato, created_at, risposta_ente, istituzioni(nome)")
    .eq("scuola_profilo_id", contesto.scuolaProfiloId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-10">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Esplora</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Trova un ente formativo</h1>
        <p className="mt-2 text-kireo-muted">Proponi un incontro di orientamento online per i tuoi studenti.</p>
      </div>

      <form method="get" className="grid gap-3 rounded-2xl border border-white/5 bg-kireo-card p-4 sm:grid-cols-5">
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Cerca per nome..."
          className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted sm:col-span-2"
        />
        <select name="area" defaultValue={params.area ?? ""} className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light">
          <option value="">Tutte le aree</option>
          {AREE.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.nome}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={params.tipo ?? ""} className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light">
          <option value="">Tutti i tipi</option>
          {TIPI.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="provincia"
          defaultValue={params.provincia ?? ""}
          placeholder="Provincia"
          className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
        />
        <button type="submit" className="rounded-lg bg-kireo-green px-4 py-2 text-sm font-semibold text-kireo-light hover:bg-kireo-green-light sm:col-span-5">
          Cerca
        </button>
      </form>

      {risultati.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">Nessun ente trovato con questi filtri.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {risultati.map((ente) => (
            <li key={ente.id}>
              <CardEnte ente={ente} azioneExtra={<ProponiIncontroButton istituzioneId={ente.id} puoProporre={contesto.puoGestireClassi} />} />
            </li>
          ))}
        </ul>
      )}

      {proposte && proposte.length > 0 && (
        <div>
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Le tue proposte</h2>
          <ul className="mt-4 space-y-3">
            {proposte.map((p) => {
              const ente = Array.isArray(p.istituzioni) ? p.istituzioni[0] : p.istituzioni;
              return (
                <li key={p.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">{ente?.nome ?? "Ente"}</p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {ETICHETTA_STATO_PROPOSTA[p.stato] ?? p.stato} · {new Date(p.created_at).toLocaleDateString("it-IT", { dateStyle: "long" })}
                  </p>
                  {p.risposta_ente && <p className="mt-2 text-sm text-kireo-light/90">&ldquo;{p.risposta_ente}&rdquo;</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
