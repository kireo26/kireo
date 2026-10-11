// Generazione CSV minimale (RFC 4180): primo export CSV del progetto,
// nessuna libreria dedicata per un compito così semplice. Usabile sia
// server-side (route handler) sia client-side (download diretto da una
// RPC già aggregata/anonimizzata) — nessuna dipendenza da fs o da altri
// moduli solo-server.
// ⚠️ UN ISTANTE GREZZO NON ENTRA IN UN CSV (11/10/2026). Il file delle presenze
// stampava «2026-10-04T15:08:31+00:00», cioè l'ora di Greenwich, accanto a ore
// PCTO su un documento che una scuola conserva — e chi lo legge in un foglio di
// calcolo non ha modo di accorgersi del fuso. Un CSV qui lo apre sempre una
// persona, quindi un istante va formattato con `formattaIstante` PRIMA di
// arrivare qui; questo controllo è il terminale, e fallisce A VOCE ALTA invece
// di consegnare un orario sbagliato di due ore su un atto. Una data senza ora
// («2008-01-01») passa: non ha un fuso da sbagliare.
const ISTANTE_GREZZO = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export class IstanteGrezzoInCsv extends Error {
  constructor(valore: string) {
    super(`istante non formattato in un CSV: «${valore}» — passalo da formattaIstante`);
  }
}

function escapiCampo(valore: unknown): string {
  if (valore === null || valore === undefined) return "";
  const testo = String(valore);
  if (ISTANTE_GREZZO.test(testo)) throw new IstanteGrezzoInCsv(testo);
  if (/[",\n;]/.test(testo)) {
    return `"${testo.replace(/"/g, '""')}"`;
  }
  return testo;
}

export function generaCsv(intestazioni: string[], righe: unknown[][]): string {
  const linee = [intestazioni.map(escapiCampo).join(","), ...righe.map((riga) => riga.map(escapiCampo).join(","))];
  // BOM UTF-8: Excel su Windows non riconosce l'UTF-8 senza, mostrerebbe
  // accenti/lettere italiane corrotti altrimenti.
  return "﻿" + linee.join("\r\n");
}

export type SezioneCsv = {
  /** Il titolo, su una riga sua: dice cosa sono le righe che seguono. */
  titolo: string;
  intestazioni: string[];
  righe: unknown[][];
  /**
   * ⚠️ COSA SI SCRIVE QUANDO NON C'È NESSUNA RIGA, e questo campo è il motivo
   * per cui questa funzione esiste: «zero domande» e «non le abbiamo
   * esportate» si somigliano in un file aperto un mese dopo. Una sezione vuota
   * deve DIRLO — e dirlo con una frase che dice *cosa* non c'è, non con un
   * «nessun dato» che va bene per tutto.
   */
  seNonCeNiente: string;
  /**
   * Una riga sotto il titolo che spiega una parola che compare nelle celle
   * (oggi: «non calcolabile» nei minuti). Facoltativa, e si stampa SOLO quando
   * serve: una nota che c'è sempre smette di essere letta.
   */
  nota?: string | null;
};

/**
 * Un file con PIÙ TABELLE, separate da una riga vuota e precedute dal loro
 * titolo.
 *
 * ⚠️ NON È UN CSV RFC 4180, e `generaCsv` resta quello che era: un lettore che
 * si aspetta colonne uniformi su un file così si rompe. Lo si fa comunque
 * perché chi lo apre è una persona, in Excel o in Numbers, dove le sezioni si
 * leggono — e perché l'alternativa (tre file, o un archivio) costa un clic e
 * del codice in più a chi deve poi allegarne uno a un'email. Il nome dice che
 * è un'altra cosa, invece di far sembrare `generaCsv` più generale di quello
 * che è.
 *
 * Il BOM sta UNA volta in testa al file, non per sezione.
 */
export function generaCsvSezioni(sezioni: SezioneCsv[]): string {
  const blocchi = sezioni.map((s) => {
    const linee = [escapiCampo(s.titolo)];
    if (s.nota) linee.push(escapiCampo(s.nota));
    if (s.righe.length === 0) {
      linee.push(escapiCampo(s.seNonCeNiente));
    } else {
      linee.push(s.intestazioni.map(escapiCampo).join(","));
      for (const riga of s.righe) linee.push(riga.map(escapiCampo).join(","));
    }
    return linee.join("\r\n");
  });
  return "﻿" + blocchi.join("\r\n\r\n") + "\r\n";
}
