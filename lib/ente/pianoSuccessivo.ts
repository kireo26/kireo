export type PianoQuote = {
  id: string;
  nome: "free" | "premium";
  prezzo_min: number;
  prezzo_max: number;
  quota_eventi_promossi: number;
  quota_newsletter: number;
  quota_cta_esterne: number;
};

// I piani sono due dal 30/10 (Mario: «solo free e premium»; il plus è uscito
// in 20261117110000, che si ferma se un ente o una richiesta lo usa ancora).
const ORDINE_PIANI = ["free", "premium"] as const;

export const ETICHETTA_PIANO: Record<string, string> = {
  free: "Free",
  premium: "Premium",
};

// Le newsletter all'anno accademico, come le scrive il database
// (20260722100000 per il premium, 20261117110000 per il free). Il listino
// pubblico di /istituzioni non legge il database, quindi le legge da qui, e
// `npm run test:newsletter` confronta questi numeri con le migrazioni. Le tre
// gratuite sono l'assaggio (Mario): «mi serve all'inizio dare possibilità agli
// enti di entrare gratis e capirne le potenzialità».
export const QUOTA_NEWSLETTER: Record<(typeof ORDINE_PIANI)[number], number> = {
  free: 3,
  premium: 12,
};

// Gate booleano riusato ovunque un contenuto/funzione è riservata ai piani
// a pagamento (embed social in bacheca, notifiche ai follower,
// manifestazioni di interesse, messaggi) — mai accesso privilegiato ai
// dati degli studenti, solo promozione/informazione, vedi CLAUDE.md.
export function pianoAPagamento(pianoNome: string): boolean {
  return pianoNome !== "free";
}

// Il piano subito sopra quello corrente (per i nudge "cosa sblocca l'upgrade")
// — null se il piano corrente è già il più alto (Premium).
export function trovaPianoSuccessivo(pianoCorrente: string, piani: PianoQuote[]): PianoQuote | null {
  const indice = ORDINE_PIANI.indexOf(pianoCorrente as (typeof ORDINE_PIANI)[number]);
  if (indice === -1 || indice === ORDINE_PIANI.length - 1) return null;
  const nomeSuccessivo = ORDINE_PIANI[indice + 1];
  return piani.find((p) => p.nome === nomeSuccessivo) ?? null;
}

// Tutti i piani sopra quello corrente, in ordine — per i bottoni "Richiedi
// l'upgrade" nella pagina /ente/piano.
export function trovaPianiSuperiori(pianoCorrente: string, piani: PianoQuote[]): PianoQuote[] {
  const indice = ORDINE_PIANI.indexOf(pianoCorrente as (typeof ORDINE_PIANI)[number]);
  if (indice === -1) return [];
  const nomiSuperiori = ORDINE_PIANI.slice(indice + 1);
  return nomiSuperiori.map((nome) => piani.find((p) => p.nome === nome)).filter((p): p is PianoQuote => Boolean(p));
}
