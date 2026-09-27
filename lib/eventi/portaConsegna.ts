// Perché la consegna di una diretta è chiusa, detto in italiano.
//
// PERCHÉ UN MODULO E NON DUE COPIE: la stessa domanda se la fanno in due — la
// pagina, per decidere se mostrare il campo e cosa scrivere al suo posto, e la
// route, quando la policy rifiuta l'insert e bisogna dire perché. Due copie
// divergono, e quella che diverge è sempre quella che nessuno rilegge.
//
// LA PORTA VERA È IN SQL: `puo_consegnare_evento`, dentro il `with check` della
// policy di insert su `consegne_evento`. Questo modulo non autorizza niente:
// spiega. Quindi degrada verso il NIENTE — se una lettura non riesce non dice
// «puoi», dice che non ha potuto controllare: un invito a scrivere un testo che
// poi verrebbe rifiutato è peggio di un avviso prudente.

import type { SupabaseClient } from "@supabase/supabase-js";
import { consegnaAperta, statoDiretta } from "@/lib/live";

export type MotivoPortaConsegna =
  | "aperta"
  | "senza_domanda"
  | "diretta_non_finita"
  | "finestra_chiusa"
  | "non_iscritto"
  | "senza_presenza"
  | "evento_senza_aree"
  | "gia_consegnata"
  | "non_ho_potuto_controllare";

export type PortaConsegna = { motivo: MotivoPortaConsegna; testo: string; aperta: boolean };

const TESTI: Record<MotivoPortaConsegna, string> = {
  aperta: "",
  senza_domanda: "Per questo incontro non è stata posta nessuna domanda finale.",
  diretta_non_finita: "La domanda finale si apre quando la diretta è terminata.",
  finestra_chiusa: "Il tempo per rispondere è scaduto: la domanda finale resta aperta per due giorni dopo la diretta.",
  non_iscritto: "Solo chi era iscritto a questo incontro può rispondere alla domanda finale.",
  senza_presenza:
    "La domanda finale è per chi ha seguito la diretta: non risulta che tu sia entrato nella pagina dell'incontro.",
  evento_senza_aree: "Per questo incontro non possiamo ancora aprire la domanda finale. Non è colpa tua: è un problema nostro.",
  gia_consegnata: "Hai già risposto a questa domanda.",
  non_ho_potuto_controllare:
    "Non siamo riusciti a controllare se puoi rispondere. Non è colpa tua: riprova, e se continua scrivici da Contatti.",
};

export function testoPorta(motivo: MotivoPortaConsegna): string {
  return TESTI[motivo];
}

export async function statoPortaConsegna(
  supabase: SupabaseClient,
  evento: { id: string; domanda_consegna: string | null; data_inizio: string; data_fine: string | null },
  userId: string,
): Promise<PortaConsegna> {
  const porta = (motivo: MotivoPortaConsegna): PortaConsegna => ({ motivo, testo: TESTI[motivo], aperta: motivo === "aperta" });

  if (!evento.domanda_consegna) return porta("senza_domanda");

  // La finestra: prima si distingue «non è ancora il momento» da «è passato»,
  // perché sono due attese opposte per chi legge.
  if (!consegnaAperta(evento.data_inizio, evento.data_fine)) {
    return porta(statoDiretta(evento.data_inizio, evento.data_fine) === "conclusa" ? "finestra_chiusa" : "diretta_non_finita");
  }

  const [{ data: consegna, error: eCons }, { data: iscrizione, error: eIscr }, { data: presenza, error: ePres }, { data: aree, error: eAree }] =
    await Promise.all([
      supabase.from("consegne_evento").select("id").eq("evento_id", evento.id).eq("student_id", userId).maybeSingle(),
      supabase.from("iscrizioni_eventi").select("student_id").eq("evento_id", evento.id).eq("student_id", userId).maybeSingle(),
      supabase.from("presenze_live").select("user_id").eq("evento_id", evento.id).eq("user_id", userId).maybeSingle(),
      supabase.from("eventi_aree").select("area_slug").eq("evento_id", evento.id),
    ]);

  // Una lettura fallita non è un permesso: si dichiara, non si indovina.
  const errore = eCons ?? eIscr ?? ePres ?? eAree;
  if (errore) {
    console.error("statoPortaConsegna — lettura fallita:", errore);
    return porta("non_ho_potuto_controllare");
  }

  if (consegna) return porta("gia_consegnata");
  if (!iscrizione) return porta("non_iscritto");
  if (!presenza) return porta("senza_presenza");
  if (!aree || aree.length === 0) return porta("evento_senza_aree");
  return porta("aperta");
}
