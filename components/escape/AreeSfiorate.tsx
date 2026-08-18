// Elenco «aree sfiorate»: aree per cui un segnale c'è ma è troppo poco per
// meritare una card piena / entrare in una classifica. Componente CONDIVISO,
// feed diverso per contesto:
//   - esito missione: aree con ≥3 dimensioni su 4 non misurate (troppo vuote per
//     una card) — la motivazione più pesante spiega cosa si è comunque acceso;
//   - vista affinità (Blocco B): aree escluse dalla classifica per eleggibilità
//     (meno di 2 attività distinte, o interesse non misurato).
// Il testo di ogni voce lo decide il chiamante (il «perché è sfiorata» cambia col
// contesto); qui si rende solo nome + testo, in forma onesta e non punitiva.

export type VoceSfiorata = { nome: string; testo: string };

export default function AreeSfiorate({
  titolo,
  sottotitolo,
  voci,
}: {
  titolo: string;
  sottotitolo?: string;
  voci: VoceSfiorata[];
}) {
  if (voci.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h3 className="font-heading text-base font-semibold text-kireo-light">{titolo}</h3>
      {sottotitolo && <p className="mt-1 text-xs text-kireo-muted">{sottotitolo}</p>}
      <ul className="mt-3 space-y-2">
        {voci.map((v, i) => (
          <li key={i} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-kireo-light/90">
            <span className="font-medium text-kireo-light">{v.nome}</span> — {v.testo}
          </li>
        ))}
      </ul>
    </div>
  );
}
