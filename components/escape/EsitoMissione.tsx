import Link from "next/link";
import type { Restituzione } from "@/lib/escape/restituzione";
import AreeSfiorate, { type VoceSfiorata } from "@/components/escape/AreeSfiorate";

// Esito trasparente della missione (v2): non un riassunto, ma una restituzione
// in quattro momenti (cosa hai costruito / come hai deciso / le occasioni / le
// ipotesi), tutta in linguaggio ipotetico. Le aree mostrano i 4 punteggi
// aggregati 0-100, MAI i numeri grezzi valore/peso delle singole prove.

export type AreaEsito = {
  slug: string;
  nome: string;
  status: "emergente" | "confermata" | "da_verificare";
  // NULL = «non ancora misurata» (nessuna prova per quella dimensione), NON 0.
  // Uno 0 renderizzato come barra vuota si legge «sei scarso»; il NULL dice la
  // verità: non l'abbiamo misurata. Le stringhe le fornisce descrizioneNonMisurata.
  interest: number | null;
  performance: number | null;
  self_efficacy: number | null;
  curiosity: number | null;
};

type ChiaveDim = "interest" | "performance" | "self_efficacy" | "curiosity";
type NonMisurata = { heading: string; corpo: string };

// Esito del revisore della proposta finale, nei tre stati (o null: proposta non
// scritta, o tentativo antecedente al campo → euristica di ripiego).
export type StatoRevisore = "letto" | "letto_senza_credito" | "non_riuscito" | null;

// Testo di una barra NULL: dice allo studente COME si riempirebbe quella
// dimensione — è tutto il valore di queste stringhe (una barra muta non orienta).
// Bravura ha ora TRE varianti (i tre stati del revisore) + il ripiego: la fonte
// è la proposta finale, e il messaggio cambia se l'abbiamo valutata su altre
// aree, se l'abbiamo letta ma non ne è emersa un'area, o se non siamo riusciti
// a leggerla per un guasto nostro.
// L'apertura della Bravura, condivisa dai quattro rami. Dice le TRE sorgenti,
// perché la bravura d'area nasce da tre punti di scoring.ts e non da uno:
// il revisore della proposta finale, la trappola dello scarto e gli
// abbinamenti compito-persona della Missione 10. La versione precedente
// nominava solo la scrittura — esatta per le sei aree che non hanno sorgenti
// deterministiche, incompleta per le altre dodici: un caso reale l'ha resa
// visibile, uno studente con bravura 20 su Mobilità arrivata da una trappola
// mentre la pagina gli diceva che la misuriamo da quello che scrive.
//
// Resta UNA frase e resta dov'è, nel blocco che spiega le dimensioni una volta
// sola. Renderla per-area vorrebbe dire riportarla dentro la card, cioè
// riaprire la decisione che quel blocco aveva chiuso («era otto volte a
// pagina»): non si riapre per aggiungere una precisazione.
const APERTURA_BRAVURA =
  "La leggiamo da quello che scrivi nella proposta finale — e, quando la missione la mette, da una scelta secca: quale strada lasci cadere, chi metti su quale compito.";

// Le aree che lo studente vede in «Perché lo diciamo» possono venire da fonti
// che NON sono la proposta finale: le priorità, i gettoni, lo scarto, la
// riflessione. Quando la Bravura resta non misurata, le due cose si leggono
// come una contraddizione — «non è emersa un'area» sopra, un'area con la sua
// frase sotto — mentre sono entrambe vere e parlano di stanze diverse.
// (Osservato dal vivo sulla Missione 08: la riga di Energia & Sostenibilità
// veniva dalla riflessione ed era una prova di CURIOSITÀ, non di bravura.)
//
// Il blocco «Perché lo diciamo» non dice a quale delle quattro dimensioni
// appartiene ogni riga: è una questione di leggibilità, non di verità, e come
// tale sta in lista — qui si toglie solo la contraddizione apparente, dicendo
// da dove viene il resto.
// Senza ELENCO, di proposito: l'apertura qui sopra nomina già lo scarto come
// sorgente di bravura, e ripeterlo in due frasi consecutive con due funzioni
// diverse fa inciampare. Questa frase non ha bisogno di enumerare per fare il
// suo lavoro — dire perché altre aree compaiono in un altro blocco.
const ALTRE_FONTI = " Le altre righe qui sotto vengono dal resto della missione, non dalla proposta.";

