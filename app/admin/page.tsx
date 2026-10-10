import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import AzioneApprovazione from "@/components/admin/AzioneApprovazione";
import AzioneApprovazioneUpgrade from "@/components/admin/AzioneApprovazioneUpgrade";
import AttivaIstituzioneButton from "@/components/admin/AttivaIstituzioneButton";
import AttivaScuolaControlli from "@/components/admin/AttivaScuolaControlli";
import ToggleGestitaRichiesta from "@/components/admin/ToggleGestitaRichiesta";
import GestisciVideoDirettaForm from "@/components/admin/GestisciVideoDirettaForm";
import GestisciChiaveTrasmissioneForm from "@/components/admin/GestisciChiaveTrasmissioneForm";
import ControlloDirettaEvento from "@/components/ente/ControlloDirettaEvento";
import AzioneApprovazionePost from "@/components/admin/AzioneApprovazionePost";
import AzioneChiudiConversazione from "@/components/admin/AzioneChiudiConversazione";
import LogoutButton from "@/components/LogoutButton";
import { ETICHETTA_PIANO } from "@/lib/ente/pianoSuccessivo";
import { getFiloneBySlug } from "@/data/filoniDocenti";
import { formattaData, formattaDataOra } from "@/lib/formato";

export default async function AdminPage() {
  const { supabase, nome } = await requireAdmin();

  const [
    { data: istituzioniInAttesa },
    { data: eventiInApprovazione },
    { data: comunicazioniInApprovazione },
    { data: richiesteUpgrade },
    { data: scuoleInAttesa },
    { data: messaggiScuola },
    { data: richiesteContatto },
    { data: webinarApprovati },
    { data: postInApprovazione },
    { data: conversazioniEnti },
  ] = await Promise.all([
    supabase.from("istituzioni").select("id, nome, tipo, created_at").eq("stato", "in_attesa").order("created_at", { ascending: true }),
    supabase
      .from("eventi")
      .select("id, titolo, descrizione, tipo, data_inizio, cta_esterna_url, pubblico, filone, hosting_diretta, youtube_video_id, istituzioni(nome)")
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
    supabase
      .from("richieste_contatto")
      .select("id, origine, nome, ruolo, istituto, codice_meccanografico, email, messaggio, created_at")
      .eq("gestita", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("eventi")
      .select(
        "id, titolo, pubblico, hosting_diretta, youtube_video_id, data_inizio, data_fine, domanda_consegna, diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_presenti, diretta_chiusa_certificati, istituzioni(nome)",
      )
      .eq("tipo", "webinar")
      .eq("stato", "approvato")
      .order("data_inizio", { ascending: false })
      .limit(30),
    supabase
      .from("post_enti")
      .select("id, tipo, corpo, immagine_url, embed_url, created_at, istituzioni(nome)")
      .eq("stato", "in_approvazione")
      .order("created_at", { ascending: true }),
    supabase
      .from("conversazioni_enti")
      .select("id, stato, created_at, profiles!student_id(nome, cognome), istituzioni(nome)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // QUANDO È STATA PREPARATA, non la chiave: l'admin deve sapere se c'è e da
  // quando, e un valore segreto ricaricato a schermo a ogni apertura della
  // coda sarebbe esposto senza che nessuno l'abbia chiesto. L'errore si
  // logga: una lettura muta qui farebbe dire «non preparata» su una chiave
  // che c'è, e l'admin la sostituirebbe per niente.
  const eventiKireo = (webinarApprovati ?? []).filter((e) => e.hosting_diretta === "kireo").map((e) => e.id);
  const chiavePerEvento = new Map<string, string>();
  if (eventiKireo.length > 0) {
    const { data: chiavi, error: erroreChiavi } = await supabase
      .from("chiavi_trasmissione")
      .select("evento_id, aggiornata_il")
      .in("evento_id", eventiKireo);
    if (erroreChiavi) console.error("[admin] chiavi_trasmissione:", erroreChiavi);
    for (const riga of chiavi ?? []) chiavePerEvento.set(riga.evento_id, riga.aggiornata_il);
  }

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
                    {formattaDataOra(e.data_inizio, "long")}
                    {e.pubblico === "docenti" && ` · Docenti · ${getFiloneBySlug(e.filone)?.nome ?? e.filone}`}
                  </p>
                  <p className="mt-2 text-sm text-kireo-light/90">{e.descrizione}</p>
                  {e.cta_esterna_url && (
                    <p className="mt-2 text-xs text-kireo-muted">CTA esterna richiesta: {e.cta_esterna_url}</p>
                  )}
                  {e.tipo === "webinar" && (
                    <p className="mt-2 text-xs text-kireo-muted">
                      Hosting diretta: {e.hosting_diretta === "proprio" ? "canale proprio dell'ente" : "ospitata da KIREO"}
                    </p>
                  )}
                  {e.tipo === "webinar" && e.hosting_diretta === "kireo" && (
                    <GestisciVideoDirettaForm eventoId={e.id} videoIdAttuale={e.youtube_video_id} />
                  )}
                  <AzioneApprovazione tabella="eventi" id={e.id} statoApprovato="approvato" statoRifiutato="rifiutato" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Dirette webinar</h2>
        <p className="mt-1 text-xs text-kireo-muted">
          Stato/presenti in tempo reale, kill switch sul video, chiusura al posto dell&apos;ente, export presenze.
        </p>
        {!webinarApprovati || webinarApprovati.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessun webinar approvato al momento.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {webinarApprovati.map((e) => {
              const organizzatore = Array.isArray(e.istituzioni) ? e.istituzioni[0] : e.istituzioni;
              return (
                <li key={e.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">{e.titolo}</p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {organizzatore?.nome ?? "KIREO"} · {e.pubblico === "docenti" ? "Docenti" : "Studenti"} ·{" "}
                    {formattaDataOra(e.data_inizio, "long")} · hosting:{" "}
                    {e.hosting_diretta === "proprio" ? "canale dell'ente" : "KIREO"}
                  </p>
                  {e.hosting_diretta === "kireo" && (
                    <>
                      <GestisciVideoDirettaForm eventoId={e.id} videoIdAttuale={e.youtube_video_id} />
                      {/* La chiave sta accanto al video perché è lo stesso
                          momento in cui l'admin prepara la diretta: altrove
                          sarebbe un gesto in più da ricordare, e il gesto che
                          si ricorda a parte è quello che si dimentica. */}
                      <GestisciChiaveTrasmissioneForm eventoId={e.id} aggiornataIl={chiavePerEvento.get(e.id) ?? null} />
                    </>
                  )}
                  {/* ⚠️ LA PORTA VERSO LA PAGINA DI QUELL'EVENTO, e sta in
                      cima: durante una diretta si modera da lì, non scorrendo
                      questa lista mentre la pagina attorno parla di istituzioni
                      in attesa. Una funzione che esiste e non si raggiunge è il
                      difetto del 28/09 («la consegna, completa e senza porta»):
                      il pannello qui sotto resta per chi apre questa pagina per
                      altro, ma il posto in cui si sta quaranta minuti è l'altro. */}
                  <div className="mt-3">
                    <Link href={`/diretta/${e.id}`} className="text-sm font-semibold text-kireo-orange underline underline-offset-2">
                      Apri la pagina di questa diretta →
                    </Link>
                  </div>
                  <ControlloDirettaEvento
                    eventoId={e.id}
                    domandaConsegna={e.domanda_consegna}
                    dataInizio={e.data_inizio}
                    dataFine={e.data_fine}
                    chiusaIl={e.diretta_chiusa_il}
                    chiusaDaTipo={e.diretta_chiusa_da_tipo}
                    chiusaPresenti={e.diretta_chiusa_presenti}
                    chiusaCertificati={e.diretta_chiusa_certificati}
                  />
                  <div className="mt-3">
                    <a href={`/api/admin/presenze/${e.id}`} className="text-xs text-kireo-orange underline underline-offset-2">
                      Esporta presenze (CSV)
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Post in approvazione</h2>
        {!postInApprovazione || postInApprovazione.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessun post in coda.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {postInApprovazione.map((p) => {
              const organizzatore = Array.isArray(p.istituzioni) ? p.istituzioni[0] : p.istituzioni;
              return (
                <li key={p.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">
                    {organizzatore?.nome ?? "—"} ·{" "}
                    <span className="text-xs font-normal uppercase tracking-wide text-kireo-muted">{p.tipo}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{p.corpo}</p>
                  {p.immagine_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.immagine_url} alt="" className="mt-3 max-h-64 rounded-lg object-cover" />
                  )}
                  {p.embed_url && (
                    <a href={p.embed_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-kireo-orange underline underline-offset-2">
                      {p.embed_url}
                    </a>
                  )}
                  <AzioneApprovazionePost id={p.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Conversazioni enti</h2>
        <p className="mt-1 text-xs text-kireo-muted">Ispezione completa (ultime 50) — le segnalate (bloccate dallo studente) sono evidenziate.</p>
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
                      richiesta il {formattaData(s.created_at, "long")}
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
                    {nomeScuola ?? "Scuola"} · {m.destinatari} · {formattaDataOra(m.created_at, "long")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{m.corpo}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Richieste di contatto</h2>
        {/* ⚠️ NON ENUMERA LE ORIGINI, e non per brevità: diceva «Dalle landing
            del funnel scuole (/dirigenti, /scuole)» e dal 10/10/2026 le origini
            sono quattro — /istituzioni e /contatti erano arrivate senza che
            questa riga lo sapesse. Il badge di ogni riga dice la sua origine,
            quindi qui non c'è niente da elencare: una frase che può tacere una
            lista è la versione che non invecchia. */}
        <p className="mt-1 text-xs text-kireo-muted">
          Ogni riga porta la propria origine — e sparisce dalla coda una volta segnata come gestita.
        </p>
        {!richiesteContatto || richiesteContatto.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessuna richiesta da gestire.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {richiesteContatto.map((r) => (
              <li key={r.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="mr-2 inline-block rounded-full bg-kireo-orange/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-orange">
                      {r.origine}
                    </span>
                    <p className="mt-1 font-heading text-sm font-semibold text-kireo-light">
                      {r.nome} · {r.ruolo}
                    </p>
                    {/* `istituto` è nullable dal 10/10/2026 (origine=contatti):
                        le parti si uniscono invece di essere incollate a mano,
                        altrimenti un istituto assente lascia un « · » orfano in
                        testa alla riga. */}
                    <p className="mt-1 text-xs text-kireo-muted">
                      {[
                        r.istituto
                          ? `${r.istituto}${r.codice_meccanografico ? ` (${r.codice_meccanografico})` : ""}`
                          : r.codice_meccanografico,
                        // Data E ORA: una coda di contatti è un elenco di
                        // lavoro, e in un elenco di lavoro QUANDO è parte
                        // dell'informazione — dice cosa è urgente, cosa è
                        // vecchio, e se due righe sono la stessa persona che ha
                        // riprovato. Il 10/10/2026 due messaggi arrivati a
                        // undici minuti di distanza dicevano la stessa data e
                        // dalla coda non si distinguevano.
                        formattaDataOra(r.created_at, "long"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {/* ⚠️ QUI C'ERA UN BOTTONE «RISPONDI», E SI RISPONDE
                        DALL'EMAIL. Apriva un `mailto:`, cioè il programma di
                        posta predefinito del computer — che sul Mac di Mario è
                        configurato con il suo indirizzo personale. Quindi il
                        bottone costruito per rispondere a nome di KIREO
                        componeva un messaggio da un indirizzo privato verso un
                        dirigente scolastico che aveva scritto a kireo.it: non
                        scomodo, SBAGLIATO. E un `mailto:` non può scegliere il
                        mittente — lo decide il programma di posta, non noi —
                        quindi non è una cosa che si aggiusta con un parametro.
                        La strada vera è il `Reply-To` sull'avviso che arriva a
                        info@kireo.it (vedi `app/api/richiesta-contatto`): si
                        risponde da dove si sta leggendo.

                        ⚠️ E NON SI COSTRUISCE QUI UNA RISPOSTA DENTRO KIREO,
                        che è l'altra tentazione di questo punto esatto. Un
                        testo mandato da qui partirebbe da `noreply@`, quindi
                        chi lo riceve non potrebbe rispondere a sua volta; o gli
                        si mette un Reply-To, e allora la controrisposta arriva
                        in casella, fuori da qui. In tutti e due i casi la coda
                        mostrerebbe quello che abbiamo scritto noi e non quello
                        che ci ha risposto lui — un archivio che mostra un lato
                        solo di uno scambio è peggio di nessun archivio, perché
                        chi lo apre non sa che manca qualcosa. Varrà la pena il
                        giorno in cui la coda la gestisce qualcuno oltre a
                        Mario: allora «chi ha risposto cosa» serve a due persone
                        e diventa un dato.

                        Qui resta l'indirizzo, `select-all` così un clic lo
                        prende tutto: serve a chi dalla coda vuole scrivere da
                        zero, e non fa partire niente da nessuna identità. */}
                    <p className="mt-1 text-xs">
                      <span className="text-kireo-muted">Ha scritto da </span>
                      <span className="select-all text-kireo-light/90">{r.email}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleGestitaRichiesta id={r.id} gestita={false} />
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{r.messaggio}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
