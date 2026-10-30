// GLI «INTERESSATI» DI UN ENTE (Mario, 28/10): il quadro in cima, l'elenco con
// gli stessi filtri sotto, e ogni nome che si apre. Le regole di cosa l'ente
// vede e non vede stanno in testa a 20261111100000; qui c'è solo come lo si
// riassume e lo si filtra. Funzioni pure, provate da `npm run test:interessati`.
//
// ✅ NESSUNA SOGLIA DI ANONIMATO QUI, ed è voluto: ogni persona contata nel
// quadro ha scelto di farsi vedere da questo ente e può revocare quando vuole,
// quindi i numeri riassumono gesti individuali già visibili uno per uno. La
// soglia serve dove un aggregato nasconde chi NON sa di essere contato: nelle
// statistiche degli eventi (app/ente/(dashboard)/statistiche), non qui.

import { orarioItalianoDaIstante } from "@/lib/formato";

export type Interessato = {
  student_id: string;
  nome: string;
  cognome: string;
  scuola_denominazione: string | null;
  scuola_provincia: string | null;
  anno_diploma: number | null;
  aree_interesse: string[];
  creata_il: string;
  // false per chi ha condiviso prima del 20261111100000: il suo consenso non
  // nominava l'attività, e per lui le due colonne sotto sono null.
  copre_attivita: boolean;
  eventi_seguiti: number | null;
  guida_scaricata: boolean | null;
  conversazione_id: string | null;
  // Dal 20261119110000: false per chi ha condiviso col pannello di prima, che
  // non nominava i post salvati né i file scaricati; per lui le due colonne
  // sotto sono null. Un consenso non si allarga da sé.
  copre_contenuti: boolean;
  post_salvati: number | null;
  allegati_scaricati: number | null;
};

// L'anno di corso si RICAVA dall'anno di diploma: la `classe` scritta in
// registrazione resta quella di quel giorno, e fra un anno sarebbe falsa.
// Anno scolastico da settembre a giugno, percorso di cinque anni (la stessa
// ipotesi di calcolaAnnoDiploma in lib/registrazione.ts, letta al contrario).
export type AnnoDiCorso = 1 | 2 | 3 | 4 | 5 | "diplomato" | null;

// In ora italiana, da lib/formato.ts: un cambio d'anno scolastico o di mese
// letto nella zona del server sarebbe sbagliato per due ore.
function annoEMese(istante: Date | string): { anno: number; mese: number } {
  const [anno, mese] = orarioItalianoDaIstante(istante).split("-").map(Number);
  return { anno, mese };
}

export function annoDiCorso(annoDiploma: number | null, oggi: Date): AnnoDiCorso {
  if (annoDiploma === null || !Number.isFinite(annoDiploma)) return null;
  const { anno, mese } = annoEMese(oggi);
  const fineAnnoScolastico = mese >= 9 ? anno + 1 : anno;
  const corso = 5 - (annoDiploma - fineAnnoScolastico);
  if (corso > 5) return "diplomato";
  if (corso < 1) return null;
  return corso as 1 | 2 | 3 | 4 | 5;
}

export function etichettaAnno(a: AnnoDiCorso): string {
  if (a === null) return "Anno non indicato";
  if (a === "diplomato") return "Già diplomato";
  return `${a}° anno`;
}

// «Ha fatto qualcosa verso di noi»: tre stati, non due. `null` è il consenso
// che non copre l'attività, e non si conta né fra chi ha fatto né fra chi ha
// solo alzato la mano: non lo sappiamo, e dirlo «no» sarebbe falso.
// Dal 30/10 conta anche «ha salvato un suo post o scaricato un suo file», ma
// solo dove il consenso lo copre (`copre_contenuti`). ⚠️ Per chi ha condiviso
// prima, «ha solo condiviso il profilo» vuol dire «niente di quello che il suo
// consenso ti lascia vedere», non «niente in assoluto»: i suoi salvataggi non
// li vediamo, e non li contiamo.
export function haFattoQualcosa(r: Interessato): boolean | null {
  if (!r.copre_attivita || r.eventi_seguiti === null || r.guida_scaricata === null) return null;
  const contenuti = r.copre_contenuti && ((r.post_salvati ?? 0) > 0 || (r.allegati_scaricati ?? 0) > 0);
  return r.eventi_seguiti > 0 || r.guida_scaricata || contenuti;
}

export type Filtri = {
  area?: string;
  anno?: string;
  provincia?: string;
  scuola?: string;
  fatto?: "si" | "no";
};

export const CHIAVI_FILTRI = ["area", "anno", "provincia", "scuola", "fatto"] as const;

