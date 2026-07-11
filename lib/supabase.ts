import { createClient } from "@supabase/supabase-js";

// Client Supabase lato browser, con la chiave pubblica "publishable"
// (sicura da esporre al client: le tabelle sono protette da Row Level
// Security, non dalla segretezza di questa chiave).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
