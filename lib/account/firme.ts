// Le firme di una persona, con le loro parole (03/11). Il NUMERO lo dà il
// database (`firme_di_un_account`, che legge le colonne dal catalogo: la
// sedicesima entra da sola); qui ci sono solo i nomi con cui dirlo.
//
// ⚠️ Una colonna che il database conta e qui non ha parole NON si tace: si dice
// «N altre firme». E `npm run test:cancellazione` è rosso finché qualcuno non le
// scrive le sue. *Un testo fisso dirà sempre la cosa sbagliata a qualcuno* (il
// 02/11 ha detto «le presenze che hai certificato» a chi aveva firmato dieci
// verifiche): il conteggio dice la cosa giusta senza prevedere i casi.
//
// Le parole sono mie e provvisorie.

export type Firma = { tabella: string; colonna: string; n: number };

/** [singolare, plurale]: «1 verifica di uno studente», «10 verifiche di studenti». */
export const PAROLE_DELLE_FIRME: Record<string, readonly [string, string]> = {
  "student_profiles.verificato_da": ["verifica di uno studente", "verifiche di studenti"],
  "iscrizioni_eventi.certificata_da_user": ["certificazione di presenza", "certificazioni di presenza"],
  "iscrizioni_eventi.iscritto_da": ["iscrizione di uno studente a un evento", "iscrizioni di studenti a eventi"],
  "iscrizioni_classe_eventi.iscritto_da": ["iscrizione di una classe a un evento", "iscrizioni di classi a eventi"],
  "post_enti.approvato_da": ["approvazione di un post", "approvazioni di post"],
  "post_enti.tolto_da": ["rimozione di un post", "rimozioni di post"],
  "newsletter_enti.approvata_da": ["decisione su una newsletter", "decisioni su newsletter"],
  "istituzioni_aree.revocata_da": ["revoca di un'area", "revoche di aree"],
  "messaggi_scuola.mittente_user": ["messaggio agli studenti", "messaggi agli studenti"],
  "school_staff.creato_da": ["invito a un tutor", "inviti a tutor"],
  "school_staff.delega_aggiornata_da": ["modifica di una delega", "modifiche di deleghe"],
  "proposte_incontro.proposta_da": ["proposta di incontro", "proposte di incontro"],
  "eventi.diretta_chiusa_da_user": ["chiusura di una diretta", "chiusure di dirette"],
  "eventi.ore_pcto_fissate_da": ["correzione delle ore di un evento", "correzioni delle ore di eventi"],
  "chiavi_trasmissione.aggiornata_da": ["chiave di trasmissione scritta", "chiavi di trasmissione scritte"],
};

function elenca(parti: string[]): string {
  if (parti.length <= 1) return parti.join("");
  return `${parti.slice(0, -1).join(", ")} e ${parti[parti.length - 1]}`;
}

/** «10 verifiche di studenti e 4 certificazioni di presenza». Solo le colonne con qualcosa. */
export function descriviFirme(firme: Firma[]): string {
  const parti: string[] = [];
  let altre = 0;
  for (const f of firme) {
    if (f.n <= 0) continue;
    const parole = PAROLE_DELLE_FIRME[`${f.tabella}.${f.colonna}`];
    if (!parole) {
      altre += f.n;
      continue;
    }
    parti.push(`${f.n} ${f.n === 1 ? parole[0] : parole[1]}`);
  }
  if (altre > 0) parti.push(altre === 1 ? "1 altra firma" : `${altre} altre firme`);
  return elenca(parti);
}

export function totaleFirme(firme: Firma[]): number {
  return firme.reduce((s, f) => s + Math.max(0, f.n), 0);
}
