"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { istanteDaOrarioItaliano, orarioItalianoDaIstante } from "@/lib/formato";
import { messaggioSpostaFinestra } from "@/lib/eventi/spostaFinestra";
import { avvisoDurataDiretta, ETICHETTA_CONFERMA_DURATA } from "@/lib/eventi/durataDiretta";
import { testoAnteprimaSpostamento, TESTO_ANTEPRIMA_FALLITA, type AnteprimaSpostamento } from "@/lib/eventi/oreDallOrario";

// L'anteprima vale per UNA coppia di date: si porta dietro la chiave con cui è
// stata chiesta, e lo spostamento parte solo se la chiave è quella dei campi
// adesso. Senza, una risposta arrivata tardi descriverebbe un orario che a
// schermo non c'è più.
type StatoAnteprima =
  | { chiave: string; tipo: "pronta"; dati: AnteprimaSpostamento }
  | { chiave: string; tipo: "fallita" };

// SPOSTARE LA FINESTRA DI UNA DIRETTA, dal prodotto (18/10). Quella sera la
// finestra è stata spostata due volte in SQL perché non esisteva nessun'altra
// strada: un ente vero, nella stessa situazione, sarebbe rimasto fermo. Tocca
// SOLO inizio e fine, e lo fa passando da `sposta_finestra_evento` (ente
// organizzatore o admin, mai a diretta chiusa).
//
// Gli orari si leggono e si scrivono IN ORA ITALIANA: un orario di scuola, non
// un orario del browser di chi compila (vedi `istanteDaOrarioItaliano`).
export default function SpostaFinestraForm({
  eventoId,
  dataInizio,
  dataFine,
}: {
  eventoId: string;
  dataInizio: string;
  dataFine: string | null;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [inizio, setInizio] = useState(() => orarioItalianoDaIstante(dataInizio));
  const [fine, setFine] = useState(() => (dataFine ? orarioItalianoDaIstante(dataFine) : ""));
  const [salvataggio, setSalvataggio] = useState(false);
  const [confermaDurata, setConfermaDurata] = useState(false);
  // Una diretta lunga si fa confermare anche qui: è da qui che il 26/10 è
  // uscita quella di diciotto ore (vedi `lib/eventi/durataDiretta.ts`).
  const isoI = istanteDaOrarioItaliano(inizio);
  const isoF = istanteDaOrarioItaliano(fine);
  const avvisoDurata = isoI && isoF ? avvisoDurataDiretta(new Date(isoI).getTime(), new Date(isoF).getTime()) : null;
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);

  // LE ORE CHE CAMBIANO, dette prima del clic (26/10, `20261029100000`): lo
  // spostamento le ricalcola, e se erano state fissate a mano le sostituisce.
  // Il numero viene da `anteprima_spostamento_finestra`, cioè dalla stessa
  // funzione che il trigger usa per scriverlo — nessuna copia della formula.
  const chiaveDate = isoI && isoF && new Date(isoF).getTime() > new Date(isoI).getTime() ? `${isoI}|${isoF}` : null;
  const [anteprima, setAnteprima] = useState<StatoAnteprima | null>(null);
  const [giroAnteprima, setGiroAnteprima] = useState(0);
  // Il giro entra nella chiave: «Riprova il calcolo» rende vecchia la risposta
  // fallita, e finché la nuova non arriva lo stato è «in corso» — derivato,
  // non scritto (nessun `setState` sincrono dentro l'effetto).
  const chiave = chiaveDate ? `${chiaveDate}|${giroAnteprima}` : null;
  useEffect(() => {
    if (!aperto || !chiave) return;
    const [pInizio, pFine] = chiave.split("|");
    let attivo = true;
    createClient()
      .rpc("anteprima_spostamento_finestra", { p_evento_id: eventoId, p_data_inizio: pInizio, p_data_fine: pFine })
      .then(({ data, error }) => {
        if (!attivo) return;
        const riga = Array.isArray(data) ? (data[0] as AnteprimaSpostamento | undefined) : undefined;
        if (error || !riga) {
          console.error("SpostaFinestraForm: anteprima", error ?? "nessuna riga");
          setAnteprima({ chiave, tipo: "fallita" });
          return;
        }
        setAnteprima({ chiave, tipo: "pronta", dati: riga });
      }, (err: unknown) => {
        if (!attivo) return;
        console.error("SpostaFinestraForm: anteprima", err);
        setAnteprima({ chiave, tipo: "fallita" });
      });
    return () => {
      attivo = false;
    };
  }, [aperto, chiave, eventoId]);
  const anteprimaCorrente = anteprima && anteprima.chiave === chiave ? anteprima : null;
  const calcoloInCorso = chiave !== null && anteprimaCorrente === null;
  // ⚠️ IL BOTTONE È SPENTO IN TUTTI E DUE GLI STATI, in corso e fallita (Mario,
  // 26/10): un bottone acceso che non risponde lo si preme di nuovo pensando
  // che il prodotto sia rotto — «le frasi si leggono, i bottoni si credono».
  // La spiegazione e «Riprova il calcolo» restano accanto.
  //
  // ⚠️ E L'ASIMMETRIA CON LA CREAZIONE È VOLUTA: lì un'anteprima che non
  // risponde non ferma niente (`CreaEventoForm`), qui sì. La creazione non
  // distrugge niente e il numero lo scrive comunque il trigger; lo spostamento
  // cancella una correzione fatta da una persona. Non è la stessa situazione,
  // e infatti non ha la stessa cura.
  const anteprimaNonPronta = chiave !== null && anteprimaCorrente?.tipo !== "pronta";
  const testoOre = anteprimaCorrente?.tipo === "pronta" ? testoAnteprimaSpostamento(anteprimaCorrente.dati) : null;

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setMessaggio(null);
    const isoInizio = istanteDaOrarioItaliano(inizio);
    const isoFine = istanteDaOrarioItaliano(fine);
    if (!isoInizio || !isoFine) {
      setMessaggio({ ok: false, testo: messaggioSpostaFinestra("date_mancanti") });
      return;
    }
    if (new Date(isoFine).getTime() <= new Date(isoInizio).getTime()) {
      setMessaggio({ ok: false, testo: messaggioSpostaFinestra("fine_prima_di_inizio") });
      return;
    }
    if (avvisoDurata && !confermaDurata) {
      setMessaggio({ ok: false, testo: avvisoDurata });
      return;
    }
    // ⚠️ SENZA L'ANTEPRIMA DI QUESTE DATE LO SPOSTAMENTO NON PARTE (Mario):
    // può cancellare una correzione a mano, e una cosa che cancella la scelta
    // di qualcun altro non si conferma al buio. Il testo e il bottone per
    // riprovare sono già a schermo; qui non si dice niente di nuovo.
    if (anteprimaCorrente?.tipo !== "pronta") return;
    setSalvataggio(true);
    try {
      const { error } = await createClient().rpc("sposta_finestra_evento", {
        p_evento_id: eventoId,
        p_data_inizio: isoInizio,
        p_data_fine: isoFine,
      });
      if (error) {
        console.error("SpostaFinestraForm:", error);
        setMessaggio({ ok: false, testo: messaggioSpostaFinestra(error.message) });
        return;
      }
      setMessaggio({ ok: true, testo: messaggioSpostaFinestra(null) });
      // Il resto della pagina (la console, l'intestazione) legge le date dal
      // server: si ricarica, invece di tenere due copie della finestra.
      router.refresh();
    } catch (err) {
      console.error("SpostaFinestraForm:", err);
      setMessaggio({ ok: false, testo: messaggioSpostaFinestra("eccezione") });
    } finally {
      setSalvataggio(false);
    }
  }

  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className="text-sm text-kireo-orange underline underline-offset-2">
        Sposta l&apos;orario della diretta
      </button>
    );
  }

  return (
    <form onSubmit={salva} className="space-y-3">
      <p className="text-sm font-semibold text-kireo-light">Sposta l&apos;orario della diretta</p>
      <div className="flex flex-wrap gap-4">
        <label className="text-xs text-kireo-muted">
          Inizio (ora italiana)
          <input
            type="datetime-local"
            value={inizio}
            onChange={(e) => { setInizio(e.target.value); setConfermaDurata(false); }}
            className="mt-1 block rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
          />
        </label>
        <label className="text-xs text-kireo-muted">
          Fine (ora italiana)
          <input
            type="datetime-local"
            value={fine}
            onChange={(e) => { setFine(e.target.value); setConfermaDurata(false); }}
            className="mt-1 block rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
          />
        </label>
      </div>
      {calcoloInCorso && <p className="text-xs text-kireo-muted">Calcolo le ore con il nuovo orario…</p>}
      {anteprimaCorrente?.tipo === "fallita" && (
        <div className="space-y-1">
          <p className="text-xs text-red-400">{TESTO_ANTEPRIMA_FALLITA}</p>
          <button
            type="button"
            onClick={() => setGiroAnteprima((g) => g + 1)}
            className="text-xs text-kireo-orange underline underline-offset-2"
          >
            Riprova il calcolo
          </button>
        </div>
      )}
      {testoOre && <p className="text-xs text-kireo-light">{testoOre}</p>}
      {avvisoDurata && (
        <label className="flex items-start gap-2 text-xs text-kireo-light">
          <input type="checkbox" checked={confermaDurata} onChange={(e) => setConfermaDurata(e.target.checked)} className="mt-0.5" />
          <span>
            {avvisoDurata} {ETICHETTA_CONFERMA_DURATA}
          </span>
        </label>
      )}
      <div className="flex items-center gap-4">
        <Button type="submit" variant="outline" disabled={salvataggio || anteprimaNonPronta}>
          {salvataggio ? "Salvataggio…" : "Salva il nuovo orario"}
        </Button>
        <button type="button" onClick={() => setAperto(false)} className="text-xs text-kireo-muted underline underline-offset-2">
          Annulla
        </button>
      </div>
      {messaggio && <p className={`text-xs ${messaggio.ok ? "text-kireo-green-light" : "text-red-400"}`}>{messaggio.testo}</p>}
    </form>
  );
}
