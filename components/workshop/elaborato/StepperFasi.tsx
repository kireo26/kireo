import type { FaseElaborato } from "@/lib/workshop/elaborato-config";

function etichettaScadenza(dataCreazione: string, giornoScadenza: number, completata: boolean): string {
  const scadenza = new Date(dataCreazione);
  scadenza.setDate(scadenza.getDate() + giornoScadenza);
  const giorniRimasti = Math.ceil((scadenza.getTime() - Date.now()) / 86_400_000);

  if (completata) return "Completato";
  if (giorniRimasti < 0) return `In ritardo di ${Math.abs(giorniRimasti)} giorn${Math.abs(giorniRimasti) === 1 ? "o" : "i"}`;
  if (giorniRimasti === 0) return "Scade oggi";
  return `Scadenza tra ${giorniRimasti} giorn${giorniRimasti === 1 ? "o" : "i"}`;
}

export default function StepperFasi({
  fasi,
  faseCorrenteId,
  fasiCompletate,
  iscrizioneCreataIl,
  onSeleziona,
}: {
  fasi: FaseElaborato[];
  faseCorrenteId: string;
  fasiCompletate: string[];
  iscrizioneCreataIl: string;
  onSeleziona: (faseId: string) => void;
}) {
  return (
    <div className="h-fit rounded-2xl border border-white/5 bg-kireo-card p-4">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Incarichi</p>
      <ol className="mt-2 space-y-1">
        {fasi.map((fase, indice) => {
          const completata = fasiCompletate.includes(fase.id);
          const attiva = fase.id === faseCorrenteId;
          const scadenza = etichettaScadenza(iscrizioneCreataIl, fase.giornoScadenza, completata);
          const inRitardo = !completata && scadenza.startsWith("In ritardo");

          return (
            <li key={fase.id}>
              <button
                type="button"
                onClick={() => onSeleziona(fase.id)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  attiva ? "bg-kireo-green/15" : "hover:bg-white/5"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                    completata
                      ? "bg-kireo-green text-kireo-light"
                      : attiva
                        ? "border border-kireo-green text-kireo-green-light"
                        : "border border-white/20 text-kireo-muted"
                  }`}
                >
                  {completata ? "✓" : indice + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${attiva ? "text-kireo-light" : "text-kireo-light/90"}`}>{fase.titolo}</span>
                  <span className={`block text-xs ${inRitardo ? "text-kireo-orange" : "text-kireo-muted"}`}>{scadenza}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
