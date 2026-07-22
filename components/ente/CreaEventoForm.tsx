"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import AreeInteresseGrid from "@/components/app/AreeInteresseGrid";

const TIPI = [
  { value: "webinar", label: "Webinar" },
  { value: "workshop", label: "Workshop" },
  { value: "altro", label: "Altro" },
];

const MAX_AREE_EVENTO = 2;

const MAX_EVENTI_IN_REVISIONE = 4;

export default function CreaEventoForm({
  istituzioneId,
  eventiInRevisione,
}: {
  istituzioneId: string;
  eventiInRevisione: number;
}) {
  const fairUseRaggiunto = eventiInRevisione >= MAX_EVENTI_IN_REVISIONE;
  const router = useRouter();
  const [titolo, setTitolo] = useState("");
  const [tipo, setTipo] = useState("webinar");
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [sede, setSede] = useState("");
  const [link, setLink] = useState("");
  const [posti, setPosti] = useState("");
  const [orePcto, setOrePcto] = useState("0");
  const [scaletta, setScaletta] = useState("");
  const [ctaEsternaUrl, setCtaEsternaUrl] = useState("");
  const [aree, setAree] = useState<string[]>([]);

  const [errori, setErrori] = useState<Record<string, string>>({});
  const [inviando, setInviando] = useState(false);
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [inviato, setInviato] = useState(false);

  function toggleArea(slug: string) {
    setAree((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_AREE_EVENTO) return prev;
      return [...prev, slug];
    });
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!titolo.trim()) next.titolo = "Inserisci un titolo.";
    if (!dataInizio) next.dataInizio = "Inserisci data e ora.";
    if (!scaletta.trim()) next.scaletta = "La scaletta/argomento è obbligatoria per la revisione di KIREO.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroreGenerale(null);
    if (fairUseRaggiunto) {
      setErroreGenerale("Hai già 4 eventi in attesa di revisione: attendi l'esito prima di proporne altri.");
      return;
    }
    const validazione = validate();
    setErrori(validazione);
    if (Object.keys(validazione).length > 0) return;

    setInviando(true);
    try {
      const supabase = createClient();
      const { data: evento, error } = await supabase
        .from("eventi")
        .insert({
          titolo: titolo.trim(),
          descrizione: scaletta.trim(),
          tipo,
          organizzatore_id: istituzioneId,
          data_inizio: new Date(dataInizio).toISOString(),
          data_fine: dataFine ? new Date(dataFine).toISOString() : null,
          sede: sede.trim() || null,
          link: link.trim() || null,
          posti: posti ? Number(posti) : null,
          ore_pcto: orePcto ? Number(orePcto) : 0,
          cta_esterna_url: ctaEsternaUrl.trim() || null,
          stato: "in_approvazione",
        })
        .select("id")
        .single();

      if (error || !evento) {
        if (error?.message?.includes("troppi_eventi_in_revisione")) {
          setErroreGenerale("Hai già 4 eventi in attesa di revisione: attendi l'esito prima di proporne altri.");
        } else {
          setErroreGenerale("Non è stato possibile inviare l'evento. Riprova più tardi.");
        }
        return;
      }

      if (aree.length > 0) {
        await supabase.from("eventi_aree").insert(aree.map((area_slug) => ({ evento_id: evento.id, area_slug })));
      }

      setInviato(true);
      router.refresh();
    } catch {
      setErroreGenerale("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setInviando(false);
    }
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
          Evento inviato in approvazione
        </h3>
        <p className="mt-2 text-sm text-kireo-muted">
          KIREO lo revisiona prima che compaia pubblicamente. Puoi seguirne lo stato qui sotto.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>
      )}

      {fairUseRaggiunto && (
        <div className="rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-4 py-3 text-sm text-kireo-orange">
          Hai già 4 eventi in attesa di revisione. Attendi l&apos;esito di KIREO su almeno uno di questi prima di proporne altri.
        </div>
      )}

      <div>
        <label htmlFor="titolo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Titolo
        </label>
        <input
          id="titolo"
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          aria-invalid={Boolean(errori.titolo)}
          className={`${inputClass} ${fieldBorder(Boolean(errori.titolo))}`}
        />
        {errori.titolo && <p className="mt-1.5 text-sm text-red-400">{errori.titolo}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="tipo" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Tipo
          </label>
          <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`}>
            {TIPI.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="orePcto" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Ore PCTO (0 se non applicabile)
          </label>
          <input
            id="orePcto"
            type="number"
            min="0"
            step="0.5"
            value={orePcto}
            onChange={(e) => setOrePcto(e.target.value)}
            className={`${inputClass} ${fieldBorder(false)}`}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="dataInizio" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Data e ora di inizio
          </label>
          <input
            id="dataInizio"
            type="datetime-local"
            value={dataInizio}
            onChange={(e) => setDataInizio(e.target.value)}
            aria-invalid={Boolean(errori.dataInizio)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.dataInizio))}`}
          />
          {errori.dataInizio && <p className="mt-1.5 text-sm text-red-400">{errori.dataInizio}</p>}
        </div>
        <div>
          <label htmlFor="dataFine" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Data e ora di fine (facoltativa)
          </label>
          <input
            id="dataFine"
            type="datetime-local"
            value={dataFine}
            onChange={(e) => setDataFine(e.target.value)}
            className={`${inputClass} ${fieldBorder(false)}`}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="sede" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Sede (vuoto se online)
          </label>
          <input id="sede" value={sede} onChange={(e) => setSede(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`} />
        </div>
        <div>
          <label htmlFor="posti" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Posti disponibili (facoltativo)
          </label>
          <input
            id="posti"
            type="number"
            min="1"
            value={posti}
            onChange={(e) => setPosti(e.target.value)}
            className={`${inputClass} ${fieldBorder(false)}`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="link" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Link di partecipazione (facoltativo)
        </label>
        <input id="link" type="url" value={link} onChange={(e) => setLink(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`} />
      </div>

      <div>
        <label htmlFor="ctaEsternaUrl" className="mb-1.5 block text-sm font-medium text-kireo-light">
          CTA verso il tuo sito (facoltativa, soggetta a quota e ad approvazione)
        </label>
        <input
          id="ctaEsternaUrl"
          type="url"
          value={ctaEsternaUrl}
          onChange={(e) => setCtaEsternaUrl(e.target.value)}
          className={`${inputClass} ${fieldBorder(false)}`}
          placeholder="https://..."
        />
      </div>

      <div>
        <label htmlFor="scaletta" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Scaletta o argomento, per la revisione di KIREO
        </label>
        <textarea
          id="scaletta"
          value={scaletta}
          onChange={(e) => setScaletta(e.target.value)}
          rows={4}
          aria-invalid={Boolean(errori.scaletta)}
          className={`${inputClass} ${fieldBorder(Boolean(errori.scaletta))}`}
          placeholder="Cosa tratterà l'evento, chi interviene, come si svolge."
        />
        {errori.scaletta && <p className="mt-1.5 text-sm text-red-400">{errori.scaletta}</p>}
        <p className="mt-1.5 text-xs text-kireo-muted">Diventa la descrizione visibile pubblicamente una volta approvato.</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-kireo-light">Aree tematiche (fino a 2)</label>
          <span className="text-sm text-kireo-muted">
            {aree.length}/{MAX_AREE_EVENTO}
          </span>
        </div>
        <AreeInteresseGrid selezionate={aree} onToggle={toggleArea} max={MAX_AREE_EVENTO} />
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={inviando || fairUseRaggiunto}>
        {fairUseRaggiunto ? "4 eventi già in revisione" : inviando ? "Invio in corso…" : "Invia in approvazione"}
      </Button>
    </form>
  );
}
