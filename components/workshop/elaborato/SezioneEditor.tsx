"use client";

import type { SezioneElaborato } from "@/lib/workshop/elaborato-config";
import { serializzaValoreSezione, type ValoreChecklist, type ValoreScelta, type ValoreSezione, type ValoreTabella } from "@/lib/workshop/elaboratoValore";
import TutorPanel from "./TutorPanel";

const INPUT_CLASSI = "w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted focus:outline-none focus:border-kireo-green";

export default function SezioneEditor({
  sezione,
  valore,
  onChange,
  iscrizioneId,
  workshopSlug,
  ruoloSlug,
  faseId,
}: {
  sezione: SezioneElaborato;
  valore: ValoreSezione;
  onChange: (valore: ValoreSezione) => void;
  iscrizioneId: string;
  workshopSlug: string;
  ruoloSlug: string;
  faseId: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      <h3 className="font-heading text-base font-semibold text-kireo-light">{sezione.titolo}</h3>
      <p className="mt-1 text-sm text-kireo-light/90">{sezione.prompt}</p>
      {sezione.hint && <p className="mt-1 text-xs text-kireo-muted">Suggerimento: {sezione.hint}</p>}

      <div className="mt-4">
        {(sezione.tipo === "testo" || sezione.tipo === "testo_lungo") && (
          <TestoInput sezione={sezione} valore={typeof valore === "string" ? valore : ""} onChange={onChange} />
        )}
        {sezione.tipo === "tabella" && (
          <TabellaInput sezione={sezione} valore={Array.isArray(valore) ? (valore as ValoreTabella) : []} onChange={onChange} />
        )}
        {sezione.tipo === "checklist" && (
          <ChecklistInput
            sezione={sezione}
            valore={valore && typeof valore === "object" && "voci" in valore ? (valore as ValoreChecklist) : { voci: {}, nota: "" }}
            onChange={onChange}
          />
        )}
        {sezione.tipo === "scelta" && (
          <SceltaInput
            sezione={sezione}
            valore={valore && typeof valore === "object" && "opzione" in valore ? (valore as ValoreScelta) : { opzione: "", motivazione: "" }}
            onChange={onChange}
          />
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

function TestoInput({ sezione, valore, onChange }: { sezione: SezioneElaborato; valore: string; onChange: (v: string) => void }) {
  const righe = sezione.tipo === "testo_lungo" ? 6 : 3;
  return (
    <div>
      <textarea
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        rows={righe}
        placeholder="Scrivi qui la tua risposta…"
        className={`${INPUT_CLASSI} resize-y`}
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
}: {
  sezione: SezioneElaborato;
  valore: ValoreTabella;
  onChange: (v: ValoreTabella) => void;
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
                      className="w-full rounded-lg border border-white/10 bg-kireo-dark px-2 py-1.5 text-sm text-kireo-light focus:outline-none focus:border-kireo-green"
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <button type="button" onClick={() => rimuoviRiga(indice)} className="text-xs text-kireo-muted hover:text-red-400">
                    Rimuovi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={aggiungiRiga} className="mt-3 rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-kireo-light hover:border-kireo-green">
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
}: {
  sezione: SezioneElaborato;
  valore: ValoreChecklist;
  onChange: (v: ValoreChecklist) => void;
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
            <label className="flex cursor-pointer items-start gap-2 text-sm text-kireo-light/90">
              <input
                type="checkbox"
                checked={Boolean(valore.voci?.[voce])}
                onChange={() => toggleVoce(voce)}
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
        className={`${INPUT_CLASSI} mt-3 resize-y`}
      />
    </div>
  );
}

function SceltaInput({
  sezione,
  valore,
  onChange,
}: {
  sezione: SezioneElaborato;
  valore: ValoreScelta;
  onChange: (v: ValoreScelta) => void;
}) {
  const opzioni = sezione.opzioni ?? [];
  return (
    <div className="space-y-3">
      <select value={valore.opzione} onChange={(e) => onChange({ ...valore, opzione: e.target.value })} className={INPUT_CLASSI}>
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
        placeholder="Perché hai scelto questa opzione?"
        className={`${INPUT_CLASSI} resize-y`}
      />
    </div>
  );
}
