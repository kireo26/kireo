import { getEnteContext } from "@/lib/ente/context";
import { getQuoteEnte } from "@/lib/ente/quote";
import { createClient } from "@/lib/supabase/server";
import { ETICHETTA_PIANO, trovaPianiSuperiori, type PianoQuote } from "@/lib/ente/pianoSuccessivo";
import RichiediUpgradeButton from "@/components/ente/RichiediUpgradeButton";

const RIGHE_QUOTA: { chiave: keyof PianoQuote; label: string }[] = [
  { chiave: "quota_webinar_anno", label: "Eventi/webinar proposti all'anno" },
  { chiave: "quota_newsletter", label: "Newsletter agli iscritti all'anno" },
  { chiave: "quota_cta_esterne", label: "CTA verso il sito esterno all'anno" },
  { chiave: "quota_comunicazioni_kireo", label: "Comunicazioni mirate KIREO all'anno" },
];

function formattaPrezzo(min: number, max: number) {
  if (min === 0 && max === 0) return "Gratis";
  if (min === max) return `€${min}/anno`;
  return `€${min}–${max}/anno`;
}

export default async function EntePianoPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const [{ data: istituzione }, { data: piani }, { data: richiestaInAttesa }, quote] = await Promise.all([
    supabase.from("istituzioni").select("piano_attivato_il, piano_scade_il").eq("id", contesto.istituzioneId).maybeSingle(),
    supabase
      .from("piani")
      .select("id, nome, prezzo_min, prezzo_max, quota_webinar_anno, quota_newsletter, quota_cta_esterne, quota_comunicazioni_kireo")
      .order("prezzo_min", { ascending: true }),
    supabase
      .from("richieste_upgrade")
      .select("id, note, created_at, piani(nome)")
      .eq("istituzione_id", contesto.istituzioneId)
      .eq("stato", "in_attesa")
      .maybeSingle(),
    getQuoteEnte(supabase, contesto.istituzioneId, contesto.pianoNome),
  ]);

  const listaPiani = (piani ?? []) as PianoQuote[];
  const pianiSuperiori = trovaPianiSuperiori(contesto.pianoNome, listaPiani);
  const pianoRichiesto = Array.isArray(richiestaInAttesa?.piani) ? richiestaInAttesa.piani[0] : richiestaInAttesa?.piani;

  const RIGHE_USO = [
    { label: "Eventi", usati: quote.webinarUsati, totali: quote.webinarTotali },
    { label: "Newsletter", usati: quote.newsletterUsate, totali: quote.newsletterTotali },
    { label: "CTA esterne", usati: quote.ctaUsate, totali: quote.ctaTotali },
    { label: "Comunicazioni KIREO", usati: quote.comunicazioniKireoUsate, totali: quote.comunicazioniKireoTotali },
  ];

  return (
    <div className="space-y-10">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Il tuo piano</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          Piano {ETICHETTA_PIANO[contesto.pianoNome] ?? contesto.pianoNome}
        </h1>
        {istituzione?.piano_scade_il && (
          <p className="mt-2 text-kireo-muted">
            Attivo dal {new Date(istituzione.piano_attivato_il as string).toLocaleDateString("it-IT", { dateStyle: "long" })}, in
            scadenza il {new Date(istituzione.piano_scade_il).toLocaleDateString("it-IT", { dateStyle: "long" })}.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {RIGHE_USO.map((q) => (
          <div key={q.label} className="rounded-2xl border border-white/5 bg-kireo-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{q.label}</p>
            <p className="mt-1 font-heading text-2xl font-bold text-kireo-light">
              {q.usati}
              <span className="text-base font-normal text-kireo-muted">/{q.totali}</span>
            </p>
            <p className="mt-1 text-xs text-kireo-muted">anno accademico corrente</p>
          </div>
        ))}
      </div>

      {richiestaInAttesa && (
        <div className="rounded-2xl border border-kireo-orange/40 bg-kireo-orange/10 px-4 py-3 text-sm text-kireo-orange">
          Hai una richiesta di upgrade al piano {ETICHETTA_PIANO[pianoRichiesto?.nome ?? ""] ?? pianoRichiesto?.nome} in attesa di
          approvazione da parte di KIREO, inviata il{" "}
          {new Date(richiestaInAttesa.created_at).toLocaleDateString("it-IT", { dateStyle: "long" })}.
          {richiestaInAttesa.note && <span className="mt-1 block text-kireo-light/80">Nota: {richiestaInAttesa.note}</span>}
        </div>
      )}

      <div>
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Confronto piani</h2>
        <p className="mt-1 text-sm text-kireo-muted">
          Pagare aumenta le quote e la visibilità del tuo profilo, mai l&apos;accesso ai dati degli studenti.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="rounded-tl-2xl bg-kireo-card p-4 font-sans font-medium text-kireo-muted">Quote</th>
                {listaPiani.map((p, idx) => (
                  <th
                    key={p.id}
                    className={`p-4 text-center font-heading text-base font-semibold leading-[1.25] ${
                      idx === listaPiani.length - 1 ? "rounded-tr-2xl" : ""
                    } ${p.nome === contesto.pianoNome ? "bg-kireo-green text-kireo-light" : "bg-kireo-card text-kireo-light"}`}
                  >
                    {ETICHETTA_PIANO[p.nome] ?? p.nome}
                    {p.nome === contesto.pianoNome && <div className="mt-1 text-[10px] font-normal uppercase tracking-wide opacity-80">Piano attuale</div>}
                    <div className="mt-1 font-sans text-xs font-normal opacity-80">{formattaPrezzo(p.prezzo_min, p.prezzo_max)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RIGHE_QUOTA.map((riga, i) => {
                const isLast = i === RIGHE_QUOTA.length - 1;
                return (
                  <tr key={riga.chiave} className={i % 2 === 0 ? "bg-kireo-dark" : "bg-kireo-dark/60"}>
                    <td className={`p-4 text-kireo-light/90 ${isLast ? "rounded-bl-2xl" : ""}`}>{riga.label}</td>
                    {listaPiani.map((p, idx) => (
                      <td key={p.id} className={`p-4 text-center text-kireo-light/90 ${isLast && idx === listaPiani.length - 1 ? "rounded-br-2xl" : ""}`}>
                        {(p[riga.chiave] as number) > 0 ? p[riga.chiave] : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!richiestaInAttesa && pianiSuperiori.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {pianiSuperiori.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/5 bg-kireo-card p-5">
                <p className="font-heading text-base font-semibold text-kireo-light">{ETICHETTA_PIANO[p.nome] ?? p.nome}</p>
                <p className="mt-1 text-xs text-kireo-muted">{formattaPrezzo(p.prezzo_min, p.prezzo_max)}</p>
                <div className="mt-4">
                  <RichiediUpgradeButton istituzioneId={contesto.istituzioneId} pianoId={p.id} pianoNomeLabel={ETICHETTA_PIANO[p.nome] ?? p.nome} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
