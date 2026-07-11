import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Esclude gli asset statici e le immagini: non serve rinfrescare la
    // sessione o valutare la protezione delle route per queste richieste.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|data/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
