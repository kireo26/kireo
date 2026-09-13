import { modoDiLavorareVuoto, type FeedbackFinale } from "@/lib/workshop/elaboratoValore";

// IL TESTO DEL SILENZIO, SCRITTO UNA VOLTA E NON GENERATO.
//
// Il silenzio è per definizione il caso in cui il modello non ha niente da
// dire, e chiedergli di comporre un paragrafo sul niente lo mette esattamente
// nella condizione in cui riempie. Il motivo, poi, non è mai specifico: è
// sempre lo stesso — poche domande, andate su cose diverse. Non c'è niente da
// personalizzare, quindi non c'è niente da generare.
//
// L'ORDINE DELLE TRE BATTUTE È LA PARTE CHE CONTA: non c'è segnale → non è un
// giudizio e il lavoro è salvo → torna dopo il prossimo. Un ragazzo che ha
// lavorato quattro settimane e legge «non emerge niente» deve arrivare alla
// seconda battuta prima di aver finito di digerire la prima.
//
// Effetto collaterale voluto: è identica per tutti quelli che la ricevono. Due
// studenti che la confrontano leggono la stessa cosa, ed è onesto — è
// un'affermazione sulle prove raccolte, non su di loro.
// Le tre battute stanno in UNA lista sola, in ordine di lettura, e la prima è
// solo resa in grassetto: così l'ordine del dato è l'ordine che legge lo
// studente, e non c'è modo di cambiarne uno senza cambiare l'altro.
const TESTO_SILENZIO = [
  "Qui non c'è ancora niente da dirti.",
  "Le domande che hai fatto al cliente sono poche, e sono andate su cose diverse: da queste non si vede ancora un modo tuo di entrare nei problemi.",
  "Non è un giudizio sul lavoro che hai consegnato: quello l'hai fatto, ed è qui sopra. È che un modo di fare, per vedersi, deve ripetersi — e un workshop solo non basta. Dopo il prossimo ci sarà più da guardare.",
];

// Il blocco sul modo di lavorare. Regge il silenzio, e lo regge con parole
// scritte da una persona invece che con una schermata vuota sotto un titolo.
function ModoDiLavorare({ modo }: { modo: NonNullable<FeedbackFinale["modo_di_lavorare"]> }) {
  if (modoDiLavorareVuoto(modo)) {
    return (
      <div className="space-y-3 rounded-2xl border border-white/5 bg-kireo-card p-6 text-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Come hai lavorato</p>
        {TESTO_SILENZIO.map((p, i) => (
          <p key={i} className={i === 0 ? "font-semibold text-kireo-light" : "text-kireo-light/90"}>
            {p}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/5 bg-kireo-card p-6 text-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Come hai lavorato</p>

      {modo.quello_che_si_vede.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-green-light">Quello che si vede</p>
          <ul className="mt-1 space-y-1 text-kireo-light/90">
            {modo.quello_che_si_vede.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      {modo.dove_porta.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-orange">Dove porta</p>
          <ul className="mt-1 space-y-1 text-kireo-light/90">
            {modo.dove_porta.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      {modo.cosa_non_si_vede_ancora && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Cosa non si vede ancora</p>
          <p className="mt-1 whitespace-pre-wrap text-kireo-light/90">{modo.cosa_non_si_vede_ancora}</p>
        </div>
      )}
    </div>
  );
}

export default function FeedbackFinalePanel({ feedback, nomeCliente }: { feedback: FeedbackFinale; nomeCliente: string }) {
  return (
    <div className="space-y-4">
      {feedback.chiusura_cliente && (
        <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-orange">{nomeCliente} chiude così</p>
          <p className="mt-2 whitespace-pre-wrap text-kireo-light/90">{feedback.chiusura_cliente}</p>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-white/5 bg-kireo-card p-6 text-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Feedback finale del tutor</p>
        {feedback.messaggio_chiusura && <p className="text-kireo-light/90">{feedback.messaggio_chiusura}</p>}
        {feedback.punti_forza.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-green-light">Punti di forza</p>
            <ul className="mt-1 list-inside list-disc text-kireo-light/90">
              {feedback.punti_forza.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {feedback.da_migliorare.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-orange">Da migliorare</p>
            <ul className="mt-1 list-inside list-disc text-kireo-light/90">
              {feedback.da_migliorare.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {feedback.modo_di_lavorare && <ModoDiLavorare modo={feedback.modo_di_lavorare} />}
    </div>
  );
}
