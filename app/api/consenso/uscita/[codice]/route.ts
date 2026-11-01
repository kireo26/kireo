import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { descriviErrore } from "@/lib/erroreSupabase";

// Il ritiro del consenso alle comunicazioni di KIREO dal link di un'email
// (01/11, 20261126100000). Solo POST, dal bottone della pagina: aprire il link
// non ritira niente. Il codice dice di chi; la sessione non c'entra. La
// conferma la decide il database: «fatto» solo se la funzione ha toccato una
// riga.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params;
  const pagina = new URL(`/disiscrizione/consenso/${encodeURIComponent(codice)}`, request.url);

  if (!UUID.test(codice)) return NextResponse.redirect(pagina, 303);

  try {
    // Con la service role: la funzione la esegue solo il server, e dalla
    // richiesta arriva solo il codice, che la funzione ricontrolla.
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("ritira_consenso_kireo_con_codice", { p_codice: codice });
    if (error) throw error;
    if (data === true) pagina.searchParams.set("esito", "fatto");
    return NextResponse.redirect(pagina, 303);
  } catch (e) {
    console.error("[comunicazioni/uscita]:", descriviErrore(e));
    pagina.searchParams.set("esito", "errore");
    return NextResponse.redirect(pagina, 303);
  }
}
