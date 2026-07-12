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

// Registra un'attività di esplorazione per area. Va chiamata solo da
// componenti client (pagine pubbliche statiche incluse): usa il client
// Supabase del browser, mai una chiamata server-side.
//
// Il cap di una riga al giorno per (studente, area, tipo) è un vincolo DB
// vero (indice unico sull'espressione data in activity_log): una
// violazione (23505) qui significa "già registrato oggi", non un errore —
// va ignorata in silenzio. Stesso trattamento per qualunque altro errore
// (inclusa la tabella non ancora migrata): è telemetria in background, mai
// qualcosa che deve interrompere o disturbare l'esperienza dello studente.
export async function registraAttivita(areaSlug: string, tipo: TipoAttivita): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return; // visitatore anonimo: nessuna attività da registrare

    await supabase.from("activity_log").insert({
      student_id: session.user.id,
      area_slug: areaSlug,
      tipo_attivita: tipo,
      peso: PESI_ATTIVITA[tipo],
    });
  } catch {
    // telemetria in background: nessun errore deve risalire al chiamante
  }
}
