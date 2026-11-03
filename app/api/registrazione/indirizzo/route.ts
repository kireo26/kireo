import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { descriviErrore } from "@/lib/erroreSupabase";

// LA REGISTRAZIONE CHIEDE SE UN INDIRIZZO È DI UNA LAPIDE (03/11).
// Dalla richiesta arriva solo l'indirizzo, e alla funzione vanno solo quello e
// un'impronta della rete: la regola della service role (lib/supabase/serviceRole.ts).
// La funzione non è eseguibile dal client, perché `test:guardie` vuole chiuso
// ad `anon` tutto quello che il browser chiama con `rpc`.
//
// IL TETTO (Mario, 03/11): «lo stesso dei codici invito tutor». La route dice
// se un indirizzo apparteneva a un account cancellato che aveva firmato
// qualcosa; senza un limite si poteva provare un elenco di indirizzi. Ora
// `controlla_indirizzo_registrazione` conta le domande per rete, 10 in un'ora,
// nella stessa tabella dei codici d'invito (chiave 'registrazione:<sha256>').
// L'impronta è uno sha256 dell'indirizzo di rete, non l'indirizzo: la riga
// vive un giorno e serve a contare, non a sapere chi. A tetto pieno risponde
// 429, e la registrazione prosegue senza la domanda (vedi
// lib/auth/indirizzoCancellato.ts): se l'indirizzo era di una lapide la ferma
// il trigger.
function impronta(req: Request): string {
  const inoltrato = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rete = inoltrato || req.headers.get("x-real-ip") || "sconosciuta";
  return createHash("sha256").update(`registrazione-indirizzo:${rete}`).digest("hex");
}

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
  const { data, error } = await supabase.rpc("controlla_indirizzo_registrazione", { p_email: email, p_impronta: impronta(req) });
  const esito = data && typeof data === "object" ? (data as { esito?: unknown }).esito : undefined;
  if (error || (esito !== "cancellato" && esito !== "libero" && esito !== "troppi_tentativi")) {
    console.error("[registrazione indirizzo] controlla_indirizzo_registrazione:", descriviErrore(error));
    return NextResponse.json({ errore: "non_controllato" }, { status: 500 });
  }
  if (esito === "troppi_tentativi") return NextResponse.json({ errore: "troppi_tentativi" }, { status: 429 });
  return NextResponse.json({ cancellato: esito === "cancellato" });
}
