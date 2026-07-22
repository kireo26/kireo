// Segnaposto delle guide di orientamento (vedi app/api/guida/[areaSlug]) —
// non è un motore PDF general-purpose, solo un titolo + righe di testo.
import { costruisciPdf, type ElementoPdf } from "./core";

export function generaPdfSegnaposto(titolo: string, righe: string[]): Buffer {
  const elementi: ElementoPdf[] = [{ tipo: "testo", x: 72, y: 720, dimensione: 20, font: "bold", testo: titolo }];
  let y = 680;
  for (const riga of righe) {
    elementi.push({ tipo: "testo", x: 72, y, dimensione: 12, font: "regular", testo: riga });
    y -= 20;
  }
  return costruisciPdf(elementi);
}
