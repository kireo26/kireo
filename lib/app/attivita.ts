import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreaBySlug } from "@/data/aree";
import { guideDiArea } from "@/lib/guide/config";
import { MISSIONI } from "@/lib/escape/config";
import { TEST_META } from "@/lib/test/config";
import type { TipoAttivita } from "./activityLog";
import { fineEffettiva } from "@/lib/live";
import { testoEsitoStorico } from "@/lib/live/presenza";
import { descriviErrore } from "@/lib/erroreSupabase";

export type VoceStorico = {
  id: string;
  tipo: "attivita" | "evento";
  titolo: string;
  data: string;
  oreCertificate: number | null;
  /** Com'è andata, per un evento finito (vedi `testoEsitoStorico`). `null` = niente da dire. */
  esito?: string | null;
};

type RigaStudentActivity = {
  id: string;
  ore_certificate: number | null;
  completed_at: string | null;
  created_at: string;
  activities: { titolo: string } | { titolo: string }[] | null;
};

type EventoStorico = {
  id: string;
  titolo: string;
  data_inizio: string;
  data_fine?: string | null;
  tipo?: string | null;
  pubblico?: string | null;
  diretta_chiusa_il?: string | null;
  diretta_durata_minuti?: number | null;
};
type RigaIscrizioneEvento = {
  created_at: string;
  stato?: string | null;
  ore_riconosciute?: number | string | null;
  eventi: EventoStorico | EventoStorico[] | null;
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

  // ⚠️ LO STORICO DICE COM'È ANDATA (26/10). Prima elencava un evento con nome
  // e data, e basta: la diretta, cioè quella che certifica le ore, prendeva il
  // trattamento peggiore dello storico. La lettura estesa ha un RIPIEGO sulla
  // forma di prima: se una colonna nuova mancasse (una migrazione non
  // applicata) la `select` fallirebbe intera, e lo storico perderebbe anche
  // gli eventi — meglio un elenco senza esito che nessun elenco.
  let vociEventi: VoceStorico[] = [];
  try {
    const estesa = await supabase
      .from("iscrizioni_eventi")
      .select(
        "created_at, stato, ore_riconosciute, eventi(id, titolo, data_inizio, data_fine, tipo, pubblico, diretta_chiusa_il, diretta_durata_minuti)",
      )
      .eq("student_id", userId);
    let righe: RigaIscrizioneEvento[] = [];
    let conEsito = true;
    if (estesa.error) {
      console.error("getStoricoAttivita: lettura estesa degli eventi non riuscita, ripiego sulla forma breve", estesa.error);
      conEsito = false;
      const breve = await supabase.from("iscrizioni_eventi").select("created_at, eventi(id, titolo, data_inizio)").eq("student_id", userId);
      if (breve.error) console.error("getStoricoAttivita: lettura degli eventi non riuscita", breve.error);
      righe = (breve.data ?? []) as RigaIscrizioneEvento[];
    } else {
      righe = (estesa.data ?? []) as RigaIscrizioneEvento[];
    }

    // I minuti contati, uno per evento. Una lettura fallita vale «non letti»:
    // l'esito degrada invece di dire un numero che non abbiamo.
    const contatiPerEvento = new Map<string, number>();
    let contatiLetti = false;
    if (conEsito) {
      const pres = await supabase.from("presenze_live").select("evento_id, ping_totali").eq("user_id", userId);
      if (pres.error) console.error("getStoricoAttivita: minuti contati non leggibili", pres.error);
      else {
        contatiLetti = true;
        for (const r of (pres.data ?? []) as { evento_id: string; ping_totali: number }[]) contatiPerEvento.set(r.evento_id, r.ping_totali);
      }
    }

    const adesso = Date.now();
    vociEventi = righe.map((riga) => {
      const rel = Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi;
      let esito: string | null = null;
      let oreCertificate: number | null = null;
      if (conEsito && rel) {
        const fine = fineEffettiva(rel.data_inizio, rel.data_fine ?? null, rel.diretta_chiusa_il ?? null);
        const ore = riga.ore_riconosciute === null || riga.ore_riconosciute === undefined ? null : Number(riga.ore_riconosciute);
        // Un evento senza battiti a cui si era iscritti è «zero minuti», ma
        // solo se la lettura è riuscita: non leggerla non è zero.
        const contati = contatiLetti ? (contatiPerEvento.get(rel.id) ?? 0) : null;
        esito = testoEsitoStorico({
          diretta: rel.tipo === "webinar",
          finito: new Date(fine).getTime() <= adesso,
          chiuso: Boolean(rel.diretta_chiusa_il),
          durata: rel.diretta_durata_minuti ?? null,
          stato: riga.stato ?? null,
          ore,
          contati,
          pubblico: rel.pubblico === "docenti" ? "docenti" : "studenti",
        });
        if (riga.stato === "partecipato" && ore !== null && ore > 0) oreCertificate = ore;
      }
      return {
        id: `evento-${rel?.id ?? riga.created_at}`,
        tipo: "evento" as const,
        titolo: rel?.titolo ?? "Evento",
        data: rel?.data_inizio ?? riga.created_at,
        oreCertificate,
        esito,
      };
    });
  } catch (e) {
    console.error("getStoricoAttivita: eventi non leggibili", e);
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

// IL TETTO GIORNALIERO, DETTO A CHI LO SUBISCE (Mario, 27/10). `activity_log`
// tiene una riga per studente, area, tipo e giorno (l'indice
// `activity_log_cap_giornaliero_idx`, sul giorno in UTC): due eventi della
// stessa area certificati lo stesso giorno lasciano UNA riga qui, mentre lo
// storico li elenca tutti e due. È la regola, e non si cambia; ma chi ha
// seguito due dirette in un pomeriggio e ne vede una pensa che KIREO si sia
// perso la seconda, e niente gli diceva il contrario. Quindi la riga che ne
// ha assorbiti più di uno lo dice, solo quando succede.
//
// Pura: riceve le righe del percorso e le presenze certificate, conta per
// (giorno UTC, area, tipo di attività) e restituisce una nota per riga.
export type PresenzaCertificata = { certificataIl: string; tipoEvento: string; aree: string[] };

export function tipoAttivitaDiPresenza(tipoEvento: string): TipoAttivita {
  return tipoEvento === "workshop" ? "workshop_pcto" : "partecipazione_webinar";
}

const giornoUtc = (istante: string) => new Date(istante).toISOString().slice(0, 10);

export function noteTettoGiornaliero(
  righe: { id: string; area_slug: string; tipo_attivita: string; created_at: string }[],
  presenze: PresenzaCertificata[],
): Map<string, number> {
  const conti = new Map<string, number>();
  for (const p of presenze) {
    const tipo = tipoAttivitaDiPresenza(p.tipoEvento);
    for (const area of p.aree) {
      const chiave = `${giornoUtc(p.certificataIl)}|${area}|${tipo}`;
      conti.set(chiave, (conti.get(chiave) ?? 0) + 1);
    }
  }
  const note = new Map<string, number>();
  for (const r of righe) {
    if (r.tipo_attivita !== "partecipazione_webinar" && r.tipo_attivita !== "workshop_pcto") continue;
    const n = conti.get(`${giornoUtc(r.created_at)}|${r.area_slug}|${r.tipo_attivita}`) ?? 0;
    if (n > 1) note.set(r.id, n);
  }
  return note;
}

// Testo mio, provvisorio.
export function testoTettoGiornaliero(n: number): string {
  return `Quel giorno gli eventi di quest'area erano ${n}: qui ne conta uno al giorno, nello storico ci sono tutti.`;
}

async function leggiNoteTetto(
  supabase: SupabaseClient,
  userId: string,
  righe: { id: string; area_slug: string; tipo_attivita: string; created_at: string }[],
): Promise<Map<string, number>> {
  if (!righe.some((r) => r.tipo_attivita === "partecipazione_webinar" || r.tipo_attivita === "workshop_pcto")) return new Map();
  const { data: presenze, error } = await supabase
    .from("iscrizioni_eventi")
    .select("certificata_il, eventi(tipo, eventi_aree(area_slug))")
    .eq("student_id", userId)
    .eq("stato", "partecipato")
    .not("certificata_il", "is", null);
  if (error) {
    console.error("[attivita] presenze per il tetto giornaliero:", descriviErrore(error));
    return new Map();
  }
  const lette: PresenzaCertificata[] = (presenze ?? []).flatMap((p) => {
    const ev = Array.isArray(p.eventi) ? p.eventi[0] : p.eventi;
    if (!ev || !p.certificata_il) return [];
    const aree = ((ev.eventi_aree ?? []) as { area_slug: string }[]).map((a) => a.area_slug);
    return [{ certificataIl: p.certificata_il as string, tipoEvento: ev.tipo as string, aree }];
  });
  return noteTettoGiornaliero(righe, lette);
}

export type VoceEsplorazioneConNota = VoceEsplorazione & { nota?: string };

// Percorso di esplorazione leggibile (non tecnico) da activity_log, più
// recenti prima.
export async function getPercorsoEsplorazione(supabase: SupabaseClient, userId: string, limite = 10): Promise<VoceEsplorazioneConNota[]> {
  try {
    const { data, error } = await supabase
      .from("activity_log")
      .select("id, area_slug, tipo_attivita, livello, created_at")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) return [];

    // Le presenze certificate servono solo se il percorso ha una riga di
    // partecipazione; se non si leggono, la nota non si dice (la riga resta
    // vera com'è).
    let note = new Map<string, number>();
    try {
      note = await leggiNoteTetto(supabase, userId, data ?? []);
    } catch (e) {
      // La nota è un di più: un guasto qui non deve togliere il percorso.
      console.error("[attivita] presenze per il tetto giornaliero:", descriviErrore(e));
    }

    return (data ?? []).map((riga) => {
      const area = getAreaBySlug(riga.area_slug);
      const testo =
        ETICHETTE_TIPO[riga.tipo_attivita as TipoAttivita]?.(area?.nome ?? riga.area_slug, titoloGuida(riga.area_slug, riga.livello)) ??
        "Attività registrata";
      const n = note.get(riga.id);
      return { id: riga.id, testo, data: riga.created_at, ...(n ? { nota: testoTettoGiornaliero(n) } : {}) };
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
