import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreaBySlug } from "@/data/aree";
import { guideDiArea } from "@/lib/guide/config";
import { MISSIONI } from "@/lib/escape/config";
import { TEST_META } from "@/lib/test/config";
import type { TipoAttivita } from "./activityLog";

export type VoceStorico = {
  id: string;
  tipo: "attivita" | "evento";
  titolo: string;
  data: string;
  oreCertificate: number | null;
};

type RigaStudentActivity = {
  id: string;
  ore_certificate: number | null;
  completed_at: string | null;
  created_at: string;
  activities: { titolo: string } | { titolo: string }[] | null;
};

type RigaIscrizioneEvento = {
  created_at: string;
  eventi: { id: string; titolo: string; data_inizio: string } | { id: string; titolo: string; data_inizio: string }[] | null;
};

// Storico unico per "Le mie attività": attività scolastiche certificate
// (student_activities, già in produzione) + eventi a cui ci si è iscritti
// (iscrizioni_eventi/eventi — se le tabelle non esistono ancora quella
// parte resta vuota senza far fallire il resto).
export async function getStoricoAttivita(supabase: SupabaseClient, userId: string): Promise<VoceStorico[]> {
  const { data: attivita } = await supabase
    .from("student_activities")
    .select("id, ore_certificate, completed_at, created_at, activities(titolo)")
    .eq("student_id", userId);

  const vociAttivita: VoceStorico[] = ((attivita ?? []) as RigaStudentActivity[]).map((riga) => {
    const rel = Array.isArray(riga.activities) ? riga.activities[0] : riga.activities;
    return {
      id: `attivita-${riga.id}`,
      tipo: "attivita",
      titolo: rel?.titolo ?? "Attività",
      data: riga.completed_at ?? riga.created_at,
      oreCertificate: riga.ore_certificate ?? null,
    };
  });

  let vociEventi: VoceStorico[] = [];
  try {
    const { data: iscrizioni, error } = await supabase
      .from("iscrizioni_eventi")
      .select("created_at, eventi(id, titolo, data_inizio)")
      .eq("student_id", userId);

    if (!error) {
      vociEventi = ((iscrizioni ?? []) as RigaIscrizioneEvento[]).map((riga) => {
        const rel = Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi;
        return {
          id: `evento-${rel?.id ?? riga.created_at}`,
          tipo: "evento" as const,
          titolo: rel?.titolo ?? "Evento",
          data: rel?.data_inizio ?? riga.created_at,
          oreCertificate: null,
        };
      });
    }
  } catch {
    vociEventi = [];
  }

  return [...vociAttivita, ...vociEventi].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

export type VoceEsplorazione = { id: string; testo: string; data: string };

// LE ETICHETTE RICEVONO ANCHE IL LIVELLO, e per una sola di loro conta.
//
// PERCHÉ. Il 29/09, nel primo corpus di pagine vere, «Il tuo percorso di
// esplorazione» mostrava DUE VOLTE la stessa riga nello stesso giorno: «Hai
// scaricato la guida di Salute & Professioni sanitarie — 26 set 2026». Non era un
// doppione: il cap giornaliero di `activity_log` è su (studente, area, tipo,
// coalesce(livello,0)) dalla migrazione 20260813120000, apposta perché le TRE
// guide di un'area facciano tre righe al giorno. Erano due guide diverse — la
// Panoramica e Le strade — e l'etichetta, che il livello non lo leggeva, le
// raccontava con la stessa frase: una cosa scritta che dichiara due fatti dove
// ce ne sono due, ma illeggibili come uno.
//
// Il nome della guida viene da `guideDiArea`, la stessa fonte della pagina
// `/app/guide/<area>`: se un domani cambia lì, cambia anche qui — mai una seconda
// copia dei tre nomi. Il livello è nullable per ogni altro tipo di attività (ed è
// nullo anche sulle righe `download_guida` scritte prima di quella migrazione):
// senza livello la frase torna a essere quella di prima, che per una riga vecchia
// è l'unica cosa vera che si può dire.
//
// ═══ «PCTO» STA SU UNA RIGA SOLA DELLE DUE, E NON È UNA SFUMATURA ═══
// Fino al 2026-09-29 `workshop_pcto` era scritto da TRE strade diverse, con lo
// stesso peso e nessuna colonna che dicesse quale: un progetto workshop KIREO
// concluso, la presenza certificata su un evento di tipo 'workshop', e il
// vecchio caricamento file di v1 (morto dal 29/08). «PCTO» era vero solo per
// la seconda — le ore esistono lì e solo lì, perché nascono da una
// certificazione con un responsabile nominato. Dalle migrazioni 20260929100000
// e 20260929110000 i nomi sono due, e la parola resta dove è vera.
//
// ⚠️ LE RIGHE PRECEDENTI AL CAMBIO NON SONO ATTRIBUIBILI, e nessuno prova a
// farlo: ricevono l'etichetta di `workshop_pcto`, che per le vecchie righe di
// progetto è inesatta. È il prezzo dichiarato del nome condiviso — inventare
// un'attribuzione a posteriori (per data, per vicinanza a un'altra riga)
// sarebbe peggio del difetto, perché produrrebbe una frase che nessuno può
// verificare. Nessuna di quelle righe appartiene a uno studente vero.
const ETICHETTE_TIPO: Record<TipoAttivita, (areaNome: string, guida: string | null) => string> = {
  visita_area: (a) => `Hai visitato l'area ${a}`,
  lettura_articolo: (a) => `Hai letto un articolo su ${a}`,
  chat_assistente: (a) => `Hai aperto l'assistente digitale di ${a}`,
  download_guida: (a, guida) => (guida ? `Hai aperto «${guida}» di ${a}` : `Hai scaricato la guida di ${a}`),
  iscrizione_webinar: (a) => `Iscrizione a un evento di ${a}`,
  partecipazione_webinar: (a) => `Hai partecipato a un evento di ${a}`,
  workshop_pcto: (a) => `Hai partecipato al workshop PCTO di ${a}`,
  workshop_progetto: (a) => `Hai completato un workshop di ${a}`,
};

// Il titolo della guida di quel livello, o null se il livello non c'è (ogni
// attività che non è una guida) o non è uno dei tre.
function titoloGuida(areaSlug: string, livello: unknown): string | null {
  if (livello !== 1 && livello !== 2 && livello !== 3) return null;
  return guideDiArea(areaSlug).find((g) => g.livello === livello)?.titolo ?? null;
}

// Percorso di esplorazione leggibile (non tecnico) da activity_log, più
// recenti prima.
export async function getPercorsoEsplorazione(supabase: SupabaseClient, userId: string, limite = 10): Promise<VoceEsplorazione[]> {
  try {
    const { data, error } = await supabase
      .from("activity_log")
      .select("id, area_slug, tipo_attivita, livello, created_at")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) return [];

    return (data ?? []).map((riga) => {
      const area = getAreaBySlug(riga.area_slug);
      const testo =
        ETICHETTE_TIPO[riga.tipo_attivita as TipoAttivita]?.(area?.nome ?? riga.area_slug, titoloGuida(riga.area_slug, riga.livello)) ??
        "Attività registrata";
      return { id: riga.id, testo, data: riga.created_at };
    });
  } catch {
    return [];
  }
}

