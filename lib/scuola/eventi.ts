import type { SupabaseClient } from "@supabase/supabase-js";
import { emailVerificato, perId, type StudenteDellaScuola } from "./studenti";

export type RigaPresenza = {
  studentId: string;
  nome: string;
  cognome: string;
  email: string | null;
  stato: "iscritto" | "partecipato";
  certificataDaTipo: string | null;
};

// Costruisce il registro presenze di un evento per la scuola corrente:
// unione di chi ha già una riga iscrizioni_eventi (origine=scuola, sia da
// iscrizione individuale sia da classe in modalità individuale, sia già
// certificato) e di chi è nel roster di una classe iscritta in modalità
// "dad" ma non ha ancora una riga (certifica_presenza la crea al volo).
export async function getRegistroPresenze(
  supabase: SupabaseClient,
  eventoId: string,
  scuolaProfiloId: string,
  // Gli studenti della scuola letti una volta da chi chiama (studenti_della_scuola):
  // nomi ed email vengono da lì, perché la scuola non legge più `profiles`.
  studenti: StudenteDellaScuola[],
): Promise<RigaPresenza[]> {
  const studentePerId = perId(studenti);
  const [{ data: righeDirette, error: erroreRigheDirette }, { data: classiDad, error: erroreClassiDad }] = await Promise.all([
    supabase
      .from("iscrizioni_eventi")
      .select("student_id, stato, certificata_da_tipo")
      .eq("evento_id", eventoId)
      .eq("origine", "scuola"),
    supabase
      .from("iscrizioni_classe_eventi")
      .select("classe_id, modalita, classi!inner(scuola_profilo_id)")
      .eq("evento_id", eventoId)
      .eq("modalita", "dad")
      .eq("classi.scuola_profilo_id", scuolaProfiloId),
  ]);

  if (erroreRigheDirette) console.error("[lib/scuola/eventi.ts:getRegistroPresenze] errore query righeDirette:", erroreRigheDirette);
  if (erroreClassiDad) console.error("[lib/scuola/eventi.ts:getRegistroPresenze] errore query classiDad:", erroreClassiDad);

  const mappa = new Map<string, RigaPresenza>();

  for (const riga of righeDirette ?? []) {
    const studente = studentePerId.get(riga.student_id);
    mappa.set(riga.student_id, {
      studentId: riga.student_id,
      nome: studente?.nome ?? "",
      cognome: studente?.cognome ?? "",
      email: studente ? emailVerificato(studente) : null,
      stato: riga.stato as "iscritto" | "partecipato",
      certificataDaTipo: riga.certificata_da_tipo,
    });
  }

  const classeIds = (classiDad ?? []).map((c) => c.classe_id);
  if (classeIds.length > 0) {
    const { data: membri, error: erroreMembri } = await supabase
      .from("classi_studenti")
      .select("student_id")
      .in("classe_id", classeIds);

    if (erroreMembri) console.error("[lib/scuola/eventi.ts:getRegistroPresenze] errore query membri:", erroreMembri);

    for (const riga of membri ?? []) {
      if (mappa.has(riga.student_id)) continue;
      const studente = studentePerId.get(riga.student_id);
      mappa.set(riga.student_id, {
        studentId: riga.student_id,
        nome: studente?.nome ?? "",
        cognome: studente?.cognome ?? "",
        email: studente ? emailVerificato(studente) : null,
        stato: "iscritto",
        certificataDaTipo: null,
      });
    }
  }

  return Array.from(mappa.values()).sort((a, b) => a.cognome.localeCompare(b.cognome, "it"));
}

// Eventi (passati o futuri) con almeno un'iscrizione riferibile alla
// scuola: individuale (iscrizioni_eventi origine=scuola su un suo
// studente) o di classe (iscrizioni_classe_eventi su una sua classe).
// Nessuna FK diretta tra iscrizioni_eventi e student_profiles (entrambe
// referenziano profiles separatamente), quindi niente embed PostgREST:
// prima gli id degli studenti della scuola, poi le iscrizioni di quegli id.
export async function getEventiConIscrizioniScuola(supabase: SupabaseClient, scuolaProfiloId: string, studenti: StudenteDellaScuola[]) {
  const idStudenti = studenti.map((s) => s.userId);

  const [{ data: perClasse }, { data: perStudente }] = await Promise.all([
    supabase.from("iscrizioni_classe_eventi").select("evento_id, classi!inner(scuola_profilo_id)").eq("classi.scuola_profilo_id", scuolaProfiloId),
    idStudenti.length > 0
      ? supabase.from("iscrizioni_eventi").select("evento_id").eq("origine", "scuola").in("student_id", idStudenti)
      : Promise.resolve({ data: [] as { evento_id: string }[] }),
  ]);

  const idEventi = new Set<string>();
  for (const r of perClasse ?? []) idEventi.add(r.evento_id);
  for (const r of perStudente ?? []) idEventi.add(r.evento_id);

  if (idEventi.size === 0) return [];

  const { data: eventi } = await supabase
    .from("eventi")
    .select("id, titolo, tipo, data_inizio, ore_pcto")
    .in("id", Array.from(idEventi))
    .order("data_inizio", { ascending: false });

  return eventi ?? [];
}
