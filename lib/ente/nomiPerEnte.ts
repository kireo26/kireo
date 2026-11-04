// Nome e cognome di chi scrive all'ente e di chi si iscrive ai suoi eventi per
// docenti (04/11, 20261209100000).
//
// L'ente non legge più `profiles` dalla tabella: le due policy che lo
// permettevano davano l'intera riga (data di nascita, telefono, consenso). Le
// due letture qui sotto danno solo nome e cognome.
//
// `null` = non letto, e la pagina lo dice invece di scrivere «Studente» o
// «Docente» al posto di un nome che c'è (Mario, 04/11). Testi miei e provvisori.

type ClienteRpc = { rpc: (f: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

export const TESTO_NOME_NON_LETTO_ENTE = "Non siamo riusciti a leggere il nome";

const nome = (r: { nome: string | null; cognome: string | null }) => `${r.nome ?? ""} ${r.cognome ?? ""}`.trim();

/** Per conversazione: il nome dello studente. */
export async function leggiNomiInConversazione(supabase: ClienteRpc): Promise<Map<string, string> | null> {
  const { data, error } = await supabase.rpc("nomi_degli_studenti_in_conversazione");
  if (error || !Array.isArray(data)) {
    console.error("[lib/ente/nomiPerEnte.ts] nomi in conversazione non letti:", error);
    return null;
  }
  const m = new Map<string, string>();
  for (const r of data as { conversazione_id: string; nome: string | null; cognome: string | null }[]) {
    const n = nome(r);
    if (n) m.set(r.conversazione_id, n);
  }
  return m;
}

/** Per docente iscritto a un evento per docenti dell'ente: il suo nome. */
export async function leggiNomiDocentiIscritti(supabase: ClienteRpc, eventoId: string): Promise<Map<string, string> | null> {
  const { data, error } = await supabase.rpc("nomi_dei_docenti_iscritti", { p_evento: eventoId });
  if (error || !Array.isArray(data)) {
    console.error("[lib/ente/nomiPerEnte.ts] nomi dei docenti iscritti non letti:", error);
    return null;
  }
  const m = new Map<string, string>();
  for (const r of data as { user_id: string; nome: string | null; cognome: string | null }[]) {
    const n = nome(r);
    if (n) m.set(r.user_id, n);
  }
  return m;
}

/** Il nome da mostrare: non letto lo dice, un nome assente resta il ripiego di sempre. */
export function nomeOppure(mappa: Map<string, string> | null, id: string, ripiego: string): string {
  if (mappa === null) return TESTO_NOME_NON_LETTO_ENTE;
  return mappa.get(id) ?? ripiego;
}
