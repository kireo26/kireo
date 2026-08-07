"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registraAttivita } from "@/lib/app/activityLog";
import type { Elaborato } from "@/lib/workshop/elaborato-config";
import { valoreVuoto, type ValoreSezione } from "@/lib/workshop/elaboratoValore";
import { Button } from "@/components/Button";
import StepperFasi from "./StepperFasi";
import SezioneEditor from "./SezioneEditor";

type FeedbackFinale = { punti_forza: string[]; aree_miglioramento: string[]; domanda_stimolante: string };

export default function ElaboratoEditor({
  iscrizioneId,
  workshopSlug,
  ruoloSlug,
  ruoloTitolo,
  areaSlug,
  iscrizioneCreataIl,
  elaborato,
  statoIniziale,
}: {
  iscrizioneId: string;
  workshopSlug: string;
  ruoloSlug: string;
  ruoloTitolo: string;
  areaSlug: string;
  iscrizioneCreataIl: string;
  elaborato: Elaborato;
  statoIniziale: {
    contenuto: Record<string, ValoreSezione>;
    faseCorrente: string | null;
    fasiCompletate: string[];
    stato: "bozza" | "consegnato";
    feedbackAi: FeedbackFinale | null;
  };
}) {
  const router = useRouter();
  const [contenuto, setContenuto] = useState<Record<string, ValoreSezione>>(statoIniziale.contenuto ?? {});
  const [fasiCompletate, setFasiCompletate] = useState<string[]>(statoIniziale.fasiCompletate ?? []);
  const [faseCorrenteId, setFaseCorrenteId] = useState<string>(
    statoIniziale.faseCorrente && elaborato.fasi.some((f) => f.id === statoIniziale.faseCorrente)
      ? statoIniziale.faseCorrente
      : elaborato.fasi[0].id,
  );
  const [statoSalvataggio, setStatoSalvataggio] = useState<"salvato" | "salvataggio" | "errore">("salvato");
  const [consegnato, setConsegnato] = useState(statoIniziale.stato === "consegnato");
  const [feedbackFinale, setFeedbackFinale] = useState<FeedbackFinale | null>(statoIniziale.feedbackAi);
  const [consegnaInCorso, setConsegnaInCorso] = useState(false);
  const [erroreConsegna, setErroreConsegna] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primoRenderRef = useRef(true);

  const salva = useCallback(
    async (dati: { contenuto: Record<string, ValoreSezione>; faseCorrente: string; fasiCompletate: string[] }) => {
      setStatoSalvataggio("salvataggio");
      const supabase = createClient();
      const { error } = await supabase.from("workshop_elaborati").upsert(
        {
          iscrizione_id: iscrizioneId,
          contenuto: dati.contenuto,
          fase_corrente: dati.faseCorrente,
          fasi_completate: dati.fasiCompletate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "iscrizione_id" },
      );
      setStatoSalvataggio(error ? "errore" : "salvato");
    },
    [iscrizioneId],
  );

  // Salvataggio automatico con debounce ~1,5s: non al primo render (lo
  // stato iniziale viene già dal DB, riscriverlo subito sarebbe inutile).
  useEffect(() => {
    if (primoRenderRef.current) {
      primoRenderRef.current = false;
      return;
    }
    if (consegnato) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void salva({ contenuto, faseCorrente: faseCorrenteId, fasiCompletate });
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [contenuto, faseCorrenteId, fasiCompletate, consegnato, salva]);

  const faseCorrente = useMemo(
    () => elaborato.fasi.find((f) => f.id === faseCorrenteId) ?? elaborato.fasi[0],
    [elaborato, faseCorrenteId],
  );

  function aggiornaValore(sezioneId: string, valore: ValoreSezione) {
    setContenuto((prev) => ({ ...prev, [sezioneId]: valore }));
  }

  function completaIncarico() {
    setFasiCompletate((prev) => (prev.includes(faseCorrente.id) ? prev : [...prev, faseCorrente.id]));
    const indice = elaborato.fasi.findIndex((f) => f.id === faseCorrente.id);
    const prossima = elaborato.fasi[indice + 1];
    if (prossima) setFaseCorrenteId(prossima.id);
  }

  async function consegnaProgetto() {
    setErroreConsegna(null);
    setConsegnaInCorso(true);
    // La route legge il contenuto autorevole dal DB, non quello del
    // client: forza subito il salvataggio in sospeso prima di consegnare.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await salva({ contenuto, faseCorrente: faseCorrenteId, fasiCompletate });

    try {
      const res = await fetch("/api/workshop/elaborato/consegna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iscrizioneId, workshopSlug, ruoloSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroreConsegna(data.errore ?? "Non è stato possibile consegnare il progetto.");
        return;
      }
      await registraAttivita(areaSlug, "workshop_pcto");
      setFeedbackFinale(data.feedback ?? null);
      setConsegnato(true);
      router.refresh();
    } catch {
      setErroreConsegna("Errore di connessione. Riprova.");
    } finally {
      setConsegnaInCorso(false);
    }
  }

  const percentualeCompletamento = Math.round((fasiCompletate.length / elaborato.fasi.length) * 100);
  const ultimaFase = elaborato.fasi[elaborato.fasi.length - 1];
  const tutteLeFasiCompletate = elaborato.fasi.every((f) => fasiCompletate.includes(f.id));

  if (consegnato) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-kireo-green/30 bg-kireo-green/5 p-6 sm:p-8">
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Progetto consegnato</h2>
          <p className="mt-1 text-sm text-kireo-muted">
            Hai consegnato il progetto per il ruolo di {ruoloTitolo}. Ecco il feedback finale.
          </p>
        </div>
        {feedbackFinale ? (
          <div className="space-y-3 rounded-2xl border border-white/5 bg-kireo-card p-6 text-sm sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-kireo-green-light">Punti di forza</p>
              <ul className="mt-1 list-inside list-disc text-kireo-light/90">
                {feedbackFinale.punti_forza.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-kireo-orange">Da migliorare</p>
              <ul className="mt-1 list-inside list-disc text-kireo-light/90">
                {feedbackFinale.aree_miglioramento.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <p className="rounded-lg bg-white/5 px-3 py-2 text-kireo-light/90">{feedbackFinale.domanda_stimolante}</p>
          </div>
        ) : (
          <p className="text-sm text-kireo-muted">Nessun feedback automatico disponibile per questa consegna.</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <StepperFasi
        fasi={elaborato.fasi}
        faseCorrenteId={faseCorrenteId}
        fasiCompletate={fasiCompletate}
        iscrizioneCreataIl={iscrizioneCreataIl}
        onSeleziona={setFaseCorrenteId}
      />

      <div className="space-y-6">
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">{faseCorrente.titolo}</h2>
            <span className="flex-none text-xs text-kireo-muted">
              {statoSalvataggio === "salvataggio" ? "Salvataggio…" : statoSalvataggio === "errore" ? "Errore nel salvataggio" : "Salvato"}
            </span>
          </div>
          <p className="mt-1 text-sm text-kireo-muted">{faseCorrente.consegna}</p>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-kireo-green transition-all" style={{ width: `${percentualeCompletamento}%` }} />
          </div>
          <p className="mt-1 text-xs text-kireo-muted">{percentualeCompletamento}% del progetto completato</p>
        </div>

        {faseCorrente.sezioni.map((sezione) => (
          <SezioneEditor
            key={sezione.id}
            sezione={sezione}
            valore={contenuto[sezione.id] ?? valoreVuoto(sezione)}
            onChange={(valore) => aggiornaValore(sezione.id, valore)}
            iscrizioneId={iscrizioneId}
            workshopSlug={workshopSlug}
            ruoloSlug={ruoloSlug}
            faseId={faseCorrente.id}
          />
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-kireo-card p-6">
          <p className="text-sm text-kireo-muted">
            {fasiCompletate.includes(faseCorrente.id)
              ? "Incarico completato — puoi tornare indietro quando vuoi."
              : "Quando hai finito, segna l'incarico come completato."}
          </p>
          {!fasiCompletate.includes(faseCorrente.id) && (
            <Button type="button" onClick={completaIncarico} className="flex-none">
              Completa incarico
            </Button>
          )}
        </div>

        {faseCorrente.id === ultimaFase.id && (
          <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-6 sm:p-8">
            <h2 className="font-heading text-base font-semibold text-kireo-light">Pronto a consegnare?</h2>
            <p className="mt-1 text-sm text-kireo-muted">
              Prima di consegnare, parla con il cliente in chat per presentargli il tuo lavoro — ti aiuta a capire se manca
              qualcosa.
            </p>
            {!tutteLeFasiCompletate && (
              <p className="mt-2 text-sm text-kireo-orange">
                Non hai ancora completato tutti gli incarichi: puoi consegnare comunque, ma prova a finirli prima.
              </p>
            )}
            <Button type="button" onClick={consegnaProgetto} disabled={consegnaInCorso} className="mt-4">
              {consegnaInCorso ? "Consegna in corso…" : "Consegna il progetto"}
            </Button>
            {erroreConsegna && <p className="mt-2 text-sm text-red-400">{erroreConsegna}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
