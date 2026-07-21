// Il nome di uno studente è autodichiarato e può essere vuoto (caso reale
// osservato in produzione): quando succede, l'email diventa
// l'identificatore principale della riga invece di mostrare uno spazio
// vuoto. Se il nome c'è, l'email resta comunque disponibile come
// etichetta secondaria (vedi i componenti che usano queste funzioni).
export function nomeCompletoStudente(nome: string, cognome: string): string {
  return `${nome} ${cognome}`.trim();
}

export function etichettaPrincipaleStudente(nome: string, cognome: string, email: string | null): string {
  return nomeCompletoStudente(nome, cognome) || email || "Studente senza nome";
}
