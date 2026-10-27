import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

export default async function EnteStatistichePage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const [{ data: stats, error: erroreStats }, { data: statsEventi, error: erroreEventi }] = await Promise.all([
    supabase.from("stats_istituzione").select("*").eq("istituzione_id", contesto.istituzioneId).maybeSingle(),
    supabase.from("stats_eventi_istituzione").select("*").eq("istituzione_id", contesto.istituzioneId).order("data_inizio", { ascending: false }),
  ]);

  // Non letto non è zero (27/10): con una lettura fallita la pagina diceva «Non
  // ci sono ancora interazioni», cioè affermava un fatto su studenti che non
  // avevamo guardato.
  const nonLetto = Boolean(erroreStats || erroreEventi);
  if (erroreStats) console.error("[statistiche ente] stats_istituzione:", descriviErrore(erroreStats));
  if (erroreEventi) console.error("[statistiche ente] stats_eventi_istituzione:", descriviErrore(erroreEventi));

  const nessunDato =
    !stats ||
    (stats.studenti_nel_recinto === 0 &&
      stats.iscritti_newsletter === 0 &&
      stats.guide_pubblicate === 0 &&
      (!statsEventi || statsEventi.length === 0));

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Statistiche</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Le tue statistiche</h1>
        <p className="mt-2 text-sm text-kireo-muted">Dati in forma aggregata e anonima: nessun elenco di studenti, mai.</p>
      </div>

      {nonLetto ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non siamo riusciti a leggere le statistiche: ricarica la pagina.
        </div>
      ) : nessunDato ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non ci sono ancora interazioni da mostrare. Torna qui dopo aver pubblicato eventi e guide.
        </div>
      ) : (
        <>
          {/*
            COSA CONTA OGNI NUMERO (Mario, 27/10: «un numero senza una
            definizione scritta non è un dato»). Una riga per riquadro: cosa
            conta, da quale gesto di uno studente, e cosa NON conta. I nomi a
            schermo sono quelli di prima: si decidono con Mario, leggendo queste
            righe. Le viste sono `stats_istituzione` e `stats_eventi_istituzione`
            (20261102110000).
            - Studenti raggiunti dall'inizio: studenti DISTINTI che, da collegati, hanno
              scaricato una guida dell'ente, o si sono iscritti alla sua
              newsletter, o si sono iscritti da sé a un suo evento. NON conta:
              chi segue l'ente, chi ha manifestato interesse o scritto un
              messaggio, chi ha solo aperto la pagina, gli studenti iscritti
              dalla loro scuola, i docenti, i download senza accesso. E non
              scende: chi disdice un'iscrizione resta contato, ed è per questo
              che il nome dice «dall'inizio» (Mario, 27/10). NON è dell'anno
              accademico, come i riquadri delle quote: conta da sempre.
            - Iscritti newsletter: le iscrizioni alla newsletter dell'ente, oggi
              (non c'è un modo di disiscriversi). NON conta le newsletter
              ricevute: l'invio non esiste ancora.
            - Download guida: studenti DISTINTI che, da collegati, hanno
              scaricato almeno una guida dell'ente. NON conta i download senza
              accesso, i download ripetuti, né quelli di chi era già passato di
              qui con un altro gesto prima del 20261102110000 (non sono mai stati
              scritti).
            - Guide pubblicate: le guide che l'ente ha caricato. Non è un gesto
              di uno studente.
          */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Studenti raggiunti dall'inizio", valore: stats?.studenti_nel_recinto ?? 0 },
              { label: "Iscritti newsletter", valore: stats?.iscritti_newsletter ?? 0 },
              { label: "Download guida", valore: stats?.download_guida ?? 0 },
              { label: "Guide pubblicate", valore: stats?.guide_pubblicate ?? 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/5 bg-kireo-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{s.label}</p>
                <p className="mt-1 font-heading text-2xl font-bold text-kireo-light">{s.valore}</p>
              </div>
            ))}
          </div>

          {statsEventi && statsEventi.length > 0 && (
            <div>
              <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Per evento</h2>
              <ul className="mt-4 space-y-3">
                {statsEventi.map((s) => (
                  <li key={s.evento_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4">
                    <div>
                      <p className="font-heading text-sm font-semibold text-kireo-light">{s.titolo}</p>
                      <p className="mt-1 text-xs text-kireo-muted">
                        {formattaData(s.data_inizio, "long")}
                      </p>
                    </div>
                    {/*
                      COSA CONTA OGNI COLONNA (27/10, 20261103100000). Gli
                      eventi pubblicati dell'ente: approvati e in approvazione,
                      non bozze né rifiutati (un evento mai pubblicato non è
                      andato in nessun modo).
                      - iscritti: ogni iscrizione, in qualunque stato (ancora
                        iscritto, certificato, assente), comprese quelle fatte
                        da una scuola e le presenze certificate senza
                        un'iscrizione prima. NON conta chi l'ha disdetta.
                      - collegati (`presenti`): studenti distinti con almeno un
                        battito sulla diretta, qualunque cosa sia successo
                        dopo. Solo per una diretta: in un incontro in presenza
                        la presenza la registra la scuola, e lì il numero non
                        compare (uno zero direbbe «non c'era nessuno»).
                      - con presenza certificata (`partecipati` nella vista):
                        soglia raggiunta alla chiusura della diretta, o
                        certificata da una scuola, dall'ente o da KIREO. Fino al
                        27/10 si chiamava «partecipati», che per un ente vuol dire
                        «c'era» (Mario). Non si dice «ore riconosciute»: un
                        webinar per docenti o un evento senza ore PCTO certifica
                        una presenza senza ore.
                      - risposte: le risposte alla domanda finale.
                      «Etichetta: numero» e non «3 iscritti»: con 1 il plurale
                      non accorda («1 iscritti», visto a schermo il 27/10), e
                      l'accordo non vale la parola.
                      Quattro numeri che raccontano una scala: chi si è
                      iscritto, chi si è collegato, chi ha raggiunto la soglia,
                      chi ha risposto. L'ultimo è la misura di attenzione,
                      e quando una domanda è stata posta si scrive ANCHE se è
                      zero — un ente che non vede il numero pensa che non lo
                      misuriamo. Dove nessuna domanda è stata posta il numero non
                      compare: uno zero là somiglierebbe a un fallimento che non
                      c'è stato.
                    */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-kireo-light">
                      <span>Iscritti: {s.iscritti}</span>
                      {s.presenti != null ? <span>Collegati: {s.presenti}</span> : null}
                      <span>Con presenza certificata: {s.partecipati}</span>
                      {s.domanda_posta ? <span>Risposte: {s.risposte}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
