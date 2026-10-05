import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreaBySlug } from "@/data/aree";
import { SLUG_T1, SLUG_T2, SLUG_T3 } from "@/lib/test/config";
import { caricaContestoPercorso } from "./stato";

// Il PASSO SUCCESSIVO del percorso studente. Percorso: guida → seconda guida →
// T1 → T2 → T3 → missioni → workshop. La tappa è determinata dal traguardo PIÙ
// AVANZATO raggiunto (così chi salta avanti non viene rimandato indietro),
// otto esiti.
//
// L'OTTAVO È L'ULTIMO GRADINO, e fino al 29/09 non c'era. La scala finiva su
// «Prova un workshop», che era l'esito di chi ha completato una missione — e
// sopra di lui niente: chi un workshop l'aveva già fatto continuava a leggere
// quel consiglio per sempre. Nel primo corpus di pagine vere il caso si è
// presentato con otto workshop alle spalle, ed era una scala senza stato
// terminale, non un difetto di vocabolario.
//
// L'ultimo gradino non può dire «hai finito» (orientarsi non finisce) né
// inventare un passo che non esiste: dice il vero, cioè che i passi sono
// esauriti e la strada no. La destinazione è la stessa del primo gradino
// (`/app/aree`) per la ragione che la frase dichiara — da qui il passo non è
// nuovo, è lo stesso in un'area che non si è ancora toccata: si riparte dalla
// scelta di un'area, con un motivo diverso.
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
//
// `nota`: una seconda riga, FACOLTATIVA, per il solo primo gradino — vedi la
// ragione accanto a lui. Un testo che si degrada bene vale più di un testo
// giusto in un caso solo: il primo gradino chiude il difetto da solo, e se la
// nota non si può dire non si dice.
export type ProssimaTappa = { testo: string; cta: string; href: string; nota?: string };

export async function getProssimaTappa(supabase: SupabaseClient, studentId: string): Promise<ProssimaTappa> {
  // La lettura delle presenze sta NELL'ONDA CHE GIÀ C'È: in parallelo non costa
  // latenza, e serve solo all'ultimo gradino. Metterla là dentro (invece di
  // leggerla pigramente in quel ramo) costa una query a tutti e non aggiunge un
  // giro di rete allo studente nuovo, che è precisamente quello la cui home
  // dovrebbe essere la più veloce.
  const [contesto, testCompletati, cancelloMissioniAperto, haPresenze] = await Promise.all([
    caricaContestoPercorso(supabase, studentId),
    leggiTestCompletati(supabase, studentId),
    leggiCancelloMissioni(supabase),
    leggiPresenzeCertificate(supabase, studentId),
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
  //
  // ⚠️ ANCHE QUESTA FRASE HA UNA SCADENZA, e resta un commento di proposito: il
  // giorno in cui qualcuno avrà attraversato tutti i passi in TUTTE E DICIOTTO
  // le aree, «in un'area che non hai ancora toccato» diventa falsa. Non è un
  // problema di oggi (nessuno studente vero ha finito un workshop), ma è la
  // stessa specie del difetto che questo gradino chiude — una cosa scritta che
  // dichiara uno stato diverso da quello vero — quindi la scadenza si scrive
  // invece di lasciarla scoprire. Un `if` no: costerebbe contare le aree
  // toccate a ogni caricamento della home per un caso che non esiste ancora, e
  // il caso che non esiste è precisamente quello su cui una condizione si tara
  // male.
  if (haMissione && contesto.workshopConsegnati > 0)
    return {
      testo: "Li hai attraversati tutti almeno una volta. Da qui il passo non è nuovo: è lo stesso, in un'area che non hai ancora toccato.",
      cta: "Esplora le aree",
      href: "/app/aree",
    };
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
  // ⚠️ IL PRIMO GRADINO NEGAVA UNA COSA VERA. Fino al 5/10 diceva «Comincia da
  // una guida», e uno studente certificato su due dirette lo leggeva dopo aver
  // seguito due incontri per intero: «comincia» parla della PERSONA, e la
  // persona aveva già cominciato. «Il primo passo è» parla della SCALA, che
  // davvero comincia lì — quattro parole, e la frase smette di negare una cosa
  // vera per tutti gli studenti, in tutti gli stati, senza nessuna query.
  //
  // LA NOTA È UN DI PIÙ, e nomina l'ESPLORAZIONE e non il profilo. «Contano nel
  // tuo profilo» sarebbe vero solo dopo 20261004160000 e solo per le presenze
  // con `certificata_da_tipo = 'sistema'` (una certificata a mano dalla scuola
  // lascia il credito di esplorazione e nessuna prova): una frase falsa per
  // alcuni, nel punto in cui gli stiamo dicendo che quello che hanno fatto non
  // è andato perso. «Dove hai esplorato finora» è vera per tutte e due le
  // certificazioni, e soprattutto è un riquadro che lo studente ha SULLA STESSA
  // PAGINA — quindi la frase è verificabile da chi la legge invece di essere
  // una promessa.
  return {
    testo: "Il primo passo è una guida: scegli un'area che ti incuriosisce.",
    cta: "Esplora le aree",
    href: "/app/aree",
    nota: haPresenze
      ? 'Gli incontri che hai seguito contano già in "Dove hai esplorato finora": il percorso è un\'altra strada.'
      : undefined,
  };
}

// Ha almeno una presenza certificata? SÌ/NO, nessun numero — è tutto quello che
// serve alla nota, e un conteggio sarebbe un dato in più da non usare.
//
// NON discrimina `certificata_da_tipo`, di proposito: la nota parla
// dell'esplorazione, che una certificazione manuale alimenta quanto una
// automatica. Se un giorno la nota tornasse a nominare il profilo, allora sì —
// lì il discriminante è `'sistema'`, ed è lo stesso di 20261004160000.
//
// Degrada verso il NO su qualunque errore: una lettura fallita non deve
// produrre una nota che afferma una cosa su quello che lo studente ha fatto.
async function leggiPresenzeCertificate(supabase: SupabaseClient, studentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("iscrizioni_eventi")
      .select("evento_id")
      .eq("student_id", studentId)
      .eq("stato", "partecipato")
      .limit(1);
    if (error || !data) return false;
    return data.length > 0;
  } catch {
    return false;
  }
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
