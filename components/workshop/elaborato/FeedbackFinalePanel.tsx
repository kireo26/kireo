import type { FeedbackFinale } from "@/lib/workshop/elaboratoValore";

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
    </div>
  );
}
