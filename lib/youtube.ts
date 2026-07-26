// Estrae l'id di un video YouTube da un URL, per hosting_diretta='proprio'
// (l'ente incolla il link della propria diretta "non in elenco"). Copre le
// forme più comuni: watch?v=, youtu.be/, /live/, /embed/. Nessuna chiamata
// di rete: solo pattern matching sull'URL, l'id non viene validato contro
// l'API YouTube (nessuna chiave API nel progetto, per scelta — "nessun
// costo infrastruttura").
const PATTERNS = [
  /(?:youtube(?:-nocookie)?\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
  /(?:youtube(?:-nocookie)?\.com\/live\/)([\w-]{11})/,
  /(?:youtube(?:-nocookie)?\.com\/embed\/)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
];

export function estraiIdYoutube(url: string): string | null {
  const pulito = url.trim();
  if (!pulito) return null;
  for (const pattern of PATTERNS) {
    const match = pulito.match(pattern);
    if (match) return match[1];
  }
  return null;
}
