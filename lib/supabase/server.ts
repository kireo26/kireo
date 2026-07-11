import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase per Server Component e Route Handler: legge/scrive la
// sessione tramite i cookie della richiesta. Va creato una volta per ogni
// richiesta (mai riusato tra richieste diverse).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: se il middleware aggiorna già
          // la sessione ad ogni richiesta, questo può essere ignorato.
        }
      },
    },
  });
}
