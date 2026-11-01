// LA DELEGA DI UN TUTOR SI SALVA AL CLIC, E ADESSO LO DICE (passo 5.2, 01/11).
//
// Dal giro del 28/10 (Mario): ha spuntato una casella, non c'era nessun bottone
// e niente sullo schermo gli ha detto che era successo. Ha cambiato un permesso
// di una persona ed è rimasto col dubbio. Il salvataggio al clic resta; manca la
// riga che lo conferma.
//
// ⚠️ E la scrittura era muta (il censimento del 27/10): l'update non contava le
// righe, quindi una riga che la policy non lascia passare sarebbe sparita senza
// errore, e la casella si sarebbe girata lo stesso. Ora si rilegge la riga, e
// «salvato» si dice solo se il valore riletto è quello chiesto.
export type Permesso = "puo_verificare_studenti" | "puo_gestire_classi" | "puo_certificare_presenze" | "puo_inviare_comunicazioni";

export const PERMESSI: { chiave: Permesso; label: string; azione: string }[] = [
  { chiave: "puo_verificare_studenti", label: "Verificare studenti", azione: "verificare gli studenti" },
  { chiave: "puo_gestire_classi", label: "Gestire classi", azione: "gestire le classi" },
  { chiave: "puo_certificare_presenze", label: "Certificare presenze", azione: "certificare le presenze" },
  { chiave: "puo_inviare_comunicazioni", label: "Inviare comunicazioni", azione: "inviare comunicazioni" },
];

export type EsitoDelega = { esito: "salvato"; valore: boolean } | { esito: "non_toccato" } | { esito: "diverso" };

// La riga riletta dopo l'update: zero righe vuol dire che la scrittura non è
// atterrata (la RLS filtra senza errore, il modo 11).
export function esitoDelega(righe: unknown, chiave: Permesso, chiesto: boolean): EsitoDelega {
  if (!Array.isArray(righe) || righe.length !== 1) return { esito: "non_toccato" };
  const valore = (righe[0] as Record<string, unknown>)[chiave];
  if (valore !== chiesto) return { esito: "diverso" };
  return { esito: "salvato", valore: chiesto };
}

// Testi miei e provvisori. Il nome è quello che il referente vede sulla riga;
// senza nome si dice «il tutor» (un invito non ancora riscattato può non averlo).
export function testoConfermaDelega(nome: string | null, chiave: Permesso, valore: boolean): string {
  const chi = nome?.trim() ? nome.trim() : "il tutor";
  const azione = PERMESSI.find((p) => p.chiave === chiave)?.azione ?? "questo";
  return valore ? `Salvato: ora ${chi} può ${azione}.` : `Salvato: ${chi} non può più ${azione}.`;
}

export const TESTI_DELEGA = {
  errore: "Non è stato possibile aggiornare il permesso: niente è cambiato. Riprova.",
  nonToccato: "Il permesso non è stato salvato: ricarica la pagina e riprova.",
} as const;
