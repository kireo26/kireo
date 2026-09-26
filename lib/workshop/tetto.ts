import type { SupabaseClient } from "@supabase/supabase-js";

// Il tetto dei workshop, letto dal lato TypeScript.
//
// LA DEFINIZIONE NON È QUI: è in SQL (migrazione 20260926100000), perché le
// iscrizioni si creano dal client e l'unico posto che non si aggira è il
// `with check` di una policy. Questo file non ricalcola niente — chiede. Il
// NUMERO stesso arriva da là (`tetto`), così non esiste una seconda versione
// del tetto che dice allo studente tre mentre il database gliene applica un
// altro.
//
// A COSA SERVE, visto che il database rifiuta comunque: un `with check` che
// nega arriva al client come «new row violates row-level security policy», e
// `IscrizioneRuolo` lo tradurrebbe in «Riprova» — un consiglio sbagliato, perché
// riprovare non serve a niente. Qui si risponde alla domanda vera: quale dei
// due muri è, e cosa si può fare.
//
// PERCHÉ IL PRIMO CASO DEVE NOMINARE UN POSTO. Il bottone per lasciare un
// workshop sta sulla pagina di QUEL workshop (`RitiroIscrizione`), quindi un no
// che dice solo «ne hai già uno attivo» manda a cercare. Per questo
// `stato_tetto_workshop()` restituisce anche slug, titolo e ruolo di quello
// attivo: il rifiuto porta dove si può agire.
//
// DEGRADA VERSO L'APERTO, al contrario del database (stessa scelta di
// `lib/percorso/cancelli.ts`): se la lettura fallisce si mostra la scelta del
// ruolo, lo studente prova, e se il tetto è davvero chiuso è il database a
// dirlo. Nascondere la scelta per un errore di rete direbbe a chi ha un posto
// libero che non ce l'ha, che è la bugia peggiore delle due.
//
// ⚠️ I testi sono voce: questi li ho scritti io e vanno riletti da Mario.

export type StatoTetto = {
  usate: number;
  tetto: number;
  puo: boolean;
  esente: boolean;
  attivoSlug: string | null;
  attivoTitolo: string | null;
  attivoRuolo: string | null;
};

export async function leggiTettoWorkshop(supabase: SupabaseClient): Promise<StatoTetto | null> {
  try {
    const { data, error } = await supabase.rpc("stato_tetto_workshop");
    if (error) {
      console.error("Errore lettura tetto workshop:", error.message ?? error);
      return null;
    }
    const r = Array.isArray(data) ? data[0] : data;
    if (!r) return null;
    return {
      usate: Number(r.usate) || 0,
      tetto: Number(r.tetto) || 0,
      puo: r.puo === true,
      esente: r.esente === true,
      attivoSlug: r.attivo_slug ?? null,
      attivoTitolo: r.attivo_titolo ?? null,
      attivoRuolo: r.attivo_ruolo ?? null,
    };
  } catch (errore) {
    console.error("Errore lettura tetto workshop (eccezione):", errore);
    return null;
  }
}

export type AvvisoTetto = { titolo: string; corpo: string; cta?: { testo: string; href: string } };

/**
 * Cosa legge chi non può cominciare un altro workshop. `null` = può, oppure non
 * l'abbiamo potuto leggere: in entrambi i casi si mostra la scelta del ruolo.
 */
export function avvisoTetto(stato: StatoTetto | null): AvvisoTetto | null {
  if (!stato || stato.puo) return null;

  // Uno alla volta. Il caso più frequente, ed è quello che ha una strada.
  if (stato.attivoSlug) {
    const quale = stato.attivoTitolo ?? "un altro workshop";
    const ruolo = stato.attivoRuolo ? ` nel ruolo ${stato.attivoRuolo}` : "";
    return {
      titolo: "Stai già lavorando a un workshop",
      corpo: `Sei dentro «${quale}»${ruolo}. Un workshop dura settimane e chiede di seguire un cliente fino in fondo: farne due insieme vuol dire farne male due. Finisci quello — oppure lascialo, e il lavoro che hai fatto resta lì dov'è.`,
      cta: { testo: `Vai a ${quale}`, href: `/app/workshop/${stato.attivoSlug}` },
    };
  }

  // Il tetto. Qui non c'è un passo da fare: si dice cosa c'è dopo.
  return {
    titolo: `Hai già fatto ${stato.usate} workshop`,
    corpo: `Sono i ${stato.tetto} che si possono fare: non è una punizione, è che un ritratto fatto di troppe cose non dice più da che parte stai andando. Quello che hai costruito resta tuo e lo rileggi quando vuoi.`,
    cta: { testo: "Rivedi i tuoi workshop", href: "/app/workshop" },
  };
}
