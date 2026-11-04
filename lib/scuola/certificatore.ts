// Chi ha certificato una presenza, detto alla scuola (01/11, passo 4).
//
// «Certificato» senza dire da chi non è un difetto piccolo (Mario): chi ha
// certificato è parte del fatto che diventa un'ora in un registro. Fino al
// 01/11 l'etichetta non conosceva `ente` (il CHECK di `certificata_da_tipo`
// ammette sistema, kireo, scuola, ente), e una presenza certificata dall'ente
// si leggeva «Certificato». ⚠️ Testi miei e provvisori.

export const ETICHETTA_CERTIFICATORE: Record<string, string> = {
  sistema: "Certificato automaticamente dalla presenza misurata",
  kireo: "Certificato da KIREO",
  scuola: "Certificato dalla tua scuola",
  ente: "Certificato dall'ente che ha organizzato l'incontro",
};

export function etichettaCertificatore(tipo: string | null | undefined): string {
  if (tipo && ETICHETTA_CERTIFICATORE[tipo]) return ETICHETTA_CERTIFICATORE[tipo];
  // Mai la parola nuda: un tipo che non conosciamo lo si dice.
  // ⚠️ 04/11: qui usciva `Certificato (${tipo})`, cioè il valore grezzo dentro
  // una frase. Un tipo che non conosciamo lo si dice, senza stamparlo.
  return tipo ? "Certificato: non riconosciamo chi l'ha certificato" : "Certificato: chi l'ha certificato non è registrato";
}

/**
 * Il nome di chi ha certificato, letto da `nomi_dei_certificatori`
 * (20261207110000), l'unica strada che arriva anche a un tutor disattivato, a
 * chi ha cancellato l'account (la lapide tiene il nome) e a chi non è dello
 * staff. La scuola non legge più `profiles` per queste persone.
 *
 * `null` = non letto (la pagina lo dice); una persona assente dalla mappa =
 * la funzione non la restituisce (non ha certificato uno studente di questa
 * scuola), e il nome non si mostra.
 */
export async function leggiNomiCertificatori(
  supabase: { rpc: (f: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> },
  ids: (string | null | undefined)[],
): Promise<Map<string, string> | null> {
  const unici = [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0))];
  if (unici.length === 0) return new Map();
  const { data, error } = await supabase.rpc("nomi_dei_certificatori", { p_ids: unici });
  if (error || !Array.isArray(data)) {
    console.error("[lib/scuola/certificatore.ts] nomi dei certificatori non letti:", error);
    return null;
  }
  const mappa = new Map<string, string>();
  for (const r of data as { user_id: string; nome: string | null; cognome: string | null }[]) {
    const nome = `${r.nome ?? ""} ${r.cognome ?? ""}`.trim();
    if (nome) mappa.set(r.user_id, nome);
  }
  return mappa;
}

/** Testo mio e provvisorio. */
export const TESTO_CERTIFICATORE_NON_LETTO = "non siamo riusciti a leggere il nome";

/** Il nome da mostrare accanto all'etichetta: `undefined` se non c'è da dire niente. */
export function nomeDelCertificatore(
  mappa: Map<string, string> | null,
  tipo: string | null | undefined,
  userId: string | null | undefined,
): string | undefined {
  if (tipo === "sistema" || !userId) return undefined;
  if (mappa === null) return TESTO_CERTIFICATORE_NON_LETTO;
  return mappa.get(userId);
}
