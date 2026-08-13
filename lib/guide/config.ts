// KIREO — Sezione Guide: config dei contenuti (client-safe: niente fs, niente
// segreti). Ogni area (le 18 di data/aree.ts) ha fino a TRE guide di
// orientamento in PDF, di profondità crescente:
//   1 — Panoramica            (sempre disponibile)
//   2 — Le strade dentro l'area (si sblocca quando l'area si rafforza)
//   3 — Come partire davvero   (si sblocca quando l'area è consolidata)
//
// I PDF sono prodotti a parte (stile KIREO) e vivono in public/guide/<area>/
// <livello>.pdf — serviti staticamente da Vercel, stesso pattern dei kit
// workshop (public/materiali/...). La disponibilità del FILE è dichiarata in
// GUIDE_PRONTE (sotto), non letta con fs: deterministica e indipendente
// dall'ambiente. Questo config descrive le guide che CONCETTUALMENTE esistono,
// i loro titoli, la disponibilità del PDF e la regola di sblocco.
//
// I titoli dei tre livelli sono fissi; i sottotitoli sono generati dal nome
// dell'area, con override opzionali per-area in GUIDE_OVERRIDE (personalizzare
// una guida = aggiungere una riga lì, senza toccare la logica).

import { AREE, getAreaBySlug } from "@/data/aree";

export type LivelloGuida = 1 | 2 | 3;

export type Guida = {
  areaSlug: string;
  livello: LivelloGuida;
  titolo: string;
  sottotitolo: string;
  pdf: string; // URL statico: "/guide/<area>/<livello>.pdf"
};

// Nome fisso di ciascun livello + template del sottotitolo (riceve il nome area).
const LIVELLI: Record<LivelloGuida, { titolo: string; sottotitolo: (nome: string) => string }> = {
  1: { titolo: "Panoramica", sottotitolo: (n) => `Cos'è ${n} e se può fare per te.` },
  2: { titolo: "Le strade dentro l'area", sottotitolo: (n) => `I percorsi e i mestieri dentro ${n}.` },
  3: { titolo: "Come partire davvero", sottotitolo: (n) => `I primi passi concreti per ${n}.` },
};

// Personalizzazioni testuali per-area (vuoto oggi: i template bastano). Esempio:
// "informatica-digitale": { 2: { sottotitolo: "Sviluppo, dati, reti, sicurezza." } }
export const GUIDE_OVERRIDE: Record<string, Partial<Record<LivelloGuida, Partial<Pick<Guida, "titolo" | "sottotitolo">>>>> = {};

const LIVELLI_ORDINE: LivelloGuida[] = [1, 2, 3];

// Le tre guide di un'area (sempre tutte e tre: la disponibilità del PDF è
// un'altra cosa, vedi disponibilita.ts).
export function guideDiArea(areaSlug: string): Guida[] {
  const nome = getAreaBySlug(areaSlug)?.nome ?? areaSlug;
  return LIVELLI_ORDINE.map((livello) => {
    const ov = GUIDE_OVERRIDE[areaSlug]?.[livello];
    return {
      areaSlug,
      livello,
      titolo: ov?.titolo ?? LIVELLI[livello].titolo,
      sottotitolo: ov?.sottotitolo ?? LIVELLI[livello].sottotitolo(nome),
      pdf: `/guide/${areaSlug}/${livello}.pdf`,
    };
  });
}

export const TUTTE_LE_GUIDE: Guida[] = AREE.flatMap((a) => guideDiArea(a.slug));

// ─────────────────────────────────────────── Disponibilità del PDF (config, non fs)
//
// Quali guide hanno il PDF reale già caricato in public/guide/<area>/<livello>.pdf.
// DELIBERATAMENTE dichiarato qui, non letto con fs.existsSync: su Vercel i file di
// public/ sono serviti dalla CDN ma NON sono garantiti nel filesystem della
// funzione serverless a runtime, quindi una lettura fs sarebbe non deterministica
// in produzione. Rendere una guida disponibile = caricare il PDF nel repo E
// aggiungere/estendere la sua riga qui (una riga, coerente col resto del config).
//
export const GUIDE_PRONTE: Record<string, LivelloGuida[]> = {
  "informatica-digitale": [1, 2, 3], // PDF in public/guide/informatica-digitale/{1,2,3}.pdf
};

