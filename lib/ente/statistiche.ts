import { formattaData } from "@/lib/formato";
import { getAreaBySlug } from "@/data/aree";
import { annoDiCorso, etichettaAnno, TESTI_INTERESSATI } from "@/lib/ente/interessati";

// LE STATISTICHE DELL'ENTE IN QUATTRO SEZIONI (29/10, 20261115100000).
// Eventi, Studenti, Newsletter, Guide: in cima a ognuna il dato aggregato,
// sotto il dettaglio. I numeri li calcola `statistiche_ente(uuid)`, una
// lettura sola; qui ci sono la lettura difensiva del jsonb e i testi.
//
// ⚠️ LA SOGLIA DI ANONIMATO STA NEL DATABASE, NON QUI. Una ripartizione arriva
// con i soli gruppi da almeno `soglia` studenti, e il resto sommato in `altre`:
// la pagina non riceve mai un gruppo più piccolo, quindi non può mostrarlo per
// sbaglio. Il numero è lo stesso di `report_evento_distribuzione` (k=5).
//
// ⚠️ «Non letto» non è zero: `leggiStatistiche` restituisce null su qualunque
// forma inattesa, e la pagina lo dice.
//
// Testi miei e provvisori, da rileggere con Mario.

export type Gruppo = { chiave: string | null; n: number };
export type Ripartizione = { righe: Gruppo[]; altre: number };

export type EventoRiga = {
  evento_id: string;
  titolo: string;
  data_inizio: string;
  tipo: string;
  passato: boolean;
  iscritti: number;
  collegati: number | null;
  certificate: number;
  risposte: number;
  domanda_posta: boolean;
};

export type GuidaRiga = {
  guida_id: string;
  titolo: string;
  caricata_il: string;
  archiviata_il: string | null;
  scaricamenti: number;
  studenti: number;
};

export type StatisticheEnte = {
  eventi: {
    in_programma: number;
    passati: number;
    iscritti: number;
    collegati: number;
    certificate: number;
    iscritti_dirette_finite: number;
    iscritti_collegati: number;
    permanenza_media_pct: number | null;
    permanenza_su: number;
    lista: EventoRiga[];
  };
  studenti: {
    totale: number;
    nuovi_mese: number;
    soglia: number;
    per_area: Ripartizione;
    per_anno_diploma: Ripartizione;
    per_indirizzo: Ripartizione;
    per_provincia: Ripartizione;
  };
  newsletter: { iscritti: number; raggiungibili: number; nuovi_mese: number; persi_mese: number; persi_contati_dal: string | null };
  guide: { scaricamenti: number; scaricamenti_mese: number; studenti: number; contati_dal: string | null; per_guida: GuidaRiga[] };
};

const oggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
// Un conteggio arriva come numero; un null o una stringa non numerica è una
// forma inattesa, e una forma inattesa non diventa zero.
function numero(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function ripartizione(v: unknown): Ripartizione | null {
  if (!oggetto(v) || !Array.isArray(v.righe)) return null;
  const altre = numero(v.altre);
  if (altre === undefined) return null;
  const righe: Gruppo[] = [];
  for (const r of v.righe) {
    if (!oggetto(r)) return null;
    const n = numero(r.n);
    if (n === undefined || (r.chiave !== null && typeof r.chiave !== "string")) return null;
    righe.push({ chiave: r.chiave as string | null, n });
  }
  return { righe, altre };
}

function numeri<K extends string>(o: unknown, chiavi: readonly K[]): Record<K, number> | null {
  if (!oggetto(o)) return null;
  const fuori = {} as Record<K, number>;
  for (const k of chiavi) {
    const n = numero(o[k]);
    if (n === undefined) return null;
    fuori[k] = n;
  }
  return fuori;
}

/** Il jsonb di `statistiche_ente`, o null se manca un pezzo: mai un mezzo risultato riempito di zeri. */
export function leggiStatistiche(dato: unknown): StatisticheEnte | null {
  if (!oggetto(dato)) return null;
  const e = dato.eventi;
  const ne = numeri(e, ["in_programma", "passati", "iscritti", "collegati", "certificate", "iscritti_dirette_finite", "iscritti_collegati", "permanenza_su"] as const);
  if (!ne || !oggetto(e) || !Array.isArray(e.lista)) return null;
  const lista: EventoRiga[] = [];
  for (const r of e.lista) {
    if (!oggetto(r) || typeof r.evento_id !== "string" || typeof r.titolo !== "string" || typeof r.data_inizio !== "string") return null;
    const nr = numeri(r, ["iscritti", "certificate", "risposte"] as const);
    if (!nr) return null;
    lista.push({
      evento_id: r.evento_id,
      titolo: r.titolo,
      data_inizio: r.data_inizio,
      tipo: String(r.tipo ?? ""),
      passato: r.passato === true,
      collegati: r.collegati === null ? null : (numero(r.collegati) ?? null),
      domanda_posta: r.domanda_posta === true,
      ...nr,
    });
  }

  const s = dato.studenti;
  const ns = numeri(s, ["totale", "nuovi_mese", "soglia"] as const);
  if (!ns || !oggetto(s)) return null;
  const parti = (["per_area", "per_anno_diploma", "per_indirizzo", "per_provincia"] as const).map((k) => ripartizione(s[k]));
  if (parti.some((p) => p === null)) return null;
  const [per_area, per_anno_diploma, per_indirizzo, per_provincia] = parti as Ripartizione[];

  const n = dato.newsletter;
  const nn = numeri(n, ["iscritti", "raggiungibili", "nuovi_mese", "persi_mese"] as const);
  if (!nn || !oggetto(n)) return null;

  const g = dato.guide;
  const ng = numeri(g, ["scaricamenti", "scaricamenti_mese", "studenti"] as const);
  if (!ng || !oggetto(g) || !Array.isArray(g.per_guida)) return null;
  const per_guida: GuidaRiga[] = [];
  for (const r of g.per_guida) {
    if (!oggetto(r) || typeof r.guida_id !== "string" || typeof r.titolo !== "string" || typeof r.caricata_il !== "string") return null;
    const nr = numeri(r, ["scaricamenti", "studenti"] as const);
    if (!nr) return null;
    per_guida.push({ guida_id: r.guida_id, titolo: r.titolo, caricata_il: r.caricata_il, archiviata_il: typeof r.archiviata_il === "string" ? r.archiviata_il : null, ...nr });
  }

  return {
    eventi: { ...ne, permanenza_media_pct: e.permanenza_media_pct == null ? null : (numero(e.permanenza_media_pct) ?? null), lista },
    studenti: { ...ns, per_area, per_anno_diploma, per_indirizzo, per_provincia },
    newsletter: { ...nn, persi_contati_dal: typeof n.persi_contati_dal === "string" ? n.persi_contati_dal : null },
    guide: { ...ng, contati_dal: typeof g.contati_dal === "string" ? g.contati_dal : null, per_guida },
  };
}

export type RigaMostrata = { etichetta: string; n: number };

/** Una ripartizione pronta per lo schermo: le etichette, e in fondo «altre» se c'è. */
export function righeMostrate(r: Ripartizione, etichetta: (chiave: string | null) => string, soglia: number): RigaMostrata[] {
  // Due chiavi diverse possono avere la stessa etichetta (due anni di diploma
  // già passati sono tutti e due «Già diplomato»): si sommano. Un gruppo che
  // nasce da una somma ha almeno `soglia` studenti, perché ognuno dei pezzi li
  // aveva.
  const somma = new Map<string, number>();
  for (const g of r.righe) {
    const e = etichetta(g.chiave);
    somma.set(e, (somma.get(e) ?? 0) + g.n);
  }
  const fuori = [...somma].map(([e, n]) => ({ etichetta: e, n })).sort((a, b) => b.n - a.n || a.etichetta.localeCompare(b.etichetta, "it"));
  if (r.altre > 0) fuori.push({ etichetta: T.altre(soglia), n: r.altre });
  return fuori;
}

export const etichettaArea = (slug: string | null) => (slug ? (getAreaBySlug(slug)?.nome ?? slug) : "Area non indicata");
export const etichettaIndirizzo = (v: string | null) => v ?? "Indirizzo non indicato";
export const etichettaProvincia = (v: string | null) => v ?? "Provincia non indicata";
export function etichettaAnnoDiploma(oggi: Date) {
  return (v: string | null) => etichettaAnno(annoDiCorso(v === null ? null : Number(v), oggi));
}

export const T = {
  cima:
    "Qui ci sono solo numeri, mai un nome: e un gruppo di meno di 5 studenti non compare da solo, finisce in «Altri gruppi». I nomi li trovi soltanto in «Interessati», e solo di chi ha scelto di mostrarsi a te, che può revocarlo quando vuole.",
  nonLetto: "Non siamo riusciti a leggere le statistiche: ricarica la pagina.",
  altre: (k: number) => `Altri gruppi (ciascuno sotto i ${k} studenti)`,
  notaAree: TESTI_INTERESSATI.notaAree,
  eventi: {
    titolo: "Eventi",
    collegatiSuIscritti: (c: number, i: number) => `Iscritti alle dirette già concluse che si sono collegati: ${c} su ${i}.`,
    permanenza: (pct: number, su: number) =>
      `Permanenza media di chi si è collegato: ${pct}% della durata vera dell'incontro (presenze contate: ${su}).`,
    inProgramma: "In programma",
    passati: "Passati",
    nessunoInProgramma: "Nessun evento in programma.",
    nessunoPassato: "Nessun evento passato.",
  },
  studenti: {
    titolo: "Studenti",
    chi: "Gli studenti che hanno fatto almeno un gesto verso di te: seguirti, iscriversi a un tuo evento o alla tua newsletter, scaricare la tua guida, condividere il profilo. Non scende: chi smette resta contato.",
    nessuno: "Ancora nessuno studente: le ripartizioni compaiono quando ce ne sono.",
  },
  newsletter: {
    titolo: "Newsletter",
    persiDal: (d: string) => `Le uscite si contano dal ${formattaData(d, "long")}.`,
    invii: "Le newsletter non partono ancora: quando partiranno, qui troverai quante ne sono state mandate.",
  },
  guide: {
    titolo: "Guide",
    riepilogo: (n: number, m: number) => `Scaricamenti in tutto: ${n} · studenti iscritti a KIREO fra chi le ha scaricate: ${m}`,
    spiega: "Il primo numero conta gli scaricamenti, non le persone: chi scarica due volte conta due, e conta anche chi non ha fatto l'accesso. Il secondo conta studenti, una volta ciascuno.",
    periodo: (g: GuidaRiga) =>
      g.archiviata_il
        ? `Pubblica dal ${formattaData(g.caricata_il, "long")} al ${formattaData(g.archiviata_il, "long")}, ora in archivio.`
        : `Pubblica dal ${formattaData(g.caricata_il, "long")}.`,
    riga: (g: GuidaRiga) => `Scaricamenti: ${g.scaricamenti} · Studenti iscritti a KIREO: ${g.studenti}`,
    nessuna: "Non hai ancora caricato una guida.",
  },
} as const;
