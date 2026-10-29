import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";
import { sottoNewsletterEnte } from "@/lib/app/comunicazioniKireo";
import { sottoDownloadGuida } from "@/lib/ente/guida";
import {
  T,
  leggiStatistiche,
  righeMostrate,
  etichettaArea,
  etichettaAnnoDiploma,
  etichettaIndirizzo,
  etichettaProvincia,
  type EventoRiga,
  type RigaMostrata,
} from "@/lib/ente/statistiche";

// LE STATISTICHE DELL'ENTE IN QUATTRO SEZIONI (29/10, 20261115100000). Una
// lettura sola, `statistiche_ente`: la soglia di anonimato la applica lei, e qui
// non arriva mai un gruppo sotto i 5 studenti. Il perché di ogni scelta sta in
// `lib/ente/statistiche.ts` e nella testa della migrazione.

function Riquadro({ etichetta, valore, sotto }: { etichetta: string; valore: number | string; sotto?: string | null }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{etichetta}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-kireo-light">{valore}</p>
      {sotto && <p className="mt-1 text-xs text-kireo-muted">{sotto}</p>}
    </div>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">{titolo}</h2>
      {children}
    </section>
  );
}

function Tabella({ titolo, righe, nota }: { titolo: string; righe: RigaMostrata[]; nota?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{titolo}</p>
      {nota && <p className="mt-1 text-xs text-kireo-muted">{nota}</p>}
      <ul className="mt-3 space-y-1 text-sm text-kireo-light">
        {righe.map((r) => (
          <li key={r.etichetta} className="flex justify-between gap-3">
            <span>{r.etichetta}</span>
            <span className="tabular-nums">{r.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RigaEvento({ s }: { s: EventoRiga }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4">
      <div>
        <p className="font-heading text-sm font-semibold text-kireo-light">{s.titolo}</p>
        <p className="mt-1 text-xs text-kireo-muted">{formattaData(s.data_inizio, "long")}</p>
      </div>
      {/*
        COSA CONTA OGNI COLONNA (27/10, ripresa il 29/10 in `statistiche_ente`).
        Solo gli eventi approvati: un evento mai pubblicato non è andato in
        nessun modo, e una bozza non ha iscritti.
        - iscritti: ogni iscrizione, in qualunque stato, comprese quelle fatte
          da una scuola. NON conta chi l'ha disdetta.
        - collegati: studenti distinti con almeno un battito sulla diretta. Solo
          per una diretta: in un incontro in presenza la presenza la registra
          la scuola, e uno zero direbbe «non c'era nessuno».
        - con presenza certificata: soglia raggiunta alla chiusura, o
          certificata da una scuola, dall'ente o da KIREO. Non «ore
          riconosciute»: un evento senza ore certifica una presenza senza ore.
        - risposte: le risposte alla domanda finale, solo dove una domanda è
          stata posta (uno zero senza domanda sarebbe un fallimento che non c'è
          stato).
        «Etichetta: numero» e non «3 iscritti»: con 1 il plurale non accorda.
      */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-kireo-light">
        <span>Iscritti: {s.iscritti}</span>
        {s.collegati != null ? <span>Collegati: {s.collegati}</span> : null}
        <span>Con presenza certificata: {s.certificate}</span>
        {s.domanda_posta ? <span>Risposte: {s.risposte}</span> : null}
      </div>
    </li>
  );
}

export default async function EnteStatistichePage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("statistiche_ente", { p_istituzione_id: contesto.istituzioneId });
  if (error) console.error("[statistiche ente] statistiche_ente:", descriviErrore(error));
  const stats = error ? null : leggiStatistiche(data);
  if (!error && !stats) console.error("[statistiche ente] statistiche_ente: forma inattesa");
  // Non letto non è zero (27/10): con una lettura fallita la pagina non dice
  // niente sugli studenti, perché non li abbiamo guardati.
  const nonLetto = stats === null;
  const oggi = new Date();

  return (
    <div className="space-y-10">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Statistiche</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Le tue statistiche</h1>
        {/*
          ⚠️ La frase di prima («nessun elenco di studenti, mai») era falsa da
          quando esistono gli Interessati (Mario, 29/10): l'ente un elenco di
          nomi ce l'ha, di chi ha scelto di mostrarsi. Non si toglie, si rende
          vera: qui niente nomi, sotto i 5 un gruppo non si mostra da solo, e
          i nomi stanno altrove, solo per chi li ha dati.
        */}
        <p className="mt-2 text-sm text-kireo-muted">{T.cima}</p>
      </div>

      {nonLetto ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">{T.nonLetto}</div>
      ) : (
        <>
          <Sezione titolo={T.eventi.titolo}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Riquadro etichetta="In programma" valore={stats.eventi.in_programma} />
              <Riquadro etichetta="Passati" valore={stats.eventi.passati} />
              <Riquadro etichetta="Iscritti" valore={stats.eventi.iscritti} />
              <Riquadro etichetta="Collegati alle dirette" valore={stats.eventi.collegati} />
              <Riquadro etichetta="Con presenza certificata" valore={stats.eventi.certificate} />
            </div>
            {stats.eventi.iscritti_dirette_finite > 0 && (
              <p className="text-sm text-kireo-muted">{T.eventi.collegatiSuIscritti(stats.eventi.iscritti_collegati, stats.eventi.iscritti_dirette_finite)}</p>
            )}
            {stats.eventi.permanenza_media_pct != null && stats.eventi.permanenza_su > 0 && (
              <p className="text-sm text-kireo-muted">{T.eventi.permanenza(stats.eventi.permanenza_media_pct, stats.eventi.permanenza_su)}</p>
            )}
            {(
              [
                [T.eventi.inProgramma, stats.eventi.lista.filter((e) => !e.passato).reverse(), T.eventi.nessunoInProgramma],
                [T.eventi.passati, stats.eventi.lista.filter((e) => e.passato), T.eventi.nessunoPassato],
              ] as const
            ).map(([titolo, lista, vuoto]) => (
              <div key={titolo}>
                <h3 className="font-heading text-base font-semibold text-kireo-light">{titolo}</h3>
                {lista.length === 0 ? (
                  <p className="mt-2 text-sm text-kireo-muted">{vuoto}</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {lista.map((s) => (
                      <RigaEvento key={s.evento_id} s={s} />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </Sezione>

          <Sezione titolo={T.studenti.titolo}>
            {/*
              Solo aggregato. Chi conta: vedi `T.studenti.chi`, e la stessa
              definizione sta in `statistiche_ente`. Solo account con ruolo
              studente: un docente che segue l'ente non è uno studente
              raggiunto. Non scende, per questo «dall'inizio».
            */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Riquadro etichetta="Studenti raggiunti dall'inizio" valore={stats.studenti.totale} />
              <Riquadro etichetta="Nuovi questo mese" valore={stats.studenti.nuovi_mese} />
            </div>
            <p className="text-sm text-kireo-muted">{T.studenti.chi}</p>
            {stats.studenti.totale === 0 ? (
              <p className="text-sm text-kireo-muted">{T.studenti.nessuno}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Tabella titolo="Per area" nota={T.notaAree} righe={righeMostrate(stats.studenti.per_area, etichettaArea, stats.studenti.soglia)} />
                <Tabella
                  titolo="Per anno di corso"
                  righe={righeMostrate(stats.studenti.per_anno_diploma, etichettaAnnoDiploma(oggi), stats.studenti.soglia)}
                />
                <Tabella titolo="Per indirizzo" righe={righeMostrate(stats.studenti.per_indirizzo, etichettaIndirizzo, stats.studenti.soglia)} />
                <Tabella titolo="Per provincia" righe={righeMostrate(stats.studenti.per_provincia, etichettaProvincia, stats.studenti.soglia)} />
              </div>
            )}
          </Sezione>

          <Sezione titolo={T.newsletter.titolo}>
            {/*
              Il numero grande è chi la riceverà: gli iscritti che si sono
              iscritti da maggiorenni (20261107110000). Sotto, gli iscritti in
              tutto, solo quando differiscono. Le uscite le conta un trigger
              (`uscite_newsletter_giorno`), perché un'iscrizione tolta non lascia
              una riga: si contano da quando il trigger esiste. Aperture e clic
              non si promettono: l'invio non esiste ancora.
            */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Riquadro
                etichetta="Chi la riceverà"
                valore={stats.newsletter.raggiungibili}
                sotto={sottoNewsletterEnte(stats.newsletter.iscritti, stats.newsletter.raggiungibili)}
              />
              <Riquadro etichetta="Nuove iscrizioni questo mese" valore={stats.newsletter.nuovi_mese} />
              <Riquadro
                etichetta="Uscite questo mese"
                valore={stats.newsletter.persi_mese}
                sotto={stats.newsletter.persi_contati_dal ? T.newsletter.persiDal(stats.newsletter.persi_contati_dal) : null}
              />
            </div>
            <p className="text-sm text-kireo-muted">{T.newsletter.invii}</p>
          </Sezione>

          <Sezione titolo={T.guide.titolo}>
            {/*
              Due numeri distinti (Mario, 29/10): gli scaricamenti, tutti,
              anche di chi non ha fatto l'accesso (un contatore senza identità,
              `contatore_scaricamenti_guide`), e gli studenti iscritti a KIREO
              che le hanno scaricate, una volta ciascuno
              (`scaricamenti_guide_enti`). Tutti e due dalla data di
              `inizio_conteggio_download_guide()`: quelli di prima non sono
              stati registrati, e la riga sotto lo dice.
            */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Riquadro etichetta="Scaricamenti delle tue guide" valore={stats.guide.scaricamenti} sotto={sottoDownloadGuida(stats.guide.contati_dal)} />
              <Riquadro etichetta="Scaricamenti questo mese" valore={stats.guide.scaricamenti_mese} />
            </div>
            <p className="text-sm text-kireo-light">{T.guide.riepilogo(stats.guide.scaricamenti, stats.guide.studenti)}</p>
            <p className="text-xs text-kireo-muted">{T.guide.spiega}</p>
            {stats.guide.per_guida.length === 0 ? (
              <p className="text-sm text-kireo-muted">{T.guide.nessuna}</p>
            ) : (
              <ul className="space-y-3">
                {stats.guide.per_guida.map((g) => (
                  <li key={g.guida_id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                    <p className="font-heading text-sm font-semibold text-kireo-light">{g.titolo}</p>
                    <p className="mt-1 text-xs text-kireo-muted">{T.guide.periodo(g)}</p>
                    <p className="mt-2 text-sm text-kireo-light">{T.guide.riga(g)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Sezione>
        </>
      )}
    </div>
  );
}
