import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client con la service role key: bypassa la RLS. ⚠️ Fino al 29/10 questo
// commento diceva «usato SOLO dal cron del motore workshop»: non era vero da
// settimane (i guasti, il conto dell'intelligenza artificiale, il contatore
// della guardia della lingua lo usano da route raggiungibili da uno studente,
// e i guasti anche senza accesso). La regola vera, che i chiamanti rispettano:
// con questo client si chiamano solo funzioni o tabelle FISSE, scelte qui nel
// codice, e da una richiesta arrivano al più valori che la funzione
// ricontrolla (un id). Mai una query costruita da quello che manda chi chiama.
// Chi lo usa oggi: il cron del motore workshop, `lib/guasti/registra.ts`,
// `lib/ai/consumo.ts`, `lib/lingua/contatoreGuardia.ts`,
// `lib/guide/contatoreScaricamenti.ts`, il cron della newsletter, l'uscita dalla
// newsletter dalla posta (`/api/newsletter/uscita/[codice]` e la sua pagina:
// dalla richiesta arriva solo il codice) e l'avviso all'ente
// (`lib/ente/avvisoDecisione.ts`, che rilegge la decisione). Mai importato da codice che gira nel
// browser. SUPABASE_SERVICE_ROLE_KEY sta su Vercel (Supabase → Project
// Settings → API → service_role secret), mai con prefisso NEXT_PUBLIC_.
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
