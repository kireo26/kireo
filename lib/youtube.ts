// Estrae l'id di un video YouTube da un URL, per hosting_diretta='proprio'
// (l'ente incolla il link della propria diretta "non in elenco"). Copre le
// forme più comuni: watch?v=, youtu.be/, /live/, /embed/. Nessuna chiamata
// di rete QUI: solo pattern matching sull'URL, e nessuna chiave API nel
// progetto (per scelta — "nessun costo infrastruttura").
//
// L'id però ADESSO VIENE PROVATO, altrove: lib/sondaYoutube.ts +
// lib/useSondaIncorporamento.ts costruiscono un player dell'IFrame API nel
// browser e leggono l'errore 101/150 per sapere se l'incorporamento è
// attivo. Anche quella strada non richiede nessuna chiave. Chi passa di qui
// non deve concluderne che del video non sappiamo niente.
const PATTERNS = [
  /(?:youtube(?:-nocookie)?\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
  /(?:youtube(?:-nocookie)?\.com\/live\/)([\w-]{11})/,
  /(?:youtube(?:-nocookie)?\.com\/embed\/)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
];

// ⚠️ L'ID NUDO VALE (26/10). In diretta, io e Mario ci siamo fermati due minuti
// a tentativi su «Incolla un link YouTube valido», che non diceva quale forma lo
// fosse — e l'id da solo, quello che Studio mostra sotto il video, non era
// accettato. Ora lo è: undici caratteri fra lettere, cifre, «-» e «_», e
// nient'altro attorno (un pezzo di testo qualunque di undici lettere non è un
// link incollato male, ma la stringa intera deve avere quella forma).
const ID_NUDO = /^[\w-]{11}$/;

// Il rifiuto NOMINA le forme accettate, invece di dire «valido» e basta.
export const TESTO_LINK_NON_RICONOSCIUTO =
  "Non riconosciamo questo link. Vanno bene youtube.com/watch?v=…, youtube.com/live/…, youtu.be/… oppure l'id del video da solo (11 caratteri).";

export function estraiIdYoutube(url: string): string | null {
  const pulito = url.trim();
  if (!pulito) return null;
  if (ID_NUDO.test(pulito)) return pulito;
  for (const pattern of PATTERNS) {
    const match = pulito.match(pattern);
    if (match) return match[1];
  }
  return null;
}
