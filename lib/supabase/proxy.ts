import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AREA_PROTETTA = "/app";

function redirectAccedi(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/accedi";
  url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Aggiorna la sessione ad ogni richiesta e protegge le route sotto /app:
// senza utente autenticato reindirizza a /accedi, preservando la pagina di
// destinazione originale in redirectedFrom.
//
// Il matcher in proxy.ts intercetta praticamente ogni pagina del sito, non
// solo /app: questa funzione non deve mai lanciare, altrimenti un problema
// di configurazione o di rete verso Supabase abbatterebbe l'intero sito
// invece della sola area protetta. Se le credenziali mancano o la verifica
// fallisce, le route pubbliche passano comunque (fail-open), quelle sotto
// /app negano l'accesso per sicurezza (fail-closed).
export async function updateSession(request: NextRequest) {
  const isProtetta = request.nextUrl.pathname.startsWith(AREA_PROTETTA);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase non configurato: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY mancanti.");
    return isProtetta ? redirectAccedi(request) : NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    });

    // getUser() rivalida il token con il server Supabase (a differenza di
    // getSession(), che si fida del solo cookie locale): è la scelta corretta
    // per una decisione di autorizzazione nel middleware.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && isProtetta) {
      return redirectAccedi(request);
    }

    return supabaseResponse;
  } catch (error) {
    console.error("Errore middleware Supabase:", error);
    return isProtetta ? redirectAccedi(request) : NextResponse.next();
  }
}
