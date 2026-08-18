import Link from "next/link";
import type { Restituzione } from "@/lib/escape/restituzione";

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

// Testo di una barra NULL: dice allo studente COME si riempirebbe quella
// dimensione — è tutto il valore di queste stringhe (una barra muta non orienta).
// Bravura ha due varianti: la fonte è la proposta finale, e cambia se l'abbiamo
// valutata (revisore ha pesato altre aree) o non l'abbiamo letta affatto.
function descrizioneNonMisurata(chiave: ChiaveDim, propostaValutata: boolean): NonMisurata {
  switch (chiave) {
    case "performance":
      return propostaValutata
        ? {
            heading: "Bravura — non ancora misurata.",
            corpo: "La misuriamo da quello che scrivi nella proposta finale, e questa volta la tua proposta parlava soprattutto di altre aree.",
          }
        : {
            // «non l'abbiamo letta», non «non l'hai completata»: se la causa è un
            // guasto nostro (chiave AI assente), la colpa allo studente sarebbe
            // falsa; da fuori non sappiamo quale dei due, e questa frase è vera in
            // entrambi. (È anche l'effetto visibile del guasto che il Fix E loggerà.)
            heading: "Bravura — non ancora misurata.",
            corpo: "La misuriamo da quello che scrivi nella proposta finale del progetto: questa volta non l'abbiamo letta.",
          };
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

function Barra({ label, valore, nonMisurata }: { label: string; valore: number | null; nonMisurata: NonMisurata }) {
  // valore NULL → «non ancora misurata» (mai una barra a 0, che si leggerebbe
  // come un giudizio negativo su un'azione mai compiuta).
  if (valore === null) {
    return (
      <div>
        <p className="mb-1 text-[11px] font-medium text-kireo-muted">{nonMisurata.heading}</p>
        <p className="text-[11px] leading-snug text-kireo-muted/70">{nonMisurata.corpo}</p>
      </div>
    );
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
  spiegazioni,
  ragionamento,
  propostaValutata,
}: {
  titolo: string;
  restituzione: Restituzione;
  aree: AreaEsito[];
  spiegazioni: { testo: string; aree: string[] }[];
  // Qualità di missione (categoria 'qualita_missione'): osservazioni sul METODO,
  // senza area. È il consumatore dichiarato di quella categoria.
  ragionamento: string[];
  // Distingue le due cause di una Bravura NULL: proposta valutata (revisore ha
  // pesato altre aree) vs proposta non letta. Il segnale è l'esistenza di una
  // riga evidence con step_id 's4_proposta' per il tentativo (zero stato nuovo).
  propostaValutata: boolean;
}) {
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
        {aree.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessun segnale d&apos;area registrato per questa missione.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {aree.map((a) => (
              <div key={a.slug} className="rounded-2xl border border-white/5 bg-kireo-dark p-5">
                <h4 className="font-heading text-base font-semibold text-kireo-light">{a.nome}</h4>
                <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] ${STATUS_LABEL[a.status].classe}`}>{STATUS_LABEL[a.status].testo}</span>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {DIMENSIONI.map((d) => (
                    <Barra key={d.chiave} label={d.label} valore={a[d.chiave]} nonMisurata={descrizioneNonMisurata(d.chiave, propostaValutata)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {restituzione.notaVerifica && (
          <p className="mt-4 rounded-lg border border-kireo-orange/30 bg-kireo-orange/5 px-3 py-2 text-sm text-kireo-light/90">{restituzione.notaVerifica}</p>
        )}
      </div>

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
