// Chi può moderare la diretta di un evento, e cosa vede.
//
// ⚠️ UNA PAGINA PER DUE RUOLI, ed è un vincolo di Mario: «stessa pagina per
// ente e admin se possibile — due pagine gemelle divergono sempre». Quindi non
// `requireAdmin()` né `getEnteContext()`, che sono guardie di AREA e
// reindirizzano chi non è del loro ruolo: qui serve una guardia che ammetta
// tutti e due e dica QUALE dei due è, perché l'unica cosa che cambia fra loro è
// quali dati può portarsi via (vedi `parte`).
//
// ⚠️ LA VERA AUTORIZZAZIONE NON È QUI: le RPC della diretta
// (`conteggio_presenti_live`, `domande_live_organizzatore`,
// `chiudi_diretta_evento`, `esporta_*`) sono SECURITY DEFINER e rifiutano
// chiunque non sia admin o l'organizzatore. Questa funzione decide se la PAGINA
// si apre — cioè l'esperienza, non la protezione. Un `notFound()` invece di un
// redirect: chi non c'entra non deve nemmeno sapere che quell'evento esiste.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Quale delle due parti sta moderando. Congelato nel nome come `certificata_da_tipo`. */
export type ParteModeratrice = "kireo" | "ente";

export type ContestoModerazione = {
  parte: ParteModeratrice;
  evento: {
    id: string;
    titolo: string;
    tipo: string;
    pubblico: string;
    filone: string | null;
    data_inizio: string;
    data_fine: string | null;
    stato: string;
    in_evidenza: boolean;
    hosting_diretta: string | null;
    youtube_video_id: string | null;
    domanda_consegna: string | null;
    diretta_chiusa_il: string | null;
    diretta_chiusa_da_tipo: string | null;
    diretta_chiusa_presenti: number | null;
    diretta_chiusa_certificati: number | null;
    diretta_durata_minuti: number | null;
    ore_pcto: number | null;
    ore_pcto_fissate_il: string | null;
    // Nome e cognome di chi ha corretto le ore, letto solo per KIREO: è l'unica
    // parte che vede la correzione. Null senza correzione o senza lettura.
    ore_pcto_fissate_da_nome: string | null;
    organizzatore: string | null;
    // Per la plancia dell'admin (27/10): approvare un evento si fa qui, e si
    // decide leggendo cosa l'ente ha scritto.
    descrizione: string | null;
    cta_esterna_url: string | null;
  };
};

export async function getContestoModerazione(eventoId: string): Promise<ContestoModerazione> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/accedi");

  const { data: profilo } = await supabase.from("profiles").select("ruolo").eq("id", user.id).maybeSingle();

  const { data: evento, error } = await supabase
    .from("eventi")
    .select(
      "id, titolo, descrizione, cta_esterna_url, tipo, pubblico, filone, data_inizio, data_fine, stato, in_evidenza, hosting_diretta, youtube_video_id, domanda_consegna, diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_presenti, diretta_chiusa_certificati, diretta_durata_minuti, ore_pcto, ore_pcto_fissate_il, ore_pcto_fissate_da, organizzatore_id, istituzioni(nome)",
    )
    .eq("id", eventoId)
    .maybeSingle();

  // ⚠️ UNA LETTURA FALLITA NON È UN EVENTO CHE NON ESISTE, e l'errore si
  // logga: un `notFound()` muto su un problema di rete manda a cercare un
  // evento che c'è.
  if (error) console.error("getContestoModerazione: lettura evento", error);
  if (!evento) notFound();

  let parte: ParteModeratrice | null = null;
  if (profilo?.ruolo === "admin") {
    parte = "kireo";
  } else if (profilo?.ruolo === "istituzione") {
    const { data: link } = await supabase
      .from("institution_profiles")
      .select("istituzione_id")
      .eq("user_id", user.id)
      .maybeSingle();
    // ⚠️ `=== organizzatore_id` e non `!==`: un confronto affermativo con un
    // `istituzione_id` nullo è falso, quindi fallisce CHIUSO — un `!==`
    // sarebbe NULL-unsafe nella direzione sbagliata, che è il difetto che in
    // questo progetto abbiamo ricacciato sette volte.
    if (link?.istituzione_id && link.istituzione_id === evento.organizzatore_id) parte = "ente";
  }
  if (!parte) notFound();

  // Chi ha corretto le ore: una lettura a parte e non un embed, perché `eventi`
  // ha due chiavi verso `profiles` e l'embed andrebbe disambiguato a mano. Una
  // lettura fallita lascia una traccia e la riga dice che non sa — non un nome
  // inventato, e nemmeno un silenzio che sembri una correzione senza autore.
  let nomeCorrettore: string | null = null;
  if (parte === "kireo" && evento.ore_pcto_fissate_da) {
    const { data: p, error: eP } = await supabase
      .from("profiles")
      .select("nome, cognome")
      .eq("id", evento.ore_pcto_fissate_da)
      .maybeSingle();
    if (eP) console.error("getContestoModerazione: chi ha corretto le ore", eP);
    const nome = [p?.nome, p?.cognome].filter(Boolean).join(" ").trim();
    nomeCorrettore = nome || null;
  }

  const istituzione = Array.isArray(evento.istituzioni) ? evento.istituzioni[0] : evento.istituzioni;
  return {
    parte,
    evento: {
      id: evento.id,
      titolo: evento.titolo,
      tipo: evento.tipo,
      pubblico: evento.pubblico,
      filone: evento.filone,
      data_inizio: evento.data_inizio,
      data_fine: evento.data_fine,
      stato: evento.stato,
      in_evidenza: !!evento.in_evidenza,
      hosting_diretta: evento.hosting_diretta,
      youtube_video_id: evento.youtube_video_id,
      domanda_consegna: evento.domanda_consegna,
      diretta_chiusa_il: evento.diretta_chiusa_il,
      diretta_chiusa_da_tipo: evento.diretta_chiusa_da_tipo,
      diretta_chiusa_presenti: evento.diretta_chiusa_presenti,
      diretta_chiusa_certificati: evento.diretta_chiusa_certificati,
      diretta_durata_minuti: evento.diretta_durata_minuti,
      ore_pcto: evento.ore_pcto,
      ore_pcto_fissate_il: evento.ore_pcto_fissate_il,
      ore_pcto_fissate_da_nome: nomeCorrettore,
      organizzatore: istituzione?.nome ?? null,
      descrizione: evento.descrizione ?? null,
      cta_esterna_url: evento.cta_esterna_url ?? null,
    },
  };
}
