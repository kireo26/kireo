import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registraGuasto } from "@/lib/guasti/registra";
import { descriviErrore } from "@/lib/erroreSupabase";

// IL RIQUADRO SEMPLICE, CONTATO (decisione di Mario, 18/10). Quando lo script
// di YouTube non si carica il player torna all'iframe grezzo, e da lì non
// sappiamo se il video parte: la presenza non avanza e la pagina lo dice
// (`TESTO_RIPIEGO` in lib/live/presenza.ts). Questa route esiste per una ragione
// sola: sapere QUANTE VOLTE capita. Senza quel numero la decisione resterebbe
// questa per inerzia; con il numero si può ripensare.
//
// Una riga in `guasti` (specie `misura_avvio_video`) per caricamento di pagina
// che cade nel ripiego. Si scrive solo per chi è iscritto all'evento: la riga
// conta studenti veri davanti a una diretta, non richieste qualunque. È
// best-effort e lato client nessuno aspetta la risposta per dire niente.
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
    const { data: profilo } = await supabase.from("profiles").select("di_prova").eq("id", user.id).maybeSingle();

    await registraGuasto({
      processo: "live/ripiego",
      specie: "misura_avvio_video",
      motivo: "api_youtube_non_caricata",
      dettaglio: `evento ${eventoId}`,
      diProva: profilo?.di_prova === true,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`live/ripiego: registrazione non riuscita: ${descriviErrore(e)}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
