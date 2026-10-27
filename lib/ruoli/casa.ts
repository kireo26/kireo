// DOVE ABITA CHI HA UN RUOLO (Mario, 27/10). Un posto solo per la domanda
// «qual è la mia area?», che fino al 27/10 aveva tre risposte: `/dopo-accesso`
// la sapeva per tutti i ruoli, mentre «La mia area» nel menu portava sempre a
// `/app` e `/app` costruiva la casa di uno studente a chiunque ci arrivasse.
// Un ente che cliccava «La mia area» leggeva «Ciao Anna · Il tuo percorso di
// orientamento sta per iniziare» con il ruolo `istituzione` scritto in chiaro
// sulla riga del suo profilo: non mancava l'informazione, mancava qualcuno che
// la leggesse.
//
// I ruoli sono i sei di `public.profile_role` (`20260710180000`, `20260713100000`,
// `20260715100000`). Un ruolo nuovo non è qui finché qualcuno non lo aggiunge,
// e allora `casaPerRuolo` dice `null`: chi lo chiama deve decidere cosa fare di
// un ruolo che non conosce, invece di mandarlo a casa di uno studente.
// `npm run test:casa` confronta l'elenco con l'enum delle migrazioni.
export const CASA_PER_RUOLO: Record<string, string> = {
  studente: "/app",
  istituzione: "/ente",
  referente_scuola: "/scuola",
  tutor_scuola: "/scuola",
  admin: "/admin",
  docente: "/docente",
};

export function casaPerRuolo(ruolo: string | null | undefined): string | null {
  return ruolo ? (CASA_PER_RUOLO[ruolo] ?? null) : null;
}

/**
 * Dove porta «La mia area»: a `/dopo-accesso`, che legge il ruolo dal profilo
 * sul server e manda alla casa giusta. Il menu non sa il ruolo (legge solo la
 * sessione) e non deve saperlo: una seconda copia della decisione nel client
 * divergerebbe dalla prima.
 */
export const HREF_LA_MIA_AREA = "/dopo-accesso";
