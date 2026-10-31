import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { registraGuasto } from "@/lib/guasti/registra";
import { risondaUnEvento } from "@/lib/eventi/sondaRegistrazione";
import { descriviErrore } from "@/lib/erroreSupabase";

// La pagina «rivedi» chiama qui quando il video non parte (Mario, 31/10). Il
// corpo della richiesta non dice niente, apposta: il browser CHIEDE di
// ricontrollare, non dichiara cosa ha visto. Decide `risondaUnEvento`, che
// rifà la sonda vera su YouTube e scrive solo un esito definitivo. Aperta come
// la pagina; la pausa fra due risonde dello stesso evento la tiene la funzione.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROCESSO = "eventi/risonda";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ stato: "non_serve" }, { status: 400 });

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    console.error(`[${PROCESSO}] configurazione:`, descriviErrore(e));
    await registraGuasto({ processo: PROCESSO, specie: "configurazione", dettaglio: e });
    return NextResponse.json({ errore: "Configurazione mancante." }, { status: 500 });
  }

  const esito = await risondaUnEvento(supabase, (url, init) => fetch(url, init), id, new Date());
  if (esito.stato === "guasto") {
    console.error(`[${PROCESSO}] ${id}: ${esito.dettaglio}`);
    await registraGuasto({ processo: PROCESSO, specie: "sonda_registrazione", motivo: "risonda", dettaglio: esito.dettaglio });
    return NextResponse.json({ stato: "guasto" }, { status: 500 });
  }
  return NextResponse.json(esito);
}
