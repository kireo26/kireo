import type { SupabaseClient } from "@supabase/supabase-js";

export type RigaPresenza = {
  studentId: string;
  nome: string;
  cognome: string;
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
  scuolaId: string,
): Promise<RigaPresenza[]> {
  const [{ data: righeDirette }, { data: classiDad }] = await Promise.all([
    supabase
      .from("iscrizioni_eventi")
      .select("student_id, stato, certificata_da_tipo, profiles(nome, cognome)")
      .eq("evento_id", eventoId)
      .eq("origine", "scuola"),
    supabase
      .from("iscrizioni_classe_eventi")
      .select("classe_id, modalita, classi!inner(scuola_profilo_id)")
      .eq("evento_id", eventoId)
      .eq("modalita", "dad")
      .eq("classi.scuola_profilo_id", scuolaProfiloId),
  ]);

  const mappa = new Map<string, RigaPresenza>();

  for (const riga of righeDirette ?? []) {
    const profilo = Array.isArray(riga.profiles) ? riga.profiles[0] : riga.profiles;
    mappa.set(riga.student_id, {
      studentId: riga.student_id,
      nome: profilo?.nome ?? "",
      cognome: profilo?.cognome ?? "",
      stato: riga.stato as "iscritto" | "partecipato",
      certificataDaTipo: riga.certificata_da_tipo,
    });
  }

  const classeIds = (classiDad ?? []).map((c) => c.classe_id);
  if (classeIds.length > 0) {
    const { data: membri } = await supabase
      .from("classi_studenti")
      .select("student_id, profiles(nome, cognome)")
      .in("classe_id", classeIds);

    for (const riga of membri ?? []) {
      if (mappa.has(riga.student_id)) continue;
      const profilo = Array.isArray(riga.profiles) ? riga.profiles[0] : riga.profiles;
      mappa.set(riga.student_id, {
        studentId: riga.student_id,
        nome: profilo?.nome ?? "",
        cognome: profilo?.cognome ?? "",
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
export async function getEventiConIscrizioniScuola(supabase: SupabaseClient, scuolaProfiloId: string, scuolaId: string) {
  const { data: studentiScuola } = await supabase.from("student_profiles").select("user_id").eq("school_code", scuolaId);
  const idStudenti = (studentiScuola ?? []).map((s) => s.user_id);

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
