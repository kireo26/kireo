import type { FaseElaborato, SezioneElaborato } from "./elaborato-config";

export type ValoreTesto = string;
export type ValoreTabella = Record<string, string>[];
export type ValoreChecklist = { voci: Record<string, boolean>; nota: string };
export type ValoreScelta = { opzione: string; motivazione: string };
export type ValoreSezione = ValoreTesto | ValoreTabella | ValoreChecklist | ValoreScelta;

export function valoreVuoto(sezione: SezioneElaborato): ValoreSezione {
  switch (sezione.tipo) {
    case "testo":
    case "testo_lungo":
    case "immagine":
      // 'immagine': stringa vuota = nessuna immagine caricata, altrimenti
      // percorso Storage (bucket workshop-consegne) — stesso tipo di
      // 'testo', mai un url pubblico (il bucket è privato).
      return "";
    case "tabella":
      // righeIniziali (facoltativo): righe pre-compilate come punto di
      // partenza (es. voci di costo già elencate), altrimenti tabella
      // vuota — restano righe normali, modificabili/rimuovibili.
      return sezione.righeIniziali
        ? sezione.righeIniziali.map((riga) => Object.fromEntries((sezione.colonne ?? []).map((colonna, i) => [colonna, riga[i] ?? ""])))
        : [];
    case "checklist":
      return { voci: {}, nota: "" };
    case "scelta":
      return { opzione: "", motivazione: "" };
  }
}

// Riassunto in testo semplice del valore di una sezione — usato come
// contesto per il tutor AI (modalità "revisione" e come "ho già scritto"
// nella modalità "aiuto"), mai per il salvataggio (quello resta jsonb).
export function serializzaValoreSezione(sezione: SezioneElaborato, valore: ValoreSezione | undefined): string {
  if (valore === undefined) return "";
  switch (sezione.tipo) {
    case "testo":
    case "testo_lungo":
      return typeof valore === "string" ? valore : "";
    case "immagine":
      return typeof valore === "string" && valore ? "[immagine allegata]" : "(nessuna immagine)";
    case "tabella": {
      const righe = Array.isArray(valore) ? (valore as ValoreTabella) : [];
      if (righe.length === 0) return "";
      return righe
        .map((riga) => (sezione.colonne ?? []).map((colonna) => `${colonna}: ${riga[colonna] ?? ""}`).join(", "))
        .join("\n");
    }
    case "checklist": {
      const v = valore as ValoreChecklist;
      const voci = (sezione.voci ?? []).map((voce) => `${v?.voci?.[voce] ? "[x]" : "[ ]"} ${voce}`).join("\n");
      return v?.nota ? `${voci}\nNota: ${v.nota}` : voci;
    }
    case "scelta": {
      const v = valore as ValoreScelta;
      return v?.opzione ? `${v.opzione} — ${v.motivazione || "(nessuna motivazione)"}` : "";
    }
  }
}

// Una sezione "raggiunge il minimo" quando soddisfa la soglia dichiarata
// nel config (minCaratteri/minRighe) o, in assenza di soglia, quando non è
// vuota — usato sia lato client (per abilitare "Consegna la tappa") sia
// lato server (route consegna-tappa, contro il contenuto autorevole letto
// dal DB, mai quello del client).
export function sezioneRaggiungeMinimo(sezione: SezioneElaborato, valore: ValoreSezione | undefined): boolean {
  // Una sezione facoltativa non blocca mai la consegna, a prescindere dal
  // tipo — oggi usato solo per lo schizzo immagine di spazio/la_pianta.
  if (sezione.opzionale) return true;
  if (valore === undefined) return false;
  switch (sezione.tipo) {
    case "testo":
    case "testo_lungo": {
      const testo = typeof valore === "string" ? valore.trim() : "";
      return sezione.minCaratteri ? testo.length >= sezione.minCaratteri : testo.length > 0;
    }
    case "immagine":
      return typeof valore === "string" && valore.length > 0;
    case "tabella": {
      const righe = Array.isArray(valore) ? (valore as ValoreTabella) : [];
      return sezione.minRighe ? righe.length >= sezione.minRighe : righe.length > 0;
    }
    case "checklist": {
      // Una spunta OPPURE una nota scritta. Prima serviva per forza almeno
      // una spunta, e in una lista di cose che uno METTE IN PIEDI («spunta
      // ciò che prevedi») questo rendeva indicibile la risposta «nessuna di
      // queste»: per andare avanti lo studente doveva dichiarare di prevedere
      // qualcosa che non prevedeva. Una scelta imposta da noi che finisce in
      // `contenuto`, che il revisore legge come una sua dichiarazione e che
      // domani, col cross-feed nel profilo, diventerebbe un'affermazione su
      // di lui che nessuna sua scelta sostiene.
      // La nota tiene comunque distinto «nessuna, e ti spiego perché» da «non
      // l'ho compilata», che era la ragione per cui il vuoto secco non basta.
      const v = valore as ValoreChecklist;
      const qualcheSpunta = Boolean(v?.voci && Object.values(v.voci).some(Boolean));
      return qualcheSpunta || Boolean(v?.nota && v.nota.trim().length > 0);
    }
    case "scelta": {
      const v = valore as ValoreScelta;
      return Boolean(v?.opzione);
    }
  }
}

