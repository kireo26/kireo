import type { SupabaseClient } from "@supabase/supabase-js";

// L'unica lettura degli studenti da parte della scuola (01/11, 20261128100000).
//
// La scuola non legge più `profiles` né `student_profiles`: le due policy che
// glielo permettevano davano tutte le colonne, comprese data di nascita,
// telefono e consenso alle comunicazioni, e già per uno studente solo
// dichiarato. Stringere le colonne non bastava, perché i privilegi valgono per
// ruolo e la scuola e lo studente sono lo stesso ruolo: si sarebbero tolti allo
// studente i suoi dati. Quindi qui passa SOLO quello che la funzione
// `studenti_della_scuola()` restituisce, e una pagina che volesse un altro campo
// deve chiederlo a una migrazione, non a una `select`.
//
// ⚠️ L'email di uno studente DICHIARATO serve solo a verificare (Mario, 01/11:
// senza un elemento che distingua, il referente verifica male). Si mostra solo
// sulle righe in attesa di verifica, mai negli elenchi generali, nelle
// esportazioni o nei file scaricabili: per questo `emailPerVerifica` la dà solo
// per i dichiarati, e `emailVerificato` solo per i verificati.

export type StatoStudenteScuola = "dichiarato" | "verificato";

export type StudenteDellaScuola = {
  userId: string;
  nome: string | null;
  cognome: string | null;
  classe: string | null;
  stato: StatoStudenteScuola;
  dichiaratoIl: string | null;
  verificatoIl: string | null;
  email: string | null;
};

type Riga = {
  user_id: string;
  nome: string | null;
  cognome: string | null;
  classe: string | null;
  stato_verifica: StatoStudenteScuola;
  dichiarato_il: string | null;
  verificato_il: string | null;
  email: string | null;
};

// null = non letto (la pagina lo dice), [] = nessuno studente.
export async function leggiStudentiDellaScuola(supabase: SupabaseClient): Promise<StudenteDellaScuola[] | null> {
  const { data, error } = await supabase.rpc("studenti_della_scuola");
  if (error) {
    console.error("[lib/scuola/studenti.ts] errore RPC studenti_della_scuola:", error);
    return null;
  }
  return ((data ?? []) as Riga[]).map((r) => ({
    userId: r.user_id,
    nome: r.nome,
    cognome: r.cognome,
    classe: r.classe,
    stato: r.stato_verifica,
    dichiaratoIl: r.dichiarato_il,
    verificatoIl: r.verificato_il,
    email: r.email,
  }));
}

export function soloDichiarati(studenti: StudenteDellaScuola[]): StudenteDellaScuola[] {
  return studenti.filter((s) => s.stato === "dichiarato");
}

export function soloVerificati(studenti: StudenteDellaScuola[]): StudenteDellaScuola[] {
  return studenti.filter((s) => s.stato === "verificato");
}

// L'email di chi aspetta la verifica: solo per la schermata della verifica.
export function emailPerVerifica(s: StudenteDellaScuola): string | null {
  return s.stato === "dichiarato" ? s.email : null;
}

// L'email di uno studente verificato.
export function emailVerificato(s: StudenteDellaScuola): string | null {
  return s.stato === "verificato" ? s.email : null;
}

export function nomeCompleto(s: Pick<StudenteDellaScuola, "nome" | "cognome">): string {
  return [s.nome, s.cognome].filter(Boolean).join(" ").trim();
}

export function perId(studenti: StudenteDellaScuola[]): Map<string, StudenteDellaScuola> {
  return new Map(studenti.map((s) => [s.userId, s]));
}

// Testo mio e provvisorio.
export const TESTO_STUDENTI_NON_LETTI = "Non siamo riusciti a leggere l'elenco degli studenti: ricarica la pagina.";
