import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { avvisaEnteDellaDecisione, type CosaDecisa } from "@/lib/ente/avvisoDecisione";
import { descriviErrore } from "@/lib/erroreSupabase";

// Riprova l'email all'ente su una decisione già presa (30/10). Non decide
// niente: rilegge stato e nota dal database e rimanda l'avviso, scrivendo una
// riga nuova in `avvisi_email_enti`. Una decisione cambiata nel frattempo la
// dice com'è adesso, non com'era.
export async function POST(request: NextRequest) {
  let corpo: { cosa?: unknown; id?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });
  }
  const cosa = corpo.cosa === "evento" || corpo.cosa === "newsletter" ? (corpo.cosa as CosaDecisa) : null;
  const id = typeof corpo.id === "string" ? corpo.id : null;
  if (!cosa || !id) return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ errore: "Accesso richiesto." }, { status: 401 });
    const { data: profilo, error: errProfilo } = await supabase.from("profiles").select("ruolo").eq("id", auth.user.id).maybeSingle();
    if (errProfilo) throw errProfilo;
    if (profilo?.ruolo !== "admin") return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 });
    const avviso = await avvisaEnteDellaDecisione(cosa, id);
    return NextResponse.json({ ok: true, emailInviata: avviso.esito === "inviata", esitoEmail: avviso.esito });
  } catch (e) {
    console.error("[admin/riprova-avviso]:", descriviErrore(e));
    return NextResponse.json({ errore: "Non è stato possibile riprovare." }, { status: 500 });
  }
}
