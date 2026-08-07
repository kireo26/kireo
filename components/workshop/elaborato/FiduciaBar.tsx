export default function FiduciaBar({ fiducia, nomeCliente }: { fiducia: number; nomeCliente: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Quanto hai convinto {nomeCliente}</p>
        <span className="text-sm font-semibold text-kireo-light">{fiducia}/100</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-kireo-orange transition-all" style={{ width: `${fiducia}%` }} />
      </div>
    </div>
  );
}
