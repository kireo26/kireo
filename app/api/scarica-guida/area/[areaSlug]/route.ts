import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { percorsoGuidaUno } from "@/lib/guide/config";
import { registraAperturaGuida } from "@/lib/guide/apertura";
import { SITE_URL } from "@/lib/site";
import { segnalaGuasto } from "@/lib/guasti/registra";
import { CAMPO_RITORNO, conEsito, destinatarioGuida, ritornoSicuro } from "@/lib/guide/scaricamento";
import { mandaEmailGuida } from "@/lib/guide/emailGuida";

// LA PANORAMICA DI UN'AREA, SCARICATA DAL SERVER (29/10). Il form della pagina
// dell'area (`GuidaAreaForm`) faceva `window.location.href = pdf` e poi, dietro
// un `await getSession()`, la riga in `activity_log`: misurato il 29/10, la
// riga arriva o no secondo quanto dura quella lettura (3 su 3 se immediata, 2
// su 3 a 5 ms, 0 su 3 a 30 ms). Qui la riga si scrive PRIMA di rimandare al
// file. Il perché, per tutte e due le guide, sta in `lib/guide/scaricamento.ts`.
//
// A differenza della guida di un ente, qui la traccia non decide il file: se la
// scrittura fallisce si registra il guasto e il file parte lo stesso — la
// Panoramica è aperta a tutti, e la traccia è il percorso dello studente, non
// un permesso.
//
// Il file lo decide `percorsoGuidaUno`, come in ogni altro punto che scarica la
// Guida 1: nessun ripiego scritto qui.
const PROCESSO = "scarica-guida-area";

export async function POST(request: Request, { params }: { params: Promise<{ areaSlug: string }> }) {
  const { areaSlug } = await params;
  const area = getAreaBySlug(areaSlug);
  const form = await request.formData().catch(() => null);
  const ritorno = ritornoSicuro(form?.get(CAMPO_RITORNO));
  if (!area) return NextResponse.redirect(new URL(conEsito(ritorno, "non_disponibile"), request.url), 303);

  let emailAccount: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      emailAccount = user.email ?? null;
      // Dal 10/11 la riga la scrive la service role, non la sessione: l'apertura
      // di una guida è il fatto che il cancello legge, e il browser non lo
      // scrive più (lib/guide/apertura.ts).
      await registraAperturaGuida(PROCESSO, user.id, area.slug, 1);
    }
  } catch (errore) {
    await segnalaGuasto(
      { processo: PROCESSO, specie: "traccia_guida", motivo: "sessione_non_letta", dettaglio: errore },
      "Errore [scarica-guida-area]: sessione non letta, la traccia non è stata scritta —",
    );
  }

  const destinatario = destinatarioGuida(emailAccount, form);
  if (!emailAccount && !destinatario) return NextResponse.redirect(new URL(conEsito(ritorno, "dati"), request.url), 303);

  const percorso = percorsoGuidaUno(area.slug);
  if (destinatario) {
    after(() => mandaEmailGuida(PROCESSO, destinatario, `Guida di orientamento — ${area.nome}`, `${SITE_URL}${percorso}`));
  }
  return NextResponse.redirect(new URL(percorso, request.url), 303);
}
