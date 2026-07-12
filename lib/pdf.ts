// Generatore minimale di PDF (nessuna libreria esterna): costruisce un PDF
// valido a mano, con offset degli oggetti calcolati in codice (non scritti
// a mano) per evitare una xref table corrotta. Usato solo per il
// segnaposto delle guide di orientamento (vedi app/api/guida/[areaSlug]) —
// non è un motore PDF general-purpose.
function pdfEscape(testo: string): string {
  return testo.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function generaPdfSegnaposto(titolo: string, righe: string[]): Buffer {
  const contentLines: string[] = [`BT /F1 20 Tf 72 720 Td (${pdfEscape(titolo)}) Tj ET`];
  let y = 680;
  for (const riga of righe) {
    contentLines.push(`BT /F2 12 Tf 72 ${y} Td (${pdfEscape(riga)}) Tj ET`);
    y -= 20;
  }
  const content = contentLines.join("\n");

  const oggetti = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
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