function descrizioneNonMisurata(chiave: ChiaveDim, revisoreEsito: StatoRevisore, propostaValutata: boolean): NonMisurata {
  switch (chiave) {
    case "performance": {
      // Per i tentativi col campo valorizzato l'esito è autorevole; per i
      // vecchi (null) si ripiega sull'euristica del conteggio prove.
      const esito: StatoRevisore = revisoreEsito ?? (propostaValutata ? "letto" : null);
      switch (esito) {
        case "letto":
          return {
            heading: "Bravura — non ancora misurata.",
            corpo: `${APERTURA_BRAVURA} Questa volta la tua proposta parlava soprattutto di altre aree.${ALTRE_FONTI}`,
          };
        case "letto_senza_credito":
          // La premessa di questa riga è CAMBIATA: da quando il giudizio
          // complessivo del revisore ha un consumatore (scoring.ts, stesso
          // stato), non è più vero che dalla proposta non è uscito niente — è
          // uscito un giudizio, solo non legato a un'area. Prima era asciutta
          // per onestà; ora la stessa asciuttezza nasconderebbe una cosa che
          // c'è, due blocchi più sotto.
          return {
            heading: "Bravura — non ancora misurata.",
            corpo: `${APERTURA_BRAVURA} Questa volta dalla tua proposta non è emersa un'area da valutare: quello che ci abbiamo letto sta più sotto, in «Come hai ragionato».${ALTRE_FONTI}`,
          };
        case "non_riuscito":
          // Guasto nostro (chiave assente, o chiamata/estrazione fallita): la
          // colpa allo studente sarebbe falsa. Distinta da «non l'abbiamo letta».
          return {
            heading: "Bravura — non ancora misurata.",
            corpo: `${APERTURA_BRAVURA} Questa volta la proposta non siamo riusciti a leggerla.${ALTRE_FONTI}`,
          };
        default:
          // null: proposta non scritta (o tentativo vecchio senza prove). Vera
          // in entrambi i casi, non accusa nessuno.
          return {
            heading: "Bravura — non ancora misurata.",
            corpo: `${APERTURA_BRAVURA} Questa volta la proposta non l'abbiamo letta.${ALTRE_FONTI}`,
          };
      }
    }
    case "self_efficacy":
      // Fonte unica (i compiti presi in prima persona), nessuna variante.
      // Nota missione 10: la bravura lì può venire anche dagli abbinamenti
      // compito-persona (assegna_persone → seg.performance), quindi «dalla
      // proposta» non sarebbe l'unica fonte — ma quel meccanismo è il candidato
      // n.1 del censimento del Fix C e potrebbe non sopravvivergli: nessuna terza
      // variante finché non sappiamo cosa resta.
      return {
        heading: "Fiducia in te — non ancora misurata.",
        corpo: "La leggiamo dai compiti che scegli di prenderti in prima persona: in quest'area non te ne è ancora capitato uno.",
      };
    case "interest":
      // TRANSITORIA (approvata, ma in via di estinzione): con l'item 3 (classifica
      // per eleggibilità) un'area senza segnale d'interesse NON è «affine» e non
      // riceve più una card piena — finisce nell'elenco delle aree sfiorate. Dopo
      // l'item 3 questa stringa sarà quasi irraggiungibile: serve ancora per i casi
      // limite, ma NON costruirci sopra nulla. La rinuncia («metti qualcosa davanti
      // a qualcos'altro») è ciò che rende informativo il segnale d'interesse
      // (priorità/budget/scarti/ruoli): la si nomina apposta.
      return {
        heading: "Interesse — non ancora misurato.",
        corpo: "Lo leggiamo dalle scelte in cui metti qualcosa davanti a qualcos'altro: in quest'area non ne è ancora arrivata una.",
      };
    case "curiosity":
      // Il vincolo (i gettoni sono pochi) è la ragione per cui quella scelta dice
      // qualcosa: esplicitato apposta.
      return {
        heading: "Curiosità — non ancora misurata.",
        corpo: "La leggiamo da cosa scegli di approfondire quando non puoi approfondire tutto: in quest'area non hai ancora aperto una pista.",
      };
  }
}

