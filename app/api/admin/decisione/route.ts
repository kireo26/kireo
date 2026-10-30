import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erroreRifiuto } from "@/lib/admin/rifiuto";
import { avvisaEnteDellaDecisione, type CosaDecisa } from "@/lib/ente/avvisoDecisione";
import { messaggioErroreNewsletter } from "@/lib/newsletter/regole";
import { descriviErrore } from "@/lib/erroreSupabase";

// La decisione dell'admin su un evento o una newsletter (30/10), e l'avviso
// all'ente nella stessa richiesta: prima la decisione con la sessione
// dell'admin (privilegi e policy sono quelli di sempre), poi l'email dal
// server. Fino al 30/10 l'approvazione di un evento era un update dal browser,
// e nessuno avvisava l'ente; un'email mandata dal browser dopo l'update si
// perderebbe chiudendo la scheda.
export async function POST(request: NextRequest) {
  let corpo: { cosa?: unknown; id?: unknown; approva?: unknown; nota?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });
  }
  const cosa = corpo.cosa === "evento" || corpo.cosa === "newsletter" ? (corpo.cosa as CosaDecisa) : null;
  const id = typeof corpo.id === "string" ? corpo.id : null;
  const approva = corpo.approva === true;
  const nota = typeof corpo.nota === "string" ? corpo.nota : "";
  if (!cosa || !id || typeof corpo.approva !== "boolean") {
    return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });
  }
  if (!approva) {
    const manca = erroreRifiuto(nota);
    if (manca) return NextResponse.json({ errore: manca }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ errore: "Accesso richiesto." }, { status: 401 });
    const { data: profilo, error: errProfilo } = await supabase.from("profiles").select("ruolo").eq("id", auth.user.id).maybeSingle();
    if (errProfilo) throw errProfilo;
    if (profilo?.ruolo !== "admin") return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 });

    if (cosa === "evento") {
      const { data, error } = await supabase
        .from("eventi")
        .update({ stato: approva ? "approvato" : "rifiutato", note_revisione: nota.trim() || null })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      // Zero righe è un rifiuto, non un «fatto» (il modo 11).
      if (!data || data.length !== 1) return NextResponse.json({ errore: "Evento non aggiornato: ricarica la pagina." }, { status: 409 });
    } else {
      const { error } = await supabase.rpc("decidi_newsletter", { p_id: id, p_approva: approva, p_nota: nota });
      if (error) {
        const messaggio = messaggioErroreNewsletter(error.message);
        if (/non_autorizzato|non_trovata|non_in_approvazione|motivo_mancante|giorno_passato/.test(error.message ?? "")) {
          return NextResponse.json({ errore: messaggio }, { status: 409 });
        }
        throw error;
      }
    }

    const avviso = await avvisaEnteDellaDecisione(cosa, id);
    return NextResponse.json({ ok: true, emailInviata: avviso.ok && avviso.inviate > 0 });
  } catch (e) {
    console.error("[admin/decisione]:", descriviErrore(e));
    return NextResponse.json({ errore: "Non è stato possibile aggiornare. Riprova." }, { status: 500 });
  }
}
