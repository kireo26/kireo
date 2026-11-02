"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import ScuolaCascadeFields, { SCUOLA_ALTRO, type ScuolaCascadeValue } from "@/components/ScuolaCascadeFields";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { CLASSI } from "@/lib/registrazione";
import AreeInteresseGrid from "./AreeInteresseGrid";
import { formattaData } from "@/lib/formato";
import { TESTI_RIFIUTO, rigaRifiuto, type MotivoRifiutoVerifica } from "@/lib/scuola/rifiutoVerifica";

export type RifiutoVerifica = { motivo: MotivoRifiutoVerifica; scuola: string; il: string };
import { descriviErrore } from "@/lib/erroreSupabase";
import { sessioneAncoraViva } from "@/lib/rifiutiScrittura";
import { TESTO_NON_ATTERRATA, testoErroreAree, testoErroreScuola, testoErroreTelefono } from "@/lib/app/rifiutiStudente";

const MAX_AREE_INTERESSE = 3;
type StatoSalvataggio = "idle" | "salvando" | "ok" | "errore";

function MessaggioSalvataggio({ stato, messaggioErrore }: { stato: StatoSalvataggio; messaggioErrore: string }) {
  if (stato === "ok") return <span className="text-sm text-kireo-green-light">Salvato.</span>;
  if (stato === "errore") return <span className="text-sm text-red-400">{messaggioErrore}</span>;
  return null;
}

