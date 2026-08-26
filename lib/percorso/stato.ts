import type { SupabaseClient } from "@supabase/supabase-js";
import { SLUG_T1 } from "@/lib/test/config";
import { getAreaBySlug } from "@/data/aree";

// ─────────────────────────────────────────────────────────────────────────
// KIREO — Stato di avanzamento del percorso: FONTE DI VERITÀ UNICA.
//
// Dato uno studente e un'area, dice a che punto è del percorso: quattro
// condizioni con esito booleano + i dettagli utili a mostrarle. Scritta una
// volta e riusata da tre consumatori con esigenze diverse:
//   - la dashboard studente (mostrare lo stato),
//   - lo sblocco dell'assistente (gate, non ancora collegato — vedi
//     GATE_ASSISTENTE_ATTIVO in lib/assistente/config.ts),
//   - il futuro motore di mailing (decidere se una nudge ha senso).
// Il resto del codice NON deve reimplementare queste condizioni: se cambia la
// definizione di "a che punto è lo studente", si cambia qui.
//
// Le quattro condizioni:
//   1. Test       — almeno la Fase 1 (test T1 «Da dove parti») completata.
//                   GLOBALE, non per area.
//   2. Affinità   — l'area rientra tra le prime N del profilo. È l'unica che
//                   dipende dalla scelta score_aree vs area_signal: isolata in
//                   leggiAffinita() (vedi sotto), il punto unico da cambiare.
//   3. Guide      — tutte e tre le guide dell'area (livelli 1/2/3) scaricate.
//                   Per area. Usa activity_log.livello.
//   4. Esperienza — almeno una missione completata O un workshop consegnato.
//                   GLOBALE: vale qualunque missione/workshop, non per forza
//                   dell'area corrente.
//
// Efficienza: i dati GLOBALI (test, esperienza, classifica di affinità, mappa
// delle guide per area) si leggono UNA volta con caricaContestoPercorso(), poi
// statoAvanzamentoDaContesto() valuta ogni area senza altre query (pura,
// testabile senza DB). statoAvanzamento() è il wrapper monouso.
//
// Robustezza: ogni lettura degrada a "condizione non soddisfatta" se la
// tabella/vista non esiste ancora (migrazioni non applicate) o la query
// fallisce — mai un crash, stesso principio di lib/app/radarData.ts.
// ─────────────────────────────────────────────────────────────────────────

// Quante aree "in cima" contano come affini. Configurabile: alzarla allarga
// l'accesso, abbassarla lo restringe.
//
// ⚠️ Il valore 3 è PROVVISORIO e NON tarato: è una prima ipotesi, non una
// soglia validata sui dati. Va rivisto quando ci saranno abbastanza studenti
// reali perché la query diagnostica (scripts/diagnostica-percorso.sql) sia
// statisticamente significativa — non prima. Finché il campione è minuscolo,
// non trattarlo come una soglia affidabile per bloccare l'accesso.
export const TOP_N_AFFINITA = 3;

export type StatoAvanzamento = {
  studentId: string;
  areaSlug: string;
  // 1. Test (globale)
  test: { soddisfatta: boolean; faseUnoCompletata: boolean };
  // 2. Affinità (per area, dipende dalla sorgente scelta)
  affinita: {
    soddisfatta: boolean;
    posizione: number | null; // 1-based nella classifica del profilo, null se l'area non è nel profilo
    topN: number;
    profiloPresente: boolean; // false = nessun segnale ancora (es. test non fatto): affinità indeterminata
  };
  // 3. Guide (per area)
  guide: { soddisfatta: boolean; livelliScaricati: number[]; livelliMancanti: number[] };
  // 4. Esperienza (globale)
  esperienza: { soddisfatta: boolean; missioniCompletate: number; workshopConsegnati: number };
  numeroSoddisfatte: 0 | 1 | 2 | 3 | 4;
};

