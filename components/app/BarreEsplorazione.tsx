import { getAreaBySlug } from "@/data/aree";

// «Dove hai esplorato finora»: un conteggio di attività (da score_aree, somma
// dei pesi di activity_log — guide, pagine, eventi), reso a BARRE, non a radar.
// Un radar disegna un poligono chiuso su assi etichettati: l'occhio lo legge
// come una sagoma, «questo sei tu» — e per giunta la sagoma cambia se cambi
// l'ordine degli assi (nessun ordine è «giusto»). Per un tally di clic è una
// forma che promette un'identità che il dato non contiene. Una barra è un
// magnitudo: «qui sei passato di più», senza suggerire chi sei.
// (Il radar NON è morto: su quattro dimensioni in relazione — interesse,
// bravura, fiducia, curiosità — la forma significa qualcosa. Quando un'area
// avrà prove su tutte e quattro, quello sarà il posto onesto per riprenderlo.
// Vedi la nota in components/app/RadarAttitudinale.tsx.)

// Quante aree mostrare a barre prima di riassumere il resto in «e altre».
// ⚠️ PROVVISORIO, non tarato: prima ipotesi, da rivedere sui dati reali.
const TOP_N_ESPLORAZIONE = 6;

export default function BarreEsplorazione({ valori }: { valori: Record<string, number> }) {
  const voci = Object.entries(valori)
    .filter(([, v]) => v > 0)
    .map(([slug, v]) => ({ slug, nome: getAreaBySlug(slug)?.nome ?? slug, v }))
    .sort((a, b) => b.v - a.v);

  // Lo stato vuoto dice PRIMA cosa conta questo blocco. Senza, uno studente che
  // ha fatto due missioni leggeva «non hai ancora esplorato nessuna area» con,
  // trenta centimetri più su, otto aree ricavate da quelle stesse missioni: due
  // affermazioni contrarie nella stessa schermata. Non è il cross-feed (che
  // resta una voce aperta a sé): è che i due blocchi contano cose diverse e uno
  // dei due non lo diceva.
  if (voci.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-kireo-muted">
        Qui contiamo guide, pagine ed eventi. Le missioni e i test raccontano un&apos;altra cosa e stanno nelle affinità. Non hai ancora aperto niente: scarica una guida, apri la pagina di un&apos;area o iscriviti a un evento, e qui comparirà dove hai messo piede.
      </p>
    );
  }

  const max = Math.max(...voci.map((x) => x.v));
  const mostrate = voci.slice(0, TOP_N_ESPLORAZIONE);
  const altre = voci.length - mostrate.length;

  return (
    <div className="space-y-2.5">
      {mostrate.map((x) => (
        <div key={x.slug}>
          <p className="mb-1 text-xs text-kireo-light/90">{x.nome}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-kireo-green/70" style={{ width: `${Math.round((x.v / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      {altre > 0 && <p className="pt-1 text-xs text-kireo-muted">e altre {altre} aree con qualche attività.</p>}
    </div>
  );
}
