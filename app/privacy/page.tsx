import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — KIREO",
  description: "Informativa sulla privacy di KIREO ai sensi del GDPR (Regolamento UE 2016/679).",
};

const SEZIONI = [
  {
    titolo: "1. Titolare del trattamento",
    testo:
      "Il Titolare del trattamento dei dati raccolti tramite il sito kireo.it è [Ragione sociale da inserire], con sede legale in [indirizzo da inserire], contattabile all'indirizzo email [email da inserire].",
  },
  {
    titolo: "2. Tipologie di dati raccolti",
    testo:
      "Raccogliamo dati anagrafici e di contatto (nome, cognome, email), dati relativi al profilo (interessi, percorso di studio, ruolo) e dati di navigazione raccolti automaticamente durante l'utilizzo del sito.",
  },
  {
    titolo: "3. Finalità del trattamento",
    testo:
      "I dati sono trattati per gestire l'iscrizione e l'utilizzo della piattaforma, rispondere alle richieste di contatto, generare i giustificativi PCTO e inviare comunicazioni relative al servizio, previo consenso.",
  },
  {
    titolo: "4. Base giuridica",
    testo:
      "Il trattamento si basa sull'esecuzione di un contratto o di misure precontrattuali richieste dall'interessato, sul consenso esplicito per finalità di comunicazione facoltative e sul legittimo interesse del Titolare. Per gli studenti minorenni (a partire dai 14 anni, età minima per l'iscrizione), la base di legittimazione è rafforzata dalla convenzione tra KIREO e la scuola secondaria superiore di appartenenza: il referente scolastico verifica l'identità e l'iscrizione effettiva dello studente alla propria scuola prima che i dati del profilo siano utilizzabili nell'ambito delle attività PCTO, a garanzia che il trattamento avvenga in un contesto istituzionale controllato.",
  },
  {
    titolo: "5. Modalità di trattamento e conservazione dei dati",
    testo:
      "I dati sono trattati con strumenti informatici e conservati su infrastrutture cloud sicure per il tempo necessario a soddisfare le finalità indicate, nel rispetto dei principi di minimizzazione e sicurezza previsti dal GDPR.",
  },
  {
    titolo: "6. Diritti dell'interessato",
    testo:
      "In qualsiasi momento è possibile esercitare i diritti di accesso, rettifica, cancellazione, limitazione, opposizione e portabilità dei dati, scrivendo all'indirizzo email indicato al punto 1.",
  },
  {
    titolo: "7. Cookie e tecnologie simili",
    testo:
      "Il sito utilizza cookie tecnici necessari al funzionamento della piattaforma e, previo consenso, cookie di analisi statistica in forma aggregata. Maggiori dettagli sono disponibili nella cookie policy [da inserire].",
  },
  {
    titolo: "8. Modifiche alla presente informativa",
    testo:
      "La presente informativa può essere aggiornata periodicamente. Le modifiche saranno pubblicate su questa pagina con indicazione della data di ultimo aggiornamento: [data da inserire].",
  },
];

export default function Privacy() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
        Privacy
      </p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">
        Informativa sulla privacy
      </h1>
      <p className="mt-4 text-sm text-kireo-muted">
        Ai sensi del Regolamento (UE) 2016/679 (GDPR). Testo provvisorio, da completare con i dati
        definitivi del Titolare del trattamento.
      </p>

      <div className="mt-12 space-y-10">
        {SEZIONI.map((s) => (
          <div key={s.titolo}>
            <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
              {s.titolo}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-kireo-muted">{s.testo}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