// Titoli delle sezioni di una tappa che non raggiungono ancora il minimo
// — array vuoto quando la tappa è pronta per essere consegnata.
export function sezioniIncomplete(fase: FaseElaborato, contenuto: Record<string, ValoreSezione>): string[] {
  return fase.sezioni.filter((s) => !sezioneRaggiungeMinimo(s, contenuto[s.id])).map((s) => s.titolo);
}

// Workshop 2.0 v2 — stato per-tappa (workshop_fasi_stato) e le forme dei
// due feedback generati dal cron via lib/workshop/prompt-revisore.ts:
// la revisione di OGNI tappa (promptRevisore, rubrica-based) e il
// feedback finale dell'ULTIMA tappa (promptFeedbackFinale, complessivo
// sull'intero progetto) — forme diverse apposta, non unificate, per
// restare fedeli ai prompt forniti invece di inventarne una terza forma.
export type RevisioneTappa = {
  // Due nomi per lo stesso posto, e non è un ripensamento a metà: dal
  // 2026-08-31 il revisore di tappa produce `cosa_regge`, il feedback finale
  // produce ancora `punti_forza`. È una PROVA — l'ipotesi è che un campo che
  // si chiama «punti di forza» tiri il modello a lodare la PERSONA («hai
  // capito», «hai riconosciuto») qualunque cosa dica la regola sotto, e
  // lasciarne uno dei due invariato è quello che rende la prova leggibile:
  // se cala solo quello cambiato, è il campo; se calano entrambi o nessuno,
  // l'ipotesi era sbagliata. Le revisioni già scritte hanno la chiave vecchia
  // e devono continuare a leggersi.
  cosa_regge?: string[];
  punti_forza?: string[];
  da_migliorare: string[];
  domanda: string;
  commento_breve: string;
  punteggio_fiducia: number;
};

// Il posto dove il revisore dice cosa tiene, comunque l'abbia chiamato.
export const cosaRegge = (r: { cosa_regge?: string[]; punti_forza?: string[] } | null | undefined): string[] =>
  r?.cosa_regge ?? r?.punti_forza ?? [];

// ─────────────────────── IL BLOCCO SUL MODO DI LAVORARE
// Quello che si vede di come ha lavorato, e dove quel modo di fare si usa.
// Il materiale sono le DOMANDE che ha fatto al cliente lungo il percorso —
// l'unico testo che uno studente scrive senza sapere di essere valutato.
//
// LA REGOLA, una sola: il blocco AFFERMA AZIONI, non afferma mai il MOTIVO di
// un'azione. «Nella tappa 2 hai chiesto X» si può rileggere; «hai chiesto X
// perché volevi Y» no, e il 13/09 il modello l'ha inventato su una domanda che
// era stata messa lì per costruzione perché non avesse nessuna intenzione
// dietro («non è una domanda random: è il vincolo che dà forma a tutto»).
//
// Sta in un oggetto suo, prodotto da una CHIAMATA SEPARATA, per una ragione
// che non è di ordine: il feedback finale ha un campo che gli vieta il
// silenzio per come è scritto il prompt (due segnaposto in `punti_forza` si
// leggono come «almeno due»), e questo blocco deve poter non dire niente.
// Chiedere le due cose nello stesso JSON è chiedere due contratti opposti
// nella stessa risposta.
export type ModoDiLavorare = {
  // VUOTO È IL SILENZIO, e il silenzio è un esito legittimo — anzi è quello
  // giusto più spesso di quanto sembri. Ogni voce porta dentro di sé una
  // citazione letterale di una domanda dello studente.
  quello_che_si_vede: string[];
  // Dove quel modo di fare si usa: un'affermazione sul MESTIERE, mai
  // un'etichetta sulla persona. Vuoto se `quello_che_si_vede` è vuoto.
  dove_porta: string[];
  // Cosa quelle domande NON mostrano di lui. Richiesto solo quando c'è
  // qualcosa da vedere: nel silenzio resta vuoto di proposito, perché il testo
  // del silenzio è scritto una volta nel pannello e non si genera (vedi sotto).
  cosa_non_si_vede_ancora: string;
};

