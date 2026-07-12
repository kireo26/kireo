import { NextResponse } from "next/server";

// Predisposto per il follow-up via email dopo il download di una guida
// (area o ente — vedi report finale della sessione per i dettagli): OGGI
// NON INVIA NESSUNA EMAIL REALE. Le "Email Templates" di Supabase coprono
// solo i flussi di Auth (conferma iscrizione, reset password) — non esiste
// nel progetto un invio email transazionale generico. Per attivarlo
// davvero serve un provider dedicato (es. Resend, Postmark) con una chiave
// API in env, non ancora configurato: questa route è il punto dove
// andrebbe collegata la chiamata reale.
export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  if (!corpo?.email || (!corpo?.areaSlug && !corpo?.istituzioneId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const contesto = corpo.areaSlug ? `area ${corpo.areaSlug}` : `istituzione ${corpo.istituzioneId}`;
  console.log(`[guida-email] Follow-up da inviare a ${corpo.email} per ${contesto} (invio email non ancora configurato).`);

  return NextResponse.json({ ok: true, inviata: false });
}