function SezioneAnagrafica({
  nome,
  cognome,
  dataNascita,
}: {
  nome: string;
  cognome: string;
  dataNascita: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Dati anagrafici</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Nome</dt>
          <dd className="mt-1 text-kireo-light">{nome}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Cognome</dt>
          <dd className="mt-1 text-kireo-light">{cognome}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Data di nascita</dt>
          <dd className="mt-1 text-kireo-light">
            {dataNascita ? formattaData(dataNascita, "long") : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-kireo-muted">
        Per correggere questi dati scrivici da{" "}
        <Link href="/contatti" className="text-kireo-orange underline underline-offset-2">
          Contatti
        </Link>
        .
      </p>
    </div>
  );
}

function SezioneTelefono({ userId, telefonoIniziale }: { userId: string; telefonoIniziale: string | null }) {
  const [telefono, setTelefono] = useState(telefonoIniziale ?? "");
  const [stato, setStato] = useState<StatoSalvataggio>("idle");
  const [messaggio, setMessaggio] = useState("");

  async function handleSalva() {
    setStato("salvando");
    try {
      const supabase = createClient();
      // `.select()`: zero righe senza errore non è «Salvato».
      const { data, error } = await supabase.from("profiles").update({ telefono: telefono.trim() || null }).eq("id", userId).select("id");
      if (error) {
        console.error("SezioneTelefono: salvataggio non riuscito", descriviErrore(error));
        setMessaggio(testoErroreTelefono(error, await sessioneAncoraViva(supabase)));
        setStato("errore");
      } else if ((data ?? []).length === 0) {
        setMessaggio(TESTO_NON_ATTERRATA);
        setStato("errore");
      } else setStato("ok");
    } catch (e) {
      console.error("SezioneTelefono: salvataggio non arrivato", descriviErrore(e));
      setMessaggio(testoErroreTelefono(null, true));
      setStato("errore");
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Contatti</h2>
      <div className="mt-4">
        <label htmlFor="telefono" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Telefono
        </label>
        <input
          id="telefono"
          type="tel"
          value={telefono}
          onChange={(e) => {
            setTelefono(e.target.value);
            setStato("idle");
          }}
          className={`${inputClass} ${fieldBorder(false)} max-w-xs`}
          placeholder="Il tuo numero di telefono"
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" variant="primary" onClick={handleSalva} disabled={stato === "salvando"}>
          {stato === "salvando" ? "Salvataggio…" : "Salva telefono"}
        </Button>
        <MessaggioSalvataggio stato={stato} messaggioErrore={messaggio} />
      </div>
    </div>
  );
}

function SezioneScuola({
  userId,
  scuolaValueIniziale,
  classeIniziale,
  statoVerifica,
  nomeScuolaAttuale,
  rifiuto,
}: {
  userId: string;
  scuolaValueIniziale: ScuolaCascadeValue;
  classeIniziale: string;
  statoVerifica: string | null;
  nomeScuolaAttuale: string | null;
  rifiuto: RifiutoVerifica | null;
}) {
  const [scuolaValue, setScuolaValue] = useState<ScuolaCascadeValue>(scuolaValueIniziale);
  const [classe, setClasse] = useState(classeIniziale);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [stato, setStato] = useState<StatoSalvataggio>("idle");
  const [messaggio, setMessaggio] = useState("");

  if (statoVerifica === "verificato") {
    const classeLabel = CLASSI.find((c) => c.value === classeIniziale)?.label ?? classeIniziale;
    return (
      <div id="scuola" className="rounded-2xl border border-white/5 bg-kireo-card p-6">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Scuola e classe</h2>
        <p className="mt-2 text-kireo-light/90">
          {nomeScuolaAttuale ?? "—"} {classeLabel && `· ${classeLabel}`}
        </p>
        <p className="mt-3 text-sm text-kireo-muted">
          La tua scuola ha verificato la tua appartenenza: non puoi più cambiarla da qui. Se hai cambiato scuola, scrivici da{" "}
          <Link href="/contatti" className="text-kireo-orange underline underline-offset-2">
            Contatti
          </Link>
          .
        </p>
      </div>
    );
  }

  function handleScuolaChange(patch: Partial<ScuolaCascadeValue>) {
    setScuolaValue((prev) => ({ ...prev, ...patch }));
    setStato("idle");
  }

  async function handleSalva() {
    const nextErrori: Record<string, string> = {};
    if (!scuolaValue.scuola || scuolaValue.scuola === SCUOLA_ALTRO) {
      nextErrori.scuola = "Seleziona una scuola presente nell'elenco.";
    }
    if (!classe) nextErrori.classe = "Seleziona la classe che frequenti.";
    setErrori(nextErrori);
    if (Object.keys(nextErrori).length > 0) return;

    setStato("salvando");
    try {
      const supabase = createClient();
      const classeLabel = CLASSI.find((c) => c.value === classe)?.label ?? classe;
      const { data, error } = await supabase
        .from("student_profiles")
        .update({ school_code: scuolaValue.scuola, classe: classeLabel })
        .eq("user_id", userId)
        .select("user_id");
      if (error) {
        // Il trigger `blocco_cambio_scuola_verificato` dice no se la scuola ha
        // verificato mentre la pagina era aperta: lo si dice, non «riprova».
        console.error("SezioneScuola: salvataggio non riuscito", descriviErrore(error));
        setMessaggio(testoErroreScuola(error, await sessioneAncoraViva(supabase)));
        setStato("errore");
      } else if ((data ?? []).length === 0) {
        setMessaggio(TESTO_NON_ATTERRATA);
        setStato("errore");
      } else setStato("ok");
    } catch (e) {
      console.error("SezioneScuola: salvataggio non arrivato", descriviErrore(e));
      setMessaggio(testoErroreScuola(null, true));
      setStato("errore");
    }
  }

  return (
    <div id="scuola" className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Scuola e classe</h2>
      {/* Il rifiuto è lo stato di una pratica, non una macchia: sparisce quando
          lo studente dichiara di nuovo una scuola (lo pulisce il trigger nel
          database; qui si nasconde appena il salvataggio riesce). */}
      {rifiuto && stato !== "ok" && (
        <div className="mt-3 rounded-xl border border-kireo-orange/30 bg-kireo-orange/5 p-4">
          <p className="text-sm font-semibold text-kireo-light">{TESTI_RIFIUTO.titolo}</p>
          <p className="mt-1 text-sm text-kireo-light/90">
            {rigaRifiuto(rifiuto.scuola, formattaData(rifiuto.il, "long"), rifiuto.motivo)}
          </p>
          <p className="mt-1 text-sm text-kireo-muted">{TESTI_RIFIUTO.cosaFare}</p>
        </div>
      )}
      <div className="mt-4 space-y-5">
        <ScuolaCascadeFields value={scuolaValue} onChange={handleScuolaChange} errors={errori} />
        <div>
          <label htmlFor="classe" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Classe frequentata
          </label>
          <select
            id="classe"
            value={classe}
            onChange={(e) => {
              setClasse(e.target.value);
              setStato("idle");
            }}
            aria-invalid={Boolean(errori.classe)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.classe))} max-w-xs`}
          >
            <option value="" disabled>
              Seleziona la classe
            </option>
            {CLASSI.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {errori.classe && <p className="mt-1.5 text-sm text-red-400">{errori.classe}</p>}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" variant="primary" onClick={handleSalva} disabled={stato === "salvando"}>
          {stato === "salvando" ? "Salvataggio…" : "Salva scuola e classe"}
        </Button>
        <MessaggioSalvataggio stato={stato} messaggioErrore={messaggio} />
      </div>
    </div>
  );
}

function SezioneAree({ userId, areeIniziali }: { userId: string; areeIniziali: string[] }) {
  const [aree, setAree] = useState<string[]>(areeIniziali);
  const [baseline, setBaseline] = useState<string[]>(areeIniziali);
  const [stato, setStato] = useState<StatoSalvataggio>("idle");
  const [messaggio, setMessaggio] = useState("");

  function toggle(slug: string) {
    setAree((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_AREE_INTERESSE) return prev;
      return [...prev, slug];
    });
    setStato("idle");
  }

  async function handleSalva() {
    setStato("salvando");
    try {
      const supabase = createClient();
      const daRimuovere = baseline.filter((s) => !aree.includes(s));
      const daAggiungere = aree.filter((s) => !baseline.includes(s));

      if (daRimuovere.length > 0) {
        const { error } = await supabase
          .from("student_area_interests")
          .delete()
          .eq("user_id", userId)
          .in("area_slug", daRimuovere);
        if (error) throw error;
      }
      if (daAggiungere.length > 0) {
        const { error } = await supabase
          .from("student_area_interests")
          .insert(daAggiungere.map((slug) => ({ user_id: userId, area_slug: slug })));
        if (error) throw error;
      }
      setBaseline(aree);
      setStato("ok");
    } catch (e) {
      // Un errore del database arriva qui con il suo codice (`throw error`
      // sopra); un'eccezione della rete senza, e si legge come guasto.
      console.error("SezioneAree: salvataggio non riuscito", descriviErrore(e));
      const erroreDb = e && typeof e === "object" && "code" in e ? (e as { code?: unknown; message?: unknown }) : null;
      setMessaggio(testoErroreAree(erroreDb, erroreDb ? await sessioneAncoraViva(createClient()) : true));
      setStato("errore");
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Le mie aree</h2>
          <p className="text-sm text-kireo-muted">Scegline fino a {MAX_AREE_INTERESSE}.</p>
        </div>
        <span className="flex-none whitespace-nowrap text-sm text-kireo-muted">
          {aree.length}/{MAX_AREE_INTERESSE} selezionate
        </span>
      </div>
      <AreeInteresseGrid selezionate={aree} onToggle={toggle} max={MAX_AREE_INTERESSE} />
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" variant="primary" onClick={handleSalva} disabled={stato === "salvando"}>
          {stato === "salvando" ? "Salvataggio…" : "Salva aree"}
        </Button>
        <MessaggioSalvataggio stato={stato} messaggioErrore={messaggio} />
      </div>
    </div>
  );
}

export default function ProfiloForm({
  userId,
  nome,
  cognome,
  dataNascita,
  telefonoIniziale,
  scuolaValueIniziale,
  classeIniziale,
  areeInteresseIniziali,
  statoVerifica = null,
  nomeScuolaAttuale = null,
  rifiuto = null,
}: {
  userId: string;
  nome: string;
  cognome: string;
  dataNascita: string | null;
  telefonoIniziale: string | null;
  scuolaValueIniziale: ScuolaCascadeValue;
  classeIniziale: string;
  areeInteresseIniziali: string[];
  statoVerifica?: string | null;
  nomeScuolaAttuale?: string | null;
  rifiuto?: RifiutoVerifica | null;
}) {
  return (
    <div className="space-y-6">
      <SezioneAnagrafica nome={nome} cognome={cognome} dataNascita={dataNascita} />
      <SezioneTelefono userId={userId} telefonoIniziale={telefonoIniziale} />
      <SezioneScuola
        userId={userId}
        scuolaValueIniziale={scuolaValueIniziale}
        classeIniziale={classeIniziale}
        statoVerifica={statoVerifica}
        nomeScuolaAttuale={nomeScuolaAttuale}
        rifiuto={rifiuto}
      />
      <SezioneAree userId={userId} areeIniziali={areeInteresseIniziali} />
    </div>
  );
}
