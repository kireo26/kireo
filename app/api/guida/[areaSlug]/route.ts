import { NextResponse } from "next/server";
import { getAreaBySlug } from "@/data/aree";
import { generaPdfSegnaposto } from "@/lib/pdf/segnaposto";

// Download immediato della guida dopo il form (vedi GuidaAreaForm). Le 18
// guide reali restano fuori scope in questa sessione (confermato
// esplicitamente): questo genera un PDF segnaposto chiaramente marcato
// come tale, mai spacciato per contenuto reale — vedi il nome del file e
// il testo nel PDF stesso.
export async function GET(_request: Request, { params }: { params: Promise<{ areaSlug: string }> }) {
  const { areaSlug } = await params;
  const area = getAreaBySlug(areaSlug);
  if (!area) {
    return NextResponse.json({ errore: "Area non trovata." }, { status: 404 });
  }

  const pdf = generaPdfSegnaposto(`Guida di orientamento (segnaposto) — ${area.nome}`, [
    "Questo è un contenuto segnaposto: la guida completa non è ancora stata scritta.",
    "Presto qui troverai percorsi, competenze richieste e domande utili",
    `per capire se ${area.nome.toLowerCase()} fa per te.`,
    "",
    "Nel frattempo esplora l'area e gli eventi in programma su kireo.it.",
  ]);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="guida-${area.slug}-kireo-segnaposto.pdf"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}
