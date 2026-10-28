// Dal 20261109100000 decide SOLO le comunicazioni facoltative (le newsletter
// degli enti e quelle di KIREO): condividere il profilo e scrivere a un ente
// sono aperti dai 14 anni. Per i consensi la regola è consenso_dato_da_maggiorenne
// (lib/app/comunicazioniKireo.ts), che guarda l'età di quando si è risposto.
//
// Specchio client-side di is_maggiorenne() (vedi
// supabase/migrations/20260727100000_age_gating.sql): usato SOLO per
// l'esperienza utente (mostrare/nascondere bottoni, testi). Il vero gate è
// sempre lato DB (RLS/funzioni SECURITY DEFINER) — nessuna decisione di
// sicurezza deve fidarsi solo di questa funzione. NULL/mancante = false
// (minorenne), stessa guardia conservativa.
export function isMaggiorenne(dataNascita: string | null | undefined): boolean {
  if (!dataNascita) return false;
  const nascita = new Date(dataNascita);
  const sogliaDiciottoAnniFa = new Date();
  sogliaDiciottoAnniFa.setFullYear(sogliaDiciottoAnniFa.getFullYear() - 18);
  return nascita <= sogliaDiciottoAnniFa;
}

// TRE STATI, NON DUE (28/10). `isMaggiorenne(null)` risponde «no», ed è giusto
// per un cancello; per una FRASE no: a chi non ha una data di nascita dire
// «KIREO non invia comunicazioni facoltative a chi ha meno di 18 anni» afferma
// un'età che non sappiamo. «Non lo so» non diventa né un sì né un no
// silenzioso: diventa una richiesta di dircelo.
export type StatoEta = "maggiorenne" | "minorenne" | "sconosciuta";

export function statoEta(dataNascita: string | null | undefined): StatoEta {
  if (!dataNascita) return "sconosciuta";
  return isMaggiorenne(dataNascita) ? "maggiorenne" : "minorenne";
}
