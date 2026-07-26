import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Heartbeat di presenza per una diretta: la vera autorizzazione (utente
// iscritto, evento nella finestra della diretta) vive in
// ping_presenza_live (SECURITY DEFINER), qui si passa solo la sessione
// dell'utente autenticato. Un ping mancato/respinto non deve mai apparire
// come un errore bloccante al client (il prossimo tentativo tra 60s
// recupera): risposta 200/ok anche sugli esiti "attesi" (non_iscritto,
// evento_non_in_corso), solo un 401 se manca proprio la sessione.
export async function POST(request: NextRequest) {
  let body: { eventoId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (typeof body.eventoId !== "string" || !body.eventoId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { error } = await supabase.rpc("ping_presenza_live", { p_evento_id: body.eventoId });

  if (error) {
    return NextResponse.json({ ok: false, motivo: error.message }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
