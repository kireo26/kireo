"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import Combobox from "@/components/Combobox";
import { PROVINCE_ITALIANE } from "@/lib/province";
import { MAX_COPERTINA_MB, MAX_GUIDA_MB, TIPO_GUIDA, tipoCopertinaAmmesso } from "@/lib/ente/media";

const OPZIONI_PROVINCIA = PROVINCE_ITALIANE.map((p) => ({ value: p, label: p }));
import AreeInteresseGrid from "@/components/app/AreeInteresseGrid";
import {
  COLONNE_GUIDA_PANNELLO,
  archiviate,
  messaggioScelta,
  pubbliche,
  rigaArchiviata,
  testoPrimaDelCaricamento,
  testoSceltaNecessaria,
  type GuidaPannello,
} from "@/lib/ente/guida";

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
    if (!tipoCopertinaAmmesso(file.type)) {
      setMessaggioErrore("Carica un'immagine JPG, PNG o WebP.");
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
            accept="image/jpeg,image/png,image/webp"
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
      // Si rilegge la riga scritta: il database mette lo schema al sito
      // («davante.it» → «https://davante.it», 20261102100000), e il campo deve
      // mostrare quello che è stato salvato davvero. Zero righe vuol dire che la
      // RLS ha filtrato l'update senza errore: non è un «salvato».
      const { data, error } = await supabase
        .from("istituzioni")
        .update({ descrizione: descrizione.trim() || null, sito_ufficiale: sito.trim() || null, provincia: provincia.trim() || null })
        .eq("id", istituzioneId)
        .select("sito_ufficiale")
        .maybeSingle();
      if (error || !data) {
        if (error) console.error("[ente] salvataggio profilo:", descriviErrore(error));
        setStato("errore");
        return;
      }
      setSito(data.sito_ufficiale ?? "");
      setStato("ok");
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
            // Testo e non `type="url"`: fuori da un `<form>` il browser avvisava
            // («Inserisci un URL») e salvava lo stesso. Lo schema lo mette il
            // database (`normalizza_sito_ufficiale`).
            type="text"
            inputMode="url"
            autoComplete="url"
            value={sito}
            onChange={(e) => {
              setSito(e.target.value);
              setStato("idle");
            }}
            className={`${inputClass} ${fieldBorder(false)}`}
            placeholder="www.vostrosito.it"
          />
        </div>
        <div>
          <label htmlFor="provincia" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Provincia (facoltativa)
          </label>
          {/*
            UNA SCELTA DA UN ELENCO, NON TESTO LIBERO (Mario, 27/10). Il campo
            alimenta il filtro di Esplora, e un ente che scriveva «MI» non usciva
            cercando «Milano» senza che nessuno glielo dicesse: credeva di
            essere nel filtro e non c'era. L'elenco è `PROVINCE_ITALIANE`, lo
            stesso dei moduli delle scuole e di Esplora.
          */}
          <Combobox
            id="provincia"
            value={provincia}
            onChange={(v) => {
              setProvincia(v);
              setStato("idle");
            }}
            options={OPZIONI_PROVINCIA}
            pinnedOption={{ value: "", label: "Nessuna provincia" }}
            placeholder="Scrivi per cercare la provincia…"
            messaggioVuoto="Nessuna provincia trovata."
            className={`${inputClass} ${fieldBorder(false)}`}
          />
          {provincia && !(PROVINCE_ITALIANE as readonly string[]).includes(provincia) && (
            <p className="mt-1.5 text-xs text-kireo-orange">
              La provincia salvata, «{provincia}», non è nell&apos;elenco: sceglila qui sopra, altrimenti chi cerca in Esplora per
              provincia non ti trova.
            </p>
          )}
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

// La guida dell'ente: una pubblica, le altre in archivio (lib/ente/guida.ts).
// Dopo ogni scrittura si rilegge l'elenco dal database: caricare una guida ne
// archivia altre (un trigger), e lo stato vero lo sa solo lui.
function SezioneGuida({ istituzioneId, guideIniziali }: { istituzioneId: string; guideIniziali: GuidaPannello[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [titolo, setTitolo] = useState("");
  const [guide, setGuide] = useState(guideIniziali);
  const [stato, setStato] = useState<Stato>("idle");
  const [messaggioErrore, setMessaggioErrore] = useState("Non è stato possibile caricare la guida. Riprova più tardi.");
  const [scegliendo, setScegliendo] = useState<string | null>(null);

  async function rileggi(): Promise<boolean> {
    const { data, error } = await createClient()
      .from("guide_enti")
      .select(COLONNE_GUIDA_PANNELLO)
      .eq("istituzione_id", istituzioneId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[ente] guide, rilettura:", descriviErrore(error));
      return false;
    }
    setGuide((data ?? []) as GuidaPannello[]);
    return true;
  }

  async function handleFile(file: File) {
    if (!titolo.trim()) {
      setMessaggioErrore("Inserisci prima un titolo per la guida.");
      setStato("errore");
      return;
    }
    if (file.type !== TIPO_GUIDA) {
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
      const { error: erroreInsert } = await supabase
        .from("guide_enti")
        .insert({ istituzione_id: istituzioneId, titolo: titolo.trim(), pdf_url: data.publicUrl });
      if (erroreInsert) throw erroreInsert;

      setTitolo("");
      if (!(await rileggi())) {
        setMessaggioErrore("La guida è caricata, ma non siamo riusciti a rileggere l'elenco: ricarica la pagina.");
        setStato("errore");
        return;
      }
      setStato("ok");
    } catch {
      setMessaggioErrore("Non è stato possibile caricare la guida. Riprova più tardi.");
      setStato("errore");
    }
  }

  async function scegli(id: string) {
    setScegliendo(id);
    const { error } = await createClient().rpc("scegli_guida_pubblica", { p_guida_id: id });
    if (error) {
      console.error("[ente] scegli_guida_pubblica:", descriviErrore(error));
      setMessaggioErrore(messaggioScelta(error.message));
      setStato("errore");
    } else if (!(await rileggi())) {
      setMessaggioErrore("La scelta è salvata, ma non siamo riusciti a rileggere l'elenco: ricarica la pagina.");
      setStato("errore");
    } else {
      setStato("ok");
    }
    setScegliendo(null);
  }

  const ora = pubbliche(guide);
  const vecchie = archiviate(guide);
  const scelta = testoSceltaNecessaria(guide);

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Guida</h2>

      {ora.length > 0 && (
        <ul className="mt-4 space-y-2">
          {ora.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-kireo-light">
              <span>
                <span className="mr-2 inline-block rounded-full bg-kireo-green/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-green-light">
                  Pubblica
                </span>
                {g.titolo}
              </span>
              <span className="flex items-center gap-3">
                {scelta && (
                  <Button type="button" variant="outline" onClick={() => scegli(g.id)} disabled={scegliendo !== null}>
                    {scegliendo === g.id ? "Salvataggio…" : "Tieni questa"}
                  </Button>
                )}
                <a href={g.pdf_url} target="_blank" rel="noopener noreferrer" className="text-kireo-orange underline underline-offset-2">
                  Apri
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
      {scelta && <p className="mt-3 text-sm text-kireo-orange">{scelta}</p>}

      <div className="mt-4 space-y-3">
        <p className="text-sm text-kireo-muted">{testoPrimaDelCaricamento(guide)}</p>
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

      {vecchie.length > 0 && (
        <div className="mt-6 border-t border-white/5 pt-4">
          <h3 className="text-sm font-semibold text-kireo-light">In archivio</h3>
          <ul className="mt-2 space-y-2">
            {vecchie.map((g) => (
              <li key={g.id} className="text-sm text-kireo-muted">
                <span className="text-kireo-light/90">{g.titolo}</span> · {rigaArchiviata(g)}{" "}
                <a href={g.pdf_url} target="_blank" rel="noopener noreferrer" className="text-kireo-orange underline underline-offset-2">
                  Apri
                </a>{" "}
                ·{" "}
                <button
                  type="button"
                  onClick={() => scegli(g.id)}
                  disabled={scegliendo !== null}
                  className="text-kireo-orange underline underline-offset-2 disabled:opacity-50"
                >
                  {scegliendo === g.id ? "Salvataggio…" : "Rendila di nuovo pubblica"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Fino a N aree di competenza, in revisione KIREO (a differenza degli
// altri campi di questa pagina, self-service senza revisione — vedi
// migration istituzioni_aree). N dipende dal TIPO dell'ente, non dal piano, e
// sta in un posto solo: `max_aree_istituzione` (20261103110000), che usa anche
// il trigger. Qui non c'è più una costante: due copie dello stesso limite
// divergono. Solo le 18 aree di orientamento: la selezione filoni per gli enti
// formazione_docenti resta fuori da questa UI (loro categorizzazione interna,
// non serve a /app/esplora).
function SezioneAreeCompetenza({ istituzioneId }: { istituzioneId: string }) {
  const [righe, setRighe] = useState<{ area_slug: string; stato: string }[]>([]);
  const [caricato, setCaricato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // null = limite non letto: la griglia non ferma, e se si supera lo dice il
  // database (`troppe_aree_istituzione`).
  const [massimo, setMassimo] = useState<number | null>(null);

  useEffect(() => {
    async function carica() {
      const supabase = createClient();
      const [{ data }, { data: limite, error: erroreLimite }] = await Promise.all([
        supabase.from("istituzioni_aree").select("area_slug, stato").eq("istituzione_id", istituzioneId),
        supabase.rpc("max_aree_istituzione", { p_istituzione_id: istituzioneId }),
      ]);
      if (erroreLimite) console.error("[profilo ente] max_aree_istituzione:", descriviErrore(erroreLimite));
      setRighe(data ?? []);
      setMassimo(typeof limite === "number" ? limite : null);
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
    if (massimo !== null && attive.length >= massimo) return;
    const { error } = await supabase.from("istituzioni_aree").insert({ istituzione_id: istituzioneId, area_slug: slug });
    if (error) {
      setErrore(
        error.message?.includes("troppe_aree_istituzione")
          ? "Hai già dichiarato tutte le aree che il tuo tipo di ente può avere."
          : "Non è stato possibile aggiungere l'area. Riprova.",
      );
      return;
    }
    setRighe((prev) => [...prev, { area_slug: slug, stato: "in_approvazione" }]);
  }

  if (!caricato) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Aree di competenza</h2>
      <p className="mt-1 text-sm text-kireo-muted">
        {massimo !== null ? `Fino a ${massimo} aree, in revisione KIREO.` : "Aree in revisione KIREO."} Alimentano Esplora e la sezione dedicata sulle pagine
        area di orientamento.
      </p>
      {errore && <p className="mt-2 text-sm text-red-400">{errore}</p>}
      <div className="mt-4">
        <AreeInteresseGrid selezionate={attive} onToggle={toggle} max={massimo ?? Number.POSITIVE_INFINITY} />
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
  guideIniziali: GuidaPannello[];
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
