import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import AzioneApprovazione from "@/components/admin/AzioneApprovazione";
import AzioneApprovazioneUpgrade from "@/components/admin/AzioneApprovazioneUpgrade";
import AttivaIstituzioneButton from "@/components/admin/AttivaIstituzioneButton";
import AttivaScuolaControlli from "@/components/admin/AttivaScuolaControlli";
import ToggleGestitaRichiesta from "@/components/admin/ToggleGestitaRichiesta";
import TogliPost from "@/components/admin/TogliPost";
import RiprovaAvvisoEnte from "@/components/admin/RiprovaAvvisoEnte";
import { TESTI_AVVISI, avvisiDaRiprovare, type RigaAvviso } from "@/lib/admin/avvisiEnte";
import NotificheBell from "@/components/app/NotificheBell";
import AzioneChiudiConversazione from "@/components/admin/AzioneChiudiConversazione";
import LogoutButton from "@/components/LogoutButton";
import { ETICHETTA_PIANO } from "@/lib/ente/pianoSuccessivo";
import { formattaData, formattaDataOra } from "@/lib/formato";
import { contaDaApprovare } from "@/lib/admin/caricaEventiAdmin";
import { etichettaDaApprovare } from "@/lib/admin/eventiAdmin";
import { descriviErrore } from "@/lib/erroreSupabase";
import { etichettaStatoPost, leggiMotiviPost, rigaMotivo } from "@/lib/ente/post";
import { immagineDelPost } from "@/lib/post/contenuti";

