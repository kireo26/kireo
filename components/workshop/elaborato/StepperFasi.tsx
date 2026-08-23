import type { FaseElaborato } from "@/lib/workshop/elaborato-config";
import { tappaNonValutata, type FaseStatoRiga } from "@/lib/workshop/elaboratoValore";

const ETICHETTA_STATO: Record<FaseStatoRiga["stato"], string> = {
  bloccata: "Bloccata",
  aperta: "In corso",
  consegnata: "In revisione",
  revisionata: "Revisionata",
};

export default function StepperFasi({
  fasi,
  fasiStato,
  tappaSelezionataId,
  onSeleziona,
}: {
  fasi: FaseElaborato[];
  fasiStato: FaseStatoRiga[];
  tappaSelezionataId: string;
  onSeleziona: (faseId: string) => void;
}) {
  return (
    <div className="h-fit rounded-2xl border border-white/5 bg-kireo-card p-4">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Le tappe</p>
      <ol className="mt-2 space-y-1">
        {fasi.map((fase, indice) => {
          const riga = fasiStato.find((r) => r.faseId === fase.id);
          const stato = riga?.stato ?? "bloccata";
          const bloccata = stato === "bloccata";
          // Una tappa passata oltre senza revisione NON è «✓ Revisionata»: il
          // segno di spunta direbbe che è stata valutata. Resta superata (il
          // percorso è andato avanti) ma detta com'è.
          const nonValutata = tappaNonValutata(riga);
          const selezionata = fase.id === tappaSelezionataId;
          const precedente = fasi[indice - 1];

          return (
            <li key={fase.id}>
              <button
                type="button"
                disabled={bloccata}
                onClick={() => onSeleziona(fase.id)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  selezionata ? "bg-kireo-green/15" : bloccata ? "cursor-not-allowed opacity-60" : "hover:bg-white/5"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                    stato === "revisionata" && nonValutata
                      ? "border border-white/20 text-kireo-muted"
                      : stato === "revisionata"
                      ? "bg-kireo-green text-kireo-light"
                      : stato === "consegnata"
                        ? "border border-kireo-orange text-kireo-orange"
                        : stato === "aperta"
                          ? "border border-kireo-green text-kireo-green-light"
                          : "border border-white/20 text-kireo-muted"
                  }`}
                >
                  {stato === "revisionata" && !nonValutata ? "✓" : bloccata ? "🔒" : indice + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${selezionata ? "text-kireo-light" : "text-kireo-light/90"}`}>{fase.titolo}</span>
                  <span className={`block text-xs ${stato === "consegnata" ? "text-kireo-orange" : "text-kireo-muted"}`}>
                    {bloccata
                      ? precedente
                        ? `Si apre dopo la revisione della tappa precedente (di solito entro ${precedente.cooldownGiorni} giorni dalla consegna)`
                        : "Bloccata"
                      : nonValutata
                        ? "Superata, non revisionata"
                        : ETICHETTA_STATO[stato]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
