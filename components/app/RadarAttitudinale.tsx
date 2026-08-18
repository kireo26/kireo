import { AREE } from "@/data/aree";

// ⚠️ NON PIÙ MONTATO SULLA HOME (2026-08). Questo radar disegna un asse per
// ognuna delle 18 aree da un CONTEGGIO di attività (score_aree): una sagoma che
// si legge «questo sei tu» sopra un tally di clic, e per giunta una sagoma che
// cambia se cambia l'ordine arbitrario degli assi. Sostituito da
// BarreEsplorazione («Dove hai esplorato finora»): un magnitudo, non un ritratto.
//
// Il radar NON va buttato dal linguaggio visivo — è sbagliato per un TALLY, non
// in sé. Su quattro dimensioni in RELAZIONE che descrivono davvero un'area
// (interesse, bravura, fiducia in te, curiosità) la forma significa qualcosa,
// perché gli assi sono legati fra loro. Quando un'area avrà prove sufficienti su
// tutte e quattro, un radar A 4 ASSI PER AREA (non 18 assi da un conteggio) sarà
// il posto onesto per riprenderlo. È una nota per il futuro: non costruito qui.
// Il file resta come base di partenza per quel componente, non per riusarlo così.

const SIZE = 240;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE / 2 - 28; // spazio per le etichette attorno all'anello esterno
const ANELLI = [1 / 3, 2 / 3, 1];

function puntoSuAsse(indice: number, totale: number, raggio: number) {
  const angolo = -Math.PI / 2 + (indice * 2 * Math.PI) / totale;
  return { x: CENTER + raggio * Math.cos(angolo), y: CENTER + raggio * Math.sin(angolo) };
}

// Radar attitudinale riusabile: un raggio per ogni area di data/aree.ts.
// `valori` sono conteggi grezzi (non normalizzati): il componente normalizza
// da solo sul massimo presente. Senza attività completate tutti i valori
// sono 0 e il poligono collassa quasi al centro — stato zero "con grazia",
// non un errore, non un grafico vuoto muto (da qui la caption sotto).
export default function RadarAttitudinale({ valori }: { valori: Record<string, number> }) {
  const totale = AREE.length;
  const massimo = Math.max(0, ...AREE.map((a) => valori[a.slug] ?? 0));

  const puntiDati = AREE.map((area, i) => {
    const normalizzato = massimo > 0 ? (valori[area.slug] ?? 0) / massimo : 0;
    return puntoSuAsse(i, totale, MAX_RADIUS * normalizzato);
  });
  const poligono = puntiDati.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-xs" role="img" aria-label="Radar delle attitudini per area di orientamento">
        {ANELLI.map((r) => (
          <circle key={r} cx={CENTER} cy={CENTER} r={MAX_RADIUS * r} fill="none" stroke="rgba(255,255,255,0.08)" />
        ))}
        {AREE.map((area, i) => {
          const p = puntoSuAsse(i, totale, MAX_RADIUS);
          return <line key={area.slug} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" />;
        })}
        <polygon points={poligono} fill="rgba(15,110,86,0.35)" stroke="#0F6E56" strokeWidth="1.5" strokeLinejoin="round" />
        {AREE.map((area, i) => {
          const p = puntoSuAsse(i, totale, MAX_RADIUS + 14);
          return (
            <text
              key={area.slug}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              className="fill-kireo-muted"
            >
              {area.icona}
            </text>
          );
        })}
      </svg>
      <p className="mt-3 text-center text-xs text-kireo-muted">Si colora a ogni attività completata.</p>
    </div>
  );
}
