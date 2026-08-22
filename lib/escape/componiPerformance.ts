// Composizione delle frasi di performance del finale Escape («Come hai
// ragionato») dai DESCRITTORI delle voci di punteggio. Ogni clausola è vera per
// costruzione: compare solo se il fatto che nomina è davvero accaduto.
//
//   appartenenza — «hai tenuto/finanziato X» sse X è nella selezione
//   limite       — «hai speso X su Y {unità}» sse dentro; «sforato: X su Y {unità}» sse oltre
//   soglia       — SEMPRE (fattuale): «hai messo a su b €» / «sei arrivato al n%»
//   negativo     — «hai evitato X» sse evitato; «hai scelto X» sse preso
//   dipendenze   — «ordine rispettato», oppure «Prima andava Y, poi X»
//   passi        — «I tuoi primi passi, in ordine: {lista}» (fatto, sempre)
//   affidabilita — «Al primo posto hai messo {X}» (fatto, sempre)
//   scarto       — 4 cornici su posizione+inversione della trappola (fatto)
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
  // unita: l'unità del limite, portata nel testo come fa la soglia («€», «cent»,
  // «giorni»). «giorni» cambia anche il verbo (usato invece di speso).
  | { tipo: "limite"; usato: number; disponibile: number; unita: string }
  | { tipo: "soglia"; label: string; stile: "finanziamento" | "livello"; usato: number; soglia: number }
  // testoBuona/testoMigliora: override per un negativo la cui frase non regge sul
  // verbo standard (es. «tutta l'esecuzione» — non la si «sceglie», la si prende).
  | { tipo: "negativo"; label: string; presente: boolean; testoBuona?: string; testoMigliora?: string }
  | { tipo: "dipendenze"; rispettato: boolean; coppiaViolata?: { prima: string; dopo: string } }
  // passi/affidabilita: clausole a fatto singolo, sempre emesse (come soglia),
  // indipendenti da buona/migliora — mettono in fila cosa lo studente ha scelto,
  // senza dire se è giusto. `ordine`/`primo` vuoti → nessuna clausola.
  | { tipo: "passi"; ordine: string[] }
  | { tipo: "affidabilita"; primo: string | null }
  // scarto: quattro cornici fattuali, keyed su DOVE è la trappola (fra gli
  // scartati o i tenuti) e se è INVERTITA (trappolaSeScartata, es. Missione 04:
  // l'accessibilità è pericolosa da LASCIARE FUORI, non da tenere). Così chi fa
  // la scelta giusta della 04 — tenere l'accessibilità — riceve comunque un
  // fatto sulla trappola, invece di niente. `trappola: null` → nessuna trappola.
  | { tipo: "scarto"; scartati: string[]; trappola: "scartata" | "tenuta" | null; invertita: boolean }
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
      const u = raggruppa(v.usato), d = raggruppa(v.disponibile);
      const giorni = v.unita === "giorni";
      // Aggancio al FATTO (usato vs disponibile), non all'esito buona/migliora:
      // la buona può scattare anche sforando, se un altro termine alza il valore.
      if (v.usato > v.disponibile) clausole.push(giorni ? `Hai sforato: ${u} giorni su ${d}.` : `Hai sforato: ${u} su ${d} ${v.unita}.`);
      else clausole.push(giorni ? `Hai usato ${u} giorni su ${d}.` : `Hai speso ${u} su ${d} ${v.unita}.`);
    } else if (v.tipo === "soglia") {
      // Sempre emessa, fattuale — vera al pieno, a metà, a zero: nessuno stato muto.
      clausole.push(v.stile === "finanziamento" ? `Per ${v.label} hai messo ${raggruppa(v.usato)} su ${raggruppa(v.soglia)} €.` : `Per ${v.label} sei arrivato al ${Math.round(v.usato)}%.`);
    } else if (v.tipo === "negativo") {
      if (buona && !v.presente) clausole.push(v.testoBuona ?? `Hai evitato ${v.label}.`);
      else if (!buona && v.presente) clausole.push(v.testoMigliora ?? `Hai scelto ${v.label}.`);
    } else if (v.tipo === "dipendenze") {
      if (buona && v.rispettato) clausole.push("Hai rispettato l'ordine dei lavori.");
      else if (!buona && !v.rispettato) clausole.push(v.coppiaViolata ? `Prima andava ${v.coppiaViolata.dopo}, poi ${v.coppiaViolata.prima}.` : "Hai saltato l'ordine dei lavori.");
    } else if (v.tipo === "passi") {
      if (v.ordine.length) clausole.push(`I tuoi primi passi, in ordine: ${elenco(v.ordine)}.`);
    } else if (v.tipo === "affidabilita") {
      if (v.primo) clausole.push(`Al primo posto hai messo ${v.primo}.`);
    } else if (v.tipo === "scarto") {
      // Le etichette dello scarto sono FRASI (con «e» e virgolette): l'elenco
      // «A, B e C» confonderebbe le congiunzioni → separatore a punto e virgola,
      // preceduto da due punti. La clausola sulla trappola è SEMPRE una frase a
      // sé, così tutte e quattro le cornici hanno la stessa struttura esatta.
      if (v.scartati.length) clausole.push(`Hai scartato: ${v.scartati.join("; ")}.`);
      if (v.trappola === "scartata") {
        clausole.push(v.invertita
          ? "Fra queste c'era la scelta che, lasciata fuori, poteva far saltare tutto."
          : "Fra queste c'era la scelta che poteva far saltare tutto.");
      } else if (v.trappola === "tenuta") {
        clausole.push(v.invertita
          ? "Hai tenuto la scelta che, lasciata fuori, avrebbe fatto saltare tutto."
          : "Hai tenuto la scelta che poteva far saltare tutto.");
      }
    }
    // aggregato: silenzio
  }

  return clausole.length ? clausole.join(" ") : null;
}
