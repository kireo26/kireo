import Link from "next/link";
import { TESTI_COSE_DA_DECIDERE as T, type CosaDaDecidere } from "@/lib/admin/coseDaDecidere";

// Le sette cose che aspettano una decisione, lette da `coseDaDecidere`: lo
// stesso riquadro in «Oggi» e in cima a «Notifiche». Un numero e il link a
// dove si decide. Un numero non letto si scrive «non letto», mai zero.
export default function CoseDaDecidere({ cose }: { cose: CosaDaDecidere[] }) {
  const qualcunaNonLetta = cose.some((c) => c.numero === null);
  const tutteZero = cose.every((c) => c.numero === 0);
  return (
    <section aria-labelledby="cose-da-decidere">
      <h2 id="cose-da-decidere" className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
        {T.titolo}
      </h2>
      {tutteZero && <p className="mt-2 text-sm text-kireo-muted">{T.tuttoFatto}</p>}
      <ul className="mt-4 divide-y divide-white/5 rounded-xl border border-white/5 bg-kireo-card">
        {cose.map((c) => (
          <li key={c.chiave}>
            <Link href={c.href} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/5">
              <span className="text-sm text-kireo-light">{c.etichetta}</span>
              <span
                className={`font-heading text-lg font-semibold ${
                  c.numero === null ? "text-amber-200" : c.numero > 0 ? "text-kireo-orange" : "text-kireo-muted"
                }`}
              >
                {c.numero === null ? T.nonLetto : c.numero}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {qualcunaNonLetta && <p className="mt-2 text-xs text-amber-200">{T.nonLettoSpiegazione}</p>}
    </section>
  );
}
