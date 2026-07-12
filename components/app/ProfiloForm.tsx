"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import ScuolaCascadeFields, { SCUOLA_ALTRO, type ScuolaCascadeValue } from "@/components/ScuolaCascadeFields";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { CLASSI } from "@/lib/registrazione";
import AreeInteresseGrid from "./AreeInteresseGrid";

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
            {dataNascita ? new Date(dataNascita).toLocaleDateString("it-IT", { dateStyle: "long" }) : "—"}
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

  async function handleSalva() {
    setStato("salvando");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ telefono: telefono.trim() || null }).eq("id", userId);
      setStato(error ? "errore" : "ok");
    } catch {
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
        <MessaggioSalvataggio stato={stato} messaggioErrore="Non è stato possibile salvare il telefono. Riprova più tardi." />
      </div>
    </div>
  );
}

function SezioneScuola({
  userId,
  scuolaValueIniziale,
  classeIniziale,
}: {
  userId: string;
  scuolaValueIniziale: ScuolaCascadeValue;
  classeIniziale: string;
}) {
  const [scuolaValue, setScuolaValue] = useState<ScuolaCascadeValue>(scuolaValueIniziale);
  const [classe, setClasse] = useState(classeIniziale);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [stato, setStato] = useState<StatoSalvataggio>("idle");

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
      const { error } = await supabase
        .from("student_profiles")
        .update({ school_code: scuolaValue.scuola, classe: classeLabel })
        .eq("user_id", userId);
      setStato(error ? "errore" : "ok");
    } catch {
      setStato("errore");
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Scuola e classe</h2>
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
        <MessaggioSalvataggio stato={stato} messaggioErrore="Non è stato possibile salvare. Riprova più tardi." />
      </div>
    </div>
  );
}

function SezioneAree({ userId, areeIniziali }: { userId: string; areeIniziali: string[] }) {
  const [aree, setAree] = useState<string[]>(areeIniziali);
  const [baseline, setBaseline] = useState<string[]>(areeIniziali);
  const [stato, setStato] = useState<StatoSalvataggio>("idle");

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
    } catch {
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
        <MessaggioSalvataggio stato={stato} messaggioErrore="Non è stato possibile salvare le aree. Riprova più tardi." />
      </div>
    </div>
  );
}

function BloccoPrivacy({ userId }: { userId: string }) {
  const router = useRouter();
  const [esportando, setEsportando] = useState(false);
  const [confermaRichiesta, setConfermaRichiesta] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [erroreEliminazione, setErroreEliminazione] = useState<string | null>(null);

  async function handleScaricaDati() {
    setEsportando(true);
    try {
      const supabase = createClient();
      const [profilo, studente, aree, attivita, webinar] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("student_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("student_area_interests").select("area_slug, created_at").eq("user_id", userId),
        supabase.from("student_activities").select("*").eq("student_id", userId),
        supabase.from("webinar_registrations").select("*").eq("user_id", userId),
      ]);

      const datiEsportati = {
        profilo: profilo.data,
        scuola: studente.data,
        areeInteresse: aree.data ?? [],
        attivita: attivita.data ?? [],
        prenotazioniWebinar: webinar.data ?? [],
        esportatoIl: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(datiEsportati, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kireo-i-miei-dati.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setEsportando(false);
    }
  }

  async function handleEliminaDefinitivo() {
    setEliminando(true);
    setErroreEliminazione(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_own_account");
      if (error) {
        setErroreEliminazione("Non è stato possibile completare l'operazione. Riprova più tardi o scrivici da /contatti.");
        setEliminando(false);
        return;
      }
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setErroreEliminazione("Non è stato possibile completare l'operazione. Riprova più tardi o scrivici da /contatti.");
      setEliminando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Privacy</h2>
        <p className="mt-1 text-sm text-kireo-muted">Scarica una copia di tutti i tuoi dati salvati su KIREO, in formato JSON.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={handleScaricaDati} disabled={esportando}>
          {esportando ? "Preparazione…" : "Scarica i miei dati"}
        </Button>
      </div>

      <div className="rounded-2xl border border-red-500/30 bg-kireo-card p-6">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Elimina il mio account</h2>
        <p className="mt-1 text-sm text-kireo-muted">
          Rimuove definitivamente il tuo profilo, la scuola collegata, le aree di interesse, le attività e le
          prenotazioni ai webinar. L&apos;operazione non è reversibile.
        </p>

        {!confermaRichiesta ? (
          <button
            type="button"
            onClick={() => setConfermaRichiesta(true)}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-red-500/50 px-6 py-3 font-sans text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
          >
            Elimina il mio account
          </button>
        ) : (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <p className="text-sm text-red-300">Sei sicuro? Questa azione è definitiva e non si può annullare.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleEliminaDefinitivo}
                disabled={eliminando}
                className="inline-flex items-center justify-center rounded-full bg-red-500 px-6 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {eliminando ? "Eliminazione…" : "Sì, elimina definitivamente"}
              </button>
              <Button type="button" variant="ghost" onClick={() => setConfermaRichiesta(false)} disabled={eliminando}>
                Annulla
              </Button>
            </div>
            {erroreEliminazione && <p className="mt-3 text-sm text-red-400">{erroreEliminazione}</p>}
          </div>
        )}
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
}: {
  userId: string;
  nome: string;
  cognome: string;
  dataNascita: string | null;
  telefonoIniziale: string | null;
  scuolaValueIniziale: ScuolaCascadeValue;
  classeIniziale: string;
  areeInteresseIniziali: string[];
}) {
  return (
    <div className="space-y-6">
      <SezioneAnagrafica nome={nome} cognome={cognome} dataNascita={dataNascita} />
      <SezioneTelefono userId={userId} telefonoIniziale={telefonoIniziale} />
      <SezioneScuola userId={userId} scuolaValueIniziale={scuolaValueIniziale} classeIniziale={classeIniziale} />
      <SezioneAree userId={userId} areeIniziali={areeInteresseIniziali} />
      <BloccoPrivacy userId={userId} />
    </div>
  );
}
