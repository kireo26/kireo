import { NextResponse } from "next/server";
import { inviaEmail } from "@/lib/email/brevo";
import { templateFollowUpGuida } from "@/lib/email/templates";
import { getAreaBySlug } from "@/data/aree";
import { SITE_URL } from "@/lib/site";

// Follow-up via email dopo il download di una guida (area o ente): ora
// collegato per davvero al client Brevo condiviso (lib/email/brevo.ts),
// stesso usato dal form "Richiedi informazioni" delle landing del funnel
// scuole. Un fallimento nell'invio non deve mai risalire come errore al
// form chiamante (il download del PDF è già partito prima di questa
// chiamata, vedi GuidaAreaForm/GuidaEnteForm): risposta sempre 200 con
// `inviata` a indicare l'esito reale.
export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  if (!corpo?.email || (!corpo?.areaSlug && !corpo?.istituzioneId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const nomeDestinatario = typeof corpo.nome === "string" ? corpo.nome.trim() : "";

  let titoloGuida: string;
  let linkGuida: string;

  if (corpo.areaSlug) {
    const area = getAreaBySlug(corpo.areaSlug);
    if (!area) return NextResponse.json({ ok: false }, { status: 400 });
    titoloGuida = `Guida di orientamento — ${area.nome}`;
    linkGuida = `${SITE_URL}/api/guida/${area.slug}`;
  } else {
    if (typeof corpo.pdfUrl !== "string" || !corpo.pdfUrl) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const nomeIstituzione = typeof corpo.istituzioneNome === "string" && corpo.istituzioneNome ? corpo.istituzioneNome : "l'istituzione";
    titoloGuida = `Guida di ${nomeIstituzione}`;
    linkGuida = corpo.pdfUrl;
  }

  const esito = await inviaEmail(
    corpo.email,
    "La tua guida KIREO",
    templateFollowUpGuida({ nome: nomeDestinatario, titoloGuida, linkGuida }),
    nomeDestinatario || undefined,
  );

  if (!esito.ok) {
    console.error(`[guida-email] Invio non riuscito a ${corpo.email}: ${esito.motivo}`);
  }

  return NextResponse.json({ ok: true, inviata: esito.ok });
}
