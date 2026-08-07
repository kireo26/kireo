import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client con la service role key: bypassa la RLS, usato SOLO dal cron del
// motore workshop (nessuna sessione studente da cui autenticarsi — il
// cron non ha nessuno loggato quando scatta). Mai importato da codice che
// gira nel browser o in una route raggiungibile da una richiesta non
// autenticata come "sistema" (vedi il controllo CRON_SECRET nella route
// che lo usa). SUPABASE_SERVICE_ROLE_KEY è una variabile d'ambiente nuova
// per il progetto: da configurare su Vercel (valore preso da Supabase →
// Project Settings → API → service_role secret), mai esposta con prefisso
// NEXT_PUBLIC_.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL non configurate.");
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
