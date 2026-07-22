// Attestato di partecipazione a un webinar (docenti in questa fase — lo
// stesso layout/generatore servirà per i futuri giustificativi PCTO
// studenti). Layout sobrio brand KIREO: mai "formazione accreditata", solo
// "attestato di partecipazione". Logo organizzatore/KIREO resi come testo
// (nome), non come immagine: l'embedding di immagini richiederebbe una
// vera libreria PDF, fuori scope per questo generatore scritto a mano.
import { costruisciPdf, troncaTesto, type ElementoPdf } from "./core";

const VERDE_BRAND: [number, number, number] = [0x0f / 255, 0x6e / 255, 0x56 / 255];
const ARANCIO_BRAND: [number, number, number] = [0xef / 255, 0x9f / 255, 0x27 / 255];
const GRIGIO: [number, number, number] = [0.45, 0.45, 0.45];

export type DatiAttestato = {
  nomeCompleto: string;
  titoloWebinar: string;
  filoneLabel: string;
  dataEventoLabel: string;
  durataLabel: string | null;
  organizzatoreNome: string;
  codiceVerifica: string;
  rilasciatoIlLabel: string;
};

export function generaAttestatoPdf(dati: DatiAttestato): Buffer {
  const elementi: ElementoPdf[] = [
    // Cornice sobria.
    { tipo: "rettangolo", x: 40, y: 40, larghezza: 515, altezza: 762, colore: VERDE_BRAND, riempito: false },
    { tipo: "rettangolo", x: 46, y: 46, larghezza: 503, altezza: 750, colore: ARANCIO_BRAND, riempito: false },

    { tipo: "testo", x: 72, y: 760, dimensione: 10, font: "regular", testo: "KIREO — Orientamento. Direzione. Futuro." },
    { tipo: "linea", x1: 72, y1: 748, x2: 523, y2: 748, larghezza: 0.5, colore: GRIGIO },

    { tipo: "testo", x: 72, y: 690, dimensione: 24, font: "bold", testo: "Attestato di partecipazione" },
    { tipo: "linea", x1: 72, y1: 678, x2: 523, y2: 678, larghezza: 1, colore: VERDE_BRAND },

    { tipo: "testo", x: 72, y: 630, dimensione: 12, font: "regular", testo: "Si attesta che" },
    { tipo: "testo", x: 72, y: 600, dimensione: 19, font: "bold", testo: troncaTesto(dati.nomeCompleto, 55) },

    { tipo: "testo", x: 72, y: 565, dimensione: 12, font: "regular", testo: "ha partecipato al webinar" },
    { tipo: "testo", x: 72, y: 538, dimensione: 15, font: "bold", testo: troncaTesto(dati.titoloWebinar, 65) },

    { tipo: "testo", x: 72, y: 505, dimensione: 11, font: "regular", testo: `Filone: ${dati.filoneLabel}` },
    {
      tipo: "testo",
      x: 72,
      y: 485,
      dimensione: 11,
      font: "regular",
      testo: `Data: ${dati.dataEventoLabel}${dati.durataLabel ? ` · Durata: ${dati.durataLabel}` : ""}`,
    },
    { tipo: "testo", x: 72, y: 465, dimensione: 11, font: "regular", testo: `Organizzato da: ${troncaTesto(dati.organizzatoreNome, 45)} · KIREO` },

    {
      tipo: "testo",
      x: 72,
      y: 130,
      dimensione: 9,
      font: "regular",
      testo: "Attestato di partecipazione: non costituisce formazione accreditata.",
    },
    { tipo: "linea", x1: 72, y1: 115, x2: 523, y2: 115, larghezza: 0.5, colore: GRIGIO },
    { tipo: "testo", x: 72, y: 98, dimensione: 9, font: "regular", testo: `Rilasciato il ${dati.rilasciatoIlLabel}` },
    { tipo: "testo", x: 72, y: 82, dimensione: 9, font: "regular", testo: `Codice di verifica: ${dati.codiceVerifica}` },
    { tipo: "testo", x: 72, y: 66, dimensione: 9, font: "regular", testo: `Verifica su kireo.it/verifica-attestato/${dati.codiceVerifica}` },
  ];

  return costruisciPdf(elementi);
}
