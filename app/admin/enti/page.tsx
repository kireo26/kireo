import { requireAdmin } from "@/lib/admin/context";
import AttivaIstituzioneButton from "@/components/admin/AttivaIstituzioneButton";
import RevocaArea from "@/components/admin/RevocaArea";
import AzioneChiudiConversazione from "@/components/admin/AzioneChiudiConversazione";
import AzioneApprovazioneUpgrade from "@/components/admin/AzioneApprovazioneUpgrade";
import Paginazione from "@/components/admin/Paginazione";
import { TESTI_AREE_ADMIN } from "@/lib/admin/revocaArea";
import { CRITERI } from "@/lib/admin/coseDaDecidere";
import { intervallo, paginaDa, testoTotale } from "@/lib/admin/pagine";
import { ETICHETTA_PIANO } from "@/lib/ente/pianoSuccessivo";
import { getAreaBySlug } from "@/data/aree";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

// ENTI (31/10). ⚠️ PROVVISORIA, fino al secondo lotto del riordino: qui stanno
// le quattro sezioni degli enti che prima erano in /admin, spostate intere —
// le attivazioni, le aree con la revoca, le conversazioni, le richieste di
// cambio piano. Il secondo lotto porta la ricerca e la pagina di ogni ente, e
// queste quattro diventano cose della pagina di quell'ente.
export default async function AdminEntiPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  const pagina = paginaDa((await searchParams).pagina);
  const { da, a } = intervallo(pagina);
  const [
    { data: istituzioniInAttesa },
    { data: areeEnti, error: erroreAreeEnti },
    { data: conversazioniEnti, count: contoConversazioni, error: erroreConversazioni },
    { data: richiesteUpgrade },
  ] = await Promise.all([
    CRITERI.istituzioniInAttesa.filtra(supabase.from("istituzioni").select("id, nome, tipo, created_at")).order("created_at", { ascending: true }),
    supabase
      .from("istituzioni_aree")
      .select("id, istituzione_id, area_slug, stato, revocata_il, motivo_revoca, istituzioni(nome)")
      .order("istituzione_id", { ascending: true })
      .order("area_slug", { ascending: true })
      .limit(500),
    supabase
      .from("conversazioni_enti")
      .select("id, stato, created_at, profiles!student_id(nome, cognome), istituzioni(nome)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(da, a),
    CRITERI.upgradeInAttesa
      .filtra(supabase.from("richieste_upgrade").select("id, note, created_at, istituzioni(nome), piani(nome, prezzo_min, prezzo_max)"))
      .order("created_at", { ascending: true }),
  ]);
  if (erroreAreeEnti) console.error("[admin] aree degli enti:", descriviErrore(erroreAreeEnti));
  if (erroreConversazioni) console.error("[admin] conversazioni:", descriviErrore(erroreConversazioni));
  const totaleConversazioni = erroreConversazioni ? null : (contoConversazioni ?? null);

  return (
    <div className="space-y-12">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Enti</h1>
      <section id="in-attesa">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Enti in attesa di attivazione</h2>
        {!istituzioniInAttesa || istituzioniInAttesa.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessuna istituzione in attesa di attivazione.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {istituzioniInAttesa.map((i) => (
              <li key={i.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-semibold text-kireo-light">{i.nome}</p>
                    <p className="mt-1 text-xs text-kireo-muted">
                      {i.tipo} · richiesta il {formattaData(i.created_at, "long")}
                    </p>
                  </div>
                  <AttivaIstituzioneButton istituzioneId={i.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* LE AREE DEGLI ENTI (31/10): non si approvano più, si tolgono. L'ente
          le sceglie e valgono subito; qui KIREO toglie quella scelta a torto,
          con un motivo che arriva all'ente (lib/admin/revocaArea.ts). */}
      <section id="aree-enti">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">{TESTI_AREE_ADMIN.titolo}</h2>
        <p className="mt-1 text-xs text-kireo-muted">{TESTI_AREE_ADMIN.spiegazione}</p>
        {erroreAreeEnti ? (
          <p className="mt-4 text-sm text-amber-200">{TESTI_AREE_ADMIN.nonLette}</p>
        ) : !areeEnti || areeEnti.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">{TESTI_AREE_ADMIN.nessuna}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {areeEnti.map((a) => {
              const ente = Array.isArray(a.istituzioni) ? a.istituzioni[0] : a.istituzioni;
              return (
                <li key={a.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">
                    {ente?.nome ?? "—"} · <span className="font-normal">{getAreaBySlug(a.area_slug as string)?.nome ?? a.area_slug}</span>
                  </p>
                  {a.stato === "rifiutata" ? (
                    <p className="mt-1 text-xs text-red-300">
                      Tolta{a.revocata_il ? ` il ${formattaData(a.revocata_il as string, "long")}` : ""}
                      {a.motivo_revoca ? `: ${a.motivo_revoca}` : ""}
                    </p>
                  ) : (
                    <RevocaArea istituzioneId={a.istituzione_id as string} areaSlug={a.area_slug as string} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="conversazioni">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Conversazioni enti</h2>
        <p className="mt-1 text-xs text-kireo-muted">Le segnalate (bloccate dallo studente) sono evidenziate.</p>
        <p className="mt-3 text-sm text-kireo-light">{testoTotale(totaleConversazioni, pagina, conversazioniEnti?.length ?? 0)}</p>
        {!conversazioniEnti || conversazioniEnti.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessuna conversazione ancora.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {conversazioniEnti.map((c) => {
              const studente = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
              const ente = Array.isArray(c.istituzioni) ? c.istituzioni[0] : c.istituzioni;
              const segnalata = c.stato === "bloccata_da_studente";
              return (
                <li
                  key={c.id}
                  className={`rounded-xl border p-4 ${segnalata ? "border-red-500/40 bg-red-500/5" : "border-white/5 bg-kireo-card"}`}
                >
                  <p className="font-heading text-sm font-semibold text-kireo-light">
                    {studente?.nome ?? "Studente"} {studente?.cognome ?? ""} ↔ {ente?.nome ?? "Ente"}
                  </p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {c.stato} · {formattaData(c.created_at, "long")}
                  </p>
                  {c.stato !== "chiusa_da_admin" && (
                    <div className="mt-2">
                      <AzioneChiudiConversazione id={c.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Paginazione base="/admin/enti" pagina={pagina} totale={totaleConversazioni} />
      </section>

      <section id="upgrade">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Richieste di cambio piano</h2>
        {!richiesteUpgrade || richiesteUpgrade.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessuna richiesta di upgrade in coda.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {richiesteUpgrade.map((r) => {
              const ente = Array.isArray(r.istituzioni) ? r.istituzioni[0] : r.istituzioni;
              const piano = Array.isArray(r.piani) ? r.piani[0] : r.piani;
              return (
                <li key={r.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">
                    {ente?.nome ?? "—"} → {ETICHETTA_PIANO[piano?.nome ?? ""] ?? piano?.nome}
                  </p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    richiesta il {formattaData(r.created_at, "long")}
                  </p>
                  {r.note && <p className="mt-2 text-sm text-kireo-light/90">{r.note}</p>}
                  <AzioneApprovazioneUpgrade richiestaId={r.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
}
