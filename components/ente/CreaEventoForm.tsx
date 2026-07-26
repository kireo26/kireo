"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import AreeInteresseGrid from "@/components/app/AreeInteresseGrid";
import { FILONI_DOCENTI } from "@/data/filoniDocenti";
import { estraiIdYoutube } from "@/lib/youtube";

const VOCI_CHECKLIST: { chiave: "non_in_elenco" | "incorporamento_attivo" | "chat_disattivata" | "no_contenuti_terzi"; testo: string }[] = [
  { chiave: "non_in_elenco", testo: "La diretta è impostata come \"non in elenco\" su YouTube (non pubblica, raggiungibile solo dal link)." },
  { chiave: "incorporamento_attivo", testo: "L'incorporamento (embed) del video è attivo nelle impostazioni dello studio di YouTube." },
  { chiave: "chat_disattivata", testo: "La chat dal vivo di YouTube è disattivata (le domande passano solo dalla piattaforma KIREO)." },
  { chiave: "no_contenuti_terzi", testo: "Non trasmetterò musica di alcun tipo né contenuti audio/video di terzi non licenziati." },
];

const TIPI = [
  { value: "webinar", label: "Webinar" },
  { value: "workshop", label: "Workshop" },
  { value: "altro", label: "Altro" },
];

const MAX_AREE_EVENTO = 2;

const MAX_EVENTI_IN_REVISIONE = 4;

