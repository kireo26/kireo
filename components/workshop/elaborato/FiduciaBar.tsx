// Barra della fiducia. Il DENOMINATORE non è fisso a 100: è la somma dei punti
// delle sole tappe che siamo riusciti a valutare. Se una revisione AI si è
// arresa, quella tappa esce dal massimo (45/75, non 45/100) invece di contare
// come uno zero — «NULL non è zero», lo stesso principio delle barre «non
// ancora misurata» dell'esito missione e dei punteggi nullable di area_signal.
// Uno zero direbbe «non l'hai convinto»; la verità è che non l'abbiamo chiesto.
export default function FiduciaBar({
  fiducia,
  massimo,
  nomeCliente,
}: {
  fiducia: number;
  massimo: number;
  nomeCliente: string;
}) {
  const percentuale = massimo > 0 ? Math.min(100, Math.round((fiducia / massimo) * 100)) : 0;
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Quanto hai convinto {nomeCliente}</p>
        <span className="text-sm font-semibold text-kireo-light">
          {fiducia}/{massimo}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-kireo-orange transition-all" style={{ width: `${percentuale}%` }} />
      </div>
      {massimo < 100 && (
        <p className="mt-2 text-[11px] leading-snug text-kireo-muted">
          Il massimo è {massimo} e non 100 perché una tappa non è stata valutata per un problema nostro: non pesa sul tuo punteggio.
        </p>
      )}
    </div>
  );
}
