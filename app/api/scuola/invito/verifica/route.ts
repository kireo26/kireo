import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { descriviErrore } from "@/lib/erroreSupabase";
import { codiceInvitoCompleto, leggiEsitoVerifica, normalizzaCodiceInvito } from "@/lib/scuola/codiceInvito";

// LA VERIFICA DEL CODICE D'INVITO, per chi non ha ancora un account (01/11).
//
// Prima la pagina chiamava `verifica_invito_tutor` dal browser, senza tetto, e
// la funzione diceva il nome della scuola a ogni codice giusto. Ora passa da qui:
// la route calcola un'impronta della rete di chi chiede e la passa a
// `controlla_codice_invito`, che conta i codici sbagliati (10 in un'ora). Dalla
// richiesta arriva solo il codice, e alla funzione va solo il codice e
// l'impronta: la regola della service role (lib/supabase/serviceRole.ts).
//
// L'impronta è uno sha256 dell'indirizzo, non l'indirizzo: la riga vive un
// giorno e serve a contare, non a sapere chi.
function impronta(req: Request): string {
  const inoltrato = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rete = inoltrato || req.headers.get("x-real-ip") || "sconosciuta";
  return createHash("sha256").update(`invito-tutor:${rete}`).digest("hex");
}

export async function POST(req: Request) {
  let codice = "";
  try {
    const corpo = (await req.json()) as { codice?: unknown };
    codice = typeof corpo.codice === "string" ? normalizzaCodiceInvito(corpo.codice) : "";
  } catch {
    return NextResponse.json({ esito: "non_valido" }, { status: 400 });
  }
  // Un codice a metà non si conta: è qualcuno che sta ancora scrivendo.
  if (!codiceInvitoCompleto(codice)) return NextResponse.json({ esito: "forma" }, { status: 400 });

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    console.error("[invito verifica] service role non configurata:", descriviErrore(e));
    return NextResponse.json({ esito: "non_controllato" }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("controlla_codice_invito", { p_codice: codice, p_impronta: impronta(req) });
  if (error) {
    console.error("[invito verifica] controlla_codice_invito:", descriviErrore(error));
    return NextResponse.json({ esito: "non_controllato" }, { status: 500 });
  }
  const esito = leggiEsitoVerifica(data);
  return NextResponse.json(esito, { status: esito.esito === "troppi_tentativi" ? 429 : 200 });
}
