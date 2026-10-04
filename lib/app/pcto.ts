import type { SupabaseClient } from "@supabase/supabase-js";
import { formattaNumero } from "@/lib/formato";
import { getOrePctoDaEventi } from "./eventi";

// Traguardo di default: nessuna scuola/convenzione lo personalizza ancora,
// va reso configurabile (es. su `conventions`) quando servirà davvero.
export const TRAGUARDO_ORE_PCTO = 90;

// ─────────────────────── LA FRASE DEL CONTATORE, UNA SOLA ───────────────────
//
// «1 ore certificate su 90» — visto a schermo il 4/10, con un'ora sola. Il
// singolare non era gestito, e il difetto si vede SOLO sui numeri interi:
// `0,5 ore` è giusto, `1 ore` no.
//
// E LA STESSA FRASE AVEVA ALTRI DUE DIFETTI CHE NESSUNO HA MAI VISTO, perché
// nessuno studente ha ancora avuto ore frazionarie. Le colonne sono
// `numeric(5,1)` (`student_activities.ore_certificate`, `eventi.ore_pcto`),
// quindi un decimale è possibile — e la somma la fa JavaScript:
//
//   • il SEPARATORE: `{ore}` grezzo in JSX stampa `0.5` con il punto, in una
//     pagina in italiano. Non è una chiamata `toLocale*`, quindi la guardia di
//     `npm run test:date` non lo vede: lì il difetto è l'ASSENZA di una
//     formattazione, non una formattazione sbagliata.
//   • il RUMORE della virgola mobile: `1,1 + 2,2` in JS fa
//     `3.3000000000000003`, e sono esattamente i valori che una colonna a un
//     decimale produce. A schermo sarebbe arrivato così.
//
// Il separatore lo chiude `formattaNumero`, che esisteva già: non c'era da
// scrivere niente, c'era da usare quello che c'è.
//
// ⚠️ L'ARROTONDAMENTO ESPLICITO NON È RIDONDANTE CON LUI, e la controprova lo
// dice meglio di come lo direbbe un ragionamento. `formattaNumero` arrotonda
// per mostrare — `toLocaleString` taglia a tre decimali — e quell'arrotondamento
// è INVISIBILE a chi decide il singolare: togliendo questa riga e lasciando il
// formattatore, `0,9999999999` si stampa «1» e la frase torna a dire **«1 ore
// certificate»**, cioè il difetto del 4/10 ricreato dalla cura che doveva
// chiuderlo. Quindi si arrotonda PRIMA, una volta, e il numero che il singolare
// guarda è lo stesso che finisce a schermo.
//
// È UN VALORE e non un ternario dentro il JSX, per la ragione di casa: una
// frase composta in un `.tsx` non si può provare da uno script Node, e una
// proprietà dichiarata e non provata è un test che non c'è ancora. Le due
// superfici che la mostrano (la card della home e `/app/attivita`) la
// CHIAMANO: `npm run test:ore` pretende che nessun `.tsx` se la riscriva, così
// la terza copia non nasce domani.
export function testoOreCertificate(ore: number): string {
  // Un decimale, la precisione vera delle colonne.
  const mostrate = Math.round(ore * 10) / 10;
  const unita = mostrate === 1 ? "ora certificata" : "ore certificate";
  return `${formattaNumero(mostrate)} ${unita} su ${formattaNumero(TRAGUARDO_ORE_PCTO)}`;
}

// Ore certificate da due fonti legittimamente distinte, sommate: attività
// scolastiche certificate (student_activities, pipeline lato scuola/PCTO
// tradizionale) ed eventi KIREO/istituzioni a cui lo studente ha
// partecipato (iscrizioni_eventi con stato "partecipato", vedi
// lib/app/eventi.ts). Condivisa da Home e "Le mie attività".
export async function getOreCertificate(supabase: SupabaseClient, userId: string): Promise<number> {
  const [{ data }, oreEventi] = await Promise.all([
    supabase.from("student_activities").select("ore_certificate").eq("student_id", userId),
    getOrePctoDaEventi(supabase, userId),
  ]);
  const oreAttivita = (data ?? []).reduce((totale, riga) => totale + Number(riga.ore_certificate ?? 0), 0);
  return oreAttivita + oreEventi;
}