export default async function AdminPage() {
  const { supabase, nome, userId } = await requireAdmin();

  const [
    { data: istituzioniInAttesa },
    { data: newsletterInApprovazione, error: erroreNewsletter },
    { data: richiesteUpgrade },
    { data: scuoleInAttesa },
    { data: messaggiScuola },
    { data: richiesteContatto },
    { data: postEnti, error: errorePostEnti },
    { data: conversazioniEnti },
    daApprovare,
    { data: righeAvvisi, error: erroreAvvisi },
  ] = await Promise.all([
    supabase.from("istituzioni").select("id, nome, tipo, created_at").eq("stato", "in_attesa").order("created_at", { ascending: true }),
    supabase
      .from("newsletter_enti")
      .select("id, oggetto, corpo, giorno, ultimo_giorno, istituzione_id, istituzioni(nome)")
      .eq("stato", "in_approvazione")
      .order("giorno", { ascending: true }),
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
      .from("post_enti")
      .select("id, tipo, corpo, immagine_url, embed_url, link_titolo, allegato_nome, stato, visibile, visibile_dal, tolto_il, created_at, istituzioni(nome)")
      .in("stato", ["pubblicato", "approvato", "tolto"])
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("conversazioni_enti")
      .select("id, stato, created_at, profiles!student_id(nome, cognome), istituzioni(nome)")
      .order("created_at", { ascending: false })
      .limit(50),
    contaDaApprovare(supabase),
    supabase
      .from("avvisi_email_enti")
      .select("cosa, riferimento_id, esito, motivo, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // Le email all'ente non partite (30/10, `avvisi_email_enti`): la decisione è
  // presa e la sua riga è uscita dalla coda, quindi l'esito si legge qui e non
  // là. Un elenco che non si legge lo dice, invece di sembrare vuoto.
  if (erroreAvvisi) console.error("[admin] esiti delle email agli enti:", descriviErrore(erroreAvvisi));
  const avvisiFalliti = erroreAvvisi ? null : avvisiDaRiprovare((righeAvvisi ?? []) as RigaAvviso[]);
  const idEventiAvvisi = (avvisiFalliti ?? []).filter((a) => a.cosa === "evento").map((a) => a.riferimento_id);
  const idNewsletterAvvisi = (avvisiFalliti ?? []).filter((a) => a.cosa === "newsletter").map((a) => a.riferimento_id);
  const [{ data: titoliEventi }, { data: titoliNewsletter }] = await Promise.all([
    idEventiAvvisi.length > 0
      ? supabase.from("eventi").select("id, titolo").in("id", idEventiAvvisi)
      : Promise.resolve({ data: [] as { id: string; titolo: string }[] }),
    idNewsletterAvvisi.length > 0
      ? supabase.from("newsletter_enti").select("id, oggetto").in("id", idNewsletterAvvisi)
      : Promise.resolve({ data: [] as { id: string; oggetto: string }[] }),
  ]);
  const titoloAvviso = new Map<string, string>([
    ...(titoliEventi ?? []).map((e) => [e.id, e.titolo] as [string, string]),
    ...(titoliNewsletter ?? []).map((n) => [n.id, n.oggetto] as [string, string]),
  ]);


  // I post degli enti (29/10): si pubblicano subito, e da qui si tolgono. Per
  // ognuno quante notifiche «Nuovo post» sono già partite, che la conferma
  // dice prima del gesto; `null` se non si è riusciti a contarle.
  const idPost = (postEnti ?? []).map((p) => p.id as string);
  const { data: notifichePost, error: erroreNotifichePost } =
    idPost.length > 0
      ? await supabase.from("notifiche_studenti").select("riferimento_id").eq("tipo", "nuovo_post").in("riferimento_id", idPost)
      : { data: [] as { riferimento_id: string }[], error: null };
  if (errorePostEnti) console.error("[admin] post degli enti:", descriviErrore(errorePostEnti));
  if (erroreNotifichePost) console.error("[admin] notifiche dei post:", descriviErrore(erroreNotifichePost));
  const notifichePerPost = new Map<string, number>();
  for (const n of notifichePost ?? []) notifichePerPost.set(n.riferimento_id, (notifichePerPost.get(n.riferimento_id) ?? 0) + 1);
  const motiviPost = await leggiMotiviPost(supabase, (postEnti ?? []).filter((p) => p.stato === "tolto").map((p) => p.id as string));

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
        <div className="flex items-center gap-3">
          <NotificheBell userId={userId} />
          <LogoutButton />
        </div>
      </div>

      {(avvisiFalliti === null || avvisiFalliti.length > 0) && (
        <section className="mb-12">
          <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-orange">{TESTI_AVVISI.titolo}</h2>
          {avvisiFalliti === null ? (
            <p className="mt-4 text-sm text-red-300">{TESTI_AVVISI.nonLetto}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-kireo-muted">{TESTI_AVVISI.spiegazione}</p>
              <ul className="mt-4 space-y-3">
                {avvisiFalliti.map((a) => (
                  <li key={`${a.cosa}:${a.riferimento_id}`} className="rounded-xl border border-kireo-orange/30 bg-kireo-card p-4">
                    <p className="text-sm text-kireo-light">
                      {a.cosa === "evento" ? "Evento" : "Newsletter"} «{titoloAvviso.get(a.riferimento_id) ?? a.riferimento_id}» ·{" "}
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
      )}

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

      {/* GLI EVENTI HANNO UNA PAGINA LORO dal 27/10 (`/admin/eventi`): qui
          c'erano la coda delle approvazioni e trenta dirette, ognuna con la
          sua console — una plancia per riga. Ora la coda dice il numero e
          porta là; la plancia di un evento sta nella pagina dell'evento. */}
      <section className="mb-12">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Eventi</h2>
        <p className="mt-4 text-sm text-kireo-light">
          <Link href="/admin/eventi" className="font-semibold text-kireo-orange underline underline-offset-2">
            {etichettaDaApprovare(daApprovare)} →
          </Link>
        </p>
        {/* ⚠️ UNA FRASE DI TRANSIZIONE (Mario, 27/10): parla a chi ricorda la
            coda di prima, dove qui c'erano gli eventi stessi. Non si cambia
            adesso; si toglie quando nessuno ricorderà più com'era prima — il
            fatto che lo dice è il primo admin che non ha mai visto la coda di
            prima del 27/10. Sta nell'elenco «Le frasi di transizione» dei
            punti aperti di CLAUDE.md. */}
        <p className="mt-1 text-xs text-kireo-muted">In programmazione, eventi passati e rifiutati stanno nella stessa pagina.</p>
      </section>

      {/* I POST NON PASSANO PIÙ DA UNA CODA (Mario, 29/10): si pubblicano
          subito, l'admin riceve una notifica, e da qui si tolgono con una
          motivazione. Qui c'era «Post in approvazione». */}
      <section className="mb-12" id="post">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Post degli enti</h2>
        <p className="mt-1 text-xs text-kireo-muted">Si pubblicano subito. Un post che non rispetta il regolamento si toglie dal feed con un motivo, che arriva all&apos;ente.</p>
        {errorePostEnti ? (
          <p className="mt-4 text-sm text-amber-200">Non siamo riusciti a leggere i post: ricarica la pagina.</p>
        ) : !postEnti || postEnti.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessun post pubblicato.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {postEnti.map((p) => {
              const organizzatore = Array.isArray(p.istituzioni) ? p.istituzioni[0] : p.istituzioni;
              const stato = etichettaStatoPost(p.stato as string);
              const motivo = rigaMotivo(p.stato as string, motiviPost, p.id as string, (p.tolto_il as string | null) ?? null);
              return (
                <li key={p.id} id={`post-${p.id}`} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">
                    {organizzatore?.nome ?? "—"} ·{" "}
                    <span className="text-xs font-normal uppercase tracking-wide text-kireo-muted">{p.tipo}</span>{" "}
                    <span className={`ml-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stato.classe}`}>{stato.label}</span>
                  </p>
                  <p className="mt-1 text-xs text-kireo-muted">{formattaDataOra(p.created_at, "long")}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{p.corpo}</p>
                  {/* Un'immagine fuori dal nostro spazio dei file non si carica
                      nemmeno qui: si mostra l'indirizzo, che è il motivo per
                      cui toglierla (lib/post/contenuti.ts). */}
                  {p.immagine_url &&
                    (immagineDelPost(p.immagine_url as string, process.env.NEXT_PUBLIC_SUPABASE_URL) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.immagine_url as string} alt="" className="mt-3 max-h-64 rounded-lg object-cover" />
                    ) : (
                      <p className="mt-2 text-xs text-red-300">Immagine fuori dallo spazio dei file di KIREO, non mostrata: {p.immagine_url as string}</p>
                    ))}
                  {p.link_titolo && <p className="mt-2 text-xs text-kireo-light">Scheda: {p.link_titolo as string}</p>}
                  {p.allegato_nome && <p className="mt-2 text-xs text-kireo-light">File: {p.allegato_nome as string}</p>}
                  {p.embed_url && (
                    <a href={p.embed_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-kireo-orange underline underline-offset-2">
                      {p.embed_url}
                    </a>
                  )}
                  {motivo && <p className="mt-2 text-xs text-red-300">{motivo}</p>}
                  {p.visibile && (
                    <TogliPost id={p.id as string} notifiche={erroreNotifichePost ? null : (notifichePerPost.get(p.id as string) ?? 0)} />
                  )}
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
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Newsletter da leggere</h2>
        {/* Dal 30/10 la newsletter nasce in `newsletter_enti` e arriva nella posta degli
            studenti con il nome di KIREO sopra: per questo si approva, e i post no. Le
            proposte di prima in `comunicazioni` non le legge più nessuno, e non partono.
            La quota del piano e il giorno pieno li fa rispettare il database quando
            l'ente manda in approvazione: qui non c'è niente da superare. */}
        {erroreNewsletter ? (
          <p className="mt-4 text-sm text-red-300">Non siamo riusciti a leggere le newsletter in coda: ricarica la pagina.</p>
        ) : !newsletterInApprovazione || newsletterInApprovazione.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessuna newsletter da leggere.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {newsletterInApprovazione.map((n) => {
              const ente = Array.isArray(n.istituzioni) ? n.istituzioni[0] : n.istituzioni;
              return (
                <li key={n.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">{n.oggetto}</p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {ente?.nome ?? "—"} · parte il {formattaData(n.giorno, "long")} alle 7:30 · per email fino al{" "}
                    {formattaData(n.ultimo_giorno, "long")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{n.corpo}</p>
                  <AzioneApprovazione cosa="newsletter" id={n.id} />
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
