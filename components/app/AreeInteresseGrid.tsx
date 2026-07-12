import { AREE } from "@/data/aree";

// Estratta da RegistrazioneForm: stessa griglia di card, riusata anche in
// ProfiloForm per modificare le aree di interesse dopo la registrazione.
export default function AreeInteresseGrid({
  selezionate,
  onToggle,
  max,
}: {
  selezionate: string[];
  onToggle: (slug: string) => void;
  max: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {AREE.map((area) => {
        const selezionata = selezionate.includes(area.slug);
        const disabilitata = !selezionata && selezionate.length >= max;
        return (
          <button
            key={area.slug}
            type="button"
            onClick={() => onToggle(area.slug)}
            disabled={disabilitata}
            aria-pressed={selezionata}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              selezionata ? "border-kireo-green bg-kireo-green/10" : "border-white/10 hover:border-white/20"
            }`}
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-xs font-bold text-kireo-orange">
              {area.icona}
            </span>
            <span className="text-sm font-medium leading-[1.25] text-kireo-light">{area.nome}</span>
          </button>
        );
      })}
    </div>
  );
}