// ─────────────────────────── AFFINITÀ: il punto unico da modificare ────────
//
// ⚠️ PUNTO UNICO DA CAMBIARE quando sarà decisa la sorgente dell'affinità.
// Nessun'altra parte del codice sa da quale tabella arriva il dato: tutti
// leggono la classifica che questa funzione restituisce.
//
// DECISIONE PENDENTE (Mario decide dopo aver letto il report). Sorgenti:
//   - area_signal.interest_score — profilo attitudinale 0..100 per dimensione,
//     alimentato dal test T1 e dalle missioni (le azioni pesano più delle
//     dichiarazioni), con confidence e status. Rappresenta "affinità".
//   - score_aree.punteggio — somma grezza dei pesi di esplorazione
//     (activity_log). Rappresenta "quanto ha esplorato", non affinità.
//
// Sorgente: area_signal.interest_score (profilo attitudinale dedotto dalle
// azioni), NON score_aree (somma di clic: «quanto ha esplorato», non affinità).
//
// ⚠️ DA RILEGGERE QUANDO QUESTA DECISIONE SI RIAPRE, perché una parte della
// risposta è già qui. I due motori non differiscono solo per COSA misurano, ma
// per l'OPERATORE: `score_aree` SOMMA i pesi, `area_signal` fa la MEDIA
// pesata. La media è invariante di scala — cancella per costruzione quante
// volte lo studente è tornato in un'area, che è l'unica cosa che distingue uno
// studente da un altro.
//
// Misurato su uno studente simulato che ha giocato tutte e 11 le missioni: le
// azioni per area vanno da 3 a 17 (un fattore 5,7) e l'interesse resta fra 64 e
// 78. L'area PRIMA in classifica aveva 4 azioni e confidence 0,33; quella con
// 17 azioni e confidence 1,00 era dodicesima. Non è uno strumento che non
// separa: separa al contrario.
//
// Non è una raccomandazione a cambiare sorgente — si incrocia con altre
// decisioni aperte. È il pezzo di analisi che serve a chi riaprirà la
// domanda, messo dove la domanda vive.
//
// CLASSIFICA PER ELEGGIBILITÀ (item 3): l'affinità è un'affermazione SULLO
// STUDENTE, quindi ha una barra di sufficienza — non basta un segnale qualunque.
// Un'area entra nella classifica solo se:
//   - ha ≥2 attività distinte (attivita_distinte, la stessa barra del Fix D:
//     conferma = il segnale ritorna in un'attività diversa), E
//   - ha un interesse dichiarato (interest_score non NULL): l'affinità È
//     l'interesse; senza, l'area non è affine — è ESCLUSA, non ordinata a 0.
// Le aree escluse ma con un segnale non spariscono: vanno nell'elenco «aree
// sfiorate» (vedi caricaAffinitaHome), non in fondo alla classifica.
//
// Ritorna gli area_slug ELEGGIBILI ordinati per interest_score decrescente.
export async function leggiAffinita(supabase: SupabaseClient, studentId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("area_signal")
      .select("area_slug, interest_score, confidence, attivita_distinte")
      .eq("student_id", studentId);
    if (error || !data) return [];
    return [...data]
      .filter((r) => (r.attivita_distinte ?? 0) >= 2 && r.interest_score !== null) // eleggibili
      .sort(
        (a, b) =>
          (b.interest_score ?? 0) - (a.interest_score ?? 0) || // interesse decrescente
          Number(b.confidence) - Number(a.confidence) || // a parità, più confidenza prima
          a.area_slug.localeCompare(b.area_slug), // determinismo finale
      )
      .map((r) => r.area_slug);
  } catch {
    return [];
  }
}