// Un'istituzione di tipo formazione_docenti propone SOLO eventi per
// docenti (pubblico=docenti + filone al posto delle aree): niente
// eventi_aree per questi eventi, il trigger blocca_aree_su_eventi_docenti
// lo impedirebbe comunque, ma il client non deve nemmeno tentarlo.
export default function CreaEventoForm({
  istituzioneId,
  eventiInRevisione,
  perDocenti = false,
  propostaIncontroId = null,
  descrizionePrefill = null,
}: {
  istituzioneId: string;
  eventiInRevisione: number;
  perDocenti?: boolean;
  propostaIncontroId?: string | null;
  descrizionePrefill?: string | null;
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
  const [scaletta, setScaletta] = useState(descrizionePrefill ?? "");
  const [ctaEsternaUrl, setCtaEsternaUrl] = useState("");
  const [aree, setAree] = useState<string[]>([]);
  const [filone, setFilone] = useState("");
  const [hostingDiretta, setHostingDiretta] = useState<"kireo" | "proprio">("kireo");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const eDiretta = tipo === "webinar";

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
    if (perDocenti && !filone) next.filone = "Seleziona il filone del webinar.";
    if (eDiretta) {
      if (!dataFine) next.dataFine = "Per un webinar in diretta la data e ora di fine sono obbligatorie (servono a calcolare le presenze).";
      if (hostingDiretta === "proprio") {
        if (!estraiIdYoutube(youtubeLink)) next.youtubeLink = "Incolla il link della tua diretta YouTube (non in elenco).";
        if (VOCI_CHECKLIST.some((v) => !checklist[v.chiave])) next.checklist = "Devi confermare tutte le voci della checklist per trasmettere dal tuo canale.";
      }
    }
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
      const usaChecklist = eDiretta && hostingDiretta === "proprio";
      const oraAccettazione = usaChecklist ? new Date().toISOString() : null;
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
          pubblico: perDocenti ? "docenti" : "studenti",
          filone: perDocenti ? filone : null,
          hosting_diretta: eDiretta ? hostingDiretta : "kireo",
          youtube_video_id: usaChecklist ? estraiIdYoutube(youtubeLink) : null,
          checklist_diretta: usaChecklist
            ? {
                non_in_elenco: oraAccettazione,
                incorporamento_attivo: oraAccettazione,
                chat_disattivata: oraAccettazione,
                no_contenuti_terzi: oraAccettazione,
              }
            : null,
          checklist_diretta_accettata_il: oraAccettazione,
          proposta_incontro_id: propostaIncontroId,
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

      if (!perDocenti && aree.length > 0) {
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
            Data e ora di fine {eDiretta ? "" : "(facoltativa)"}
          </label>
          <input
            id="dataFine"
            type="datetime-local"
            value={dataFine}
            onChange={(e) => setDataFine(e.target.value)}
            aria-invalid={Boolean(errori.dataFine)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.dataFine))}`}
          />
          {errori.dataFine && <p className="mt-1.5 text-sm text-red-400">{errori.dataFine}</p>}
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

      {eDiretta ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-kireo-dark/40 p-4">
          <div>
            <p className="mb-2 text-sm font-medium text-kireo-light">Dove si svolge la diretta?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${hostingDiretta === "kireo" ? "border-kireo-green bg-kireo-green/10" : "border-white/10"}`}>
                <input
                  type="radio"
                  name="hostingDiretta"
                  checked={hostingDiretta === "kireo"}
                  onChange={() => setHostingDiretta("kireo")}
                  className="mt-1 h-4 w-4 accent-kireo-green"
                />
                <span>
                  <span className="block text-sm font-semibold text-kireo-light">Ospitata da KIREO</span>
                  <span className="block text-xs text-kireo-muted">Nessun link da fornire ora: riceverai la chiave di trasmissione da KIREO prima dell&apos;evento.</span>
                </span>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${hostingDiretta === "proprio" ? "border-kireo-green bg-kireo-green/10" : "border-white/10"}`}>
                <input
                  type="radio"
                  name="hostingDiretta"
                  checked={hostingDiretta === "proprio"}
                  onChange={() => setHostingDiretta("proprio")}
                  className="mt-1 h-4 w-4 accent-kireo-green"
                />
                <span>
                  <span className="block text-sm font-semibold text-kireo-light">Sul nostro canale YouTube</span>
                  <span className="block text-xs text-kireo-muted">Trasmetti tu da una diretta YouTube "non in elenco".</span>
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-kireo-orange/30 bg-kireo-orange/5 p-3 text-xs text-kireo-light/90">
            <p className="font-semibold text-kireo-orange">Nei webinar KIREO non è consentita musica di alcun tipo (nemmeno in attesa) né contenuti audio/video di terzi.</p>
            <p className="mt-1 text-kireo-muted">Una diretta con audio non autorizzato rischia l&apos;interruzione automatica per copyright da parte di YouTube: protegge la diretta e chi partecipa.</p>
          </div>

          {hostingDiretta === "proprio" && (
            <div className="space-y-4 border-t border-white/10 pt-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Come creare una diretta non in elenco su YouTube</p>
                <ol className="list-decimal space-y-1 pl-5 text-xs text-kireo-muted">
                  <li>Su YouTube Studio, crea una nuova diretta (o programmala per l&apos;orario dell&apos;evento).</li>
                  <li>Visibilità: imposta "Non in elenco" (mai "Pubblica" o "Privata").</li>
                  <li>Nelle impostazioni della diretta, disattiva la chat dal vivo.</li>
                  <li>Verifica che l&apos;incorporamento (embed) sia consentito.</li>
                  <li>Copia il link della diretta e incollalo qui sotto.</li>
                </ol>
              </div>

              <div>
                <label htmlFor="youtubeLink" className="mb-1.5 block text-sm font-medium text-kireo-light">
                  Link della diretta YouTube
                </label>
                <input
                  id="youtubeLink"
                  type="url"
                  value={youtubeLink}
                  onChange={(e) => setYoutubeLink(e.target.value)}
                  aria-invalid={Boolean(errori.youtubeLink)}
                  className={`${inputClass} ${fieldBorder(Boolean(errori.youtubeLink))}`}
                  placeholder="https://youtube.com/watch?v=..."
                />
                {errori.youtubeLink && <p className="mt-1.5 text-sm text-red-400">{errori.youtubeLink}</p>}
              </div>

              <div className="space-y-2">
                {VOCI_CHECKLIST.map((voce) => (
                  <label key={voce.chiave} className="flex items-start gap-3 text-sm text-kireo-light/90">
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[voce.chiave])}
                      onChange={(e) => setChecklist((prev) => ({ ...prev, [voce.chiave]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-kireo-dark accent-kireo-green"
                    />
                    {voce.testo}
                  </label>
                ))}
                {errori.checklist && <p className="mt-1.5 text-sm text-red-400">{errori.checklist}</p>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="link" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Link di partecipazione (facoltativo)
          </label>
          <input id="link" type="url" value={link} onChange={(e) => setLink(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`} />
        </div>
      )}

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

      {perDocenti ? (
        <div>
          <label htmlFor="filone" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Filone
          </label>
          <select
            id="filone"
            value={filone}
            onChange={(e) => setFilone(e.target.value)}
            aria-invalid={Boolean(errori.filone)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.filone))}`}
          >
            <option value="" disabled>
              Seleziona il filone
            </option>
            {FILONI_DOCENTI.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.nome}
              </option>
            ))}
          </select>
          {errori.filone && <p className="mt-1.5 text-sm text-red-400">{errori.filone}</p>}
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-kireo-light">Aree tematiche (fino a 2)</label>
            <span className="text-sm text-kireo-muted">
              {aree.length}/{MAX_AREE_EVENTO}
            </span>
          </div>
          <AreeInteresseGrid selezionate={aree} onToggle={toggleArea} max={MAX_AREE_EVENTO} />
        </div>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={inviando || fairUseRaggiunto}>
        {fairUseRaggiunto ? "4 eventi già in revisione" : inviando ? "Invio in corso…" : "Invia in approvazione"}
      </Button>
      <p className="text-center text-xs text-kireo-muted">
        Ricorda il{" "}
        <a href="/ente/regolamento" target="_blank" className="text-kireo-orange underline underline-offset-2">
          regolamento enti
        </a>
        .
      </p>
    </form>
  );
}