export function leggiFiltri(parametri: Record<string, string | string[] | undefined>): Filtri {
  const uno = (k: string) => {
    const v = parametri[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() !== "" ? s : undefined;
  };
  const fatto = uno("fatto");
  return {
    area: uno("area"),
    anno: uno("anno"),
    provincia: uno("provincia"),
    scuola: uno("scuola"),
    fatto: fatto === "si" || fatto === "no" ? fatto : undefined,
  };
}

function chiaveAnno(a: AnnoDiCorso): string {
  return a === null ? "nd" : String(a);
}

export function filtraInteressati(righe: Interessato[], f: Filtri, oggi: Date): Interessato[] {
  return righe.filter((r) => {
    if (f.area && !r.aree_interesse.includes(f.area)) return false;
    if (f.anno && chiaveAnno(annoDiCorso(r.anno_diploma, oggi)) !== f.anno) return false;
    if (f.provincia && (r.scuola_provincia ?? "") !== f.provincia) return false;
    if (f.scuola && (r.scuola_denominazione ?? "") !== f.scuola) return false;
    if (f.fatto) {
      const fatto = haFattoQualcosa(r);
      if (fatto === null) return false;
      if (f.fatto === "si" && !fatto) return false;
      if (f.fatto === "no" && fatto) return false;
    }
    return true;
  });
}

export type Voce = { valore: string; etichetta: string; conteggio: number };

export type Quadro = {
  totale: number;
  nuoviQuestoMese: number;
  hannoFatto: number;
  soloLaMano: number;
  // Chi ha condiviso prima che il consenso nominasse l'attività: contati a
  // parte, perché di loro non sappiamo se hanno fatto qualcosa.
  senzaAttivita: number;
  perArea: Voce[];
  perAnno: Voce[];
  perProvincia: Voce[];
  perScuola: Voce[];
};

function contaPer(righe: Interessato[], chiavi: (r: Interessato) => { valore: string; etichetta: string }[]): Voce[] {
  const mappa = new Map<string, Voce>();
  for (const r of righe) {
    for (const k of chiavi(r)) {
      const v = mappa.get(k.valore) ?? { valore: k.valore, etichetta: k.etichetta, conteggio: 0 };
      v.conteggio += 1;
      mappa.set(k.valore, v);
    }
  }
  return [...mappa.values()].sort((a, b) => b.conteggio - a.conteggio || a.etichetta.localeCompare(b.etichetta, "it"));
}

export function quadroInteressati(righe: Interessato[], oggi: Date, nomeArea: (slug: string) => string): Quadro {
  const ora = annoEMese(oggi);
  let nuovi = 0;
  let fatto = 0;
  let mano = 0;
  let senza = 0;
  for (const r of righe) {
    const c = annoEMese(r.creata_il);
    if (c.anno === ora.anno && c.mese === ora.mese) nuovi += 1;
    const f = haFattoQualcosa(r);
    if (f === null) senza += 1;
    else if (f) fatto += 1;
    else mano += 1;
  }
  return {
    totale: righe.length,
    nuoviQuestoMese: nuovi,
    hannoFatto: fatto,
    soloLaMano: mano,
    senzaAttivita: senza,
    perArea: contaPer(righe, (r) => r.aree_interesse.map((s) => ({ valore: s, etichetta: nomeArea(s) }))),
    perAnno: contaPer(righe, (r) => {
      const a = annoDiCorso(r.anno_diploma, oggi);
      return [{ valore: chiaveAnno(a), etichetta: etichettaAnno(a) }];
    }),
    perProvincia: contaPer(righe, (r) =>
      r.scuola_provincia ? [{ valore: r.scuola_provincia, etichetta: r.scuola_provincia }] : [],
    ),
    perScuola: contaPer(righe, (r) =>
      r.scuola_denominazione ? [{ valore: r.scuola_denominazione, etichetta: r.scuola_denominazione }] : [],
    ),
  };
}

// L'indirizzo di un filtro, tenendo gli altri: cliccare «Napoli» dentro
// «quinto anno · Informatica» deve restringere, non ricominciare.
export function hrefFiltro(base: string, attuali: Filtri, chiave: keyof Filtri, valore: string | undefined): string {
  const p = new URLSearchParams();
  for (const k of CHIAVI_FILTRI) {
    const v = k === chiave ? valore : attuali[k];
    if (v) p.set(k, v);
  }
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}

// I testi: miei e provvisori, da rileggere.
export const TESTI_INTERESSATI = {
  nonLetti: "Non siamo riusciti a leggere gli studenti interessati: ricarica la pagina.",
  nessuno: "Nessuno studente ha ancora condiviso il proprio profilo con te.",
  nessunoConFiltri: "Nessuno studente corrisponde a questi filtri.",
  hannoFatto:
    "hanno anche fatto qualcosa verso di te: sono stati a un tuo evento, hanno scaricato la tua guida, salvato un tuo post o scaricato un tuo file",
  soloLaMano: "hanno solo condiviso il profilo",
  senzaAttivita:
    "hanno condiviso il profilo prima che il consenso includesse l'attività verso di te: di loro vedi solo quello che hanno dichiarato",
  schedaNonDisponibile:
    "Questo studente non condivide più il proprio profilo con te, oppure non l'ha mai fatto.",
  schedaSenzaAttivita:
    "Ha condiviso il profilo prima che il consenso includesse l'attività verso di te: qui vedi solo quello che ha dichiarato.",
  // Le aree sono le sole che sommano più del totale: le altre tre
  // ripartizioni hanno una voce per studente.
  notaAree: "Ogni studente può aver scelto più aree.",
  nessunaAttivita: "Non è ancora stato a un tuo evento e non ha scaricato la tua guida.",
  // Dal 30/10: i post salvati e i file scaricati, solo con il consenso nuovo.
  nessunContenuto: "Non ha salvato un tuo post e non ha scaricato un tuo file.",
  schedaSenzaContenuti:
    "Ha condiviso il profilo prima che il consenso includesse i post salvati e i file scaricati: questi non li vedi.",
  // ⚠️ L'ENTE NON SCRIVE PER PRIMO, ed è una REGOLA, non un limite tecnico
  // (Mario, 28/10): una conversazione fra un adulto che paga e un minorenne
  // parte dal minorenne. Condividere il profilo vuol dire «mi sono fatto
  // vedere», non «contattami». Per questo il bottone c'è solo dove una
  // conversazione esiste già. La regola per intero sta accanto a
  // apri_conversazione_ente (20261112100000): non si aggira da qui.
  senzaConversazione:
    "Puoi scrivergli quando ti avrà scritto lui: le conversazioni con gli studenti le apre lo studente, dai messaggi di KIREO.",
};
