import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AREA_PROTETTA = "/app";

// Aggiorna la sessione ad ogni richiesta e protegge le route sotto /app:
// senza utente autenticato reindirizza a /accedi, preservando la pagina di
// destinazione originale in redirectedFrom.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
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

  if (!user && request.nextUrl.pathname.startsWith(AREA_PROTETTA)) {
    const url = request.nextUrl.clone();
    url.pathname = "/accedi";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
