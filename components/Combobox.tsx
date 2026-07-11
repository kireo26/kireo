"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ComboboxOption = { value: string; label: string };

// Confronto case-insensitive e senza accenti ("de sanctis" trova "FRANCESCO
// DE SANCTIS"), match su qualunque punto dell'etichetta, non solo l'inizio.
function normalizza(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function corrisponde(etichetta: string, query: string): boolean {
  return normalizza(etichetta).includes(normalizza(query));
}

// Combobox ricercabile generico: campo di testo + listbox filtrata in tempo
// reale, navigabile da tastiera (frecce/invio/esc), ruoli ARIA
// combobox/listbox. Il valore selezionato resta sempre option.value — è
// solo l'interfaccia a cambiare rispetto a un <select> nativo.
//
// pinnedOption: un'opzione sempre presente in fondo alla lista, non
// soggetta al filtro (usata per "La mia scuola non è in elenco").
export default function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  disabledPlaceholder,
  messaggioVuoto = "Nessun risultato.",
  pinnedOption,
  ariaInvalid,
  ariaDescribedBy,
  className = "",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
  messaggioVuoto?: string;
  pinnedOption?: ComboboxOption;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [aperto, setAperto] = useState(false);
  const [indiceAttivo, setIndiceAttivo] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;

  const selezionata = useMemo(
    () => options.find((o) => o.value === value) ?? (pinnedOption?.value === value ? pinnedOption : undefined),
    [options, value, pinnedOption],
  );

  // Da chiuso, il campo mostra sempre l'etichetta del valore selezionato
  // (derivata dalle props, niente stato da tenere sincronizzato). Da
  // aperto, mostra quello che l'utente sta digitando.
  const displayValue = aperto ? query : (selezionata?.label ?? "");

  const opzioniBase = useMemo(() => {
    const q = query.trim();
    return q ? options.filter((o) => corrisponde(o.label, q)) : options;
  }, [options, query]);

  const opzioniNavigabili = useMemo(
    () => (pinnedOption ? [...opzioniBase, pinnedOption] : opzioniBase),
    [opzioniBase, pinnedOption],
  );

  // Riporta l'evidenziazione sulla prima opzione ogni volta che cambiano
  // query o apertura, senza un useEffect dedicato (pattern "adjust state
  // while rendering" di React: si aggiorna lo stato di confronto e si
  // richiede subito un nuovo render, invece di committare quello intermedio).
  const chiaveFiltro = `${aperto}:${query}`;
  const [ultimaChiaveFiltro, setUltimaChiaveFiltro] = useState(chiaveFiltro);
  if (chiaveFiltro !== ultimaChiaveFiltro) {
    setUltimaChiaveFiltro(chiaveFiltro);
    setIndiceAttivo(0);
  }

  useEffect(() => {
    if (!aperto) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAperto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [aperto]);

  function apri() {
    if (disabled) return;
    setQuery("");
    setAperto(true);
  }

  function selezionaOpzione(opzione: ComboboxOption) {
    onChange(opzione.value);
    setAperto(false);
  }

  function handleBlur() {
    // Piccolo ritardo per non chiudere prima che il click su un'opzione
    // registri il suo onClick; se nel frattempo è già stata selezionata
    // un'opzione, questo diventa un no-op innocuo (aperto è già false).
    window.setTimeout(() => setAperto(false), 120);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (!aperto) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        apri();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceAttivo((i) => Math.min(i + 1, opzioniNavigabili.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceAttivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const opzione = opzioniNavigabili[indiceAttivo];
      if (opzione) {
        e.preventDefault();
        selezionaOpzione(opzione);
      }
    } else if (e.key === "Escape") {
      setAperto(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={aperto}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={aperto && opzioniNavigabili[indiceAttivo] ? `${id}-opzione-${indiceAttivo}` : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
        disabled={disabled}
        value={displayValue}
        placeholder={disabled ? disabledPlaceholder : placeholder}
        onFocus={apri}
        onClick={apri}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!aperto) setAperto(true);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={className}
      />

      {aperto && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-kireo-dark shadow-xl">
          {opzioniBase.length === 0 && <p className="px-4 py-3 text-sm text-kireo-muted">{messaggioVuoto}</p>}

          {opzioniNavigabili.length > 0 && (
            <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto">
              {opzioniNavigabili.map((opzione, i) => (
                <li
                  key={opzione.value}
                  id={`${id}-opzione-${i}`}
                  role="option"
                  aria-selected={opzione.value === value}
                  onClick={() => selezionaOpzione(opzione)}
                  onMouseEnter={() => setIndiceAttivo(i)}
                  className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                    i === indiceAttivo ? "bg-kireo-green/20 text-kireo-light" : "text-kireo-light/90"
                  } ${opzione.value === value ? "font-semibold" : ""}`}
                >
                  {opzione.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
