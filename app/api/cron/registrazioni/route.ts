import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { registraGuasto } from "@/lib/guasti/registra";
import { giroSondaRegistrazioni } from "@/lib/eventi/sondaRegistrazione";
import { descriviErrore } from "@/lib/erroreSupabase";

// La sonda delle registrazioni (31/10): una volta al giorno chiede a YouTube se
// le dirette finite hanno ancora un video che si incorpora, e lo scrive
// sull'evento (lib/eventi/sondaRegistrazione.ts). Protetta da CRON_SECRET come
// gli altri cron. Una route sua e non un passo di un altro cron: il motore dei
// workshop si ferma senza la chiave di Anthropic, e la newsletter lavora in
// un'ora sola; una sonda che non parte perché un altro lavoro non è partito
// sarebbe un silenzio.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PROCESSO = "cron/registrazioni";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    console.error(`[${PROCESSO}] configurazione:`, descriviErrore(e));
    await registraGuasto({ processo: PROCESSO, specie: "configurazione", dettaglio: e });
    return NextResponse.json({ errore: "Configurazione mancante." }, { status: 500 });
  }

  const esito = await giroSondaRegistrazioni(supabase, (url, init) => fetch(url, init), new Date());
  for (const g of esito.guasti) {
    console.error(`[${PROCESSO}] ${g.passo}: ${g.dettaglio}`);
    await registraGuasto({ processo: PROCESSO, specie: "sonda_registrazione", motivo: g.passo, dettaglio: g.dettaglio });
  }
  if (esito.letti === null) {
    console.error(`[${PROCESSO}] gli eventi da sondare non si sono letti: nessuna sonda in questo giro`);
    return NextResponse.json({ errore: "Non sono riuscito a leggere gli eventi da sondare." }, { status: 500 });
  }
  return NextResponse.json({ letti: esito.letti, sondati: esito.sondati, guasti: esito.guasti.length });
}
