import type { FeedbackFinale } from "@/lib/workshop/elaboratoValore";

// Il blocco sul modo di lavorare. Regge il silenzio: quando non c'è niente da
// mostrare restano solo le due righe di «Cosa non si vede ancora», ed è una
// schermata onesta — non un titolo con sotto il vuoto.
function ModoDiLavorare({ modo }: { modo: NonNullable<FeedbackFinale["modo_di_lavorare"]> }) {
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

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Cosa non si vede ancora</p>
        <p className="mt-1 whitespace-pre-wrap text-kireo-light/90">{modo.cosa_non_si_vede_ancora}</p>
      </div>
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
