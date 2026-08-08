"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SezioneElaborato } from "@/lib/workshop/elaborato-config";
import { serializzaValoreSezione, type ValoreChecklist, type ValoreScelta, type ValoreSezione, type ValoreTabella } from "@/lib/workshop/elaboratoValore";
import TutorPanel from "./TutorPanel";

const BUCKET_IMMAGINI = "workshop-consegne";
const MAX_IMMAGINE_MB = 5;
const TIPI_IMMAGINE_CONSENTITI = ["image/png", "image/jpeg"];

const INPUT_CLASSI = "w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted focus:outline-none focus:border-kireo-green";

export default function SezioneEditor({
  sezione,
  valore,
  onChange,
  iscrizioneId,
  workshopSlug,
  ruoloSlug,
  faseId,
  disabled = false,
}: {
  sezione: SezioneElaborato;
  valore: ValoreSezione;
  onChange: (valore: ValoreSezione) => void;
  iscrizioneId: string;
  workshopSlug: string;
  ruoloSlug: string;
  faseId: string;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      <h3 className="font-heading text-base font-semibold text-kireo-light">{sezione.titolo}</h3>
      <p className="mt-1 text-sm text-kireo-light/90">{sezione.prompt}</p>
      {sezione.hint && <p className="mt-1 text-xs text-kireo-muted">Suggerimento: {sezione.hint}</p>}

      <div className="mt-4">
        {(sezione.tipo === "testo" || sezione.tipo === "testo_lungo") && (
          <TestoInput sezione={sezione} valore={typeof valore === "string" ? valore : ""} onChange={onChange} disabled={disabled} />
        )}
        {sezione.tipo === "tabella" && (
          <TabellaInput sezione={sezione} valore={Array.isArray(valore) ? (valore as ValoreTabella) : []} onChange={onChange} disabled={disabled} />
        )}
        {sezione.tipo === "checklist" && (
          <ChecklistInput
            sezione={sezione}
            valore={valore && typeof valore === "object" && "voci" in valore ? (valore as ValoreChecklist) : { voci: {}, nota: "" }}
            onChange={onChange}
            disabled={disabled}
          />
        )}
        {sezione.tipo === "scelta" && (
          <SceltaInput
            sezione={sezione}
            valore={valore && typeof valore === "object" && "opzione" in valore ? (valore as ValoreScelta) : { opzione: "", motivazione: "" }}
            onChange={onChange}
            disabled={disabled}
          />
        )}
        {sezione.tipo === "immagine" && (
          <ImmagineInput iscrizioneId={iscrizioneId} faseId={faseId} sezioneId={sezione.id} valore={typeof valore === "string" ? valore : ""} onChange={onChange} disabled={disabled} />
        )}
      </div>

      <TutorPanel
        iscrizioneId={iscrizioneId}
        workshopSlug={workshopSlug}
        ruoloSlug={ruoloSlug}
        faseId={faseId}
        sezioneId={sezione.id}
        testoCorrente={serializzaValoreSezione(sezione, valore)}
      />
    </div>
  );
}

