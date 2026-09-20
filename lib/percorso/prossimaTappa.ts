import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreaBySlug } from "@/data/aree";
import { SLUG_T1, SLUG_T2, SLUG_T3 } from "@/lib/test/config";
import { caricaContestoPercorso } from "./stato";

// Il PASSO SUCCESSIVO del percorso studente. Percorso: guida → seconda guida →
// T1 → T2 → T3 → missioni → workshop. La tappa è determinata dal traguardo PIÙ
// AVANZATO raggiunto (così chi salta avanti non viene rimandato indietro),
// sette esiti.
//
// DUE DEI SETTE SONO CANCELLI VERI, dal 2026-09-20. Fino a quella data questo
// commento diceva che il percorso si limitava a consigliare e che niente era
// chiuso, ed era vero. Adesso le missioni si aprono con i tre test e i
// workshop dopo un'esperienza (migrazione 20260920100000): le prime cinque
// tappe restano consigli — guide e test sono esplorazione e nessuno li chiude
// — le ultime due no. Se qualcuno rimettesse qui la frase di prima sarebbe la
// specie di casa: un commento che dichiara quello che il codice faceva ieri.
// `npm run test:cancelli` la cerca alla lettera, quindi non va riprodotta
// nemmeno per citarla.
//
// E LA SOGLIA DELLE MISSIONI NON SI RICALCOLA QUI. `t1 && t2 && t3` sarebbe la
// stessa regola scritta una seconda volta, in un'altra lingua rispetto alla
// policy che poi rifiuta davvero: divergerebbero al primo che ne tocca una.
// Quel rung chiede a `ha_completato_i_tre_test()`, la stessa funzione del
// cancello. Gli altri rung continuano a guardare i test uno per uno, e devono:
// il loro mestiere è NOMINARE il prossimo test, non dire se sei passato.
//
// NB (2026-08): le guide NON alimentano il profilo Escape (area_signal) — vivono
// in activity_log (il radar «Dove hai esplorato»). Il ritratto prima della
// missione lo fanno i tre test; le guide restano esplorazione. Il cross-feed
// activity→evidence è una voce di backlog a sé (vedi CLAUDE.md, «Punti aperti»).
//
// Riusa caricaContestoPercorso (fonte di verità di guide/esperienza/T1) e vi
// aggiunge solo la lettura di T2/T3, che quel contesto non copre. Degrada a
// «niente fatto» su qualunque errore di lettura, mai un crash.

// testo: la frase (per la card della home, sola indicazione). cta+href: etichetta
// e destinazione del passo, per chi vuole un bottone (gli esiti dei test).
export type ProssimaTappa = { testo: string; cta: string; href: string };

export async function getProssimaTappa(supabase: SupabaseClient, studentId: string): Promise<ProssimaTappa> {
  const [contesto, testCompletati, cancelloMissioniAperto] = await Promise.all([
    caricaContestoPercorso(supabase, studentId),
    leggiTestCompletati(supabase, studentId),
    leggiCancelloMissioni(supabase),
  ]);

  const t1 = testCompletati.has(SLUG_T1);
  const t2 = testCompletati.has(SLUG_T2);
  const haMissione = contesto.missioniCompletate > 0;

  // Guide: c'è un'area con ≥2 guide? e quali aree ne hanno esattamente una
  // (per suggerire la seconda)? L'area scelta è la prima per slug (determinismo).
  let dueGuideStessaArea = false;
  const areeConUnaGuida: string[] = [];
  for (const [area, livelli] of contesto.guidePerArea) {
    if (livelli.size >= 2) dueGuideStessaArea = true;
    else if (livelli.size === 1) areeConUnaGuida.push(area);
  }

  // Ladder: dal traguardo più avanzato indietro — sempre un solo esito.
  if (haMissione) return { testo: "Prova un workshop.", cta: "Prova un workshop", href: "/app/workshop" };
  if (cancelloMissioniAperto) return { testo: "Le missioni sono aperte.", cta: "Prova una missione", href: "/app/escape" };
  if (t1 && t2) return { testo: 'Fai "Più a fondo".', cta: "Fai «Più a fondo»", href: `/app/test/${SLUG_T3}` };
  if (t1) return { testo: 'Fai "Come ti muovi".', cta: "Fai «Come ti muovi»", href: `/app/test/${SLUG_T2}` };
  if (dueGuideStessaArea) return { testo: 'Fai il test "Da dove parti".', cta: "Fai «Da dove parti»", href: `/app/test/${SLUG_T1}` };
  if (areeConUnaGuida.length > 0) {
    const slug = areeConUnaGuida.sort()[0];
    const nome = getAreaBySlug(slug)?.nome;
    return { testo: nome ? `Leggi la seconda guida di ${nome}.` : "Leggi la seconda guida dell'area che hai iniziato.", cta: "Leggi la seconda guida", href: `/app/guide/${slug}` };
  }
  return { testo: "Comincia da una guida: scegli un'area che ti incuriosisce.", cta: "Esplora le aree", href: "/app/aree" };
}

// Il cancello delle missioni, chiesto a chi lo definisce. Degrada verso
// l'APERTO come `lib/percorso/cancelli.ts`: se la lettura fallisce la card
// dice «le missioni sono aperte» e sarà semmai la pagina a fermare — meglio un
// consiglio ottimista che rimandare ai test uno che li ha già fatti.
async function leggiCancelloMissioni(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("ha_completato_i_tre_test");
    if (error) {
      console.error("Errore lettura cancello missioni (prossima tappa):", error.message ?? error);
      return true;
    }
    return data === true;
  } catch {
    return true;
  }
}

// Il passo dopo un TEST, che è una domanda diversa da quella della home.
//
// `getProssimaTappa` risponde a «a che punto sei del percorso» e lo fa dal
// traguardo più avanzato, apposta: chi salta avanti non deve essere rimandato
// indietro. È la risposta giusta per la card della home, e sbagliata in fondo a
// un test — lì la domanda è «e adesso?», e la risposta è locale: **i tre test
// sono una sequenza**. Dopo «Da dove parti» viene «Come ti muovi», dopo «Come
// ti muovi» viene «Più a fondo», e dopo l'ultimo non c'è un quarto test: ci
// sono le missioni.
//
// Deterministica, senza database, e soprattutto NON manda mai indietro: queste
// pagine puntano solo avanti, quindi non serve nessun modo gentile di dire «ti
// manca ancora una cosa».
//
// (L'esito di «Più a fondo» non passa di qui: ha una CTA sua, la missione in cui
// l'area vincitrice è più centrale — vedi `missionePerArea`.)
export function passoDopoTest(slugTest: string): ProssimaTappa {
  if (slugTest === SLUG_T1) return { testo: 'Fai "Come ti muovi".', cta: "Fai «Come ti muovi»", href: `/app/test/${SLUG_T2}` };
  if (slugTest === SLUG_T2) return { testo: 'Fai "Più a fondo".', cta: "Fai «Più a fondo»", href: `/app/test/${SLUG_T3}` };
  return { testo: "Le missioni sono aperte.", cta: "Prova una missione", href: "/app/escape" };
}

async function leggiTestCompletati(supabase: SupabaseClient, studentId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("test_attempt")
      .select("test_slug")
      .eq("student_id", studentId)
      .eq("stato", "completata");
    if (error || !data) return new Set();
    return new Set(data.map((r) => r.test_slug as string));
  } catch {
    return new Set();
  }
}
