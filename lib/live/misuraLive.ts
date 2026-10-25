// Le MISURE della diretta: righe in `guasti` che non dicono che qualcosa si è
// rotto, dicono quante volte una cosa che non osserviamo direttamente è
// successa. Due chiamanti, e un posto solo perché le due route si comportino
// allo stesso modo su iscrizione, sessione e `di_prova` (due copie
// divergerebbero, ed è già successo ad altre due route gemelle).
//
//   misura_avvio_video   lo script di YouTube non si è caricato (18/10)
//   misura_fine_video    il player ha detto «finito» (25/10)
//
// Solo server: usa il client cookie-based e `registraGuasto`.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registraGuasto, type SpecieGuasto } from "@/lib/guasti/registra";
import { descriviErrore } from "@/lib/erroreSupabase";

export async function registraMisuraLive(
  request: NextRequest,
  misura: {
    processo: string;
    specie: SpecieGuasto;
    motivo: string;
    /** Riceve l'evento letto (null se non leggibile) e compone il dettaglio. */
    dettaglio: (eventoId: string, evento: { data_fine: string | null } | null) => string;
  },
) {
  let body: { eventoId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof body.eventoId !== "string" || !body.eventoId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const eventoId = body.eventoId;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    // La propria iscrizione (policy `select_own`): chi non è iscritto non ha
    // una pagina della diretta da cui arrivare qui, quindi non si conta.
    const { data: iscrizione } = await supabase
      .from("iscrizioni_eventi")
      .select("evento_id")
      .eq("evento_id", eventoId)
      .eq("student_id", user.id)
      .maybeSingle();
    if (!iscrizione) return NextResponse.json({ ok: false, motivo: "non_iscritto" });

    // Il flag lo passa il chiamante, mai dedotto: una misura che non distingue
    // il robot dagli studenti veri è una misura che mente.
    const [{ data: profilo }, { data: evento }] = await Promise.all([
      supabase.from("profiles").select("di_prova").eq("id", user.id).maybeSingle(),
      supabase.from("eventi").select("data_fine").eq("id", eventoId).maybeSingle(),
    ]);

    await registraGuasto({
      processo: misura.processo,
      specie: misura.specie,
      motivo: misura.motivo,
      dettaglio: misura.dettaglio(eventoId, evento ?? null),
      diProva: profilo?.di_prova === true,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`${misura.processo}: registrazione non riuscita: ${descriviErrore(e)}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
