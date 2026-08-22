// Composizione delle frasi di performance del finale Escape («Come hai
// ragionato») dai DESCRITTORI delle voci di punteggio. Ogni clausola è vera per
// costruzione: compare solo se il fatto che nomina è davvero accaduto.
//
//   appartenenza — «hai tenuto/finanziato X» sse X è nella selezione
//   limite       — «hai speso X su Y» sempre; «sforato» sse oltre
//   soglia       — SEMPRE (fattuale): «hai messo a su b €» / «sei arrivato al n%»
//   negativo     — «hai evitato X» sse evitato; «hai scelto X» sse preso
//   dipendenze   — «ordine rispettato», oppure «Prima andava Y, poi X»
//   aggregato    — silenzio (pienezza/equilibrio non sono azioni ricordabili)
//
// Se NON emerge nessuna clausola la funzione ritorna null e il chiamante NON
// emette la riga (silenzio totale del blocco — Opzione A).
//
// CORNICI INVARIANTI (vincolo non negoziabile): nessuna cornice concorda con
// l'etichetta — niente participi che si accordano, niente preposizioni
// articolate («di il», «a la»), niente articoli nella cornice. Così le ~40
// etichette di genere/numero misto entrano senza produrre frasi storte.
// Logica pura, nessuna dipendenza — SOLO server per convenzione.

export type DescrittoreVoce =
  | { tipo: "appartenenza"; label: string; presente: boolean; ordine: number }
  | { tipo: "limite"; usato: number; disponibile: number; unita?: "giorni" }
  | { tipo: "soglia"; label: string; stile: "finanziamento" | "livello"; usato: number; soglia: number }
  // testoBuona/testoMigliora: override per un negativo la cui frase non regge sul
  // verbo standard (es. «tutta l'esecuzione» — non la si «sceglie», la si prende).
  | { tipo: "negativo"; label: string; presente: boolean; testoBuona?: string; testoMigliora?: string }
  | { tipo: "dipendenze"; rispettato: boolean; coppiaViolata?: { prima: string; dopo: string } }
  | { tipo: "aggregato" };

function elenco(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return items.slice(0, -1).join(", ") + " e " + items[items.length - 1];
}

// Raggruppamento a migliaia con il punto (stile italiano) per gli importi in euro.
const raggruppa = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function componiPerformance(
  valore: number,
  voci: DescrittoreVoce[],
  meccanismo: "piano" | "budget",
): string | null {
  const buona = valore >= 0.6;
  const clausole: string[] = [];

  const app = voci
    .filter((v): v is Extract<DescrittoreVoce, { tipo: "appartenenza" }> => v.tipo === "appartenenza")
    .sort((a, b) => a.ordine - b.ordine);
  const presenti = app.filter((v) => v.presente).map((v) => v.label);
  const assenti = app.filter((v) => !v.presente).map((v) => v.label);

  if (buona) {
    if (presenti.length) clausole.push(meccanismo === "piano" ? `Nel piano hai tenuto ${elenco(presenti)}.` : `Hai finanziato ${elenco(presenti)}.`);
  } else {
    if (presenti.length === 0 && app.length >= 2) clausole.push("Hai lasciato fuori quasi tutto.");
    else if (assenti.length) clausole.push(`Hai lasciato fuori ${elenco(assenti)}.`);
  }

  for (const v of voci) {
    if (v.tipo === "limite") {
      if (buona) clausole.push(v.unita === "giorni" ? `Hai usato ${v.usato} giorni su ${v.disponibile}.` : `Hai speso ${v.usato} su ${v.disponibile}.`);
      else if (v.usato > v.disponibile) clausole.push(`Hai sforato: ${v.usato} su ${v.disponibile}.`);
    } else if (v.tipo === "soglia") {
      // Sempre emessa, fattuale — vera al pieno, a metà, a zero: nessuno stato muto.
      clausole.push(v.stile === "finanziamento" ? `Per ${v.label} hai messo ${raggruppa(v.usato)} su ${raggruppa(v.soglia)} €.` : `Per ${v.label} sei arrivato al ${Math.round(v.usato)}%.`);
    } else if (v.tipo === "negativo") {
      if (buona && !v.presente) clausole.push(v.testoBuona ?? `Hai evitato ${v.label}.`);
      else if (!buona && v.presente) clausole.push(v.testoMigliora ?? `Hai scelto ${v.label}.`);
    } else if (v.tipo === "dipendenze") {
      if (buona && v.rispettato) clausole.push("Hai rispettato l'ordine dei lavori.");
      else if (!buona && !v.rispettato) clausole.push(v.coppiaViolata ? `Prima andava ${v.coppiaViolata.dopo}, poi ${v.coppiaViolata.prima}.` : "Hai saltato l'ordine dei lavori.");
    }
    // aggregato: silenzio
  }

  return clausole.length ? clausole.join(" ") : null;
}