// ─────────────────────────── Affinità per la home (sezione dedicata) ────────
// Ritorna il necessario alla sezione «Le tue affinità» in home: le aree
// eleggibili ordinate + le aree «sfiorate» (segnale c'è ma non eleggibile) con
// la loro prova più forte + se lo studente ha ALMENO un'attività (per scegliere
// fra i due stati vuoti). Stessa definizione di eleggibilità di leggiAffinita.
export type StatoArea = "emergente" | "confermata" | "da_verificare";
export type AreaEleggibile = { slug: string; nome: string; interest: number; status: StatoArea };
// `nome` può elencare PIÙ aree ("A, B") quando la loro prova più forte è la
// stessa riga di evidenza: condividono una riga, nomi elencati (vedi sotto).
export type AreaSfiorataAffinita = { nome: string; motivazione: string | null };
export type AffinitaHome = {
  eleggibili: AreaEleggibile[];
  sfiorate: AreaSfiorataAffinita[];
  haAttivita: boolean; // area_signal ha ≥1 riga → ≥1 attività completata
};

function eleggibile(r: { attivita_distinte: number | null; interest_score: number | null }): boolean {
  return (r.attivita_distinte ?? 0) >= 2 && r.interest_score !== null;
}

// Regola #2 (2026-08): se la motivazione PIÙ PESANTE di due o più aree è la
// STESSA riga di evidenza (es. il mandato, che tocca più aree), quelle aree
// condividono UNA riga, nomi elencati — invece di ripetere la stessa frase, che
// letta sembra un refuso. NON si sostituisce con la seconda motivazione: il
// mandato è la prova più pesante e più personale (è lo studente a scegliere come
// impostare l'indagine); nasconderla per una delle due aree mostrerebbe un
// segnale più debole per un motivo tecnico, e farebbe dipendere il testo
// dall'ordine di visualizzazione (arbitrario). Le aree senza motivazione, o con
// motivazione unica, restano una riga a testa. `voci` in ingresso è già ordinata;
// l'ordine di prima occorrenza è preservato. PURA (testabile senza DB).
export function raggruppaSfiorate(voci: { nome: string; motivazione: string | null }[]): AreaSfiorataAffinita[] {
  const gruppi = new Map<string, { nomi: string[]; motivazione: string | null }>();
  let nulle = 0;
  for (const v of voci) {
    const chiave = v.motivazione ?? `__nulla_${nulle++}`; // le motivazioni assenti non si fondono mai
    const g = gruppi.get(chiave);
    if (g) g.nomi.push(v.nome);
    else gruppi.set(chiave, { nomi: [v.nome], motivazione: v.motivazione });
  }
  return [...gruppi.values()].map((g) => ({ nome: g.nomi.join(", "), motivazione: g.motivazione }));
}

export async function caricaAffinitaHome(supabase: SupabaseClient, studentId: string): Promise<AffinitaHome> {
  const vuoto: AffinitaHome = { eleggibili: [], sfiorate: [], haAttivita: false };
  try {
    const { data, error } = await supabase
      .from("area_signal")
      .select("area_slug, interest_score, confidence, status, attivita_distinte")
      .eq("student_id", studentId);
    if (error || !data || data.length === 0) return vuoto;

    const eleggibili: AreaEleggibile[] = data
      .filter((r) => eleggibile(r))
      .sort(
        (a, b) =>
          (b.interest_score ?? 0) - (a.interest_score ?? 0) ||
          Number(b.confidence) - Number(a.confidence) ||
          a.area_slug.localeCompare(b.area_slug),
      )
      .map((r) => ({ slug: r.area_slug, nome: getAreaBySlug(r.area_slug)?.nome ?? r.area_slug, interest: r.interest_score ?? 0, status: r.status as StatoArea }));

    const righeSfiorate = [...data.filter((r) => !eleggibile(r))].sort(
      (a, b) =>
        Number(b.confidence) - Number(a.confidence) || // più segnale prima
        (b.interest_score ?? 0) - (a.interest_score ?? 0) ||
        a.area_slug.localeCompare(b.area_slug),
    );
    const motivazioni = await motivazioniPiuPesanti(supabase, studentId, righeSfiorate.map((r) => r.area_slug));
    const sfiorate = raggruppaSfiorate(
      righeSfiorate.map((r) => ({ nome: getAreaBySlug(r.area_slug)?.nome ?? r.area_slug, motivazione: motivazioni.get(r.area_slug) ?? null })),
    );

    return { eleggibili, sfiorate, haAttivita: true };
  } catch {
    return vuoto;
  }
}

