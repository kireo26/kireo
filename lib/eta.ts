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
