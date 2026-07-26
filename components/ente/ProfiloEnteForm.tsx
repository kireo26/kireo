"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import AreeInteresseGrid from "@/components/app/AreeInteresseGrid";

const MAX_COPERTINA_MB = 5;
const MAX_GUIDA_MB = 20;
type Stato = "idle" | "salvando" | "ok" | "errore";

function MessaggioStato({ stato, messaggioErrore }: { stato: Stato; messaggioErrore: string }) {
  if (stato === "ok") return <span className="text-sm text-kireo-green-light">Salvato.</span>;
  if (stato === "errore") return <span className="text-sm text-red-400">{messaggioErrore}</span>;
  return null;
}

function SezioneCopertina({ istituzioneId, copertinaIniziale }: { istituzioneId: string; copertinaIniziale: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [anteprima, setAnteprima] = useState<string | null>(copertinaIniziale);
  const [stato, setStato] = useState<Stato>("idle");
  const [messaggioErrore, setMessaggioErrore] = useState("Non è stato possibile caricare la copertina. Riprova più tardi.");

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setMessaggioErrore("Carica un'immagine (JPG, PNG...).");
      setStato("errore");
      return;
    }
    if (file.size > MAX_COPERTINA_MB * 1024 * 1024) {
      setMessaggioErrore(`L'immagine deve essere sotto i ${MAX_COPERTINA_MB} MB.`);
      setStato("errore");
      return;
    }

    setStato("salvando");
    try {
      const supabase = createClient();
      const estensione = file.name.split(".").pop() ?? "jpg";
      const percorso = `${istituzioneId}/copertina-${Date.now()}.${estensione}`;
      const { error: erroreUpload } = await supabase.storage.from("istituzioni-media").upload(percorso, file, { upsert: true });
      if (erroreUpload) throw erroreUpload;

      const { data } = supabase.storage.from("istituzioni-media").getPublicUrl(percorso);
      const { error: erroreUpdate } = await supabase
        .from("istituzioni")
        .update({ immagine_copertina_url: data.publicUrl })
        .eq("id", istituzioneId);
      if (erroreUpdate) throw erroreUpdate;

      setAnteprima(data.publicUrl);
      setStato("ok");
    } catch {
      setMessaggioErrore("Non è stato possibile caricare la copertina. Riprova più tardi.");
      setStato("errore");
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Copertina</h2>
      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {anteprima ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={anteprima} alt="" className="h-24 w-40 flex-none rounded-lg object-cover" />
        ) : (
          <div className="flex h-24 w-40 flex-none items-center justify-center rounded-lg bg-white/5 text-xs text-kireo-muted">
            Nessuna copertina
          </div>
        )}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={stato === "salvando"}>
            {stato === "salvando" ? "Caricamento…" : "Carica copertina"}
          </Button>
          <div className="mt-2">
            <MessaggioStato stato={stato} messaggioErrore={messaggioErrore} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SezioneDatiProfilo({
  istituzioneId,
  descrizioneIniziale,
  sitoIniziale,
  provinciaIniziale,
}: {
  istituzioneId: string;
  descrizioneIniziale: string | null;
  sitoIniziale: string | null;
  provinciaIniziale: string | null;
}) {
  const [descrizione, setDescrizione] = useState(descrizioneIniziale ?? "");
  const [sito, setSito] = useState(sitoIniziale ?? "");
  const [provincia, setProvincia] = useState(provinciaIniziale ?? "");
  const [stato, setStato] = useState<Stato>("idle");

  async function handleSalva() {
    setStato("salvando");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("istituzioni")
        .update({ descrizione: descrizione.trim() || null, sito_ufficiale: sito.trim() || null, provincia: provincia.trim() || null })
        .eq("id", istituzioneId);
      setStato(error ? "errore" : "ok");
    } catch {
      setStato("errore");
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Profilo pubblico</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="descrizione" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Descrizione
          </label>
          <textarea
            id="descrizione"
            value={descrizione}
            onChange={(e) => {
              setDescrizione(e.target.value);
              setStato("idle");
            }}
            rows={4}
            className={`${inputClass} ${fieldBorder(false)}`}
            placeholder="Racconta chi siete e cosa offrite."
          />
        </div>
        <div>
          <label htmlFor="sito" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Sito ufficiale
          </label>
          <input
            id="sito"
            type="url"
            value={sito}
            onChange={(e) => {
              setSito(e.target.value);
              setStato("idle");
            }}
            className={`${inputClass} ${fieldBorder(false)}`}
            placeholder="https://..."
          />
        </div>
        <div>
          <label htmlFor="provincia" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Provincia (facoltativa)
          </label>
          <input
            id="provincia"
            value={provincia}
            onChange={(e) => {
              setProvincia(e.target.value);
              setStato("idle");
            }}
            className={`${inputClass} ${fieldBorder(false)}`}
            placeholder="Es. Milano"
          />
          <p className="mt-1.5 text-xs text-kireo-muted">Usata dal filtro provincia in Esplora.</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" variant="primary" onClick={handleSalva} disabled={stato === "salvando"}>
          {stato === "salvando" ? "Salvataggio…" : "Salva profilo"}
        </Button>
        <MessaggioStato stato={stato} messaggioErrore="Non è stato possibile salvare. Riprova più tardi." />
      </div>
    </div>
  );
}

function SezioneGuida({ istituzioneId, guideIniziali }: { istituzioneId: string; guideIniziali: { id: string; titolo: string; pdf_url: string }[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [titolo, setTitolo] = useState("");
  const [guide, setGuide] = useState(guideIniziali);
  const [stato, setStato] = useState<Stato>("idle");
  const [messaggioErrore, setMessaggioErrore] = useState("Non è stato possibile caricare la guida. Riprova più tardi.");

  async function handleFile(file: File) {
    if (!titolo.trim()) {
      setMessaggioErrore("Inserisci prima un titolo per la guida.");
      setStato("errore");
      return;
    }
    if (file.type !== "application/pdf") {
      setMessaggioErrore("Carica un file PDF.");
      setStato("errore");
      return;
    }
    if (file.size > MAX_GUIDA_MB * 1024 * 1024) {
      setMessaggioErrore(`Il PDF deve essere sotto i ${MAX_GUIDA_MB} MB.`);
      setStato("errore");
      return;
    }

    setStato("salvando");
    try {
      const supabase = createClient();
      const percorso = `${istituzioneId}/guida-${Date.now()}.pdf`;
      const { error: erroreUpload } = await supabase.storage.from("istituzioni-media").upload(percorso, file);
      if (erroreUpload) throw erroreUpload;

      const { data } = supabase.storage.from("istituzioni-media").getPublicUrl(percorso);
      const { data: nuovaGuida, error: erroreInsert } = await supabase
        .from("guide_enti")
        .insert({ istituzione_id: istituzioneId, titolo: titolo.trim(), pdf_url: data.publicUrl })
        .select("id, titolo, pdf_url")
        .single();
      if (erroreInsert) throw erroreInsert;

      setGuide((prev) => [nuovaGuida, ...prev]);
      setTitolo("");
      setStato("ok");
    } catch {
      setMessaggioErrore("Non è stato possibile caricare la guida. Riprova più tardi.");
      setStato("errore");
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Guida</h2>
      <p className="mt-1 text-sm text-kireo-muted">
        La guida caricata compare sul tuo profilo pubblico con un form di download.
      </p>

      {guide.length > 0 && (
        <ul className="mt-4 space-y-2">
          {guide.map((g) => (
            <li key={g.id} className="flex items-center justify-between text-sm text-kireo-light">
              <span>{g.titolo}</span>
              <a href={g.pdf_url} target="_blank" rel="noopener noreferrer" className="text-kireo-orange underline underline-offset-2">
                Apri
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3">
        <input
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          className={`${inputClass} ${fieldBorder(false)}`}
          placeholder="Titolo della guida"
        />
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={stato === "salvando"}>
          {stato === "salvando" ? "Caricamento…" : "Carica PDF"}
        </Button>
        <div>
          <MessaggioStato stato={stato} messaggioErrore={messaggioErrore} />
        </div>
      </div>
    </div>
  );
}

const MAX_AREE_COMPETENZA = 3;

// Fino a 3 aree di competenza, in revisione KIREO (a differenza degli
// altri campi di questa pagina, self-service senza revisione — vedi
// migration istituzioni_aree). Solo le 18 aree di orientamento: la
// selezione filoni per gli enti formazione_docenti resta fuori da questa
// UI (loro categorizzazione interna, non serve a /app/esplora).
function SezioneAreeCompetenza({ istituzioneId }: { istituzioneId: string }) {
  const [righe, setRighe] = useState<{ area_slug: string; stato: string }[]>([]);
  const [caricato, setCaricato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    async function carica() {
      const supabase = createClient();
      const { data } = await supabase.from("istituzioni_aree").select("area_slug, stato").eq("istituzione_id", istituzioneId);
      setRighe(data ?? []);
      setCaricato(true);
    }
    carica();
  }, [istituzioneId]);

  const attive = righe.filter((r) => r.stato !== "rifiutata").map((r) => r.area_slug);

  async function toggle(slug: string) {
    setErrore(null);
    const supabase = createClient();
    if (attive.includes(slug)) {
      const { error } = await supabase.from("istituzioni_aree").delete().eq("istituzione_id", istituzioneId).eq("area_slug", slug);
      if (!error) setRighe((prev) => prev.filter((r) => r.area_slug !== slug));
      return;
    }
    if (attive.length >= MAX_AREE_COMPETENZA) return;
    const { error } = await supabase.from("istituzioni_aree").insert({ istituzione_id: istituzioneId, area_slug: slug });
    if (error) {
      setErrore("Non è stato possibile aggiungere l'area. Riprova.");
      return;
    }
    setRighe((prev) => [...prev, { area_slug: slug, stato: "in_approvazione" }]);
  }

  if (!caricato) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Aree di competenza</h2>
      <p className="mt-1 text-sm text-kireo-muted">
        Fino a {MAX_AREE_COMPETENZA} aree, in revisione KIREO. Alimentano Esplora e la sezione dedicata sulle pagine
        area di orientamento.
      </p>
      {errore && <p className="mt-2 text-sm text-red-400">{errore}</p>}
      <div className="mt-4">
        <AreeInteresseGrid selezionate={attive} onToggle={toggle} max={MAX_AREE_COMPETENZA} />
      </div>
      {righe.some((r) => r.stato === "in_approvazione") && (
        <p className="mt-3 text-xs text-kireo-orange">Alcune aree sono in attesa di revisione da parte di KIREO.</p>
      )}
    </div>
  );
}

export default function ProfiloEnteForm({
  istituzioneId,
  copertinaIniziale,
  descrizioneIniziale,
  sitoIniziale,
  provinciaIniziale,
  guideIniziali,
}: {
  istituzioneId: string;
  copertinaIniziale: string | null;
  descrizioneIniziale: string | null;
  sitoIniziale: string | null;
  provinciaIniziale: string | null;
  guideIniziali: { id: string; titolo: string; pdf_url: string }[];
}) {
  return (
    <div className="space-y-6">
      <SezioneCopertina istituzioneId={istituzioneId} copertinaIniziale={copertinaIniziale} />
      <SezioneDatiProfilo istituzioneId={istituzioneId} descrizioneIniziale={descrizioneIniziale} sitoIniziale={sitoIniziale} provinciaIniziale={provinciaIniziale} />
      <SezioneAreeCompetenza istituzioneId={istituzioneId} />
      <SezioneGuida istituzioneId={istituzioneId} guideIniziali={guideIniziali} />
    </div>
  );
}
