import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erroreRevoca, messaggioRevoca } from "@/lib/admin/revocaArea";
import { avvisaEnteDellaDecisione } from "@/lib/ente/avvisoDecisione";
import { descriviErrore } from "@/lib/erroreSupabase";

// La revoca di un'area (31/10) e l'avviso all'ente nella stessa richiesta,
// come /api/admin/decisione: prima la revoca con la sessione dell'admin
// (`revoca_area_ente` guarda il ruolo), poi l'email dal server, che rilegge
// dal database cosa è stato tolto e perché.
export async function POST(request: NextRequest) {
  let corpo: { istituzioneId?: unknown; areaSlug?: unknown; motivo?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });
  }
  const istituzioneId = typeof corpo.istituzioneId === "string" ? corpo.istituzioneId : null;
  const areaSlug = typeof corpo.areaSlug === "string" ? corpo.areaSlug : null;
  const motivo = typeof corpo.motivo === "string" ? corpo.motivo : "";
  if (!istituzioneId || !areaSlug) return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });
  const manca = erroreRevoca(motivo);
  if (manca) return NextResponse.json({ errore: manca }, { status: 400 });

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ errore: "Accesso richiesto." }, { status: 401 });
    const { data, error } = await supabase.rpc("revoca_area_ente", { p_istituzione_id: istituzioneId, p_area_slug: areaSlug, p_motivo: motivo });
    if (error) {
      if (/non_autorizzato|motivo_mancante|area_non_trovata/.test(error.message ?? "")) {
        return NextResponse.json({ errore: messaggioRevoca(error.message ?? "") }, { status: 409 });
      }
      throw error;
    }
    const id = (data as { id?: string } | null)?.id;
    if (!id) return NextResponse.json({ errore: messaggioRevoca("") }, { status: 409 });
    const avviso = await avvisaEnteDellaDecisione("area", id);
    return NextResponse.json({ ok: true, emailInviata: avviso.esito === "inviata", esitoEmail: avviso.esito });
  } catch (e) {
    console.error("[admin/revoca-area]:", descriviErrore(e));
    return NextResponse.json({ errore: "Non è stato possibile togliere l'area. Riprova." }, { status: 500 });
  }
}