// Il blocco non ha niente da dire.
export const modoDiLavorareVuoto = (m: ModoDiLavorare): boolean => m.quello_che_si_vede.length === 0;

export type FeedbackFinale = {
  punti_forza: string[]; // invariato di proposito: è il termine di paragone della prova sopra
  da_migliorare: string[];
  messaggio_chiusura: string;
  chiusura_cliente: string;
  punteggio_area: number;
  // Facoltativo: i progetti chiusi prima del 13/09 non ce l'hanno, e un
  // fallimento della sua chiamata lascia il resto del feedback intatto.
  modo_di_lavorare?: ModoDiLavorare;
};

// Legge il blocco dalla risposta del modello, o dice di no.
//
// Il caso da NON lasciar passare è l'ultimo: `dove_porta` pieno con
// `quello_che_si_vede` vuoto è il blocco che afferma una direzione senza
// niente sotto — cioè esattamente l'invenzione che il blocco esiste per non
// fare, nella sua forma più difficile da riconoscere leggendo.
export function leggiModoDiLavorare(parsed: unknown): ModoDiLavorare | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const visto = o.quello_che_si_vede;
  const porta = o.dove_porta;
  if (!Array.isArray(visto) || !Array.isArray(porta)) return null;
  if (visto.some((v) => typeof v !== "string") || porta.some((v) => typeof v !== "string")) return null;
  const pulitoVisto = (visto as string[]).filter((v) => v.trim() !== "");
  const pulitoPorta = (porta as string[]).filter((v) => v.trim() !== "");
  if (pulitoVisto.length === 0 && pulitoPorta.length > 0) return null;
  // Richiesto solo quando c'è qualcosa da vedere: «cosa non si vede ancora»
  // accanto a una cosa vista è un'affermazione specifica, che solo il modello
  // può scrivere. Nel silenzio no — lì il motivo è sempre lo stesso (poche
  // domande, andate su cose diverse), quindi non c'è niente da personalizzare
  // e chiederglielo lo metterebbe proprio nella condizione in cui riempie.
  const non_visto = typeof o.cosa_non_si_vede_ancora === "string" ? o.cosa_non_si_vede_ancora : "";
  if (pulitoVisto.length > 0 && non_visto.trim() === "") return null;
  return {
    quello_che_si_vede: pulitoVisto,
    dove_porta: pulitoPorta,
    cosa_non_si_vede_ancora: non_visto,
  };
}

export type StatoTappa = "bloccata" | "aperta" | "consegnata" | "revisionata";

// Esito della generazione AI della revisione. NULL = mai tentata (tappa non
// ancora consegnata, o riga antecedente alla migrazione 20260823110000).
export type RevisioneEsito = "riuscita" | "non_riuscita" | "forma_non_valida";

export type FaseStatoRiga = {
  faseId: string;
  stato: StatoTappa;
  apertaAt: string | null;
  consegnataAt: string | null;
  revisionataAt: string | null;
  revisione: RevisioneTappa | null;
  reazioneCliente: string | null;
  revisioneEsito: RevisioneEsito | null;
  tentativiRevisione: number;
};

// Una tappa è «non valutata» se la revisione AI si è arresa: NON conta come
// zero, esce dal DENOMINATORE della barra fiducia (45/75, non 45/100).
export const tappaNonValutata = (riga: FaseStatoRiga | undefined): boolean =>
  riga?.revisioneEsito != null && riga.revisioneEsito !== "riuscita";

// Fiducia massima ottenibile davvero: somma dei fiduciaMax delle sole tappe
// che siamo riusciti a valutare. Pura, così la stessa regola vale ovunque.
export function fiduciaMassima(fasi: { id: string; fiduciaMax: number }[], fasiStato: FaseStatoRiga[]): number {
  return fasi.reduce((tot, f) => {
    const riga = fasiStato.find((r) => r.faseId === f.id);
    return tot + (tappaNonValutata(riga) ? 0 : f.fiduciaMax);
  }, 0);
}