const STATUS_LABEL: Record<AreaEsito["status"], { testo: string; classe: string }> = {
  emergente: { testo: "Ipotesi che sta emergendo", classe: "border-white/15 text-kireo-muted" },
  confermata: { testo: "Ipotesi che si va confermando", classe: "border-kireo-green/40 text-kireo-green-light" },
  da_verificare: { testo: "Da verificare — segnali contrastanti", classe: "border-kireo-orange/40 text-kireo-orange" },
};

const DIMENSIONI: { chiave: ChiaveDim; label: string }[] = [
  { chiave: "interest", label: "Interesse" },
  { chiave: "performance", label: "Bravura" },
  { chiave: "self_efficacy", label: "Fiducia in te" },
  { chiave: "curiosity", label: "Curiosità" },
];

function Barra({ label, valore, etichettaNonMisurata }: { label: string; valore: number | null; etichettaNonMisurata: string }) {
  // valore NULL → SOLO l'etichetta «— non ancora misurata» (mai una barra a 0,
  // che si leggerebbe come un giudizio negativo su un'azione mai compiuta). Il
  // COME si misura vive una volta sola nel blocco «Come leggiamo queste quattro
  // cose» sotto le card, non ripetuto in ogni casella (era otto volte a pagina).
  if (valore === null) {
    return <p className="text-[11px] leading-snug text-kireo-muted/70">{etichettaNonMisurata}</p>;
  }
  return (
    <div>
      <p className="mb-1 text-[11px] text-kireo-muted">{label}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-kireo-green" style={{ width: `${valore}%` }} />
      </div>
    </div>
  );
}

function Blocco({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h3 className="font-heading text-base font-semibold text-kireo-light">{titolo}</h3>
      <div className="mt-2 text-sm leading-relaxed text-kireo-light/90">{children}</div>
    </div>
  );
}

