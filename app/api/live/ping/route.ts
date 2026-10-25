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
    // ⚠️ 25/10: la sessione persa durante una diretta. Il client ora lo dice
    // allo studente; qui si lascia una riga, perché è il caso che il 25/10 ha
    // fermato i battiti di due account e nessuno lo sapeva.
    console.error("live/ping: battito senza sessione", body.eventoId);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { error } = await supabase.rpc("ping_presenza_live", { p_evento_id: body.eventoId });

  if (error) {
    // Gli esiti attesi (non_iscritto, evento_non_in_corso) restano muti; ogni
    // altro rifiuto si scrive — fino al 25/10 nessun battito respinto lasciava
    // traccia, e un conteggio fermo non si poteva spiegare.
    if (!/non_iscritto|evento_non_in_corso/.test(error.message ?? "")) {
      console.error("live/ping: battito rifiutato", error.message, error.code, error.details);
    }
    return NextResponse.json({ ok: false, motivo: error.message }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
