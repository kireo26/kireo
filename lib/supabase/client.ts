import { createBrowserClient } from "@supabase/ssr";

// Client Supabase per i Client Component (form, pulsanti interattivi).
// Chiave pubblica "publishable": sicura da esporre al browser, le tabelle
// sono protette da Row Level Security, non dalla segretezza della chiave.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
