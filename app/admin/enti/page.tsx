import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import Ricerca from "@/components/admin/Ricerca";
import Paginazione from "@/components/admin/Paginazione";
import AttivaIstituzioneButton from "@/components/admin/AttivaIstituzioneButton";
import { CRITERI } from "@/lib/admin/coseDaDecidere";
import { intervallo, paginaDa, testoTotale } from "@/lib/admin/pagine";
import {
  ETICHETTA_STATO_ENTE,
  ETICHETTA_TIPO_ENTE,
  FILTRI_ENTI,
  TESTI_ENTI_ADMIN as T,
  filtroDa,
  hrefFiltro,
  idEntiPerFiltro,
  leggiScheda,
  testoAccountInAttesa,
  type SchedaAdminEnte,
} from "@/lib/admin/enti";
import { ETICHETTA_PIANO } from "@/lib/ente/pianoSuccessivo";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

// L'ELENCO DEGLI ENTI (lotto 2 del riordino, 01/11): in ordine alfabetico,
// cercato per nome, filtrato per stato, con il totale. Ogni ente apre la sua
// pagina, dove stanno le decisioni (attivare, togliere un'area, il cambio di
// piano, chiudere una conversazione): vedi lib/admin/enti.ts.
export default async function AdminEntiPage({ searchParams }: { searchParams: Promise<{ q?: string; stato?: string; pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  const cerca = await searchParams;
  const q = cerca.q?.trim() || undefined;
  const filtro = filtroDa(cerca.stato);
  const pagina = paginaDa(cerca.pagina);
  const { da, a } = intervallo(pagina);

  const idFiltro = await idEntiPerFiltro(supabase, filtro);
  // Gli enti con un cambio di piano da decidere si segnano anche fuori dal
  // loro filtro: è la cosa da fare, e sta su quella riga.
  const { data: inAttesaUpgrade, error: erroreUpgrade } = await CRITERI.upgradeInAttesa.filtra(
    supabase.from("richieste_upgrade").select("istituzione_id"),
  );
  if (erroreUpgrade) console.error("[admin] cambi di piano:", descriviErrore(erroreUpgrade));
  const conUpgrade = new Set((inAttesaUpgrade ?? []).map((r) => r.istituzione_id as string));

  let enti: Record<string, unknown>[] | null = [];
  let totale: number | null = 0;
  let erroreEnti = false;
  if (idFiltro !== null && !(Array.isArray(idFiltro) && idFiltro.length === 0)) {
    let query = supabase
      .from("istituzioni")
      .select("id, nome, tipo, stato, created_at, piani(nome)", { count: "exact" })
      .order("nome", { ascending: true })
      .order("id", { ascending: true });
    if (filtro === "in_attesa") query = CRITERI.istituzioniInAttesa.filtra(query);
    else if (filtro === "attiva" || filtro === "sospesa") query = query.eq("stato", filtro);
    if (Array.isArray(idFiltro)) query = query.in("id", idFiltro);
    if (q) query = query.ilike("nome", `%${q.replace(/[%_]/g, " ")}%`);
    const { data, count, error } = await query.range(da, a);
    if (error) {
      console.error("[admin] enti:", descriviErrore(error));
      erroreEnti = true;
    }
    enti = error ? null : ((data ?? []) as Record<string, unknown>[]);
    totale = error ? null : (count ?? null);
  }

  // «Attiva» dalla riga (Mario, 01/11): l'elenco filtrato su «In attesa» esiste
  // per fare quella cosa. Ma una riga si preme per sbaglio, quindi deve dire
  // abbastanza per decidere: anche l'email dell'account, che oggi stava solo
  // nella pagina. Si legge solo per gli enti in attesa, che sono pochi; una
  // lettura fallita si dice, non diventa «nessun account».
  const inAttesa = (enti ?? []).filter((e) => e.stato === "in_attesa");
  const schede = new Map<string, SchedaAdminEnte | null>(
    await Promise.all(
      inAttesa.map(async (e) => {
        const { data, error } = await supabase.rpc("scheda_admin_ente", { p_istituzione_id: e.id });
        if (error) console.error("[admin] account dell'ente in attesa:", descriviErrore(error));
        return [e.id as string, error ? null : leggiScheda(data)] as const;
      }),
    ),
  );

  return (
    <div className="space-y-6">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Enti</h1>
      <nav aria-label="Filtra gli enti" className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {FILTRI_ENTI.map((f) => (
          <Link
            key={f.chiave}
            href={hrefFiltro(f.chiave, q)}
            aria-current={f.chiave === filtro ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${f.chiave === filtro ? "bg-kireo-green/20 text-kireo-light" : "text-kireo-muted hover:text-kireo-light"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <Ricerca base="/admin/enti" q={q} segnaposto={T.ricerca} nascosti={filtro === "tutti" ? undefined : { stato: filtro }} />
      {idFiltro === null ? (
        <p className="text-sm text-amber-200">{T.filtroNonLetto}</p>
      ) : erroreEnti ? (
        <p className="text-sm text-amber-200">{T.nonLetti}</p>
      ) : (
        <>
          <p className="text-sm text-kireo-light">{testoTotale(totale, pagina, enti?.length ?? 0)}</p>
          {!enti || enti.length === 0 ? (
            <p className="text-sm text-kireo-muted">{T.nessuno}</p>
          ) : (
            <ul className="space-y-3">
              {enti.map((e) => {
                const piano = Array.isArray(e.piani) ? e.piani[0] : e.piani;
                const nomePiano = (piano as { nome?: string } | null)?.nome ?? "";
                return (
                  <li key={e.id as string} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                    <Link href={`/admin/enti/${e.id}`} className="font-heading text-sm font-semibold text-kireo-light underline-offset-2 hover:underline">
                      {e.nome as string}
                    </Link>
                    <p className="mt-1 text-xs text-kireo-muted">
                      {ETICHETTA_TIPO_ENTE[e.tipo as string] ?? (e.tipo as string) ?? "Tipo non indicato"} ·{" "}
                      {ETICHETTA_STATO_ENTE[e.stato as string] ?? (e.stato as string)} · piano {ETICHETTA_PIANO[nomePiano] ?? (nomePiano || "non indicato")} · registrato il{" "}
                      {formattaData(e.created_at as string, "long")}
                    </p>
                    {conUpgrade.has(e.id as string) && <p className="mt-1 text-xs text-kireo-orange">{T.cambioPiano}</p>}
                    {e.stato === "in_attesa" && (
                      <>
                        <p className="mt-1 text-xs text-kireo-light/90">{testoAccountInAttesa(schede.get(e.id as string) ?? null)}</p>
                        <div className="mt-2">
                          <AttivaIstituzioneButton istituzioneId={e.id as string} nome={e.nome as string} />
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Paginazione base="/admin/enti" pagina={pagina} totale={totale} q={q} extra={filtro === "tutti" ? undefined : { stato: filtro }} />
        </>
      )}
    </div>
  );
}
