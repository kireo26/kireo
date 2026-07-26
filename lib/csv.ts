// Generazione CSV minimale (RFC 4180): primo export CSV del progetto,
// nessuna libreria dedicata per un compito così semplice. Usabile sia
// server-side (route handler) sia client-side (download diretto da una
// RPC già aggregata/anonimizzata) — nessuna dipendenza da fs o da altri
// moduli solo-server.
function escapiCampo(valore: unknown): string {
  if (valore === null || valore === undefined) return "";
  const testo = String(valore);
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
