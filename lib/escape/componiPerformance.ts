// Composizione delle frasi di performance del finale Escape («Come hai
// ragionato») dai DESCRITTORI delle voci di punteggio, invece che da stringhe
// cablate. Ogni clausola è vera per costruzione: compare solo se il fatto che
// nomina è davvero accaduto nella selezione dello studente.
//
//   appartenenza — compare SSE quella voce è nella selezione
//   limite       — si dice sempre il fatto (usato/disponibile); «sforato» sse usato > disponibile
//   soglia       — «raggiunto» SSE piena; «non raggiunto» SSE nulla; nel mezzo silenzio
//   negativo     — «non ti sei appoggiato» SSE trappola evitata; «ti sei appoggiato» SSE presa
//   dipendenze   — «rispettato l'ordine» SSE nessuna dipendenza saltata; altrimenti nomina la coppia
//   aggregato    — silenzio (pienezza/equilibrio non sono azioni ricordabili)
//
// Se NON emerge nessuna clausola la funzione ritorna null e il chiamante NON
// emette la riga (silenzio totale del blocco — Opzione A). Le etichette sono
// fornite dai descrittori; l'ordine delle appartenenze è quello della missione
// (config), mai troncato. Logica pura, nessuna dipendenza — SOLO server per
// convenzione (importata da scoring.ts).

export type DescrittoreVoce =
  | { tipo: "appartenenza"; label: string; presente: boolean; ordine: number }
  | { tipo: "limite"; label: string; usato: number; disponibile: number; unita?: string }
  | { tipo: "soglia"; label: string; stato: "pieno" | "nullo" | "parziale" }
  // testoBuona/testoMigliora: override per un negativo la cui frase non regge sul
  // verbo «appoggiato» (es. «tutta l'esecuzione» — non ci si appoggia, ci si
  // carica). Quando assenti, si usano le forme standard «(Non) ti sei appoggiato a X».
  | { tipo: "negativo"; label: string; presente: boolean; testoBuona?: string; testoMigliora?: string }
  | { tipo: "dipendenze"; rispettato: boolean; coppiaViolata?: { prima: string; dopo: string } }
  | { tipo: "aggregato" };

function elenco(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return items.slice(0, -1).join(", ") + " e " + items[items.length - 1];
}

const spesa = (usato: number, disponibile: number, unita?: string) =>
  `${usato} su ${disponibile}${unita ? " " + unita : ""}`;

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
    if (presenti.length) {
      clausole.push(meccanismo === "piano" ? `Nel piano hai tenuto ${elenco(presenti)}.` : `Hai finanziato ${elenco(presenti)}.`);
    }
    for (const v of voci) {
      if (v.tipo === "limite") clausole.push(`Hai speso ${spesa(v.usato, v.disponibile, v.unita)}.`);
      else if (v.tipo === "soglia" && v.stato === "pieno") clausole.push(`Hai raggiunto ${v.label}.`);
      else if (v.tipo === "negativo" && !v.presente) clausole.push(v.testoBuona ?? `Non ti sei appoggiato a ${v.label}.`);
      else if (v.tipo === "dipendenze" && v.rispettato) clausole.push("Hai rispettato l'ordine dei lavori.");
    }
    return clausole.length ? clausole.join(" ") : null;
  }

  // migliora: l'elenco di cosa è rimasto fuori / cosa non ha retto
  if (presenti.length === 0 && app.length >= 2) {
    clausole.push(meccanismo === "piano" ? "Nel piano è rimasto fuori quasi tutto." : "Hai lasciato fuori quasi tutto.");
  } else if (assenti.length) {
    clausole.push(`Fuori ${assenti.length > 1 ? "sono rimasti" : "è rimasto"} ${elenco(assenti)}.`);
  }
  for (const v of voci) {
    if (v.tipo === "limite" && v.usato > v.disponibile) clausole.push(`Hai sforato: ${spesa(v.usato, v.disponibile, v.unita)}.`);
    else if (v.tipo === "soglia" && v.stato === "nullo") clausole.push(`Non hai raggiunto ${v.label}.`);
    else if (v.tipo === "negativo" && v.presente) clausole.push(v.testoMigliora ?? `Ti sei appoggiato a ${v.label}.`);
    else if (v.tipo === "dipendenze" && !v.rispettato) {
      clausole.push(
        v.coppiaViolata
          ? `Hai messo ${v.coppiaViolata.prima} prima di ${v.coppiaViolata.dopo}, che doveva venire per primo.`
          : "Hai messo un lavoro prima di un altro che doveva venire per primo.",
      );
    }
  }
  return clausole.length ? clausole.join(" ") : null;
}
