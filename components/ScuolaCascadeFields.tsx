"use client";

import { useEffect, useMemo, useState } from "react";
import { PROVINCE_ITALIANE } from "@/lib/province";
import { inputClass, fieldBorder } from "@/lib/formStyles";

export type Indirizzo = "Liceo" | "Tecnico" | "Professionale";
type Scuola = {
  codice: string;
  nome: string;
  comune?: string;
  indirizzo?: string;
  ospedaliera?: boolean;
};
type ScuoleData = Record<string, Partial<Record<Indirizzo, Scuola[]>>>;

// Ordina le scuole (denominazione, poi comune) e costruisce un'etichetta
// disambiguata per ciascuna: quando più scuole condividono la stessa
// denominazione si aggiunge il comune, e se anche denominazione+comune
// coincidono si aggiunge l'indirizzo. Se il dataset non ha ancora il comune
// (CSV MIM non rigenerato con quella colonna) si ricade sul codice
// meccanografico, che è comunque univoco.
function ordinaEEtichetta(scuole: Scuola[]): { codice: string; label: string }[] {
  const ordinate = [...scuole].sort(
    (a, b) => a.nome.localeCompare(b.nome, "it") || (a.comune ?? "").localeCompare(b.comune ?? "", "it"),
  );

  const perNome = new Map<string, Scuola[]>();
  for (const s of ordinate) {
    const gruppo = perNome.get(s.nome) ?? [];
    gruppo.push(s);
    perNome.set(s.nome, gruppo);
  }

  const etichette = new Map<string, string>();
  for (const [nome, gruppoNome] of perNome) {
    if (gruppoNome.length === 1) {
      etichette.set(gruppoNome[0].codice, nome);
      continue;
    }

    const perComune = new Map<string, Scuola[]>();
    for (const s of gruppoNome) {
      const chiave = s.comune ?? "";
      const gruppo = perComune.get(chiave) ?? [];
      gruppo.push(s);
      perComune.set(chiave, gruppo);
    }

    for (const [comune, gruppoComune] of perComune) {
      if (!comune) {
        // Comune non disponibile: unica disambiguazione possibile è il codice.
        for (const s of gruppoComune) etichette.set(s.codice, `${nome} (${s.codice})`);
        continue;
      }
      if (gruppoComune.length === 1) {
        etichette.set(gruppoComune[0].codice, `${nome} — ${comune}`);
        continue;
      }
      for (const s of gruppoComune) {
        etichette.set(s.codice, s.indirizzo ? `${nome} — ${comune}, ${s.indirizzo}` : `${nome} — ${comune} (${s.codice})`);
      }
    }
  }

  return ordinate.map((s) => ({
    codice: s.codice,
    label: s.ospedaliera ? `${etichette.get(s.codice)} — sezione ospedaliera` : (etichette.get(s.codice) as string),
  }));
}

export const SCUOLA_ALTRO = "__altro";

export const INDIRIZZI: { value: Indirizzo; label: string }[] = [
  { value: "Liceo", label: "Liceo" },
  { value: "Tecnico", label: "Istituto Tecnico" },
  { value: "Professionale", label: "Istituto Professionale" },
];

export type ScuolaCascadeValue = {
  provincia: string;
  indirizzo: Indirizzo | "";
  scuola: string;
  scuolaAltro: string;
};

type ScuolaCascadeErrors = Partial<Record<"provincia" | "indirizzo" | "scuola" | "scuolaAltro", string>>;

