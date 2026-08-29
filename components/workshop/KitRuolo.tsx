import type { MaterialeWorkshop } from "@/lib/workshop/config";

const ETICHETTA_TIPO: Record<MaterialeWorkshop["tipo"], string> = {
  link: "Link",
  pdf: "PDF",
  esempio: "Esempio",
};

const COLORE_BADGE: Record<MaterialeWorkshop["tipo"], string> = {
  link: "bg-white/10 text-kireo-light/80",
  pdf: "bg-white/10 text-kireo-light/80",
  esempio: "bg-kireo-green/15 text-kireo-green-light",
};

export default function KitRuolo({ ruolo, materiali }: { ruolo: string; materiali: MaterialeWorkshop[] }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Kit materiali — {ruolo}</h2>
      <p className="mt-1 text-sm text-kireo-muted">I dati e il metodo del tuo ruolo in questo workshop. Tienili aperti mentre lavori alle tappe.</p>

      <ul className="mt-5 space-y-3">
        {materiali.map((materiale, indice) => {
          const cliccabile = Boolean(materiale.url);

          const contenuto = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="font-heading text-sm font-semibold text-kireo-light">{materiale.titolo}</p>
                <span
                  className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${COLORE_BADGE[materiale.tipo]}`}
                >
                  {ETICHETTA_TIPO[materiale.tipo]}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-kireo-muted">{materiale.descrizione}</p>
            </>
          );

          const classeCard = "rounded-xl border border-white/10 p-4";

          return (
            <li key={indice}>
              {cliccabile ? (
                <a href={materiale.url} target="_blank" rel="noopener noreferrer" className={`block ${classeCard} transition-colors hover:border-kireo-green`}>
                  {contenuto}
                </a>
              ) : (
                <div className={classeCard}>{contenuto}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
