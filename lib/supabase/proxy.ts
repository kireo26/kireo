import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AREE_PROTETTE = ["/app", "/ente", "/admin", "/scuola"];

function redirectAccedi(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/accedi";
  url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Aggiorna la sessione ad ogni richiesta e protegge le route sotto /app,
// /ente, /admin e /scuola: senza utente autenticato reindirizza a /accedi,
// preservando la pagina di destinazione originale in redirectedFrom. Il
// controllo del ruolo esatto (studente/istituzione/admin) resta comunque a
// carico di ogni area (getAppContext/getEnteContext/requireAdmin) e delle
// RLS: qui si verifica solo che ci sia una sessione, non chi sia.
//
// Il matcher in proxy.ts intercetta praticamente ogni pagina del sito, non
// solo queste aree: questa funzione non deve mai lanciare, altrimenti un
// problema di configurazione o di rete verso Supabase abbatterebbe l'intero
// sito invece della sola area protetta. Se le credenziali mancano o la
// verifica fallisce, le route pubbliche passano comunque (fail-open),
// quelle protette negano l'accesso per sicurezza (fail-closed).
export async function updateSession(request: NextRequest) {
  // /scuola/invito resta pubblica sotto /scuola: un tutor invitato non ha
  // ancora un account quando vi accede per la prima volta (deve poterla
  // raggiungere per registrarsi).
  const isProtetta =
    request.nextUrl.pathname !== "/scuola/invito" &&
    AREE_PROTETTE.some((area) => request.nextUrl.pathname.startsWith(area));
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
