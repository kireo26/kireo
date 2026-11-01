// Cosa dice una scrittura del client quando il database non l'accetta.
//
// ⚠️ LA REGOLA (Mario, 01/11): «riprova fra poco» si dice SOLO quando riprovare
// fra poco può funzionare. È la stessa di `lib/authErrors.ts`, portata alle
// scritture sul database: un guasto passeggero (rete, timeout, server) dice di
// riprovare; una sessione persa dice di rientrare; un rifiuto per una regola
// dice la regola, e chi scrive il componente la nomina; un rifiuto che non
// riconosciamo NON promette che riprovare funzioni.
//
// Il caso che l'ha fatta allargare: il registro presenze dei docenti diceva
// «Riprova più tardi» anche a «la persona non è iscritta» e «non hai il
// permesso». Chi certifica riprova, fallisce identico, smette, e quell'ora non
// c'è. Nessuno saprà mai perché.

export type ClasseErrore = "guasto" | "sessione" | "rifiuto";

// SQLSTATE di una condizione passeggera: connessione (08), risorse (53),
// operatore interrotto o tempo scaduto (57), sistema (58), serializzazione e
// stallo (40). Qui riprovare può funzionare.
const SQLSTATE_PASSEGGERI = /^(08|53|57|58|40)/;

/**
 * La classe di un errore di PostgREST. `sessioneViva` la dice chi chiama
 * (`sessioneAncoraViva`), perché è proprio la cosa che il client può aver
 * perso. Un errore senza codice è la rete (postgrest-js su una fetch fallita
 * restituisce `code: ""`), quindi passeggero. Le PGRST3xx sono il token. Ogni
 * altro codice è un rifiuto: un vincolo, una policy, una `raise exception`.
 */
export function classeErroreScrittura(errore: { code?: unknown } | null | undefined, sessioneViva: boolean): ClasseErrore {
  if (!sessioneViva) return "sessione";
  const codice = typeof errore?.code === "string" ? errore.code : "";
  if (codice === "") return "guasto";
  if (/^PGRST3/.test(codice)) return "sessione";
  if (SQLSTATE_PASSEGGERI.test(codice)) return "guasto";
  return "rifiuto";
}

/** Il codice e il messaggio di un rifiuto, per i rami che lo riconoscono. */
export function codiceErrore(errore: { code?: unknown } | null | undefined): string {
  return typeof errore?.code === "string" ? errore.code : "";
}
export function messaggioErrore(errore: { message?: unknown } | null | undefined): string {
  return typeof errore?.message === "string" ? errore.message : "";
}

type ClienteConAuth = {
  auth: { getUser: () => Promise<{ data: { user: unknown | null }; error: { name?: string } | null }> };
};

/**
 * La sessione c'è ancora? Si chiede al server, perché il client può averla
 * persa senza saperlo. ⚠️ Se la domanda stessa non arriva (la rete), la
 * risposta è «sì»: altrimenti un guasto di rete si direbbe «rientra», cioè un
 * rimedio sbagliato per un problema nostro.
 */
export async function sessioneAncoraViva(supabase: ClienteConAuth): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return true;
    return error?.name === "AuthRetryableFetchError";
  } catch {
    return true;
  }
}

// Testi comuni, miei e provvisori.
export const TESTO_SESSIONE_PERSA_SCRITTURA =
  "Il tuo accesso qui non è più valido, quindi non abbiamo salvato niente. Rientra in KIREO e rifallo.";

// `frase` è la frase intera di chi chiama («Non abbiamo potuto salvare il
// telefono.»): così il genere lo decide la frase, non un participio qui.
export function testoGuastoScrittura(frase: string): string {
  return `${frase} È un problema nostro, non tuo: riprova fra un momento.`;
}

export function testoRifiutoSconosciutoScrittura(frase: string): string {
  return `${frase} Non sappiamo dirti perché: se ti succede di nuovo, scrivici da Contatti.`;
}