// Campi provincia -> indirizzo -> scuola a cascata, condivisi tra il form di
// registrazione studenti e il form di richiesta informazioni per le scuole.
// Usa lo stesso dataset (public/data/scuole-secondarie-superiori.json).
export default function ScuolaCascadeFields({
  value,
  onChange,
  errors = {},
}: {
  value: ScuolaCascadeValue;
  onChange: (patch: Partial<ScuolaCascadeValue>) => void;
  errors?: ScuolaCascadeErrors;
}) {
  const [scuoleData, setScuoleData] = useState<ScuoleData | null>(null);
  const [caricamentoScuole, setCaricamentoScuole] = useState(true);

  useEffect(() => {
    fetch("/data/scuole-secondarie-superiori.json")
      .then((res) => res.json())
      .then((data: ScuoleData) => setScuoleData(data))
      .catch(() => setScuoleData({}))
      .finally(() => setCaricamentoScuole(false));
  }, []);

  const scuoleDisponibili = useMemo(() => {
    if (!value.provincia || !value.indirizzo || !scuoleData) return [];
    const scuole = scuoleData[value.provincia]?.[value.indirizzo] ?? [];
    return ordinaEEtichetta(scuole);
  }, [value.provincia, value.indirizzo, scuoleData]);

  const scuolaSelectAbilitata = Boolean(value.provincia && value.indirizzo && !caricamentoScuole);

  return (
    <>
      <div>
        <label htmlFor="provincia" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Provincia della scuola
        </label>
        <select
          id="provincia"
          name="provincia"
          value={value.provincia}
          onChange={(e) => onChange({ provincia: e.target.value, scuola: "", scuolaAltro: "" })}
          aria-invalid={Boolean(errors.provincia)}
          aria-describedby={errors.provincia ? "provincia-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.provincia))}`}
        >
          <option value="" disabled>
            Seleziona la provincia
          </option>
          {PROVINCE_ITALIANE.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {errors.provincia && (
          <p id="provincia-error" className="mt-1.5 text-sm text-red-400">
            {errors.provincia}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="indirizzo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Tipo di istituto
        </label>
        <select
          id="indirizzo"
          name="indirizzo"
          value={value.indirizzo}
          onChange={(e) => onChange({ indirizzo: e.target.value as Indirizzo, scuola: "", scuolaAltro: "" })}
          aria-invalid={Boolean(errors.indirizzo)}
          aria-describedby={errors.indirizzo ? "indirizzo-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.indirizzo))}`}
        >
          <option value="" disabled>
            Seleziona il tipo di istituto
          </option>
          {INDIRIZZI.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
        {errors.indirizzo && (
          <p id="indirizzo-error" className="mt-1.5 text-sm text-red-400">
            {errors.indirizzo}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="scuola" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Nome della scuola
        </label>
        <select
          id="scuola"
          name="scuola"
          value={value.scuola}
          disabled={!scuolaSelectAbilitata}
          onChange={(e) => onChange({ scuola: e.target.value })}
          aria-invalid={Boolean(errors.scuola)}
          aria-describedby={errors.scuola ? "scuola-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.scuola))}`}
        >
          <option value="" disabled>
            {!value.provincia || !value.indirizzo
              ? "Seleziona prima provincia e indirizzo"
              : caricamentoScuole
                ? "Caricamento elenco scuole…"
                : "Seleziona la scuola"}
          </option>
          {scuoleDisponibili.map((s) => (
            <option key={s.codice} value={s.codice}>
              {s.label}
            </option>
          ))}
          {scuolaSelectAbilitata && <option value={SCUOLA_ALTRO}>La mia scuola non è in elenco</option>}
        </select>
        {errors.scuola && (
          <p id="scuola-error" className="mt-1.5 text-sm text-red-400">
            {errors.scuola}
          </p>
        )}

        {value.scuola === SCUOLA_ALTRO && (
          <div className="mt-3">
            <label htmlFor="scuolaAltro" className="mb-1.5 block text-sm font-medium text-kireo-light">
              Nome della tua scuola
            </label>
            <input
              id="scuolaAltro"
              name="scuolaAltro"
              type="text"
              value={value.scuolaAltro}
              onChange={(e) => onChange({ scuolaAltro: e.target.value })}
              aria-invalid={Boolean(errors.scuolaAltro)}
              aria-describedby={errors.scuolaAltro ? "scuolaAltro-error" : undefined}
              className={`${inputClass} ${fieldBorder(Boolean(errors.scuolaAltro))}`}
              placeholder="Scrivi il nome della scuola"
            />
            {errors.scuolaAltro && (
              <p id="scuolaAltro-error" className="mt-1.5 text-sm text-red-400">
                {errors.scuolaAltro}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
