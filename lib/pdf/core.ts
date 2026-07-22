// Costruttore PDF minimale riusabile (nessuna libreria esterna): assembla
// un PDF valido a mano — oggetti, xref table e trailer con gli offset
// calcolati in codice (mai scritti a mano, altrimenti una xref corrotta) —
// una sola pagina A4 (595×842pt), due font Helvetica (regular/bold),
// nessun supporto immagini (richiederebbe una vera libreria PDF, fuori
// scope per un generatore scritto da zero). Usato sia dal segnaposto delle
// guide di orientamento (lib/pdf/segnaposto.ts) sia dagli attestati di
// partecipazione (lib/pdf/attestato.ts) — pensato per essere il livello
// condiviso anche per i futuri giustificativi PCTO studenti.

export type ElementoPdf =
  | { tipo: "testo"; x: number; y: number; dimensione: number; font: "regular" | "bold"; testo: string }
  | { tipo: "linea"; x1: number; y1: number; x2: number; y2: number; larghezza?: number; colore?: [number, number, number] }
  | { tipo: "rettangolo"; x: number; y: number; larghezza: number; altezza: number; colore: [number, number, number]; riempito?: boolean };

function pdfEscape(testo: string): string {
  return testo.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function elementoAContenuto(elemento: ElementoPdf): string {
  if (elemento.tipo === "testo") {
    const font = elemento.font === "bold" ? "/F1" : "/F2";
    return `BT ${font} ${elemento.dimensione} Tf ${elemento.x} ${elemento.y} Td (${pdfEscape(elemento.testo)}) Tj ET`;
  }
  if (elemento.tipo === "linea") {
    const [r, g, b] = elemento.colore ?? [0, 0, 0];
    return `${r} ${g} ${b} RG ${elemento.larghezza ?? 1} w ${elemento.x1} ${elemento.y1} m ${elemento.x2} ${elemento.y2} l S`;
  }
  const [r, g, b] = elemento.colore;
  return elemento.riempito
    ? `${r} ${g} ${b} rg ${elemento.x} ${elemento.y} ${elemento.larghezza} ${elemento.altezza} re f`
    : `${r} ${g} ${b} RG ${elemento.x} ${elemento.y} ${elemento.larghezza} ${elemento.altezza} re S`;
}

// Tronca un testo troppo lungo per la larghezza indicativa disponibile
// (questo generatore non fa line-wrapping): meglio un "…" onesto che un
// overflow fuori pagina.
export function troncaTesto(testo: string, maxCaratteri: number): string {
  if (testo.length <= maxCaratteri) return testo;
  return `${testo.slice(0, maxCaratteri - 1).trimEnd()}…`;
}

export function costruisciPdf(elementi: ElementoPdf[]): Buffer {
  const content = elementi.map(elementoAContenuto).join("\n");

  const oggetti = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /MediaBox [0 0 595 842] /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  oggetti.forEach((oggetto, i) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${i + 1} 0 obj\n${oggetto}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= oggetti.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
