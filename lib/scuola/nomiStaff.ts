// I nomi dei colleghi e di chi ha verificato uno studente (04/11, 20261208100000).
//
// La scuola non legge più il profilo di un collega dalla tabella: la policy che
// lo permetteva dava l'intera riga (data di nascita, telefono), e copriva solo
// lo staff attivo, quindi un tutor disattivato compariva senza nome. Le due
// letture qui sotto danno solo nome e cognome.
//
// `null` = non letto, e la pagina lo dice: dal solo schermo «non c'è» e «non
// sono riuscito a leggerlo» non si distinguono (Mario, 04/11). Testi miei e
// provvisori.

type ClienteRpc = { rpc: (f: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
type Riga = { user_id: string; nome: string | null; cognome: string | null };

const nomeDi = (r: Riga) => `${r.nome ?? ""} ${r.cognome ?? ""}`.trim();

export const TESTO_NOME_NON_LETTO = "Non siamo riusciti a leggere il nome";

/** Nome e cognome di ogni persona dello staff della scuola, attiva o no. */
export async function leggiNomiDelloStaff(supabase: ClienteRpc): Promise<Map<string, string> | null> {
  const { data, error } = await supabase.rpc("nomi_dello_staff");
  if (error || !Array.isArray(data)) {
    console.error("[lib/scuola/nomiStaff.ts] nomi dello staff non letti:", error);
    return null;
  }
  const mappa = new Map<string, string>();
  for (const r of data as Riga[]) {
    const n = nomeDi(r);
    if (n) mappa.set(r.user_id, n);
  }
  return mappa;
}

/** Il nome da mostrare per una riga dello staff con un account. */
export function nomeDelCollega(mappa: Map<string, string> | null, userId: string): string {
  if (mappa === null) return TESTO_NOME_NON_LETTO;
  return mappa.get(userId) ?? "Nome non registrato";
}

export type Verificatore = { esito: "letto"; nome: string } | { esito: "nessuno" } | { esito: "non_letto" };

/** Chi ha verificato uno studente della scuola. «nessuno» = la verifica non ha un autore registrato. */
export async function leggiVerificatore(supabase: ClienteRpc, studentId: string): Promise<Verificatore> {
  const { data, error } = await supabase.rpc("verificatore_dello_studente", { p_student: studentId });
  if (error || !Array.isArray(data)) {
    console.error("[lib/scuola/nomiStaff.ts] chi ha verificato non letto:", error);
    return { esito: "non_letto" };
  }
  const r = (data as Riga[])[0];
  const n = r ? nomeDi(r) : "";
  return n ? { esito: "letto", nome: n } : { esito: "nessuno" };
}

/** La riga sotto «Verificato il …». */
export function testoVerificatore(v: Verificatore): string {
  if (v.esito === "letto") return `da ${v.nome}`;
  if (v.esito === "nessuno") return "Chi l'ha verificato non è registrato";
  return "Non siamo riusciti a leggere chi l'ha verificato";
}