// Motivazione della prova d'area col peso maggiore, per ogni area richiesta:
// dice, nella riga sfiorata, COSA si è comunque acceso.
async function motivazioniPiuPesanti(supabase: SupabaseClient, studentId: string, slugs: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (slugs.length === 0) return m;
  try {
    const { data, error } = await supabase
      .from("evidence")
      .select("area_slug, motivazione, peso")
      .eq("student_id", studentId)
      .eq("categoria", "area")
      .in("area_slug", slugs);
    if (error || !data) return m;
    const pesoMax = new Map<string, number>();
    for (const r of data) {
      if (!r.area_slug || !r.motivazione) continue;
      const p = Number(r.peso) || 0;
      if (p > (pesoMax.get(r.area_slug) ?? -1)) {
        pesoMax.set(r.area_slug, p);
        m.set(r.area_slug, r.motivazione);
      }
    }
    return m;
  } catch {
    return m;
  }
}

// ─────────────────────────── Contesto globale (una lettura per studente) ────
export type ContestoPercorso = {
  studentId: string;
  faseUnoCompletata: boolean;
  affinitaOrdinata: string[]; // classifica dalla sorgente scelta (leggiAffinita)
  guidePerArea: Map<string, Set<number>>; // area_slug -> livelli di guida scaricati
  missioniCompletate: number;
  workshopConsegnati: number;
};

export async function caricaContestoPercorso(supabase: SupabaseClient, studentId: string): Promise<ContestoPercorso> {
  const [faseUnoCompletata, affinitaOrdinata, guidePerArea, esperienza] = await Promise.all([
    testFaseUnoCompletata(supabase, studentId),
    leggiAffinita(supabase, studentId),
    caricaGuidePerArea(supabase, studentId),
    contaEsperienza(supabase, studentId),
  ]);
  return {
    studentId,
    faseUnoCompletata,
    affinitaOrdinata,
    guidePerArea,
    missioniCompletate: esperienza.missioni,
    workshopConsegnati: esperienza.workshop,
  };
}

// ─────────────────────────── Valutazione per area (PURA, testabile) ─────────
export function statoAvanzamentoDaContesto(contesto: ContestoPercorso, areaSlug: string): StatoAvanzamento {
  // 1. Test (globale)
  const test = { soddisfatta: contesto.faseUnoCompletata, faseUnoCompletata: contesto.faseUnoCompletata };

  // 2. Affinità (per area)
  const idx = contesto.affinitaOrdinata.indexOf(areaSlug);
  const posizione = idx === -1 ? null : idx + 1;
  const affinita = {
    soddisfatta: posizione !== null && posizione <= TOP_N_AFFINITA,
    posizione,
    topN: TOP_N_AFFINITA,
    profiloPresente: contesto.affinitaOrdinata.length > 0,
  };

  // 3. Guide (per area)
  const livelliScaricati = [...(contesto.guidePerArea.get(areaSlug) ?? new Set<number>())].sort((a, b) => a - b);
  const livelliMancanti = ([1, 2, 3] as number[]).filter((l) => !livelliScaricati.includes(l));
  const guide = { soddisfatta: livelliMancanti.length === 0, livelliScaricati, livelliMancanti };

  // 4. Esperienza (globale)
  const esperienza = {
    soddisfatta: contesto.missioniCompletate > 0 || contesto.workshopConsegnati > 0,
    missioniCompletate: contesto.missioniCompletate,
    workshopConsegnati: contesto.workshopConsegnati,
  };

  const numeroSoddisfatte = (Number(test.soddisfatta) +
    Number(affinita.soddisfatta) +
    Number(guide.soddisfatta) +
    Number(esperienza.soddisfatta)) as 0 | 1 | 2 | 3 | 4;

  return { studentId: contesto.studentId, areaSlug, test, affinita, guide, esperienza, numeroSoddisfatte };
}

