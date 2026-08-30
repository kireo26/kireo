import { cosaRegge, type RevisioneTappa } from "@/lib/workshop/elaboratoValore";

export default function RevisionePanel({
  revisione,
  reazioneCliente,
  nomeCliente,
}: {
  revisione: RevisioneTappa;
  reazioneCliente: string | null;
  nomeCliente: string;
}) {
  return (
    <div className="space-y-4">
      {reazioneCliente && (
        <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-orange">{nomeCliente} ha risposto</p>
          <p className="mt-2 whitespace-pre-wrap text-kireo-light/90">{reazioneCliente}</p>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-white/5 bg-kireo-card p-6 text-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Revisione del tutor · +{revisione.punteggio_fiducia} fiducia</p>
        {revisione.commento_breve && <p className="text-kireo-light/90">{revisione.commento_breve}</p>}
        {cosaRegge(revisione).length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-green-light">Punti di forza</p>
            <ul className="mt-1 list-inside list-disc text-kireo-light/90">
              {cosaRegge(revisione).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {revisione.da_migliorare.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-orange">Da migliorare</p>
            <ul className="mt-1 list-inside list-disc text-kireo-light/90">
              {revisione.da_migliorare.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {revisione.domanda && <p className="rounded-lg bg-white/5 px-3 py-2 text-kireo-light/90">{revisione.domanda}</p>}
      </div>
    </div>
  );
}
