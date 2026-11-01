import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/context";
import AttivaIstituzioneButton from "@/components/admin/AttivaIstituzioneButton";
import RevocaArea from "@/components/admin/RevocaArea";
import AzioneChiudiConversazione from "@/components/admin/AzioneChiudiConversazione";
import AzioneApprovazioneUpgrade from "@/components/admin/AzioneApprovazioneUpgrade";
import GruppiFlusso from "@/components/admin/GruppiFlusso";
import { leggiFlusso } from "@/lib/admin/flusso";
import { GIORNI_FINESTRA_ADMIN } from "@/lib/admin/menu";
import { ETICHETTA_STATO_ENTE, ETICHETTA_TIPO_ENTE, TESTI_ENTI_ADMIN as T, leggiScheda, testoSeguaci } from "@/lib/admin/enti";
import { TESTI_AREE_ADMIN } from "@/lib/admin/revocaArea";
import { caricaStatisticheDiUnEnte } from "@/lib/ente/caricaStatistiche";
import { riquadriIndice } from "@/lib/ente/statistiche";
import { ETICHETTA_PIANO } from "@/lib/ente/pianoSuccessivo";
import { getAreaBySlug } from "@/data/aree";
import { formattaData, formattaDataOra } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

// LA PAGINA DI UN ENTE (lotto 2 del riordino, Mario, 01/11): chi è, le aree con
// la revoca, il piano con i cambi, cosa pubblica, i suoi numeri, le
// conversazioni, e il flusso ristretto a lui. Le decisioni che stavano nella
// pagina provvisoria degli Enti (attivare, togliere un'area, il cambio di
// piano, chiudere una conversazione) stanno qui, dove si vede il resto
// dell'ente. Ogni lettura che fallisce si dice: niente diventa zero.

const ULTIMI = 5;

