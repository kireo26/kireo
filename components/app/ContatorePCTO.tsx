import { TRAGUARDO_ORE_PCTO } from "@/lib/app/pcto";

export default function ContatorePCTO({ oreCertificate }: { oreCertificate: number }) {
  const percentuale = Math.min(100, Math.round((oreCertificate / TRAGUARDO_ORE_PCTO) * 100));

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Ore PCTO</h2>
      <p className="mt-1 text-sm text-kireo-muted">
        {oreCertificate} ore certificate su {TRAGUARDO_ORE_PCTO}
      </p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-kireo-green" style={{ width: `${percentuale}%` }} />
      </div>
      {oreCertificate === 0 && (
        <p className="mt-3 text-xs text-kireo-muted">Le ore certificate compariranno qui non appena registrate.</p>
      )}
    </div>
  );
}
