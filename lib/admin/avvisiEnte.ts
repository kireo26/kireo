// L'esito dell'email all'ente su una decisione (30/10, `avvisi_email_enti`).
// Una decisione è «da riprovare» se la sua riga PIÙ RECENTE non è partita:
// un tentativo riuscito dopo un fallimento la toglie dall'elenco. Testi miei e
// provvisori.

export type RigaAvviso = {
  cosa: "evento" | "newsletter";
  riferimento_id: string;
  esito: "inviata" | "non_partita" | "nessun_destinatario" | "non_dovuta";
  motivo: string | null;
  created_at: string;
};

/** Le decisioni la cui ultima email non è partita, dalla più recente. Le righe arrivano dalla più recente. */
export function avvisiDaRiprovare(righe: RigaAvviso[]): RigaAvviso[] {
  const viste = new Set<string>();
  const fuori: RigaAvviso[] = [];
  for (const r of righe) {
    const chiave = `${r.cosa}:${r.riferimento_id}`;
    if (viste.has(chiave)) continue;
    viste.add(chiave);
    if (r.esito === "non_partita" || r.esito === "nessun_destinatario") fuori.push(r);
  }
  return fuori;
}

export const TESTI_AVVISI = {
  titolo: "Email all'ente non partite",
  spiegazione:
    "La decisione è presa e l'avviso dentro KIREO è arrivato; l'email no. Qui resta finché un nuovo tentativo non parte.",
  nessuna: "Nessuna email all'ente da riprovare.",
  nonLetto: "Non siamo riusciti a leggere gli esiti delle email agli enti: ricarica la pagina.",
  nessunDestinatario: "L'ente non ha un account collegato: l'email non aveva a chi andare.",
  // Dopo la decisione, nella riga della coda: la riga esce subito dopo, quindi l'avviso non si legge lì.
  dopoDecisione: (esito: string | undefined) =>
    esito === "nessun_destinatario"
      ? "Fatto. L'ente non ha un account collegato: l'email non è partita, l'avviso dentro KIREO sì."
      : "Fatto. L'email all'ente non è partita: l'avviso dentro KIREO sì. La trovi in «Email all'ente non partite», in cima a questa pagina.",
};
