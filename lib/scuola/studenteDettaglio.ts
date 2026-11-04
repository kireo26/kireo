import type { SupabaseClient } from "@supabase/supabase-js";
import { emailVerificato, leggiStudentiDellaScuola, soloVerificati } from "./studenti";
import { leggiNomiCertificatori, nomeDelCertificatore } from "./certificatore";

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
  // La scheda è solo per uno studente VERIFICATO della scuola: lo dice
  // studenti_della_scuola, che restituisce solo gli studenti della scuola di chi chiede.
  const studenti = await leggiStudentiDellaScuola(supabase);
  const sp = soloVerificati(studenti ?? []).find((s) => s.userId === studentId);
  if (!sp) return null;

  const [{ data: classeRiga, error: erroreClasse }, { data: partecipazioniRighe, error: errorePartecipazioni }] = await Promise.all([
    supabase
      .from("classi_studenti")
      .select("classi!inner(nome_visualizzato, scuola_profilo_id)")
      .eq("student_id", studentId)
      .eq("classi.scuola_profilo_id", scuolaProfiloId)
      .maybeSingle(),
    supabase
      .from("iscrizioni_eventi")
      .select(
        "evento_id, certificata_da_tipo, certificata_da_user, certificata_il, ore_riconosciute, eventi(titolo, data_inizio)",
      )
      .eq("student_id", studentId)
      .eq("stato", "partecipato")
      .order("certificata_il", { ascending: false }),
  ]);

  if (erroreClasse) console.error("[lib/scuola/studenteDettaglio.ts] errore query classe:", erroreClasse);
  if (errorePartecipazioni) console.error("[lib/scuola/studenteDettaglio.ts] errore query partecipazioni:", errorePartecipazioni);

  const classe = Array.isArray(classeRiga?.classi) ? classeRiga?.classi[0] : classeRiga?.classi;

  // 04/11: il nome di chi ha certificato da `nomi_dei_certificatori`, non da un
  // embed su `profiles`: l'embed lo perdeva in silenzio per un tutor
  // disattivato, per chi ha cancellato l'account e per chi non è dello staff.
  const nomi = await leggiNomiCertificatori(supabase, (partecipazioniRighe ?? []).map((r) => r.certificata_da_user as string | null));
  const partecipazioni: PartecipazioneCertificata[] = (partecipazioniRighe ?? []).map((riga) => {
    const evento = Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi;
    return {
      eventoId: riga.evento_id,
      titolo: evento?.titolo ?? "Evento",
      dataInizio: evento?.data_inizio ?? "",
      // Le ore EMESSE alla certificazione (26/10), non quelle dichiarate sull'evento.
      orePcto: Number(riga.ore_riconosciute ?? 0),
      certificataDaTipo: riga.certificata_da_tipo,
      certificataIl: riga.certificata_il,
      certificataDaNome: nomeDelCertificatore(nomi, riga.certificata_da_tipo, riga.certificata_da_user as string | null) ?? null,
    };
  });

  const totaleOrePcto = partecipazioni.reduce((totale, p) => totale + p.orePcto, 0);

  return {
    userId: sp.userId,
    nome: sp.nome ?? "",
    cognome: sp.cognome ?? "",
    email: emailVerificato(sp),
    classeAssegnata: classe?.nome_visualizzato ?? null,
    statoVerifica: sp.stato,
    verificatoIl: sp.verificatoIl,
    partecipazioni,
    totaleOrePcto,
  };
}
