"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Elaborato } from "@/lib/workshop/elaborato-config";
import { sezioniIncomplete, valoreVuoto, type FaseStatoRiga, type FeedbackFinale, type ValoreSezione } from "@/lib/workshop/elaboratoValore";
import { Button } from "@/components/Button";
import StepperFasi from "./StepperFasi";
import FiduciaBar from "./FiduciaBar";
import RevisionePanel from "./RevisionePanel";
import FeedbackFinalePanel from "./FeedbackFinalePanel";
import SezioneEditor from "./SezioneEditor";

export default function ElaboratoEditor({
  iscrizioneId,
  workshopSlug,
  ruoloSlug,
  nomeCliente,
  elaborato,
  fasiStato: fasiStatoIniziali,
  contenuto: contenutoIniziale,
  fiducia: fiduciaIniziale,
  statoProgetto,
  feedbackFinale,
  messaggiTappaCorrente,
}: {
  iscrizioneId: string;
  workshopSlug: string;
  ruoloSlug: string;
  nomeCliente: string;
  elaborato: Elaborato;
  fasiStato: FaseStatoRiga[];
  contenuto: Record<string, ValoreSezione>;
  fiducia: number;
  statoProgetto: "bozza" | "consegnato";
  feedbackFinale: FeedbackFinale | null;
  messaggiTappaCorrente: number;
}) {
  const router = useRouter();
  const [contenuto, setContenuto] = useState<Record<string, ValoreSezione>>(contenutoIniziale);
  const [fasiStato, setFasiStato] = useState<FaseStatoRiga[]>(fasiStatoIniziali);
  const [statoSalvataggio, setStatoSalvataggio] = useState<"salvato" | "salvataggio" | "errore">("salvato");
  const [consegnaInCorso, setConsegnaInCorso] = useState(false);
  const [erroreConsegna, setErroreConsegna] = useState<string | null>(null);

  const primaTappaAperta = fasiStato.find((f) => f.stato !== "bloccata")?.faseId ?? elaborato.fasi[0].id;
  const [tappaSelezionataId, setTappaSelezionataId] = useState<string>(primaTappaAperta);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primoRenderRef = useRef(true);

  const salva = useCallback(
    async (nuovoContenuto: Record<string, ValoreSezione>) => {
      setStatoSalvataggio("salvataggio");
      const supabase = createClient();
      const { error } = await supabase
        .from("workshop_elaborati")
        .upsert({ iscrizione_id: iscrizioneId, contenuto: nuovoContenuto, updated_at: new Date().toISOString() }, { onConflict: "iscrizione_id" });
      setStatoSalvataggio(error ? "errore" : "salvato");
    },
    [iscrizioneId],
  );

  useEffect(() => {
    if (primoRenderRef.current) {
      primoRenderRef.current = false;
      return;
    }
    if (statoProgetto === "consegnato") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void salva(contenuto);
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [contenuto, statoProgetto, salva]);

  function aggiornaValore(sezioneId: string, valore: ValoreSezione) {
    setContenuto((prev) => ({ ...prev, [sezioneId]: valore }));
  }

  const indiceTappa = elaborato.fasi.findIndex((f) => f.id === tappaSelezionataId);
  const tappa = elaborato.fasi[indiceTappa] ?? elaborato.fasi[0];
  const rigaTappa = fasiStato.find((f) => f.faseId === tappa.id);
  const statoTappa = rigaTappa?.stato ?? "bloccata";

  const incomplete = useMemo(() => sezioniIncomplete(tappa, contenuto), [tappa, contenuto]);
  const chatSoddisfatta = statoTappa === "aperta" ? messaggiTappaCorrente >= tappa.chatMinima : true;
  const puoConsegnare = statoTappa === "aperta" && incomplete.length === 0 && chatSoddisfatta;

  async function consegnaTappa() {
    setErroreConsegna(null);
    setConsegnaInCorso(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await salva(contenuto);

    try {
      const res = await fetch("/api/workshop/elaborato/consegna-tappa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iscrizioneId, workshopSlug, ruoloSlug, faseId: tappa.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroreConsegna(data.errore ?? "Non è stato possibile consegnare la tappa.");
        return;
      }
      setFasiStato((prev) =>
        prev.map((f) => (f.faseId === tappa.id ? { ...f, stato: "consegnata", consegnataAt: new Date().toISOString() } : f)),
      );
      router.refresh();
    } catch {
      setErroreConsegna("Errore di connessione. Riprova.");
    } finally {
      setConsegnaInCorso(false);
    }
  }

  if (statoProgetto === "consegnato") {
    const ultima = elaborato.fasi.find((f) => f.ultima);
    const rigaFinale = ultima ? fasiStato.find((f) => f.faseId === ultima.id) : undefined;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-kireo-green/30 bg-kireo-green/5 p-6 sm:p-8">
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Progetto consegnato</h2>
          <p className="mt-1 text-sm text-kireo-muted">Hai completato il percorso. Ecco l&apos;esito finale.</p>
        </div>
        <FiduciaBar fiducia={fiduciaIniziale} nomeCliente={nomeCliente} />
        {rigaFinale?.revisione && (
          <RevisionePanel revisione={rigaFinale.revisione} reazioneCliente={rigaFinale.reazioneCliente} nomeCliente={nomeCliente} />
        )}
        {feedbackFinale ? (
          <FeedbackFinalePanel feedback={feedbackFinale} nomeCliente={nomeCliente} />
        ) : (
          <p className="text-sm text-kireo-muted">Il feedback finale arriva a breve.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FiduciaBar fiducia={fiduciaIniziale} nomeCliente={nomeCliente} />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <StepperFasi fasi={elaborato.fasi} fasiStato={fasiStato} tappaSelezionataId={tappaSelezionataId} onSeleziona={setTappaSelezionataId} />

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">{tappa.titolo}</h2>
              {statoTappa === "aperta" && (
                <span className="flex-none text-xs text-kireo-muted">
                  {statoSalvataggio === "salvataggio" ? "Salvataggio…" : statoSalvataggio === "errore" ? "Errore nel salvataggio" : "Salvato"}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-kireo-muted">{tappa.obiettivo}</p>
          </div>

          {statoTappa === "consegnata" && (
            <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-6 sm:p-8">
              <h3 className="font-heading text-base font-semibold text-kireo-light">In revisione</h3>
              <p className="mt-1 text-sm text-kireo-muted">
                Hai consegnato questa tappa. La revisione del tutor e la risposta di {nomeCliente} arrivano tra un paio di giorni.
              </p>
            </div>
          )}

          {statoTappa === "revisionata" && rigaTappa?.revisione && (
            <RevisionePanel revisione={rigaTappa.revisione} reazioneCliente={rigaTappa.reazioneCliente} nomeCliente={nomeCliente} />
          )}

          {tappa.sezioni.map((sezione) => (
            <SezioneEditor
              key={sezione.id}
              sezione={sezione}
              valore={contenuto[sezione.id] ?? valoreVuoto(sezione)}
              onChange={(valore) => aggiornaValore(sezione.id, valore)}
              iscrizioneId={iscrizioneId}
              workshopSlug={workshopSlug}
              ruoloSlug={ruoloSlug}
              faseId={tappa.id}
              disabled={statoTappa === "consegnata"}
            />
          ))}

          {statoTappa === "aperta" && (
            <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-kireo-light/90">
                    Hai parlato con {nomeCliente}: {messaggiTappaCorrente}/{tappa.chatMinima} messaggi
                  </p>
                  {!chatSoddisfatta && (
                    <Link href={`/app/workshop/${workshopSlug}/cliente`} className="text-xs text-kireo-orange underline underline-offset-2">
                      Parla con {nomeCliente} prima di consegnare →
                    </Link>
                  )}
                </div>
                <Button type="button" onClick={consegnaTappa} disabled={!puoConsegnare || consegnaInCorso} className="flex-none">
                  {consegnaInCorso ? "Consegna in corso…" : "Consegna la tappa"}
                </Button>
              </div>
              {incomplete.length > 0 && (
                <p className="mt-2 text-xs text-kireo-orange">Sezioni da completare: {incomplete.join(", ")}.</p>
              )}
              {erroreConsegna && <p className="mt-2 text-sm text-red-400">{erroreConsegna}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
