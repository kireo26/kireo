import { requireAdmin } from "@/lib/admin/context";
import AzioneApprovazione from "@/components/admin/AzioneApprovazione";
import AzioneApprovazioneUpgrade from "@/components/admin/AzioneApprovazioneUpgrade";
import AttivaIstituzioneButton from "@/components/admin/AttivaIstituzioneButton";
import AttivaScuolaControlli from "@/components/admin/AttivaScuolaControlli";
import LogoutButton from "@/components/LogoutButton";
import { ETICHETTA_PIANO } from "@/lib/ente/pianoSuccessivo";
import { getFiloneBySlug } from "@/data/filoniDocenti";

export default async function AdminPage() {
  const { supabase, nome } = await requireAdmin();

  const [
    { data: istituzioniInAttesa },
    { data: eventiInApprovazione },
    { data: comunicazioniInApprovazione },
    { data: richiesteUpgrade },
    { data: scuoleInAttesa },
    { data: messaggiScuola },
  ] = await Promise.all([
    supabase.from("istituzioni").select("id, nome, tipo, created_at").eq("stato", "in_attesa").order("created_at", { ascending: true }),
    supabase
      .from("eventi")
      .select("id, titolo, descrizione, tipo, data_inizio, cta_esterna_url, pubblico, filone, istituzioni(nome)")
      .eq("stato", "in_approvazione")
      .order("created_at", { ascending: true }),
    supabase
      .from("comunicazioni")
      .select("id, oggetto, corpo, tipo, istituzioni(nome)")
      .eq("stato", "in_approvazione")
      .order("created_at", { ascending: true }),
    supabase
      .from("richieste_upgrade")
      .select("id, note, created_at, istituzioni(nome), piani(nome, prezzo_min, prezzo_max)")
      .eq("stato", "in_attesa")
      .order("created_at", { ascending: true }),
    supabase
      .from("scuole_profili")
      .select("id, scuola_id, stato, convenzione_firmata_il, created_at")
      .in("stato", ["richiesta", "convenzionata"])
      .order("created_at", { ascending: true }),
    supabase.from("messaggi_scuola").select("id, scuola_profilo_id, oggetto, corpo, destinatari, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  const { data: scuoleProfiloPerMessaggio } =
    messaggiScuola && messaggiScuola.length > 0
      ? await supabase.from("scuole_profili").select("id, scuola_id").in("id", messaggiScuola.map((m) => m.scuola_profilo_id))
      : { data: [] as { id: string; scuola_id: string }[] };
  const scuolaIdPerProfilo = new Map((scuoleProfiloPerMessaggio ?? []).map((s) => [s.id, s.scuola_id]));

  const scuoleIds = Array.from(
    new Set([...(scuoleInAttesa ?? []).map((s) => s.scuola_id), ...(scuoleProfiloPerMessaggio ?? []).map((s) => s.scuola_id)]),
  );
  const { data: nomiScuole } =
    scuoleIds.length > 0
      ? await supabase.from("schools").select("codice_meccanografico, denominazione").in("codice_meccanografico", scuoleIds)
      : { data: [] as { codice_meccanografico: string; denominazione: string }[] };
  const nomeScuolaPerCodice = new Map((nomiScuole ?? []).map((s) => [s.codice_meccanografico, s.denominazione]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-20 sm:pt-28">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Admin KIREO</p>
          <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Ciao {nome}</h1>
        </div>
        <LogoutButton />
      </div>

      <section className="mb-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Istituzioni in attesa</h2>
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
                      {i.tipo} · richiesta il {new Date(i.created_at).toLocaleDateString("it-IT", { dateStyle: "long" })}
                    </p>
                  </div>
                  <AttivaIstituzioneButton istituzioneId={i.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Eventi in approvazione</h2>
        {!eventiInApprovazione || eventiInApprovazione.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessun evento in coda.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {eventiInApprovazione.map((e) => {
              const organizzatore = Array.isArray(e.istituzioni) ? e.istituzioni[0] : e.istituzioni;
              return (
                <li key={e.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">{e.titolo}</p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {organizzatore?.nome ?? "KIREO"} · {e.tipo} ·{" "}
                    {new Date(e.data_inizio).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })}
                    {e.pubblico === "docenti" && ` · Docenti · ${getFiloneBySlug(e.filone)?.nome ?? e.filone}`}
                  </p>
                  <p className="mt-2 text-sm text-kireo-light/90">{e.descrizione}</p>
                  {e.cta_esterna_url && (
                    <p className="mt-2 text-xs text-kireo-muted">CTA esterna richiesta: {e.cta_esterna_url}</p>
                  )}
                  <AzioneApprovazione tabella="eventi" id={e.id} statoApprovato="approvato" statoRifiutato="rifiutato" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Comunicazioni in approvazione</h2>
        {!comunicazioniInApprovazione || comunicazioniInApprovazione.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessuna comunicazione in coda.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {comunicazioniInApprovazione.map((c) => {
              const ente = Array.isArray(c.istituzioni) ? c.istituzioni[0] : c.istituzioni;
              return (
                <li key={c.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">{c.oggetto}</p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {ente?.nome ?? "—"} · {c.tipo === "newsletter" ? "Newsletter" : "Comunicazione mirata"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{c.corpo}</p>
                  <AzioneApprovazione tabella="comunicazioni" id={c.id} statoApprovato="approvata" statoRifiutato="rifiutata" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Richieste di upgrade</h2>
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
                    richiesta il {new Date(r.created_at).toLocaleDateString("it-IT", { dateStyle: "long" })}
                  </p>
                  {r.note && <p className="mt-2 text-sm text-kireo-light/90">{r.note}</p>}
                  <AzioneApprovazioneUpgrade richiestaId={r.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Scuole in attesa di attivazione</h2>
        {!scuoleInAttesa || scuoleInAttesa.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessuna scuola in attesa.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {scuoleInAttesa.map((s) => (
              <li key={s.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-semibold text-kireo-light">
                      {nomeScuolaPerCodice.get(s.scuola_id) ?? s.scuola_id}
                    </p>
                    <p className="mt-1 text-xs text-kireo-muted">
                      richiesta il {new Date(s.created_at).toLocaleDateString("it-IT", { dateStyle: "long" })}
                    </p>
                  </div>
                  <AttivaScuolaControlli
                    scuolaProfiloId={s.id}
                    stato={s.stato}
                    convenzioneFirmataIl={s.convenzione_firmata_il}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Messaggi delle scuole</h2>
        <p className="mt-1 text-xs text-kireo-muted">Sola lettura, a posteriori — le comunicazioni scuola→studenti non passano da revisione KIREO.</p>
        {!messaggiScuola || messaggiScuola.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessun messaggio inviato finora.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {messaggiScuola.map((m) => {
              const scuolaId = scuolaIdPerProfilo.get(m.scuola_profilo_id);
              const nomeScuola = scuolaId ? nomeScuolaPerCodice.get(scuolaId) : undefined;
              return (
                <li key={m.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">{m.oggetto}</p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {nomeScuola ?? "Scuola"} · {m.destinatari} · {new Date(m.created_at).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{m.corpo}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
