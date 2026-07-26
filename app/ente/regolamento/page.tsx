import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regolamento enti — KIREO",
  description: "Le regole che ogni istituzione formativa accetta per essere presente su KIREO.",
};

const REGOLE = [
  {
    titolo: "Niente comunicazione commerciale diretta",
    testo:
      "I contenuti pubblicati su KIREO (post di bacheca, eventi, messaggi) restano informativi e orientativi: niente linguaggio da vendita, niente sconti o promozioni a tempo, niente pressione a decidere in fretta.",
  },
  {
    titolo: "Niente inviti ad azioni fuori da KIREO",
    testo:
      "Non è consentito invitare gli studenti a proseguire la conversazione altrove (WhatsApp, Instagram diretti, telefono, email personali) né a compilare moduli esterni. Tutto quello che riguarda uno studente resta dentro KIREO, sempre.",
  },
  {
    titolo: "Niente richiesta o condivisione di contatti diretti",
    testo:
      "Email e numeri di telefono degli studenti non vengono mai richiesti né condivisi, in nessuna forma. Il contatto avviene solo tramite i messaggi in piattaforma, con uno studente maggiorenne che ha scelto di condividere il proprio profilo.",
  },
  {
    titolo: "Tutto resta in piattaforma",
    testo:
      "Post, eventi, messaggi: ogni interazione con gli studenti avviene e resta dentro KIREO, verificabile in caso di necessità.",
  },
  {
    titolo: "Niente musica o contenuti di terzi negli eventi",
    testo:
      "Nei webinar e nelle dirette organizzate su KIREO non è consentito trasmettere musica di alcun tipo (nemmeno in attesa) né contenuti audio/video di terzi non licenziati: protegge la diretta da interruzioni automatiche per copyright.",
  },
  {
    titolo: "Rispetto della revisione KIREO",
    testo:
      "Eventi, post di bacheca e le aree di competenza proposte passano da una revisione prima di comparire pubblicamente. Un rifiuto è sempre motivato: adeguarsi alle indicazioni ricevute è condizione per restare su KIREO.",
  },
];

export default function RegolamentoEntiPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 sm:pt-28">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Per le istituzioni</p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">Regolamento enti</h1>
      <p className="mt-6 text-lg text-kireo-muted">
        KIREO resta un ambiente di orientamento, non un marketplace. Ogni istituzione formativa presente sulla
        piattaforma accetta queste regole, valide per profilo, eventi, bacheca e messaggi.
      </p>

      <div className="mt-12 space-y-8">
        {REGOLE.map((regola, i) => (
          <div key={regola.titolo} className="rounded-2xl border border-white/5 bg-kireo-card p-6">
            <p className="mb-2 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
              {i + 1}. {regola.titolo}
            </p>
            <p className="text-kireo-muted">{regola.testo}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-sm text-kireo-muted">
        Il mancato rispetto di queste regole può comportare il rifiuto di un contenuto, la sospensione temporanea del
        profilo o, nei casi più gravi, la disattivazione dell'account. Per domande, scrivi a{" "}
        <a href="/contatti" className="text-kireo-orange underline underline-offset-2">
          KIREO
        </a>
        .
      </p>
    </div>
  );
}
