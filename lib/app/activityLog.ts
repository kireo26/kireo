import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";

// Stesso valori descritti nella migration activity_log: unica fonte di
// verità lato client per non disperdere i "numeri magici" nei punti di
// chiamata.
//
// DUE VALORI CON LO STESSO PESO, E SONO DUE FATTI DIVERSI (dal 2026-09-29):
//   · workshop_pcto    — presenza certificata su un EVENTO di tipo 'workshop'.
//                        Le ore PCTO esistono davvero: le scrive la stessa
//                        transazione che certifica, con chi ha certificato.
//   · workshop_progetto — un progetto workshop KIREO portato a termine. Nessuna
//                        ora: non c'è un monte ore e non c'è nessuno che
//                        certifichi, l'ha giudicato un'AI.
// Li scrivono solo funzioni SQL (certifica_presenza / chiudi_diretta_evento e
// avanza_fase_workshop): nessun punto di chiamata client passa di qui per
// loro, e il peso resta 25 per entrambi perché la scala dell'esplorazione non
// c'entra con la distinzione — a cambiare è cosa la riga DICE, non quanto vale.
// Stanno tutti e due in questa mappa perché è lei a produrre `TipoAttivita`, e
// quindi a costringere il compilatore a pretendere l'etichetta di ognuno.
export const PESI_ATTIVITA = {
  visita_area: 1,
  lettura_articolo: 2,
  chat_assistente: 3,
  download_guida: 5,
  iscrizione_webinar: 8,
  partecipazione_webinar: 15,
  workshop_pcto: 25,
  workshop_progetto: 25,
} as const;

export type TipoAttivita = keyof typeof PESI_ATTIVITA;

export type LivelloGuida = 1 | 2 | 3;

// Peso per livello di guida (solo per tipo_attivita='download_guida'): la
// Panoramica è leggera, «Come partire davvero» è il segnale più forte. Tenuto
// separato e prudente — aprire tutte e tre in un giorno = 2+3+5 = 10, sotto una
// partecipazione a webinar (15). Sostituisce il peso unico 5 per le guide.
export const PESO_GUIDA: Record<LivelloGuida, number> = { 1: 2, 2: 3, 3: 5 };

// I quattro tipi che il BROWSER registra (dal 10/11). Gli altri li scrive il
// server: `download_guida` la route che serve la guida (lib/guide/apertura.ts),
// i tipi di presenza e di workshop le funzioni che certificano. Il peso lo
// decide `registra_attivita` nel database, con gli stessi numeri di
// PESI_ATTIVITA (`npm run test:registroattivita` li confronta): chi chiama
// sceglie solo l'area e il tipo, fra questi quattro.
export type TipoAttivitaDalBrowser = "visita_area" | "lettura_articolo" | "chat_assistente" | "iscrizione_webinar";

// Registra un'attività di esplorazione per area. Va chiamata solo da
// componenti client: usa il client Supabase del browser.
//
// ⚠️ activity_log è un CONTEGGIO (il radar, lo storico), non un titolo di
// accesso: nessun cancello lo legge per decidere (Mario, 10/11; sorvegliato da
// `npm run test:registroattivita`). Dal 10/11 il browser non ci inserisce più
// righe: chiama `registra_attivita`, che accetta solo questi quattro tipi.
//
// Il tetto di una riga al giorno lo tiene il database (`gia_oggi`). Un errore
// qui non disturba l'esperienza (è un conteggio in background), ma non si
// butta: va nel log del browser.
export async function registraAttivita(areaSlug: string, tipo: TipoAttivitaDalBrowser): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return; // visitatore anonimo: nessuna attività da registrare
    const { error } = await supabase.rpc("registra_attivita", { p_area: areaSlug, p_tipo: tipo });
    if (error) console.error("[attività] non registrata:", tipo, areaSlug, descriviErrore(error));
  } catch (errore) {
    console.error("[attività] non registrata:", tipo, areaSlug, errore);
  }
}
