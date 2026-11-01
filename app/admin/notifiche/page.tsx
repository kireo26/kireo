import { requireAdmin } from "@/lib/admin/context";
import CoseDaDecidere from "@/components/admin/CoseDaDecidere";
import ToggleGestitaRichiesta from "@/components/admin/ToggleGestitaRichiesta";
import { CRITERI, coseDaDecidere } from "@/lib/admin/coseDaDecidere";
import { leggiFlusso } from "@/lib/admin/flusso";
import GruppiFlusso from "@/components/admin/GruppiFlusso";
import { GIORNI_FINESTRA_ADMIN } from "@/lib/admin/menu";
import { formattaDataOra } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

// NOTIFICHE (Mario, 31/10): «tutto quello che accade, con in cima ciò che
// chiede una decisione». In cima le stesse sette cose di «Oggi», dalla stessa
// fonte (`coseDaDecidere`); poi le richieste di contatto, che sono fatti che
// arrivano e chiedono una decisione ma non appartengono a nessun ente né a
// nessuna scuola; poi il flusso degli ultimi 30 giorni, per gruppo
// (`leggiFlusso`), con il totale di ogni gruppo e il link all'elenco intero.
export default async function AdminNotifichePage() {
  const { supabase } = await requireAdmin();
  const [cose, flusso, { data: richiesteContatto, error: erroreContatti }] = await Promise.all([
    coseDaDecidere(supabase),
    leggiFlusso(supabase),
    CRITERI.contattiDaGestire
      .filtra(supabase.from("richieste_contatto").select("id, origine, nome, ruolo, istituto, codice_meccanografico, email, messaggio, created_at"))
      .order("created_at", { ascending: true }),
  ]);
  if (erroreContatti) console.error("[admin] richieste di contatto:", descriviErrore(erroreContatti));

  return (
    <div className="space-y-12">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Notifiche</h1>
      <CoseDaDecidere cose={cose} />

      <section id="contatti">
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
        {erroreContatti ? (
          <p className="mt-4 text-sm text-red-300">Non siamo riusciti a leggere le richieste di contatto: ricarica la pagina.</p>
        ) : !richiesteContatto || richiesteContatto.length === 0 ? (
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

      <section aria-labelledby="flusso">
        <h2 id="flusso" className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
          Cosa è successo negli ultimi {GIORNI_FINESTRA_ADMIN} giorni
        </h2>
        <p className="mt-1 text-xs text-kireo-muted">
          Per ogni gruppo le ultime righe e quante sono in tutto nella finestra; l&apos;elenco intero è nella sua pagina. Ogni riga porta solo le date che abbiamo.
        </p>
        <div className="mt-6 space-y-8">
          <GruppiFlusso gruppi={flusso} />
        </div>
      </section>
    </div>
  );
}
