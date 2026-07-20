export type PianoQuote = {
  id: string;
  nome: "free" | "plus" | "premium";
  prezzo_min: number;
  prezzo_max: number;
  quota_webinar_anno: number;
  quota_newsletter: number;
  quota_cta_esterne: number;
  quota_comunicazioni_kireo: number;
};

const ORDINE_PIANI = ["free", "plus", "premium"] as const;

export const ETICHETTA_PIANO: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  premium: "Premium",
};

// Il piano subito sopra quello corrente (per i nudge "cosa sblocca l'upgrade")
// — null se il piano corrente è già il più alto (Premium).
export function trovaPianoSuccessivo(pianoCorrente: string, piani: PianoQuote[]): PianoQuote | null {
  const indice = ORDINE_PIANI.indexOf(pianoCorrente as (typeof ORDINE_PIANI)[number]);
  if (indice === -1 || indice === ORDINE_PIANI.length - 1) return null;
  const nomeSuccessivo = ORDINE_PIANI[indice + 1];
  return piani.find((p) => p.nome === nomeSuccessivo) ?? null;
}

// Tutti i piani sopra quello corrente, in ordine — per i bottoni "Richiedi
// l'upgrade" nella pagina /ente/piano (un piano può passare direttamente a
// Premium senza passare da Plus).
export function trovaPianiSuperiori(pianoCorrente: string, piani: PianoQuote[]): PianoQuote[] {
  const indice = ORDINE_PIANI.indexOf(pianoCorrente as (typeof ORDINE_PIANI)[number]);
  if (indice === -1) return [];
  const nomiSuperiori = ORDINE_PIANI.slice(indice + 1);
  return nomiSuperiori.map((nome) => piani.find((p) => p.nome === nome)).filter((p): p is PianoQuote => Boolean(p));
}
