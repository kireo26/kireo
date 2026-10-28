import Link from "next/link";
import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { pianoAPagamento } from "@/lib/ente/pianoSuccessivo";
import { getAreaBySlug } from "@/data/aree";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";
import {
  annoDiCorso,
  etichettaAnno,
  filtraInteressati,
  haFattoQualcosa,
  hrefFiltro,
  leggiFiltri,
  quadroInteressati,
  TESTI_INTERESSATI,
  type Filtri,
  type Interessato,
  type Voce,
} from "@/lib/ente/interessati";

const BASE = "/ente/interessati";

// Il quadro risponde a «chi si interessa a noi?», l'elenco sotto serve a
// guardare. Gli stessi filtri valgono per tutti e due: un ente con seicento
// interessati clicca «5° anno · Informatica · Napoli» e ne restano dodici.
// ✅ Nessuna soglia di anonimato, ed è voluto: vedi la testa di
// lib/ente/interessati.ts e di 20261111100000.
export default async function EnteInteressatiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contesto = await getEnteContext();
  const supabase = await createClient();
  const aPagamento = pianoAPagamento(contesto.pianoNome);

  const intestazione = (
    <div>
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Studenti interessati</p>
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Chi ha condiviso il proprio profilo con te</h1>
      <p className="mt-2 text-kireo-muted">Nessun contatto diretto: puoi scrivere solo tramite i messaggi di KIREO.</p>
    </div>
  );

  if (!aPagamento) {
    const { data: conteggio } = await supabase.rpc("conteggio_manifestazioni_interesse", { p_istituzione_id: contesto.istituzioneId });
    return (
      <div className="space-y-6">
        {intestazione}
        <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-8 text-center">
          <p className="text-3xl font-bold text-kireo-light">{typeof conteggio === "number" ? conteggio : 0}</p>
          <p className="mt-1 text-sm text-kireo-muted">student{conteggio === 1 ? "e" : "i"} ha{conteggio === 1 ? "" : "nno"} condiviso il proprio profilo con te.</p>
          <p className="mt-4 text-sm text-kireo-light/90">
            Con un piano a pagamento vedi chi sono, cosa hanno fatto verso di te, e puoi filtrarli.{" "}
            <a href="/ente/piano" className="text-kireo-orange underline underline-offset-2">
              Scopri i piani
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const { data, error } = await supabase.rpc("interessati_ente", { p_istituzione_id: contesto.istituzioneId });
  if (error || !data) {
    if (error) console.error("Interessati dell'ente:", descriviErrore(error));
    return (
      <div className="space-y-6">
        {intestazione}
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">{TESTI_INTERESSATI.nonLetti}</div>
      </div>
    );
  }

  const oggi = new Date();
  const tutti = data as Interessato[];
  const filtri = leggiFiltri(await searchParams);
  const filtrati = filtraInteressati(tutti, filtri, oggi);
  const nomeArea = (slug: string) => getAreaBySlug(slug)?.nome ?? slug;
  const quadro = quadroInteressati(filtrati, oggi, nomeArea);
  const conFiltri = Object.values(filtri).some(Boolean);

  if (tutti.length === 0) {
    return (
      <div className="space-y-6">
        {intestazione}
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">{TESTI_INTERESSATI.nessuno}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {intestazione}

      {conFiltri && (
        <p className="text-sm text-kireo-muted">
          Filtri attivi.{" "}
          <Link href={BASE} className="text-kireo-orange underline underline-offset-2">
            Togli tutti i filtri
          </Link>
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
          <p className="text-3xl font-bold text-kireo-light">{quadro.totale}</p>
          <p className="mt-1 text-sm text-kireo-muted">studenti in tutto · nuovi questo mese: {quadro.nuoviQuestoMese}</p>
        </div>
        <div className="space-y-2 rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-5 text-sm">
          <p>
            <Link href={hrefFiltro(BASE, filtri, "fatto", "si")} className="font-semibold text-kireo-light underline-offset-2 hover:underline">
              {quadro.hannoFatto}
            </Link>{" "}
            <span className="text-kireo-muted">{TESTI_INTERESSATI.hannoFatto}</span>
          </p>
          <p>
            <Link href={hrefFiltro(BASE, filtri, "fatto", "no")} className="font-semibold text-kireo-light underline-offset-2 hover:underline">
              {quadro.soloLaMano}
            </Link>{" "}
            <span className="text-kireo-muted">{TESTI_INTERESSATI.soloLaMano}</span>
          </p>
          {quadro.senzaAttivita > 0 && (
            <p>
              <span className="font-semibold text-kireo-light">{quadro.senzaAttivita}</span>{" "}
              <span className="text-kireo-muted">{TESTI_INTERESSATI.senzaAttivita}</span>
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Ripartizione titolo="Per area dichiarata" nota={TESTI_INTERESSATI.notaAree} voci={quadro.perArea} filtri={filtri} chiave="area" />
        <Ripartizione titolo="Per anno di corso" voci={quadro.perAnno} filtri={filtri} chiave="anno" />
        <Ripartizione titolo="Per provincia" voci={quadro.perProvincia} filtri={filtri} chiave="provincia" />
        <Ripartizione titolo="Per scuola" voci={quadro.perScuola} filtri={filtri} chiave="scuola" />
      </section>

      {filtrati.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">{TESTI_INTERESSATI.nessunoConFiltri}</div>
      ) : (
        <ul className="space-y-3">
          {filtrati.map((r) => {
            const fatto = haFattoQualcosa(r);
            return (
              <li key={r.student_id}>
                <Link
                  href={`${BASE}/${r.student_id}`}
                  className="block rounded-xl border border-white/5 bg-kireo-card p-4 transition-colors hover:border-kireo-orange/40"
                >
                  <p className="font-heading text-sm font-semibold text-kireo-light">
                    {r.nome} {r.cognome}
                  </p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {etichettaAnno(annoDiCorso(r.anno_diploma, oggi))} · {r.scuola_denominazione ?? "Scuola non indicata"}
                    {r.scuola_provincia ? ` (${r.scuola_provincia})` : ""} · condiviso il {formattaData(r.creata_il, "long")}
                  </p>
                  {r.aree_interesse.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.aree_interesse.map((slug) => (
                        <span key={slug} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-kireo-light/80">
                          {nomeArea(slug)}
                        </span>
                      ))}
                    </div>
                  )}
                  {fatto === true && (
                    <p className="mt-2 text-xs text-kireo-orange">
                      Eventi tuoi seguiti: {r.eventi_seguiti} · Guida scaricata: {r.guida_scaricata ? "sì" : "no"}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Ripartizione({
  titolo,
  nota,
  voci,
  filtri,
  chiave,
}: {
  titolo: string;
  nota?: string;
  voci: Voce[];
  filtri: Filtri;
  chiave: keyof Filtri;
}) {
  if (voci.length === 0) return null;
  const attivo = filtri[chiave];
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
      <p className={`${nota ? "" : "mb-2 "}text-xs font-semibold uppercase tracking-wide text-kireo-muted`}>{titolo}</p>
      {nota && <p className="mb-2 text-xs text-kireo-muted">{nota}</p>}
      <ul className="space-y-1 text-sm">
        {voci.slice(0, 8).map((v) => (
          <li key={v.valore} className="flex justify-between gap-3">
            <Link
              href={hrefFiltro(BASE, filtri, chiave, attivo === v.valore ? undefined : v.valore)}
              className={attivo === v.valore ? "font-semibold text-kireo-orange" : "text-kireo-light hover:underline"}
            >
              {v.etichetta}
            </Link>
            <span className="text-kireo-muted">{v.conteggio}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