// ═════ IL SECONDO REGISTRO, quello che «Le mie attività» non leggeva ═════
//
// ⚠️ IL DIFETTO CHE CHIUDE, ed è la specie capostipite di questo progetto: uno
// studente che aveva completato TRE MISSIONI apriva questa pagina e leggeva
// «Non hai ancora nessuna attività registrata» — una cosa scritta che dichiara
// uno stato diverso da quello vero, **nella pagina che esiste apposta per
// dirgli cosa ha fatto, e in faccia a chi ha fatto di più**. Per settimane è
// stata citata solo per spiegare altro (le missioni non scrivono
// `activity_log`, che è la ragione per cui un `mission_attempt` fabbricato non
// produce nessuna affermazione).
//
// PERCHÉ UN SECONDO BLOCCO E NON UNA LISTA SOLA. In KIREO i registri sono DUE
// e contano cose diverse di proposito: `activity_log` → `score_aree` è
// l'ESPLORAZIONE («dove hai messo piede, non le tue attitudini», dice la home
// con le sue stesse parole), `evidence` → `area_signal` è il RITRATTO (le
// affinità). Fonderli in un elenco unico cancellerebbe la distinzione che la
// home spiega nella sua copy — e la contraddizione fra i due ritratti è una
// PROVA che vogliamo restare visibile (vedi «Punti aperti»: il cross-feed
// `activity`↔`evidence`).
//
// E IL BLOCCO DELL'ESPLORAZIONE NON MENTIVA: «non hai nessuna attività
// registrata» è vero DEL SUO REGISTRO. La falsità nasceva dal fatto che era
// l'unica voce della pagina. Quindi non si tocca il suo stato vuoto nel merito:
// si smette di lasciarlo parlare da solo.
//
// COSA NON FA: non scrive niente, non tocca nessuna scala, nessuna migrazione.
// È una lettura in più su una pagina che ne faceva una di meno — e lascia
// aperta la domanda vera (se le missioni debbano alimentare anche il radar),
// che è una decisione di prodotto con conseguenze sui pesi.
//
// I WORKSHOP NON SONO QUI, e non è una dimenticanza: la chiusura di un progetto
// scrive `activity_log` (`workshop_progetto`, dalla separazione del 29/09),
// quindi compaiono già nell'esplorazione.
export async function getPercorsoRitratto(supabase: SupabaseClient, userId: string, limite = 10): Promise<VoceEsplorazione[]> {
  // Ogni lettura degrada DA SÉ: un registro che non risponde toglie le sue
  // voci, non la pagina. E un errore di lettura non diventa un'affermazione su
  // una persona — nel dubbio il blocco mostra meno, mai qualcosa che non ha
  // letto. (`consegne_evento` è la più giovane delle tre: se la sua migrazione
  // non fosse applicata, qui semplicemente non compare.)
  const [test, missioni, consegne] = await Promise.all([
    leggi(supabase, "test_attempt", "id, test_slug, stato, completed_at, updated_at", userId),
    leggi(supabase, "mission_attempt", "id, mission_slug, stato, completed_at, updated_at", userId),
    leggi(supabase, "consegne_evento", "id, created_at, eventi(titolo)", userId),
  ]);

  const voci: VoceEsplorazione[] = [];

  // IL FILTRO SU `stato` SI APPLICA QUI E NON NELLA QUERY, di proposito: se un
  // domani quella colonna cambiasse nome, un `.eq()` nella query farebbe
  // sparire il blocco IN SILENZIO (errore scartato → zero voci → la pagina
  // torna a dire «niente»), cioè il difetto che questo blocco chiude. Letto
  // dopo, un `stato` assente lascia passare la riga, e si vede a schermo che
  // qualcosa è cambiato.
  const completata = (r: Riga) => r.stato === undefined || r.stato === "completata";
  const quando = (r: Riga) => String(r.completed_at ?? r.updated_at ?? "");

  for (const r of test.filter(completata)) {
    const titolo = TEST_META.find((t) => t.slug === r.test_slug)?.titolo;
    voci.push({
      id: `test-${r.id}`,
      testo: titolo ? `Hai fatto il test «${titolo}»` : "Hai fatto un test",
      data: quando(r),
    });
  }
  for (const r of missioni.filter(completata)) {
    const titolo = MISSIONI.find((m) => m.slug === r.mission_slug)?.titolo;
    voci.push({
      id: `missione-${r.id}`,
      testo: titolo ? `Hai completato la missione «${titolo}»` : "Hai completato una missione",
      data: quando(r),
    });
  }
  for (const r of consegne) {
    const rel = Array.isArray(r.eventi) ? r.eventi[0] : r.eventi;
    const titolo = (rel as { titolo?: string } | null | undefined)?.titolo;
    voci.push({
      id: `consegna-${r.id}`,
      testo: titolo ? `Hai risposto alla domanda di «${titolo}»` : "Hai risposto alla domanda di un incontro",
      data: String(r.created_at ?? ""),
    });
  }

  return voci
    .filter((v) => v.data !== "")
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, limite);
}

