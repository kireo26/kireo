import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailStudenti } from "./email";

export type PartecipazioneCertificata = {
  eventoId: string;
  titolo: string;
  dataInizio: string;
  orePcto: number;
  certificataDaTipo: string | null;
  certificataIl: string | null;
  certificataDaNome: string | null;
};

export type DettaglioStudente = {
  userId: string;
  nome: string;
  cognome: string;
  email: string | null;
  classeAssegnata: string | null;
  statoVerifica: string;
  verificatoIl: string | null;
  partecipazioni: PartecipazioneCertificata[];
  totaleOrePcto: number;
};

// Scheda di uno studente per referente/tutor: SOLO studenti verificati
// della propria scuola (restituisce null altrimenti — la pagina risponde
// con un 404, mai un errore muto). Espone solo dati "amministrativi"
// necessari alla scuola (anagrafica, classe, partecipazioni certificate):
// nessuno score, radar, activity_log o altro dato di profilazione — quei
// dati restano riservati allo studente stesso nella sua area personale.
export async function getDettaglioStudente(
  supabase: SupabaseClient,
  studentId: string,
  scuolaId: string,
  scuolaProfiloId: string,
): Promise<DettaglioStudente | null> {
  const { data: sp, error: erroreStudentProfile } = await supabase
    .from("student_profiles")
    .select("user_id, stato_verifica, verificato_il, profiles!user_id(nome, cognome)")
    .eq("user_id", studentId)
    .eq("school_code", scuolaId)
    .eq("stato_verifica", "verificato")
    .maybeSingle();

  if (erroreStudentProfile) console.error("[lib/scuola/studenteDettaglio.ts] errore query student_profiles:", erroreStudentProfile);
  if (!sp) return null;

  const profilo = Array.isArray(sp.profiles) ? sp.profiles[0] : sp.profiles;

  const [{ data: classeRiga, error: erroreClasse }, { data: partecipazioniRighe, error: errorePartecipazioni }, emailPerStudente] = await Promise.all([
    supabase
      .from("classi_studenti")
      .select("classi!inner(nome_visualizzato, scuola_profilo_id)")
      .eq("student_id", studentId)
      .eq("classi.scuola_profilo_id", scuolaProfiloId)
      .maybeSingle(),
    supabase
      .from("iscrizioni_eventi")
      .select(
        "evento_id, certificata_da_tipo, certificata_da_user, certificata_il, eventi(titolo, data_inizio, ore_pcto), profiles!certificata_da_user(nome, cognome)",
      )
      .eq("student_id", studentId)
      .eq("stato", "partecipato")
      .order("certificata_il", { ascending: false }),
    getEmailStudenti(supabase, [studentId]),
  ]);

  if (erroreClasse) console.error("[lib/scuola/studenteDettaglio.ts] errore query classe:", erroreClasse);
  if (errorePartecipazioni) console.error("[lib/scuola/studenteDettaglio.ts] errore query partecipazioni:", errorePartecipazioni);

  const classe = Array.isArray(classeRiga?.classi) ? classeRiga?.classi[0] : classeRiga?.classi;

  const partecipazioni: PartecipazioneCertificata[] = (partecipazioniRighe ?? []).map((riga) => {
    const evento = Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi;
    const certificatore = Array.isArray(riga.profiles) ? riga.profiles[0] : riga.profiles;
    const nomeCertificatore = certificatore ? `${certificatore.nome} ${certificatore.cognome}`.trim() : "";
    return {
      eventoId: riga.evento_id,
      titolo: evento?.titolo ?? "Evento",
      dataInizio: evento?.data_inizio ?? "",
      orePcto: Number(evento?.ore_pcto ?? 0),
      certificataDaTipo: riga.certificata_da_tipo,
      certificataIl: riga.certificata_il,
      certificataDaNome: nomeCertificatore || null,
    };
  });

  const totaleOrePcto = partecipazioni.reduce((totale, p) => totale + p.orePcto, 0);

  return {
    userId: sp.user_id,
    nome: profilo?.nome ?? "",
    cognome: profilo?.cognome ?? "",
    email: emailPerStudente.get(studentId) ?? null,
    classeAssegnata: classe?.nome_visualizzato ?? null,
    statoVerifica: sp.stato_verifica,
    verificatoIl: sp.verificato_il,
    partecipazioni,
    totaleOrePcto,
  };
}
