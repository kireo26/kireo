import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreaBySlug } from "@/data/aree";
import { SLUG_T1, SLUG_T2, SLUG_T3 } from "@/lib/test/config";
import { caricaContestoPercorso } from "./stato";

// Il PASSO SUCCESSIVO CONSIGLIATO del percorso studente. CONSIGLIA, non impone:
// nessun gate, tutto resta aperto — la card indica solo la prossima cosa
// suggerita. Percorso: guida → seconda guida → T1 → T2 → T3 → missioni →
// workshop. La tappa è determinata dal traguardo PIÙ AVANZATO raggiunto (così
// chi salta avanti non viene rimandato indietro), sette esiti.
//
// NB (2026-08): le guide NON alimentano il profilo Escape (area_signal) — vivono
// in activity_log (il radar «Dove hai esplorato»). Il ritratto prima della
// missione lo fanno i tre test; le guide restano esplorazione. Il cross-feed
// activity→evidence è una voce di backlog a sé (vedi CLAUDE.md, «Punti aperti»).
//
// Riusa caricaContestoPercorso (fonte di verità di guide/esperienza/T1) e vi
// aggiunge solo la lettura di T2/T3, che quel contesto non copre. Degrada a
// «niente fatto» su qualunque errore di lettura, mai un crash.

export type ProssimaTappa = { testo: string };

export async function getProssimaTappa(supabase: SupabaseClient, studentId: string): Promise<ProssimaTappa> {
  const [contesto, testCompletati] = await Promise.all([
    caricaContestoPercorso(supabase, studentId),
    leggiTestCompletati(supabase, studentId),
  ]);

  const t1 = testCompletati.has(SLUG_T1);
  const t2 = testCompletati.has(SLUG_T2);
  const t3 = testCompletati.has(SLUG_T3);
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
  if (haMissione) return { testo: "Prova un workshop." };
  if (t1 && t2 && t3) return { testo: "Le missioni sono aperte." };
  if (t1 && t2) return { testo: 'Fai "Più a fondo".' };
  if (t1) return { testo: 'Fai "Come ti muovi".' };
  if (dueGuideStessaArea) return { testo: 'Fai il test "Da dove parti".' };
  if (areeConUnaGuida.length > 0) {
    const nome = getAreaBySlug(areeConUnaGuida.sort()[0])?.nome;
    return { testo: nome ? `Leggi la seconda guida di ${nome}.` : "Leggi la seconda guida dell'area che hai iniziato." };
  }
  return { testo: "Comincia da una guida: scegli un'area che ti incuriosisce." };
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
