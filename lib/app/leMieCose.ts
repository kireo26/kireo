// «LE MIE COSE» (Mario, 30/10): quello che lo studente ha tenuto, cioè le
// guide degli enti che ha scaricato e i post che ha salvato. Stava in fondo a
// /app/guide, e lì un post salvato non lo cercava nessuno: lo stesso Mario,
// dopo aver premuto «Salva», non sapeva dove trovarlo.
//
// ⚠️ «GUIDE» NON SI È RINOMINATA, ed è una decisione presa misurando: /app/guide
// è il secondo passo del percorso (`lib/percorso/passi.ts`) e contiene le 18
// guide di KIREO con il cancello sui livelli. Quelle non sono «cose mie»: sono
// il gradino che lo studente deve ancora fare. Un nome giusto per metà dello
// schermo e sbagliato per l'altra metà è peggio di quello vecchio.
//
// Nel menù sta accanto alla Bacheca, non accanto a «Le mie attività»: le due
// voci cominciano uguale e non sono parenti (il tempo che hai speso, quello che
// hai tenuto). Il posto dice da sé dove finisce quello che si salva.

import type { GuidaScaricata } from "@/lib/app/guideScaricate";
import type { PostSalvato } from "@/lib/app/postSalvati";
import type { RegistrazioneSalvata } from "@/lib/app/registrazioniSalvate";

export const HREF_LE_MIE_COSE = "/app/le-mie-cose";

// Testi miei e provvisori, tranne `salvatoDove` (Mario, 30/10).
export const TESTI_LE_MIE_COSE = {
  etichetta: "Le mie cose",
  titolo: "Le mie cose",
  intestazione: "Quello che hai tenuto, dal più recente: le guide degli enti che hai scaricato, i post e le registrazioni che hai salvato.",
  // Per chi arriva a /app/guide con un preferito o un link di prima: la
  // sezione non c'è più lì, e la riga dice dove è andata invece di saltare
  // altrove senza spiegazione.
  spostate: "Le guide degli enti che hai scaricato e i post che hai salvato ora stanno in Le mie cose.",
  vaiDiLa: "Vai a Le mie cose →",
} as const;

// ── LA LISTA UNICA (Mario, 30/10) ─────────────────────────────────────────────
// Una lista sola, guide e post insieme, in ordine di GESTO: quando lo studente
// ha scaricato la guida o salvato il post, non quando l'ente l'ha pubblicato.
// È l'archivio di quello che ha fatto lui, quindi comanda la sua data.
//
// ⚠️ SI LEGGE INTERA, NON SI IMPAGINA, ed è una scelta con la sua condizione:
// le due funzioni del database (`guide_enti_scaricate`, `post_salvati_miei`)
// restituiscono già tutte le righe di chi chiede, e qui si fondono in memoria.
// Niente cursore, quindi niente del difetto della Bacheca (una seconda pagina
// che ripete la prima), che con due sorgenti avrebbe più modi di nascere. Il
// fatto che la fa impaginare: il primo studente con un archivio che non si
// legge in una schermata. Quel giorno il cursore si prova sulla seconda pagina
// contro il database vero, non con una simulazione.
//
// L'ordine fra due righe con la stessa data è deciso da qualcosa di stabile
// (il tipo, poi l'id), mai da come arrivano: un ordine che dipende dall'ordine
// di arrivo non è un ordine.


// Dal 31/10 i filtri sono quattro (Mario): le registrazioni salvate sono la
// terza sorgente, con il loro segno.
export type FiltroLeMieCose = "tutto" | "guide" | "post" | "registrazioni";
export const FILTRI_LE_MIE_COSE: readonly FiltroLeMieCose[] = ["tutto", "guide", "post", "registrazioni"];
type Sorgente = "guide" | "post" | "registrazioni";

/** Il filtro sta nell'indirizzo (`?tipo=`): un valore sconosciuto è «Tutto». */
export function filtroDaIndirizzo(tipo: string | undefined): FiltroLeMieCose {
  return tipo === "guide" || tipo === "post" || tipo === "registrazioni" ? tipo : "tutto";
}

