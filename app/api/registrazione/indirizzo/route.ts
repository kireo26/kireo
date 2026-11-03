import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { descriviErrore } from "@/lib/erroreSupabase";

// LA REGISTRAZIONE CHIEDE SE UN INDIRIZZO È DI UNA LAPIDE (03/11).
// Dalla richiesta arriva solo l'indirizzo, e alla funzione va solo quello: la
// regola della service role (lib/supabase/serviceRole.ts). La funzione non è
// eseguibile dal client, perché `test:guardie` vuole chiuso ad `anon` tutto
// quello che il browser chiama con `rpc`.
//
// ⚠️ Dice a chiunque se un indirizzo apparteneva a un account cancellato che
// aveva firmato qualcosa. Sono pochi indirizzi di staff scolastico, e la
// registrazione lo direbbe comunque al primo tentativo. Niente tetto, per ora:
// il fatto che lo farebbe costruire è un elenco di richieste a questa route
// molto più lungo delle registrazioni.

export async function POST(req: Request) {
  let email = "";
  try {
    const corpo = (await req.json()) as { email?: unknown };
    email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ errore: "corpo_non_valido" }, { status: 400 });
  }
  if (!email || email.length > 320) return NextResponse.json({ errore: "indirizzo_mancante" }, { status: 400 });

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    console.error("[registrazione indirizzo] service role non configurata:", descriviErrore(e));
    return NextResponse.json({ errore: "non_controllato" }, { status: 500 });
  }
  const { data, error } = await supabase.rpc("indirizzo_di_un_account_cancellato", { p_email: email });
  if (error || typeof data !== "boolean") {
    console.error("[registrazione indirizzo] indirizzo_di_un_account_cancellato:", descriviErrore(error));
    return NextResponse.json({ errore: "non_controllato" }, { status: 500 });
  }
  return NextResponse.json({ cancellato: data });
}
