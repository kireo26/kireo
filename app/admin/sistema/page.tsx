import { requireAdmin } from "@/lib/admin/context";
import RiprovaAvvisoEnte from "@/components/admin/RiprovaAvvisoEnte";
import Paginazione from "@/components/admin/Paginazione";
import { TESTI_AVVISI } from "@/lib/admin/avvisiEnte";
import { leggiAvvisiDaRiprovare } from "@/lib/admin/coseDaDecidere";
import { GIORNI_FINESTRA_ADMIN, inizioFinestraAdmin } from "@/lib/admin/menu";
import { intervallo, paginaDa, testoTotale } from "@/lib/admin/pagine";
import { getAreaBySlug } from "@/data/aree";
import { formattaDataOra } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

// SISTEMA (Mario, 31/10): le due cose che dicono se la macchina sta
// funzionando e non appartengono a nessun soggetto. Le email all'ente non
// partite, con «Riprova» (prima comparivano in cima a /admin solo se ce
// n'erano); e i guasti, che prima si vedevano solo da `npm run banco guasti`.
// I guasti hanno la stessa finestra del flusso, 30 giorni, con il totale:
// *un guasto di dieci giorni fa che nessuno ha visto è precisamente quello che
// è sfuggito.*
export default async function AdminSistemaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  const pagina = paginaDa((await searchParams).pagina);
  const dal = inizioFinestraAdmin();
  const { da, a } = intervallo(pagina);

  const [avvisiFalliti, { data: guasti, count: totaleGuasti, error: erroreGuasti }] = await Promise.all([
    leggiAvvisiDaRiprovare(supabase),
    supabase
      .from("guasti")
      .select("id, avvenuto_il, processo, specie, motivo, dettaglio, di_prova", { count: "exact" })
      .gte("avvenuto_il", dal)
      .order("avvenuto_il", { ascending: false })
      .range(da, a),
  ]);
  if (erroreGuasti) console.error("[admin] guasti:", descriviErrore(erroreGuasti));

  const idEventi = (avvisiFalliti ?? []).filter((x) => x.cosa === "evento").map((x) => x.riferimento_id);
  const idNewsletter = (avvisiFalliti ?? []).filter((x) => x.cosa === "newsletter").map((x) => x.riferimento_id);
  const idAree = (avvisiFalliti ?? []).filter((x) => x.cosa === "area").map((x) => x.riferimento_id);
  const [{ data: titoliEventi }, { data: titoliNewsletter }, { data: aree }] = await Promise.all([
    idEventi.length ? supabase.from("eventi").select("id, titolo").in("id", idEventi) : Promise.resolve({ data: [] as { id: string; titolo: string }[] }),
    idNewsletter.length ? supabase.from("newsletter_enti").select("id, oggetto").in("id", idNewsletter) : Promise.resolve({ data: [] as { id: string; oggetto: string }[] }),
    idAree.length ? supabase.from("istituzioni_aree").select("id, area_slug").in("id", idAree) : Promise.resolve({ data: [] as { id: string; area_slug: string }[] }),
  ]);
  const titoloAvviso = new Map<string, string>([
    ...(titoliEventi ?? []).map((e) => [e.id, e.titolo] as [string, string]),
    ...(titoliNewsletter ?? []).map((n) => [n.id, n.oggetto] as [string, string]),
    ...(aree ?? []).map((x) => [x.id as string, getAreaBySlug(x.area_slug as string)?.nome ?? (x.area_slug as string)] as [string, string]),
  ]);
  const totale = erroreGuasti ? null : (totaleGuasti ?? null);

  return (
    <div className="space-y-12">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Sistema</h1>
      <section id="email">
          <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-orange">{TESTI_AVVISI.titolo}</h2>
          {avvisiFalliti === null ? (
            <p className="mt-4 text-sm text-red-300">{TESTI_AVVISI.nonLetto}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-kireo-muted">{TESTI_AVVISI.spiegazione}</p>
              {avvisiFalliti.length === 0 && <p className="mt-4 text-sm text-kireo-muted">{TESTI_AVVISI.nessuna}</p>}
              <ul className="mt-4 space-y-3">
                {avvisiFalliti.map((a) => (
                  <li key={`${a.cosa}:${a.riferimento_id}`} className="rounded-xl border border-kireo-orange/30 bg-kireo-card p-4">
                    <p className="text-sm text-kireo-light">
                      {a.cosa === "evento" ? "Evento" : a.cosa === "newsletter" ? "Newsletter" : "Area"} «{titoloAvviso.get(a.riferimento_id) ?? a.riferimento_id}» ·{" "}
                      {formattaDataOra(a.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-kireo-muted">
                      {a.esito === "nessun_destinatario" ? TESTI_AVVISI.nessunDestinatario : `Motivo: ${a.motivo ?? "—"}`}
                    </p>
                    <RiprovaAvvisoEnte cosa={a.cosa} id={a.riferimento_id} />
                  </li>
                ))}
              </ul>
            </>
          )}
      </section>


      <section id="guasti">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Guasti degli ultimi {GIORNI_FINESTRA_ADMIN} giorni</h2>
        <p className="mt-1 text-xs text-kireo-muted">
          Quello che il motore, i revisori e le route hanno scritto quando qualcosa non è andato. Le righe degli account di prova sono segnate.
        </p>
        {erroreGuasti ? (
          <p className="mt-4 text-sm text-red-300">Non siamo riusciti a leggere i guasti: ricarica la pagina.</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-kireo-light">{testoTotale(totale, pagina, guasti?.length ?? 0)}</p>
            {guasti && guasti.length > 0 && (
              <ul className="mt-3 space-y-2">
                {guasti.map((g) => (
                  <li key={g.id} className="rounded-xl border border-white/5 bg-kireo-card p-3">
                    <p className="text-sm text-kireo-light">
                      {g.processo} · {g.specie}
                      {g.di_prova ? <span className="ml-2 text-xs text-kireo-muted">(di prova)</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-kireo-muted">{formattaDataOra(g.avvenuto_il as string, "long")}{g.motivo ? ` · ${g.motivo}` : ""}</p>
                    {g.dettaglio && <p className="mt-1 break-all text-xs text-kireo-muted">{g.dettaglio as string}</p>}
                  </li>
                ))}
              </ul>
            )}
            <Paginazione base="/admin/sistema" pagina={pagina} totale={totale} />
          </>
        )}
      </section>
    </div>
  );
}