export function hrefFiltro(f: FiltroLeMieCose): string {
  return f === "tutto" ? HREF_LE_MIE_COSE : `${HREF_LE_MIE_COSE}?tipo=${f}`;
}

export type VoceLeMieCose =
  | { tipo: "guida"; quando: string; chiave: string; guida: GuidaScaricata }
  | { tipo: "post"; quando: string; chiave: string; post: PostSalvato }
  | { tipo: "registrazione"; quando: string; chiave: string; registrazione: RegistrazioneSalvata };

export type ListaLeMieCose = {
  voci: VoceLeMieCose[];
  /** Le sorgenti che il filtro chiede e che non si sono lette: la pagina le nomina. */
  nonLette: Sorgente[];
  /** Il testo del vuoto, solo se tutto quello che il filtro chiede si è letto e non c'è niente. */
  vuoto: string | null;
};

const ms = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

// Le tre sorgenti sono obbligatorie, anche `null` (non letta): un argomento
// facoltativo è il posto in cui un chiamante che si è dimenticato di leggere
// una sorgente la fa passare per vuota.
export function listaLeMieCose(
  guide: GuidaScaricata[] | null,
  post: PostSalvato[] | null,
  registrazioni: RegistrazioneSalvata[] | null,
  filtro: FiltroLeMieCose,
): ListaLeMieCose {
  const vuole = (s: Sorgente) => filtro === "tutto" || filtro === s;
  const vuoleGuide = vuole("guide");
  const vuolePost = vuole("post");
  const vuoleRegistrazioni = vuole("registrazioni");
  const voci: VoceLeMieCose[] = [];
  if (vuoleGuide && guide) for (const g of guide) voci.push({ tipo: "guida", quando: g.scaricataIl, chiave: g.guidaId, guida: g });
  if (vuolePost && post) for (const p of post) voci.push({ tipo: "post", quando: p.salvatoIl, chiave: p.salvataggioId, post: p });
  if (vuoleRegistrazioni && registrazioni)
    for (const r of registrazioni) voci.push({ tipo: "registrazione", quando: r.salvataIl, chiave: r.salvataggioId, registrazione: r });
  // Dal gesto più recente; a parità di istante il tipo, poi l'id.
  voci.sort((a, b) => ms(b.quando) - ms(a.quando) || a.tipo.localeCompare(b.tipo) || a.chiave.localeCompare(b.chiave));
  const nonLette: Sorgente[] = [];
  if (vuoleGuide && guide === null) nonLette.push("guide");
  if (vuolePost && post === null) nonLette.push("post");
  if (vuoleRegistrazioni && registrazioni === null) nonLette.push("registrazioni");
  const vuoto = voci.length === 0 && nonLette.length === 0 ? TESTI_LISTA.vuoto[filtro] : null;
  return { voci, nonLette, vuoto };
}

// Testi miei e provvisori (30/10), tranne i tre del vuoto di guide e post,
// proposti da Mario. Quelli delle registrazioni sono miei (31/10), tranne il
// segno «Registrazione» (Mario).
export const TESTI_LISTA = {
  filtri: { tutto: "Tutto", guide: "Guide", post: "Post", registrazioni: "Registrazioni" } as Record<FiltroLeMieCose, string>,
  /** Il segno su ogni riga: in una lista che mescola due cose, la riga dice quale delle due è. */
  segno: { guida: "Guida", post: "Post", registrazione: "Registrazione" } as const,
  vuoto: {
    tutto: "Qui finisce quello che tieni: le guide che scarichi, i post e le registrazioni che salvi.",
    guide: "Non hai ancora scaricato nessuna guida.",
    post: "Non hai ancora salvato nessun post.",
    registrazioni: "Non hai ancora salvato nessuna registrazione.",
  } as Record<FiltroLeMieCose, string>,
  nonLette: {
    guide: "Non siamo riusciti a leggere le guide che hai scaricato: qui mancano. Ricarica la pagina.",
    post: "Non siamo riusciti a leggere i post che hai salvato: qui mancano. Ricarica la pagina.",
    registrazioni: "Non siamo riusciti a leggere le registrazioni che hai salvato: qui mancano. Ricarica la pagina.",
  } as const,
};