export default function EsitoMissione({
  titolo,
  restituzione,
  aree,
  areeSfiorate,
  spiegazioni,
  ragionamento,
  revisoreEsito,
  propostaValutata,
}: {
  titolo: string;
  restituzione: Restituzione;
  // SOLO le aree con abbastanza dimensioni misurate per una card piena (<3 NULL
  // su 4). Le aree troppo vuote arrivano già separate in areeSfiorate.
  aree: AreaEsito[];
  // Aree con ≥3 dimensioni su 4 non misurate: troppo poco per una card, vanno
  // nell'elenco «hai solo sfiorato» col loro segnale più forte. Testo deciso a
  // monte (page.tsx), che ha le motivazioni delle prove.
  areeSfiorate: VoceSfiorata[];
  spiegazioni: { testo: string; aree: string[] }[];
  // Qualità di missione (categoria 'qualita_missione'): osservazioni sul METODO,
  // senza area. È il consumatore dichiarato di quella categoria.
  ragionamento: string[];
  // Esito del revisore nei tre stati (mission_attempt.revisore_esito). Distingue
  // «letta ma su altre aree» / «letta, nessuna area» / «non siamo riusciti a
  // leggerla». Null per i tentativi antecedenti al campo: allora si ripiega su
  // propostaValutata (euristica del conteggio prove s4_proposta).
  revisoreEsito: StatoRevisore;
  propostaValutata: boolean;
}) {
  // Dimensioni non misurate in ALMENO una card: sono le uniche da spiegare nel
  // blocco «Come leggiamo queste quattro cose». Se una dimensione è misurata
  // ovunque, spiegarne l'assenza sarebbe falso (non è assente) → esclusa.
  const dimensioniDaSpiegare = DIMENSIONI.filter((d) => aree.some((a) => a[d.chiave] === null));
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-kireo-green/30 bg-kireo-green/5 p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">La proposta è partita</h2>
        <p className="mt-1 text-sm text-kireo-muted">
          Ecco cosa abbiamo notato in «{titolo}» — sono <strong>ipotesi</strong>, non un giudizio. Più missioni fai, più diventano nitide.
        </p>
      </div>

      {restituzione.costruito && <Blocco titolo="Cosa hai costruito">{restituzione.costruito}</Blocco>}
      {restituzione.metodo && <Blocco titolo="Come hai deciso">{restituzione.metodo}</Blocco>}

      {restituzione.occasioni.length > 0 && (
        <Blocco titolo="Le occasioni">
          <ul className="space-y-2">
            {restituzione.occasioni.map((o, i) => (
              <li key={i} className="rounded-lg bg-white/5 px-3 py-2">{o}</li>
            ))}
          </ul>
        </Blocco>
      )}

      <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
        <h3 className="font-heading text-base font-semibold text-kireo-light">Le ipotesi</h3>
        {restituzione.ipotesi && <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">{restituzione.ipotesi}</p>}
        {aree.length === 0 && areeSfiorate.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessun segnale d&apos;area registrato per questa missione.</p>
        ) : (
          aree.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {aree.map((a) => {
                // Item 4 (regola di VISUALIZZAZIONE, non un valore dell'enum):
                // ti senti a tuo agio (self_efficacy misurata) ma non l'hai messo
                // alla prova (performance non misurata) — un'asimmetria da dire.
                const asimmetria = a.self_efficacy !== null && a.performance === null;
                return (
                  <div key={a.slug} className="rounded-2xl border border-white/5 bg-kireo-dark p-5">
                    <h4 className="font-heading text-base font-semibold text-kireo-light">{a.nome}</h4>
                    <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] ${STATUS_LABEL[a.status].classe}`}>{STATUS_LABEL[a.status].testo}</span>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {DIMENSIONI.map((d) => (
                        <Barra key={d.chiave} label={d.label} valore={a[d.chiave]} etichettaNonMisurata={descrizioneNonMisurata(d.chiave, revisoreEsito, propostaValutata).heading} />
                      ))}
                    </div>
                    {asimmetria && (
                      <p className="mt-3 rounded-lg border border-kireo-orange/20 bg-kireo-orange/5 px-3 py-2 text-[12px] leading-snug text-kireo-light/90">
                        Ti senti a tuo agio qui, ma non l&apos;hai ancora messo alla prova.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Le spiegazioni del «non ancora misurata» UNA volta sola, non per casella. */}
        {dimensioniDaSpiegare.length > 0 && (
          <details className="mt-4 rounded-xl border border-white/5 bg-kireo-dark/60 p-4">
            <summary className="cursor-pointer text-sm font-medium text-kireo-light">Come leggiamo queste quattro cose</summary>
            <ul className="mt-3 space-y-2 text-sm text-kireo-light/90">
              {dimensioniDaSpiegare.map((d) => {
                const nm = descrizioneNonMisurata(d.chiave, revisoreEsito, propostaValutata);
                return (
                  <li key={d.chiave} className="rounded-lg bg-white/5 px-3 py-2">
                    <span className="font-medium text-kireo-light">{d.label}.</span> {nm.corpo}
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        {restituzione.notaVerifica && (
          <p className="mt-4 rounded-lg border border-kireo-orange/30 bg-kireo-orange/5 px-3 py-2 text-sm text-kireo-light/90">{restituzione.notaVerifica}</p>
        )}
      </div>

      <AreeSfiorate
        titolo="Aree che hai solo sfiorato"
        sottotitolo="Un segnale c'è, ma è ancora troppo poco per un ritratto: un'altra missione in quest'area e diventa un'ipotesi."
        voci={areeSfiorate}
      />

      {spiegazioni.length > 0 && (
        <details className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <summary className="cursor-pointer font-heading text-base font-semibold text-kireo-light">Perché lo diciamo</summary>
          <ul className="mt-3 space-y-2 text-sm text-kireo-light/90">
            {spiegazioni.map((s, i) => (
              <li key={i} className="rounded-lg bg-white/5 px-3 py-2">
                {s.testo}
                {s.aree.length > 0 && <span className="text-kireo-muted"> → {s.aree.join(", ")}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {ragionamento.length > 0 && (
        <details className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <summary className="cursor-pointer font-heading text-base font-semibold text-kireo-light">Come hai ragionato</summary>
          <p className="mt-2 text-xs text-kireo-muted">Osservazioni sul tuo metodo, non su un&apos;area: come hai deciso, cosa hai scelto di non sapere, come hai ordinato le priorità.</p>
          <ul className="mt-3 space-y-2 text-sm text-kireo-light/90">
            {ragionamento.map((r, i) => (
              <li key={i} className="rounded-lg bg-white/5 px-3 py-2">{r}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/app/escape" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">
          Torna alle missioni
        </Link>
        <Link href="/app" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">
          Vai al tuo profilo
        </Link>
      </div>
    </div>
  );
}
