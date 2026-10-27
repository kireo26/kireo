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
//
// ⚠️ IL RIQUADRO SEGUE IL SERVER (Mario, 27/10). Aperto mentre l'admin
// correggeva le ore, il riquadro teneva l'anteprima di prima: «…da 2,00 a 3,00»
// accanto a ore già fissate a mano, cioè SENZA la frase che avvisa che lo
// spostamento cancella una correzione — e con il bottone acceso, perché
// l'anteprima risultava «pronta». Pronta vuol dire «ha risposto», non «ha
// risposto su questo mondo». Quindi lo stato del server (ore, correzione, fine)
// entra nella chiave: il `router.refresh()` dopo l'azione dell'altro riquadro la
// cambia, l'anteprima si rilegge, e intanto né la frase vecchia né il bottone ci
// sono. Il caso di due persone su due computer, dove nessun refresh arriva, lo
// chiude il database (`stato_cambiato`, `20261030100000`).
//
// ⚠️ LA REGOLA DEI CAMPI (Mario): un valore non ancora toccato è una proposta
// nostra e si aggiorna; un valore toccato è una scelta di chi scrive e non si
// tocca. La differenza non è il contenuto del campo: è di chi è.
export default function SpostaFinestraForm({
  eventoId,
  dataInizio,
  dataFine,
  oreAttuali,
  fissateIl,
}: {
  eventoId: string;
  dataInizio: string;
  dataFine: string | null;
  oreAttuali: number | string | null;
  fissateIl: string | null;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [inizioScritto, setInizioScritto] = useState<string | null>(null);
  const [fineScritta, setFineScritta] = useState<string | null>(null);
  const inizio = inizioScritto ?? orarioItalianoDaIstante(dataInizio);
  const fine = fineScritta ?? (dataFine ? orarioItalianoDaIstante(dataFine) : "");
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
  // Il giro entra nella chiave: «Riprova il calcolo», una nuova apertura e un
  // `stato_cambiato` rendono vecchia la risposta di prima, e finché la nuova non
  // arriva lo stato è «in corso» — derivato, non scritto (nessun `setState`
  // sincrono dentro l'effetto). Lo stato del server entra per la ragione scritta
  // in testa.
  const statoServer = `${oreAttuali ?? ""}|${fissateIl ?? ""}|${dataFine ?? ""}`;
  const chiave = chiaveDate ? `${chiaveDate}|${statoServer}|${giroAnteprima}` : null;
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
    // Lo stato che la persona ha LETTO, non quello delle props: è su questo che
    // la frase sopra il bottone è stata scritta, ed è questo che il database
    // confronta (`stato_cambiato`). Nessun valore predefinito dall'altra parte.
    const visto = anteprimaCorrente.dati;
    setSalvataggio(true);
    try {
      const { error } = await createClient().rpc("sposta_finestra_evento", {
        p_evento_id: eventoId,
        p_data_inizio: isoInizio,
        p_data_fine: isoFine,
        p_ore_viste: visto.ore_attuali,
        p_fissate_viste: visto.fissate_a_mano,
        p_aveva_fine_vista: visto.aveva_fine,
      });
      if (error && error.message.includes("stato_cambiato")) {
        // Non un guasto: le ore sono cambiate mentre si guardava. Si rilegge
        // l'anteprima (il giro la rende vecchia anche se le props non sono
        // cambiate — fra due computer nessun refresh arriva) e la pagina.
        setMessaggio({ ok: false, testo: messaggioSpostaFinestra(error.message) });
        setGiroAnteprima((g) => g + 1);
        router.refresh();
        return;
      }
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
      <button type="button" onClick={() => { setGiroAnteprima((g) => g + 1); setAperto(true); }} className="text-sm text-kireo-orange underline underline-offset-2">
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
            onChange={(e) => { setInizioScritto(e.target.value); setConfermaDurata(false); }}
            className="mt-1 block rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
          />
        </label>
        <label className="text-xs text-kireo-muted">
          Fine (ora italiana)
          <input
            type="datetime-local"
            value={fine}
            onChange={(e) => { setFineScritta(e.target.value); setConfermaDurata(false); }}
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
