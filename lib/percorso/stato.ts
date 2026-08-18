import type { SupabaseClient } from "@supabase/supabase-js";
import { SLUG_T1 } from "@/lib/test/config";

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
// Scelta PROVVISORIA implementata qui: area_signal.interest_score (vedi la
// raccomandazione nel report). Per passare a score_aree basta riscrivere il
// corpo di questa funzione perché ritorni la stessa forma (slug ordinati per
// affinità decrescente) leggendo da score_aree — nient'altro cambia.
//
// Ritorna gli area_slug ORDINATI per affinità decrescente (solo le aree con
// un segnale: un'area assente dalla lista = affinità non ancora determinata).
export async function leggiAffinita(supabase: SupabaseClient, studentId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("area_signal")
      .select("area_slug, interest_score, confidence")
      .eq("student_id", studentId);
    if (error || !data) return [];
    return [...data]
      .sort(
        (a, b) =>
          // provvisorio: sostituito dalla classifica per eleggibilità (item 3).
          // interest_score ora può essere NULL («non misurato»): qui pesa 0, ma
          // l'item 3 ESCLUDERÀ le aree senza interesse dichiarato (un'area senza
          // segnale d'interesse non è «affine»), non le ordinerà come se fosse 0.
          (b.interest_score ?? 0) - (a.interest_score ?? 0) || // affinità decrescente
          Number(b.confidence) - Number(a.confidence) || // a parità, più confidenza prima
          a.area_slug.localeCompare(b.area_slug), // determinismo finale
      )
      .map((r) => r.area_slug);
  } catch {
    return [];
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