function TestoInput({
  sezione,
  valore,
  onChange,
  disabled,
}: {
  sezione: SezioneElaborato;
  valore: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const righe = sezione.tipo === "testo_lungo" ? 6 : 3;
  return (
    <div>
      <textarea
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        rows={righe}
        placeholder="Scrivi qui la tua risposta…"
        disabled={disabled}
        className={`${INPUT_CLASSI} resize-y disabled:opacity-60`}
      />
      {sezione.minCaratteri && (
        <p className={`mt-1 text-xs ${valore.length >= sezione.minCaratteri ? "text-kireo-muted" : "text-kireo-orange"}`}>
          {valore.length}/{sezione.minCaratteri} caratteri minimi
        </p>
      )}
    </div>
  );
}

function TabellaInput({
  sezione,
  valore,
  onChange,
  disabled,
}: {
  sezione: SezioneElaborato;
  valore: ValoreTabella;
  onChange: (v: ValoreTabella) => void;
  disabled?: boolean;
}) {
  const colonne = sezione.colonne ?? [];

  function aggiornaRiga(indice: number, colonna: string, testo: string) {
    const nuove = valore.map((riga, i) => (i === indice ? { ...riga, [colonna]: testo } : riga));
    onChange(nuove);
  }

  function aggiungiRiga() {
    onChange([...valore, Object.fromEntries(colonne.map((c) => [c, ""]))]);
  }

  function rimuoviRiga(indice: number) {
    onChange(valore.filter((_, i) => i !== indice));
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] border-collapse text-sm">
          <thead>
            <tr>
              {colonne.map((colonna) => (
                <th key={colonna} className="border-b border-white/10 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-kireo-muted">
                  {colonna}
                </th>
              ))}
              <th className="border-b border-white/10" />
            </tr>
          </thead>
          <tbody>
            {valore.map((riga, indice) => (
              <tr key={indice}>
                {colonne.map((colonna) => (
                  <td key={colonna} className="px-2 py-1.5">
                    <input
                      value={riga[colonna] ?? ""}
                      onChange={(e) => aggiornaRiga(indice, colonna, e.target.value)}
                      disabled={disabled}
                      className="w-full rounded-lg border border-white/10 bg-kireo-dark px-2 py-1.5 text-sm text-kireo-light focus:outline-none focus:border-kireo-green disabled:opacity-60"
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => rimuoviRiga(indice)}
                    disabled={disabled}
                    className="text-xs text-kireo-muted hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Rimuovi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={aggiungiRiga}
        disabled={disabled}
        className="mt-3 rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-kireo-light hover:border-kireo-green disabled:cursor-not-allowed disabled:opacity-60"
      >
        + Aggiungi riga
      </button>
      {sezione.minRighe && (
        <p className={`mt-2 text-xs ${valore.length >= sezione.minRighe ? "text-kireo-muted" : "text-kireo-orange"}`}>
          {valore.length}/{sezione.minRighe} righe minime
        </p>
      )}
    </div>
  );
}

function ChecklistInput({
  sezione,
  valore,
  onChange,
  disabled,
}: {
  sezione: SezioneElaborato;
  valore: ValoreChecklist;
  onChange: (v: ValoreChecklist) => void;
  disabled?: boolean;
}) {
  const voci = sezione.voci ?? [];

  function toggleVoce(voce: string) {
    onChange({ ...valore, voci: { ...valore.voci, [voce]: !valore.voci?.[voce] } });
  }

  return (
    <div>
      <ul className="space-y-2">
        {voci.map((voce) => (
          <li key={voce}>
            <label className={`flex items-start gap-2 text-sm text-kireo-light/90 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={Boolean(valore.voci?.[voce])}
                onChange={() => toggleVoce(voce)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 flex-none accent-kireo-green"
              />
              {voce}
            </label>
          </li>
        ))}
      </ul>
      <textarea
        value={valore.nota ?? ""}
        onChange={(e) => onChange({ ...valore, nota: e.target.value })}
        rows={2}
        placeholder="Note aggiuntive (facoltativo)…"
        disabled={disabled}
        className={`${INPUT_CLASSI} mt-3 resize-y disabled:opacity-60`}
      />
    </div>
  );
}

function SceltaInput({
  sezione,
  valore,
  onChange,
  disabled,
}: {
  sezione: SezioneElaborato;
  valore: ValoreScelta;
  onChange: (v: ValoreScelta) => void;
  disabled?: boolean;
}) {
  const opzioni = sezione.opzioni ?? [];
  return (
    <div className="space-y-3">
      <select
        value={valore.opzione}
        onChange={(e) => onChange({ ...valore, opzione: e.target.value })}
        disabled={disabled}
        className={`${INPUT_CLASSI} disabled:opacity-60`}
      >
        <option value="">Scegli…</option>
        {opzioni.map((opzione) => (
          <option key={opzione} value={opzione}>
            {opzione}
          </option>
        ))}
      </select>
      <textarea
        value={valore.motivazione}
        onChange={(e) => onChange({ ...valore, motivazione: e.target.value })}
        rows={3}
        disabled={disabled}
        placeholder="Perché hai scelto questa opzione?"
        className={`${INPUT_CLASSI} resize-y disabled:opacity-60`}
      />
    </div>
  );
}

// Carica direttamente su Storage (bucket privato workshop-consegne, già
// esistente dal v1 — stessa convenzione di percorso {student_id}/{iscrizione_id}/…,
// nessuna nuova migration/policy) e salva il solo percorso come valore
// della sezione. Il bucket è privato: per la sola visualizzazione genera
// un signed URL client-side (già permesso dalla policy select esistente,
// che verifica solo la cartella = auth.uid()), non un getPublicUrl.
function ImmagineInput({
  iscrizioneId,
  faseId,
  sezioneId,
  valore,
  onChange,
  disabled,
}: {
  iscrizioneId: string;
  faseId: string;
  sezioneId: string;
  valore: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [anteprimaUrl, setAnteprimaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!valore) return;
    let annullato = false;
    const supabase = createClient();
    supabase.storage
      .from(BUCKET_IMMAGINI)
      .createSignedUrl(valore, 3600)
      .then(({ data }) => {
        if (!annullato) setAnteprimaUrl(data?.signedUrl ?? null);
      });
    return () => {
      annullato = true;
    };
  }, [valore]);

  async function handleFile(file: File) {
    setErrore(null);
    if (!TIPI_IMMAGINE_CONSENTITI.includes(file.type)) {
      setErrore("Carica un'immagine (PNG o JPG).");
      return;
    }
    if (file.size > MAX_IMMAGINE_MB * 1024 * 1024) {
      setErrore(`L'immagine deve essere sotto i ${MAX_IMMAGINE_MB} MB.`);
      return;
    }
    setCaricamento(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setErrore("Sessione scaduta. Ricarica la pagina.");
        return;
      }
      const estensione = file.name.split(".").pop() ?? "jpg";
      const percorso = `${user.id}/${iscrizioneId}/immagine_${faseId}_${sezioneId}_${Date.now()}.${estensione}`;
      const { error: erroreUpload } = await supabase.storage.from(BUCKET_IMMAGINI).upload(percorso, file, { contentType: file.type });
      if (erroreUpload) throw erroreUpload;
      onChange(percorso);
    } catch {
      setErrore("Non è stato possibile caricare l'immagine. Riprova.");
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div>
      {valore && anteprimaUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- immagine caricata dallo studente su Storage privato, non un asset del sito da ottimizzare
        <img src={anteprimaUrl} alt="Anteprima caricata" className="mb-3 max-h-64 rounded-lg border border-white/10 object-contain" />
      )}
      <input
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
        disabled={disabled || caricamento}
        className="text-sm text-kireo-light file:mr-3 file:rounded-full file:border-0 file:bg-kireo-green file:px-4 file:py-2 file:text-sm file:font-semibold file:text-kireo-light disabled:opacity-60"
      />
      {caricamento && <p className="mt-1 text-xs text-kireo-muted">Caricamento…</p>}
      {errore && <p className="mt-1 text-xs text-red-400">{errore}</p>}
      {!valore && !caricamento && <p className="mt-1 text-xs text-kireo-muted">Facoltativo: nessuna immagine caricata.</p>}
    </div>
  );
}
