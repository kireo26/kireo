import { createClient } from "@/lib/supabase/client";

// Stesso valori descritti nella migration activity_log: unica fonte di
// verità lato client per non disperdere i "numeri magici" nei punti di
// chiamata.
export const PESI_ATTIVITA = {
  visita_area: 1,
  lettura_articolo: 2,
  chat_assistente: 3,
  download_guida: 5,
  iscrizione_webinar: 8,
  partecipazione_webinar: 15,
  workshop_pcto: 25,
} as const;

export type TipoAttivita = keyof typeof PESI_ATTIVITA;

export type LivelloGuida = 1 | 2 | 3;

// Peso per livello di guida (solo per tipo_attivita='download_guida'): la
// Panoramica è leggera, «Come partire davvero» è il segnale più forte. Tenuto
// separato e prudente — aprire tutte e tre in un giorno = 2+3+5 = 10, sotto una
// partecipazione a webinar (15). Sostituisce il peso unico 5 per le guide.
export const PESO_GUIDA: Record<LivelloGuida, number> = { 1: 2, 2: 3, 3: 5 };

// Registra un'attività di esplorazione per area. Va chiamata solo da
// componenti client (pagine pubbliche statiche incluse): usa il client
// Supabase del browser, mai una chiamata server-side.
//
// `livello` (1/2/3) va passato SOLO per le guide (download_guida): distingue
// quale guida è stata aperta e, col cap DB su coalesce(livello,0), fa sì che le
// tre guide di un'area producano tre righe/giorno invece di una. Per ogni altra
// attività resta null (una riga/giorno per studente+area+tipo, come prima).
//
// Il cap di una riga al giorno è un vincolo DB vero (indice unico sull'espressione
// data in activity_log): una violazione (23505) qui significa "già registrato
// oggi", non un errore — va ignorata in silenzio. Stesso trattamento per qualunque
// altro errore (inclusa la tabella/colonna non ancora migrata): è telemetria in
// background, mai qualcosa che deve interrompere o disturbare l'esperienza.
export async function registraAttivita(areaSlug: string, tipo: TipoAttivita, livello?: LivelloGuida): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return; // visitatore anonimo: nessuna attività da registrare

    const conLivello = tipo === "download_guida" && livello != null;
    await supabase.from("activity_log").insert({
      student_id: session.user.id,
      area_slug: areaSlug,
      tipo_attivita: tipo,
      peso: conLivello ? PESO_GUIDA[livello] : PESI_ATTIVITA[tipo],
      livello: conLivello ? livello : null,
    });
  } catch {
    // telemetria in background: nessun errore deve risalire al chiamante
  }
}
