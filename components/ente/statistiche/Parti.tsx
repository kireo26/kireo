import Link from "next/link";
import { formattaData } from "@/lib/formato";
import { T, type EventoRiga, type RigaMostrata } from "@/lib/ente/statistiche";

// I pezzi delle pagine delle statistiche (l'indice e le quattro sezioni), in un
// posto solo. Il perché di ogni numero sta in `lib/ente/statistiche.ts` e nella
// testa di 20261115100000.

export function Riquadro({ etichetta, valore, sotto }: { etichetta: string; valore: number | string; sotto?: string | null }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{etichetta}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-kireo-light">{valore}</p>
      {sotto && <p className="mt-1 text-xs text-kireo-muted">{sotto}</p>}
    </div>
  );
}

export function Tabella({ titolo, righe, nota, resto }: { titolo: string; righe: RigaMostrata[]; nota?: string | null; resto?: string | null }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{titolo}</p>
      {nota && <p className="mt-1 text-xs text-kireo-muted">{nota}</p>}
      <ul className="mt-3 space-y-1 text-sm text-kireo-light">
        {righe.map((r) => (
          <li key={r.etichetta} className="flex justify-between gap-3">
            <span>{r.etichetta}</span>
            <span className="tabular-nums">{r.n}</span>
          </li>
        ))}
      </ul>
      {/* Il resto sotto la soglia non è un gruppo: si dice sotto la lista, non dentro. */}
      {resto && <p className="mt-3 text-xs text-kireo-muted">{resto}</p>}
    </div>
  );
}

export function RigaEvento({ s }: { s: EventoRiga }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4">
      <div>
        <p className="font-heading text-sm font-semibold text-kireo-light">{s.titolo}</p>
        <p className="mt-1 text-xs text-kireo-muted">{formattaData(s.data_inizio, "long")}</p>
      </div>
      {/*
        COSA CONTA OGNI COLONNA (27/10, ripresa il 29/10 in `statistiche_ente`).
        Solo gli eventi approvati: un evento mai pubblicato non è andato in
        nessun modo, e una bozza non ha iscritti.
        - iscritti: ogni iscrizione, in qualunque stato, comprese quelle fatte
          da una scuola. NON conta chi l'ha disdetta.
        - collegati: studenti distinti con almeno un battito sulla diretta. Solo
          per una diretta: in un incontro in presenza la presenza la registra
          la scuola, e uno zero direbbe «non c'era nessuno».
        - con presenza certificata: soglia raggiunta alla chiusura, o
          certificata da una scuola, dall'ente o da KIREO. Non «ore
          riconosciute»: un evento senza ore certifica una presenza senza ore.
        - risposte: le risposte alla domanda finale, solo dove una domanda è
          stata posta (uno zero senza domanda sarebbe un fallimento che non c'è
          stato).
        «Etichetta: numero» e non «3 iscritti»: con 1 il plurale non accorda.
      */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-kireo-light">
        <span>Iscritti: {s.iscritti}</span>
        {s.collegati != null ? <span>Collegati: {s.collegati}</span> : null}
        <span>Con presenza certificata: {s.certificate}</span>
        {s.domanda_posta ? <span>Risposte: {s.risposte}</span> : null}
      </div>
    </li>
  );
}

/** La testa di una sezione: il ritorno all'indice in cima, poi il titolo. */
export function TestaSezione({ titolo }: { titolo: string }) {
  return (
    <div>
      <Link href="/ente/statistiche" className="text-sm text-kireo-green hover:underline">
        {T.tornaIndice}
      </Link>
      <h1 className="mt-4 py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">{titolo}</h1>
    </div>
  );
}

export function NonLetto() {
  return <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">{T.nonLetto}</div>;
}