type Riga = Record<string, unknown>;
async function leggi(supabase: SupabaseClient, tabella: string, colonne: string, userId: string): Promise<Riga[]> {
  try {
    const { data, error } = await supabase.from(tabella).select(colonne).eq("student_id", userId);
    if (error || !data) return [];
    return data as unknown as Riga[];
  } catch {
    return [];
  }
}

export type SuggerimentoAttivita = { areaSlug: string; areaNome: string; azione: string; href: string; fatto: boolean };

// 3 attività suggerite per ciascuna area scelta (leggi la guida, fai una
// domanda all'assistente, iscriviti a un evento), marcate come "fatto" se
// quel tipo di attività risulta già registrato per quell'area (anche una
// sola volta, non solo oggi).
export async function getSuggerimentiPerAree(
  supabase: SupabaseClient,
  userId: string,
  areeSlugs: string[],
): Promise<SuggerimentoAttivita[]> {
  if (areeSlugs.length === 0) return [];

  let fatti = new Set<string>();
  try {
    const { data, error } = await supabase
      .from("activity_log")
      .select("area_slug, tipo_attivita")
      .eq("student_id", userId)
      .in("area_slug", areeSlugs);
    if (!error) {
      fatti = new Set((data ?? []).map((r) => `${r.area_slug}:${r.tipo_attivita}`));
    }
  } catch {
    fatti = new Set();
  }

  const suggerimenti: SuggerimentoAttivita[] = [];
  for (const slug of areeSlugs) {
    const area = getAreaBySlug(slug);
    if (!area) continue;
    suggerimenti.push({
      areaSlug: slug,
      areaNome: area.nome,
      azione: "Leggi la guida",
      href: `/aree/${slug}#guida`,
      fatto: fatti.has(`${slug}:download_guida`),
    });
    suggerimenti.push({
      areaSlug: slug,
      areaNome: area.nome,
      azione: "Fai una domanda all'assistente",
      href: `/aree/${slug}#assistente-digitale`,
      fatto: fatti.has(`${slug}:chat_assistente`),
    });
    suggerimenti.push({
      areaSlug: slug,
      areaNome: area.nome,
      azione: "Iscriviti a un evento",
      href: `/aree/${slug}#eventi`,
      fatto: fatti.has(`${slug}:iscrizione_webinar`),
    });
  }
  return suggerimenti;
}