export function guidaPronta(areaSlug: string, livello: LivelloGuida): boolean {
  return (GUIDE_PRONTE[areaSlug] ?? []).includes(livello);
}

// Slug delle aree con il PDF reale della Guida 1 (Panoramica) già pronto: il
// lead-magnet pubblico e il chip «Scarica la guida» ci puntano dove esiste,
// tenendo il segnaposto /api/guida/<area> come fallback altrove.
export function areeConGuida1Pronte(): string[] {
  return AREE.map((a) => a.slug).filter((s) => guidaPronta(s, 1));
}

// ─────────────────────────────────────────── Regola di sblocco (gate)
//
// Fase di test: GATE_GUIDE_ATTIVO = false → nessun blocco effettivo, tutte le
// guide restano visibili e apribili, con SOLO l'indicazione dello stato. Quando
// il gate verrà attivato, `statoSblocco().sbloccata` diventerà vincolante.
export const GATE_GUIDE_ATTIVO = false;

// Soglie numeriche di BACKUP (tarabili): usate in aggiunta ai segnali d'azione,
// così un'area che si scalda molto sblocca anche senza aver ancora fatto T3/una
// missione. Da ritarare sull'uso reale.
export const SOGLIA_L2_INTEREST = 40;
export const SOGLIA_L3_INTEREST = 65;
export const SOGLIA_CONF_ALTA = 0.8;

export type StatoArea = "emergente" | "confermata" | "da_verificare";

export type SegnaleGuida = {
  status: StatoArea | null; // null = area non ancora in area_signal
  interestScore: number; // 0..100
  confidence: number; // 0..1
  t3Completato: boolean;
  missioniBloccoCompletate: number;
};

export type StatoSblocco = { sbloccata: boolean; motivo: string };

// Guida 2 — l'area «si rafforza». Sbloccata se lo studente ha COMPLETATO T3, o
// ≥1 missione del blocco, o l'area è confermata / da_verificare (segnali forti,
// anche se con tensione interna), o supera la soglia d'interesse di backup.
function sbloccoL2(s: SegnaleGuida): StatoSblocco {
  if (s.t3Completato) return { sbloccata: true, motivo: "Sbloccata: hai completato «Più a fondo»." };
  if (s.missioniBloccoCompletate >= 1) return { sbloccata: true, motivo: "Sbloccata: hai completato una missione di quest'area." };
  if (s.status === "confermata" || s.status === "da_verificare") return { sbloccata: true, motivo: "Sbloccata: l'area si è rafforzata nel tuo profilo." };
  if (s.interestScore >= SOGLIA_L2_INTEREST) return { sbloccata: true, motivo: "Sbloccata: l'area si sta rafforzando." };
  return { sbloccata: false, motivo: "Si sblocca quando l'area si rafforza — fai «Più a fondo» o prova una missione." };
}

// Guida 3 — l'area «si consolida». Sbloccata se l'area è confermata (o
// da_verificare con confidenza alta) E hai completato ≥1 missione del blocco.
// La soglia d'interesse alta resta come backup.
function sbloccoL3(s: SegnaleGuida): StatoSblocco {
  const consolidata = s.status === "confermata" || (s.status === "da_verificare" && s.confidence >= SOGLIA_CONF_ALTA);
  if (consolidata && s.missioniBloccoCompletate >= 1) return { sbloccata: true, motivo: "Sbloccata: area consolidata e missione completata." };
  if (s.interestScore >= SOGLIA_L3_INTEREST && s.missioniBloccoCompletate >= 1) return { sbloccata: true, motivo: "Sbloccata: interesse alto e missione completata." };
  if (!consolidata && s.interestScore < SOGLIA_L3_INTEREST) return { sbloccata: false, motivo: "Si sblocca quando l'area è consolidata e hai completato una missione." };
  if (s.missioniBloccoCompletate < 1) return { sbloccata: false, motivo: "Ci sei quasi: manca una missione di quest'area." };
  return { sbloccata: false, motivo: "Si sblocca quando l'area è consolidata e hai completato una missione." };
}

export function statoSblocco(livello: LivelloGuida, s: SegnaleGuida): StatoSblocco {
  if (livello === 1) return { sbloccata: true, motivo: "Sempre disponibile." };
  return livello === 2 ? sbloccoL2(s) : sbloccoL3(s);
}