const uno = <X,>(v: X | X[] | null | undefined): X | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function AdminEntePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const { data: ente, error: erroreEnte } = await supabase
    .from("istituzioni")
    .select("id, nome, slug, tipo, stato, provincia, sito_ufficiale, created_at, regolamento_accettato_il, piano_attivato_il, piano_scade_il, piani(nome)")
    .eq("id", id)
    .maybeSingle();
  if (erroreEnte) {
    console.error("[admin] ente:", descriviErrore(erroreEnte));
    return (
      <div className="space-y-4">
        <Link href="/admin/enti" className="text-sm text-kireo-orange underline underline-offset-2">← Tutti gli enti</Link>
        <p className="text-sm text-amber-200">Non siamo riusciti a leggere questo ente: ricarica la pagina.</p>
      </div>
    );
  }
  if (!ente) notFound();

  const [
    { data: scheda, error: erroreScheda },
    stats,
    { data: aree, error: erroreAree },
    { data: richieste, error: erroreRichieste },
    { data: eventi, count: contoEventi, error: erroreEventi },
    { data: post, count: contoPost, error: errorePost },
    { count: contoPostVisibili, error: errorePostVisibili },
    { data: newsletter, count: contoNewsletter, error: erroreNewsletter },
    { data: conversazioni, count: contoConversazioni, error: erroreConversazioni },
    flusso,
  ] = await Promise.all([
    supabase.rpc("scheda_admin_ente", { p_istituzione_id: id }),
    caricaStatisticheDiUnEnte(id),
    supabase.from("istituzioni_aree").select("id, area_slug, stato, revocata_il, motivo_revoca").eq("istituzione_id", id).order("area_slug", { ascending: true }),
    supabase.from("richieste_upgrade").select("id, stato, note, created_at, piani(nome)").eq("istituzione_id", id).order("created_at", { ascending: false }),
    supabase.from("eventi").select("id, titolo, stato, data_inizio", { count: "exact" }).eq("organizzatore_id", id).order("data_inizio", { ascending: false }).limit(ULTIMI),
    supabase.from("post_enti").select("id, corpo, stato, created_at", { count: "exact" }).eq("istituzione_id", id).order("created_at", { ascending: false }).limit(ULTIMI),
    supabase.from("post_enti").select("id", { count: "exact", head: true }).eq("istituzione_id", id).eq("visibile", true),
    supabase.from("newsletter_enti").select("id, oggetto, stato, created_at", { count: "exact" }).eq("istituzione_id", id).neq("stato", "bozza").order("created_at", { ascending: false }).limit(ULTIMI),
    supabase.from("conversazioni_enti").select("id, stato, created_at, profiles!student_id(nome, cognome)", { count: "exact" }).eq("istituzione_id", id).order("created_at", { ascending: false }).limit(50),
    leggiFlusso(supabase, new Date(), id),
  ]);
  for (const [cosa, e] of [
    ["scheda", erroreScheda],
    ["aree", erroreAree],
    ["cambi di piano", erroreRichieste],
    ["eventi", erroreEventi],
    ["post", errorePost],
    ["post visibili", errorePostVisibili],
    ["newsletter", erroreNewsletter],
    ["conversazioni", erroreConversazioni],
  ] as const) {
    if (e) console.error(`[admin] ente, ${cosa}:`, descriviErrore(e));
  }
  const schedaLetta = erroreScheda ? null : leggiScheda(scheda);
  const piano = uno(ente.piani as { nome?: string } | { nome?: string }[] | null)?.nome ?? "";
  const riquadri = stats ? riquadriIndice(stats) : null;

  return (
    <div className="space-y-10">
      <div>
        <Link href="/admin/enti" className="text-sm text-kireo-orange underline underline-offset-2">← Tutti gli enti</Link>
        <h1 className="mt-3 py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">{ente.nome}</h1>
      </div>

      <section id="chi" className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-kireo-light">Chi è</h2>
        <p className="text-sm text-kireo-light">
          {ETICHETTA_TIPO_ENTE[ente.tipo as string] ?? ente.tipo ?? "Tipo non indicato"} · {ETICHETTA_STATO_ENTE[ente.stato as string] ?? ente.stato}
          {ente.provincia ? ` · Provincia di ${ente.provincia}` : ""}
        </p>
        <p className="text-xs text-kireo-muted">
          Registrato il {formattaData(ente.created_at as string, "long")}
          {ente.regolamento_accettato_il ? ` · regolamento accettato il ${formattaData(ente.regolamento_accettato_il as string, "long")}` : " · regolamento non ancora accettato"}
        </p>
        {ente.sito_ufficiale && (
          <a href={ente.sito_ufficiale as string} target="_blank" rel="noopener noreferrer" className="block break-all text-xs text-kireo-orange underline underline-offset-2">
            {ente.sito_ufficiale as string}
          </a>
        )}
        {ente.stato === "attiva" && ente.slug && (
          <Link href={`/istituzioni/${ente.slug}`} className="block text-xs text-kireo-orange underline underline-offset-2">La sua pagina pubblica →</Link>
        )}
        {ente.stato === "in_attesa" && <AttivaIstituzioneButton istituzioneId={ente.id as string} />}
        <h3 className="pt-2 font-heading text-base font-semibold text-kireo-light">Gli account dell&apos;ente</h3>
        {!schedaLetta ? (
          <p className="text-sm text-amber-200">{T.schedaNonLetta}</p>
        ) : schedaLetta.account.length === 0 ? (
          <p className="text-sm text-kireo-muted">{T.nessunAccount}</p>
        ) : (
          <ul className="space-y-1">
            {schedaLetta.account.map((a, i) => (
              <li key={`${a.email}-${i}`} className="text-sm text-kireo-light/90">
                {[a.nome, a.cognome].filter(Boolean).join(" ") || "Senza nome"} · {a.email ?? "email non letta"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="aree" className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-kireo-light">Le aree</h2>
        <p className="text-xs text-kireo-muted">{TESTI_AREE_ADMIN.spiegazione}</p>
        {erroreAree ? (
          <p className="text-sm text-amber-200">{TESTI_AREE_ADMIN.nonLette}</p>
        ) : !aree || aree.length === 0 ? (
          <p className="text-sm text-kireo-muted">Questo ente non ha ancora scelto un&apos;area.</p>
        ) : (
          <ul className="space-y-3">
            {aree.map((a) => (
              <li key={a.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <p className="text-sm font-semibold text-kireo-light">{getAreaBySlug(a.area_slug as string)?.nome ?? a.area_slug}</p>
                {a.stato === "rifiutata" ? (
                  <p className="mt-1 text-xs text-red-300">
                    Tolta{a.revocata_il ? ` il ${formattaData(a.revocata_il as string, "long")}` : ""}
                    {a.motivo_revoca ? `: ${a.motivo_revoca}` : ""}
                  </p>
                ) : (
                  <RevocaArea istituzioneId={ente.id as string} areaSlug={a.area_slug as string} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="piano" className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-kireo-light">Il piano</h2>
        <p className="text-sm text-kireo-light">
          {ETICHETTA_PIANO[piano] ?? (piano || "Piano non indicato")}
          {ente.piano_attivato_il ? ` · attivo dal ${formattaData(ente.piano_attivato_il as string, "long")}` : ""}
          {ente.piano_scade_il ? ` · fino al ${formattaData(ente.piano_scade_il as string, "long")}` : ""}
        </p>
        <h3 className="pt-2 font-heading text-base font-semibold text-kireo-light">Richieste di cambio piano</h3>
        {erroreRichieste ? (
          <p className="text-sm text-amber-200">Non siamo riusciti a leggere le richieste di cambio piano: ricarica la pagina.</p>
        ) : !richieste || richieste.length === 0 ? (
          <p className="text-sm text-kireo-muted">Nessuna richiesta di cambio piano.</p>
        ) : (
          <ul className="space-y-3">
            {richieste.map((r) => {
              const verso = uno(r.piani as { nome?: string } | { nome?: string }[] | null)?.nome ?? "";
              return (
                <li key={r.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="text-sm font-semibold text-kireo-light">→ {ETICHETTA_PIANO[verso] ?? verso}</p>
                  <p className="mt-1 text-xs text-kireo-muted">richiesta il {formattaData(r.created_at as string, "long")} · {r.stato}</p>
                  {r.note && <p className="mt-2 text-sm text-kireo-light/90">{r.note}</p>}
                  {r.stato === "in_attesa" && <AzioneApprovazioneUpgrade richiestaId={r.id as string} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="pubblica" className="space-y-4">
        <h2 className="font-heading text-xl font-semibold text-kireo-light">Cosa pubblica</h2>
        <div>
          <h3 className="font-heading text-base font-semibold text-kireo-light">Eventi · {erroreEventi ? "non letti" : (contoEventi ?? "non contati")}</h3>
          {!erroreEventi && (eventi ?? []).length > 0 && (
            <ul className="mt-1 space-y-1">
              {(eventi ?? []).map((e) => (
                <li key={e.id} className="text-sm text-kireo-light/90">
                  <Link href={`/diretta/${e.id}`} className="underline-offset-2 hover:underline">{e.titolo}</Link>
                  <span className="text-xs text-kireo-muted"> · {e.stato} · {formattaDataOra(e.data_inizio as string, "long")}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/admin/eventi?q=${encodeURIComponent(ente.nome as string)}`} className="mt-1 inline-block text-xs text-kireo-orange underline underline-offset-2">
            I suoi eventi nell&apos;elenco →
          </Link>
        </div>
        <div>
          <h3 className="font-heading text-base font-semibold text-kireo-light">
            Post · {errorePost ? "non letti" : (contoPost ?? "non contati")}
            {!errorePost && !errorePostVisibili && contoPostVisibili !== null && <span className="text-sm font-normal text-kireo-muted"> · nel feed adesso: {contoPostVisibili}</span>}
          </h3>
          {!errorePost && (post ?? []).length > 0 && (
            <ul className="mt-1 space-y-1">
              {(post ?? []).map((p) => (
                <li key={p.id} className="text-sm text-kireo-light/90">
                  {(p.corpo as string).slice(0, 100)}
                  <span className="text-xs text-kireo-muted"> · {p.stato} · {formattaDataOra(p.created_at as string, "long")}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/admin/post?q=${encodeURIComponent(ente.nome as string)}`} className="mt-1 inline-block text-xs text-kireo-orange underline underline-offset-2">
            I suoi post nell&apos;elenco →
          </Link>
        </div>
        <div>
          <h3 className="font-heading text-base font-semibold text-kireo-light">Newsletter · {erroreNewsletter ? "non lette" : (contoNewsletter ?? "non contate")}</h3>
          {!erroreNewsletter && (newsletter ?? []).length > 0 && (
            <ul className="mt-1 space-y-1">
              {(newsletter ?? []).map((n) => (
                <li key={n.id} className="text-sm text-kireo-light/90">
                  {n.oggetto}
                  <span className="text-xs text-kireo-muted"> · {n.stato} · scritta il {formattaData(n.created_at as string, "long")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="font-heading text-base font-semibold text-kireo-light">Guide</h3>
          {!stats ? (
            <p className="text-sm text-amber-200">{T.statisticheNonLette}</p>
          ) : stats.guide.per_guida.length === 0 ? (
            <p className="text-sm text-kireo-muted">Nessuna guida caricata.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {stats.guide.per_guida.map((g) => (
                <li key={g.guida_id} className="text-sm text-kireo-light/90">
                  {g.titolo}
                  <span className="text-xs text-kireo-muted">
                    {" "}· caricata il {formattaData(g.caricata_il, "long")}
                    {g.cancellata ? " · cancellata" : g.archiviata_il ? " · in archivio" : " · pubblica"} · scaricamenti: {g.scaricamenti}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="numeri" className="space-y-3">
        <h2 className="font-heading text-xl font-semibold text-kireo-light">I suoi numeri</h2>
        <p className="text-xs text-kireo-muted">Gli stessi che l&apos;ente vede nelle sue statistiche.</p>
        {schedaLetta ? <p className="text-sm text-kireo-light">{testoSeguaci(schedaLetta)}</p> : <p className="text-sm text-amber-200">{T.schedaNonLetta}</p>}
        {!riquadri ? (
          <p className="text-sm text-amber-200">{T.statisticheNonLette}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {riquadri.map((r) => (
              <div key={r.chiave} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <p className="text-xs uppercase tracking-wide text-kireo-muted">{r.titolo}</p>
                <p className="mt-1 text-xs text-kireo-muted">{r.etichetta}</p>
                <p className="font-heading text-2xl font-bold text-kireo-light">{r.valore}</p>
                <p className="mt-1 text-xs text-kireo-muted">{r.sotto}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="conversazioni" className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-kireo-light">
          Conversazioni{!erroreConversazioni && contoConversazioni !== null ? ` · ${contoConversazioni}` : ""}
        </h2>
        <p className="text-xs text-kireo-muted">{T.conversazioniNota}</p>
        {erroreConversazioni ? (
          <p className="text-sm text-amber-200">Non siamo riusciti a leggere le conversazioni: ricarica la pagina.</p>
        ) : !conversazioni || conversazioni.length === 0 ? (
          <p className="text-sm text-kireo-muted">Nessuna conversazione con studenti.</p>
        ) : (
          <ul className="space-y-3">
            {conversazioni.map((c) => {
              const studente = uno(c.profiles as { nome?: string; cognome?: string } | { nome?: string; cognome?: string }[] | null);
              const segnalata = c.stato === "bloccata_da_studente";
              return (
                <li key={c.id} className={`rounded-xl border p-4 ${segnalata ? "border-red-500/40 bg-red-500/5" : "border-white/5 bg-kireo-card"}`}>
                  <p className="text-sm font-semibold text-kireo-light">
                    {studente?.nome ?? "Studente"} {studente?.cognome ?? ""}
                  </p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {segnalata ? "segnalata: bloccata dallo studente" : c.stato} · {formattaData(c.created_at as string, "long")}
                  </p>
                  {c.stato !== "chiusa_da_admin" && (
                    <div className="mt-2">
                      <AzioneChiudiConversazione id={c.id as string} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!erroreConversazioni && (contoConversazioni ?? 0) > 50 && (
          <p className="text-xs text-kireo-muted">Mostrate le 50 più recenti di {contoConversazioni}.</p>
        )}
      </section>

      <section id="attivita" className="space-y-4">
        <h2 className="font-heading text-xl font-semibold text-kireo-light">Cosa ha fatto negli ultimi {GIORNI_FINESTRA_ADMIN} giorni</h2>
        <GruppiFlusso gruppi={flusso} />
      </section>
    </div>
  );
}