// Wrapper monouso: carica il contesto e valuta una sola area. Per più aree
// dello stesso studente usare caricaContestoPercorso una volta +
// statoAvanzamentoDaContesto per ogni area (evita query ripetute).
export async function statoAvanzamento(
  supabase: SupabaseClient,
  studentId: string,
  areaSlug: string,
): Promise<StatoAvanzamento> {
  const contesto = await caricaContestoPercorso(supabase, studentId);
  return statoAvanzamentoDaContesto(contesto, areaSlug);
}

// ─────────────────────────── Letture di supporto (private) ──────────────────

async function testFaseUnoCompletata(supabase: SupabaseClient, studentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("test_attempt")
      .select("id")
      .eq("student_id", studentId)
      .eq("test_slug", SLUG_T1)
      .eq("stato", "completata")
      .limit(1);
    if (error || !data) return false;
    return data.length > 0;
  } catch {
    return false;
  }
}

async function caricaGuidePerArea(supabase: SupabaseClient, studentId: string): Promise<Map<string, Set<number>>> {
  const mappa = new Map<string, Set<number>>();
  try {
    const { data, error } = await supabase
      .from("activity_log")
      .select("area_slug, livello")
      .eq("student_id", studentId)
      .eq("tipo_attivita", "download_guida")
      .not("livello", "is", null);
    if (error || !data) return mappa;
    for (const riga of data) {
      if (riga.livello == null) continue;
      const set = mappa.get(riga.area_slug) ?? new Set<number>();
      set.add(riga.livello);
      mappa.set(riga.area_slug, set);
    }
    return mappa;
  } catch {
    return mappa;
  }
}

async function contaEsperienza(supabase: SupabaseClient, studentId: string): Promise<{ missioni: number; workshop: number }> {
  const [missioni, workshop] = await Promise.all([contaMissioniCompletate(supabase, studentId), contaWorkshopConsegnati(supabase, studentId)]);
  return { missioni, workshop };
}

async function contaMissioniCompletate(supabase: SupabaseClient, studentId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("mission_attempt")
      .select("id")
      .eq("student_id", studentId)
      .eq("stato", "completata");
    if (error || !data) return 0;
    return data.length;
  } catch {
    return 0;
  }
}

// Un workshop "consegnato" vale sia sul motore v1 (una riga in
// workshop_consegne) sia sul motore v2 (workshop_elaborati.stato='consegnato').
// Entrambi passano dall'iscrizione dello studente (workshop_iscrizioni).
async function contaWorkshopConsegnati(supabase: SupabaseClient, studentId: string): Promise<number> {
  try {
    const { data: iscrizioni, error } = await supabase
      .from("workshop_iscrizioni")
      .select("id")
      .eq("student_id", studentId);
    if (error || !iscrizioni || iscrizioni.length === 0) return 0;
    const ids = iscrizioni.map((i) => i.id);

    const [v1, v2] = await Promise.all([
      supabase.from("workshop_consegne").select("id").in("iscrizione_id", ids),
      supabase.from("workshop_elaborati").select("iscrizione_id").in("iscrizione_id", ids).eq("stato", "consegnato"),
    ]);

    const consegneV1 = v1.error || !v1.data ? 0 : v1.data.length;
    const elaboratiV2 = v2.error || !v2.data ? 0 : v2.data.length;
    return consegneV1 + elaboratiV2;
  } catch {
    return 0;
  }
}
