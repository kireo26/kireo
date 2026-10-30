import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { descriviErrore } from "@/lib/erroreSupabase";

// L'uscita da una newsletter senza aver fatto l'accesso (30/10). Solo POST:
// la pagina `/disiscrizione/newsletter/[codice]` NON disiscrive aprendosi,
// perché i filtri antispam aprono i link delle email da soli e toglierebbero
// l'iscrizione a chi non ha premuto niente. Due chiamanti:
//   * il bottone della pagina (un form): si torna alla pagina con l'esito;
//   * la POST di `List-Unsubscribe-Post` (RFC 8058) del client di posta, che
//     manda `List-Unsubscribe=One-Click`: si risponde 200 e basta.
// Il codice dice quale iscrizione e nient'altro.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params;
  const corpo = await request.text().catch(() => "");
  const unClic = /List-Unsubscribe=One-Click/i.test(corpo);
  const pagina = new URL(`/disiscrizione/newsletter/${encodeURIComponent(codice)}`, request.url);

  if (!UUID.test(codice)) {
    if (unClic) return NextResponse.json({ ok: false }, { status: 404 });
    pagina.searchParams.set("esito", "sconosciuto");
    return NextResponse.redirect(pagina, 303);
  }

  try {
    // Con la service role: la funzione la esegue solo il server, e dalla
    // richiesta arriva solo il codice, che la funzione ricontrolla.
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("esci_newsletter_con_codice", { p_codice: codice });
    if (error) throw error;
    if (unClic) return NextResponse.json({ ok: true });
    pagina.searchParams.set("esito", data === true ? "uscito" : "sconosciuto");
    return NextResponse.redirect(pagina, 303);
  } catch (e) {
    console.error("[newsletter/uscita]:", descriviErrore(e));
    if (unClic) return NextResponse.json({ ok: false }, { status: 500 });
    pagina.searchParams.set("esito", "errore");
    return NextResponse.redirect(pagina, 303);
  }
}
