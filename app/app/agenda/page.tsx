import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getProssimiEventi, getEventiPassati, getAreeDegliEventi, getIscrizioniStudenteConOrigine } from "@/lib/app/eventi";
import ListaEventiProssimi from "@/components/app/ListaEventiProssimi";
import ConsegneDaFare from "@/components/app/ConsegneDaFare";
import { getConsegneDaFare } from "@/lib/app/consegneDaFare";
import { getEventiConRisposta, portaEventoPassato } from "@/lib/app/portaEventoPassato";
import { formattaDataOra } from "@/lib/formato";
import Link from "next/link";

export default async function AgendaAppPage() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  const [prossimi, passati, iscrizioni, consegneDaFare] = await Promise.all([
    getProssimiEventi(supabase),
    getEventiPassati(supabase),
    getIscrizioniStudenteConOrigine(supabase, contesto.userId),
    getConsegneDaFare(supabase, contesto.userId),
  ]);
  const areeDegliEventi = await getAreeDegliEventi(
    supabase,
    [...prossimi, ...passati].map((e) => e.id),
  );
  // Chi ha già risposto, fra gli eventi passati: una lettura sola. Quali
  // consegne sono APERTE non si ricalcola — è `consegneDaFare`, già in mano,
  // che è anche l'unica definizione di quella regola.
  const conRisposta = await getEventiConRisposta(
    supabase,
    contesto.userId,
    passati.filter((e) => iscrizioni[e.id]).map((e) => e.id),
  );
  const consegneAperte = new Set(consegneDaFare.map((c) => c.eventoId));

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Agenda</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">I prossimi eventi</h1>
        <p className="mt-2 text-kireo-muted">
          Webinar, workshop e incontri di orientamento, per esplorare da vicino le aree che ti interessano.
        </p>
      </div>

      <ConsegneDaFare consegne={consegneDaFare} />

      {prossimi.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center">
          <p className="text-kireo-muted">Il calendario si sta riempiendo. Torna a trovarci presto.</p>
        </div>
      ) : (
        <ListaEventiProssimi eventi={prossimi} areeDegliEventi={areeDegliEventi} iscrizioni={iscrizioni} userId={contesto.userId} />
      )}

      {passati.length > 0 && (
        <div>
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Eventi passati</h2>
          {/*
            UN EVENTO A CUI ERI ISCRITTO È RAGGIUNGIBILE QUANDO C'È QUALCOSA DI
            LÀ. Fino al 28/09 queste voci non avevano nessun link, e l'unica
            strada verso la pagina di un incontro (`EntraDirettaLink`) stava
            nella card degli eventi FUTURI: appena l'evento finiva, la sua pagina
            — con la consegna aperta per due giorni — restava raggiungibile solo
            da chi ne conosceva l'indirizzo.

            Poi il link c'era e diceva «Rivedi l'incontro», che è la sola cosa
            che quella pagina non contiene. Adesso l'etichetta la decide
            `portaEventoPassato`, che dice anche quando NON metterne nessuna: il
            perché di ognuna delle tre risposte sta là, compreso il caso che
            resta volutamente in silenzio.
          */}
          <ul className="mt-4 space-y-3">
            {passati.map((e) => {
              const porta = portaEventoPassato({
                iscritto: Boolean(iscrizioni[e.id]),
                haRisposto: conRisposta.has(e.id),
                consegnaAperta: consegneAperte.has(e.id),
              });
              const contenuto = (
                <>
                  <p className="font-heading text-sm font-semibold text-kireo-light">{e.titolo}</p>
                  <p className="mt-1 text-xs text-kireo-muted">{formattaDataOra(e.data_inizio, "full")}</p>
                </>
              );
              return porta ? (
                <li key={e.id}>
                  <Link
                    href={`/app/eventi/${e.id}/live`}
                    className="block rounded-xl border border-white/5 bg-kireo-card/60 p-4 opacity-70 transition hover:border-white/15 hover:opacity-100"
                  >
                    {contenuto}
                    <p className="mt-2 text-xs text-kireo-orange">{porta.etichetta} →</p>
                  </Link>
                </li>
              ) : (
                <li key={e.id} className="rounded-xl border border-white/5 bg-kireo-card/60 p-4 opacity-70">
                  {contenuto}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
