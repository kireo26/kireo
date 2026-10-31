import type { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { descriviErrore } from "@/lib/erroreSupabase";
import { fineEffettiva } from "@/lib/live";

// LA SONDA DELLA REGISTRAZIONE (Mario, 31/10). Una volta per evento, a diretta
// finita da un po', chiede a YouTube se il video della diretta esiste ancora ed
// è incorporabile, e scrive la risposta su `eventi.registrazione_esito`. Il
// bottone «Rivedi» compare SOLO con `disponibile`: *senza la sonda abbiamo un
// indirizzo; con la sonda abbiamo una registrazione.*
//
// COME CHIEDE: l'endpoint oEmbed di YouTube, dal nostro server. È una richiesta
// NOSTRA su un video che l'ente ha pubblicato, non un'anteprima caricata nel
// browser di uno studente: lo studente non la vede e YouTube non vede lui. Per
// questo non è la cosa che `npm run test:contenuti` §2 vieta (far vedere uno
// studente a Meta), e la guardia ha una taratura che lo dice.
//
// ✅ MISURATO NEI DUE VERSI (Mario, 31/10, primo giro vero del cron: 13 letti,
// 0 guasti, 12 disponibile e 1 non_incorporabile), e verificato a schermo col
// banco del player: `5doxLWDlAJU` sonda «disponibile» e il player «in
// riproduzione»; `nyeZXqVZcWA` sonda «non_incorporabile» e il player
// «incorporamento_disattivato». Un sì e un no verificati: la mappa qui sotto
// (presa dalla documentazione) misura, non dice sempre la stessa cosa. Il ramo
// 403/404 → non_trovata resta non osservato: nessun video sparito, finora.
//
// «UNA VOLTA», E POI SI RIPARA DOVE SI ROMPE (Mario, 31/10): un video che
// sparisce DOPO la sonda lascerebbe il bottone acceso. La pagina «rivedi» sa
// quando il video non parte, e in quel momento CHIEDE al server di risondare
// quell'evento (`risondaUnEvento`, route /api/eventi/[id]/risonda). ⚠️ Il verso
// conta: il browser non scrive «non disponibile», chiede; decide il server,
// rifacendo la sonda vera. Un browser che dichiara lo stato di una cosa si può
// ingannare: basterebbe un indirizzo costruito a mano per spegnere i bottoni di
// tutti. Così il primo studente che ci sbatte non è un danno: è la riparazione.
// Il controllo periodico resta una cosa da fare se servirà: il fatto che lo
// farebbe costruire è un bottone acceso su un video che nessuno ha provato ad
// aprire, e quello non danneggia nessuno finché nessuno lo apre.

export type EsitoRegistrazione = "disponibile" | "non_incorporabile" | "non_trovata" | "non_controllato";

// Quanto aspettare dopo la fine prima di chiedere: YouTube impiega un po' a
// trasformare una diretta in un video. Scelto, non misurato.
export const ORE_DOPO_LA_FINE = 2;

// Quante sonde per giro: un tetto perché un giro non diventi una raffica.
export const SONDE_PER_GIRO = 20;

const MS_ATTESA = 8000;

export function esitoDaRispostaOembed(stato: number): EsitoRegistrazione {
  if (stato === 200) return "disponibile";
  if (stato === 401) return "non_incorporabile";
  if (stato === 403 || stato === 404) return "non_trovata";
  return "non_controllato";
}

export function urlOembed(idVideo: string): string {
  const video = `https://www.youtube.com/watch?v=${idVideo}`;
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(video)}&format=json`;
}

type Candidato = { id: string; data_inizio: string; data_fine: string | null; diretta_chiusa_il: string | null; youtube_video_id: string };

// Un evento va sondato quando la diretta è finita da almeno ORE_DOPO_LA_FINE
// (la fine EFFETTIVA: una diretta chiusa in anticipo è finita prima).
export function daSondare(e: Candidato, adesso: Date): boolean {
  const fine = new Date(fineEffettiva(e.data_inizio, e.data_fine, e.diretta_chiusa_il)).getTime();
  return adesso.getTime() - fine >= ORE_DOPO_LA_FINE * 3600_000;
}

export type EsitoGiroSonda = {
  letti: number | null;
  // Quante richieste a YouTube: una per video distinto, non per evento.
  richieste: number;
  sondati: { id: string; esito: EsitoRegistrazione }[];
  guasti: { passo: "lettura" | "scrittura"; dettaglio: string }[];
};

// SOLO CON LA SERVICE ROLE: l'esito non lo scrive il client (20261122100000 non
// lo concede), quindi il tipo del parametro è il client della service role, e la
// guardia del registro delle colonne lo riconosce da qui.
type ClientServiceRole = ReturnType<typeof createServiceRoleClient>;

export async function giroSondaRegistrazioni(
  supabase: ClientServiceRole,
  chiedi: (url: string, init: { signal: AbortSignal }) => Promise<{ status: number }>,
  adesso: Date,
): Promise<EsitoGiroSonda> {
  const esito: EsitoGiroSonda = { letti: null, richieste: 0, sondati: [], guasti: [] };
  const { data, error } = await supabase
    .from("eventi")
    .select("id, data_inizio, data_fine, diretta_chiusa_il, youtube_video_id")
    .eq("tipo", "webinar")
    .eq("stato", "approvato")
    .not("youtube_video_id", "is", null)
    .or("registrazione_esito.is.null,registrazione_esito.eq.non_controllato")
    .lt("data_inizio", adesso.toISOString())
    .order("data_inizio", { ascending: false })
    .limit(SONDE_PER_GIRO * 5);
  if (error || !data) {
    esito.guasti.push({ passo: "lettura", dettaglio: error ? descriviErrore(error) : "nessun dato" });
    return esito;
  }
  esito.letti = data.length;
  const candidati = (data as Candidato[]).filter((e) => daSondare(e, adesso)).slice(0, SONDE_PER_GIRO);

  // UNA RICHIESTA PER VIDEO, NON PER EVENTO (31/10): il primo giro vero ne ha
  // fatte 13 per 6 video distinti (eventi di prova che riusano lo stesso
  // video). La risposta di YouTube è sul video, quindi vale per ogni evento che
  // lo usa; la scrittura resta una per evento, ognuna contata.
  const perVideo = new Map<string, EsitoRegistrazione>();
  for (const e of candidati) {
    let risposta = perVideo.get(e.youtube_video_id);
    if (risposta === undefined) {
      risposta = "non_controllato";
      const controllo = new AbortController();
      const timer = setTimeout(() => controllo.abort(), MS_ATTESA);
      try {
        const r = await chiedi(urlOembed(e.youtube_video_id), { signal: controllo.signal });
        risposta = esitoDaRispostaOembed(r.status);
      } catch {
        risposta = "non_controllato";
      } finally {
        clearTimeout(timer);
      }
      perVideo.set(e.youtube_video_id, risposta);
    }
    const { data: scritte, error: erroreScrittura } = await supabase
      .from("eventi")
      .update({ registrazione_esito: risposta, registrazione_sondata_il: adesso.toISOString() })
      .eq("id", e.id)
      .select("id");
    if (erroreScrittura || !scritte || scritte.length === 0) {
      esito.guasti.push({ passo: "scrittura", dettaglio: erroreScrittura ? descriviErrore(erroreScrittura) : `nessuna riga per ${e.id}` });
      continue;
    }
    esito.sondati.push({ id: e.id, esito: risposta });
  }
  esito.richieste = perVideo.size;
  return esito;
}

// Fra due risonde dello stesso evento: la route è aperta (la pagina è aperta),
// quindi senza una pausa chiunque potrebbe farci interrogare YouTube a raffica.
// Scelto, non misurato.
export const MINUTI_TRA_RISONDE = 10;

export type EsitoRisonda =
  | { stato: "non_serve" } // non è un evento rivedibile, o è stato risondato da poco
  | { stato: "non_controllato" } // YouTube non ha risposto: l'esito di prima resta
  | { stato: "scritto"; esito: EsitoRegistrazione }
  | { stato: "guasto"; dettaglio: string };

// Una risonda su richiesta della pagina, per UN evento. Solo su un evento
// segnato disponibile (è il bottone acceso che può mentire), e mai più spesso
// di MINUTI_TRA_RISONDE. Un «non controllato» NON si scrive: un nostro guasto di
// rete non deve spegnere il bottone di tutti; resta l'esito di prima.
export async function risondaUnEvento(
  supabase: ClientServiceRole,
  chiedi: (url: string, init: { signal: AbortSignal }) => Promise<{ status: number }>,
  eventoId: string,
  adesso: Date,
): Promise<EsitoRisonda> {
  const { data: e, error } = await supabase
    .from("eventi")
    .select("id, tipo, stato, youtube_video_id, registrazione_esito, registrazione_sondata_il")
    .eq("id", eventoId)
    .maybeSingle();
  if (error) return { stato: "guasto", dettaglio: descriviErrore(error) };
  if (!e || e.tipo !== "webinar" || e.stato !== "approvato" || !e.youtube_video_id || e.registrazione_esito !== "disponibile") {
    return { stato: "non_serve" };
  }
  const ultima = e.registrazione_sondata_il ? new Date(e.registrazione_sondata_il as string).getTime() : 0;
  if (adesso.getTime() - ultima < MINUTI_TRA_RISONDE * 60_000) return { stato: "non_serve" };

  let risposta: EsitoRegistrazione = "non_controllato";
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), MS_ATTESA);
  try {
    const r = await chiedi(urlOembed(e.youtube_video_id as string), { signal: controllo.signal });
    risposta = esitoDaRispostaOembed(r.status);
  } catch {
    risposta = "non_controllato";
  } finally {
    clearTimeout(timer);
  }
  if (risposta === "non_controllato") return { stato: "non_controllato" };

  const { data: scritte, error: erroreScrittura } = await supabase
    .from("eventi")
    .update({ registrazione_esito: risposta, registrazione_sondata_il: adesso.toISOString() })
    .eq("id", eventoId)
    .select("id");
  if (erroreScrittura || !scritte || scritte.length === 0) {
    return { stato: "guasto", dettaglio: erroreScrittura ? descriviErrore(erroreScrittura) : `nessuna riga per ${eventoId}` };
  }
  return { stato: "scritto", esito: risposta };
}
