"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { erroreOrePcto } from "@/lib/eventi/orePcto";
import { formattaDataOra } from "@/lib/formato";
import {
  messaggioCorrezioneOre,
  oreDueDecimali,
  testiCorrezioneOre,
  type AnteprimaCorrezione,
} from "@/lib/eventi/oreDallOrario";

// LA CORREZIONE DELLE ORE PCTO, SOLO ADMIN (Mario, 26/10 — `20261029100000`).
// Le ore di un evento si calcolano dall'orario; l'admin può sempre fissarle a
// mano, in tutte e due le direzioni, e la correzione resta registrata con chi
// e quando. Uno spostamento della finestra la toglie.
//
// ⚠️ NON È UN UPDATE DAL CLIENT, ed è il punto: dal 26/10 `ore_pcto` non è
// scrivibile da `authenticated` (privilegi di colonna), quindi l'unica strada
// è `correggi_ore_evento`, che scrive anche il segno. Un update diretto
// prenderebbe `permission denied`.
//
// Le frasi sotto il campo dicono cosa la correzione fa e cosa non fa — il
// massimo vale per la certificazione automatica, non per quella della scuola —
// con i numeri di `anteprima_correzione_ore`, cioè dal database.
//
// ⚠️ IL RIQUADRO SEGUE IL SERVER (Mario, giro del 27/10). Aperto con il campo a
// 2, l'orario spostato da 11:35 a 13:35: la riga di stato è passata a «3,00»,
// il campo è rimasto 2 e la frase diceva ancora «…il massimo riconoscibile resta
// 1,00…». L'anteprima si chiedeva solo all'apertura, e il `router.refresh()`
// dello spostamento cambiava le props senza rilanciarla. La frase vecchia era
// pericolosa non perché fosse vecchia, ma perché stava accanto a numeri nuovi e
// ne prendeva la freschezza. Ora lo stato del server (ore, correzione, orario,
// chiusura) è la chiave dell'anteprima: quando cambia, la frase sparisce finché
// la nuova non arriva. RICALCOLO e non chiusura: un riquadro che si chiude da
// solo è un'altra sorpresa, e butterebbe un valore che l'admin stava scrivendo.
//
// ⚠️ LA REGOLA DEL CAMPO (Mario): un valore non ancora toccato è una proposta
// nostra e si aggiorna; un valore toccato è una scelta di chi scrive e non si
// tocca. La differenza non è il contenuto del campo: è di chi è.
type StatoAnteprima = { chiave: string; dati: AnteprimaCorrezione | "fallita" };

export default function CorreggiOreForm({
  eventoId,
  oreAttuali,
  fissateIl,
  fissateDa,
  dataInizio,
  dataFine,
  chiusaIl,
}: {
  eventoId: string;
  oreAttuali: number | string;
  fissateIl: string | null;
  dataInizio: string;
  dataFine: string | null;
  chiusaIl: string | null;
  // Il nome di chi ha corretto (Mario, 26/10): la colonna lo registra e una
  // chiave esterna impedisce di cancellare quell'account per non perderlo —
  // senza questa riga, si bloccherebbe una cancellazione per conservare un nome
  // che nessuno legge. Null quando non c'è correzione, o quando il nome non si
  // è potuto leggere (lo dice la riga, senza inventarlo).
  fissateDa: string | null;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [valoreScritto, setValoreScritto] = useState<string | null>(null);
  const valore = valoreScritto ?? String(Number(oreAttuali));
  const [anteprima, setAnteprima] = useState<StatoAnteprima | null>(null);
  const [giro, setGiro] = useState(0);
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);

  // Il giro entra nella chiave perché ogni apertura rilegga: una risposta di
  // un'apertura di prima non descrive per forza lo stato di adesso.
  const chiave = `${oreAttuali}|${fissateIl ?? ""}|${dataInizio}|${dataFine ?? ""}|${chiusaIl ?? ""}|${giro}`;
  useEffect(() => {
    if (!aperto) return;
    let attivo = true;
    createClient()
      .rpc("anteprima_correzione_ore", { p_evento_id: eventoId })
      .then(({ data, error }) => {
        if (!attivo) return;
        const riga = Array.isArray(data) ? (data[0] as AnteprimaCorrezione | undefined) : undefined;
        if (error || !riga) {
          console.error("CorreggiOreForm: anteprima", error ?? "nessuna riga");
          setAnteprima({ chiave, dati: "fallita" });
          return;
        }
        setAnteprima({ chiave, dati: riga });
      }, (err: unknown) => {
        if (!attivo) return;
        console.error("CorreggiOreForm: anteprima", err);
        setAnteprima({ chiave, dati: "fallita" });
      });
    return () => {
      attivo = false;
    };
  }, [aperto, chiave, eventoId]);

  // `null` finché la risposta per QUESTO stato non c'è: si legge «in corso».
  const anteprimaCorrente = anteprima && anteprima.chiave === chiave ? anteprima.dati : null;

  const erroreCampo = valore.trim() === "" ? "Scrivi quante ore vale l'incontro." : erroreOrePcto(valore);
  const numero = erroreCampo ? null : Number(valore);
  const righe = anteprimaCorrente && anteprimaCorrente !== "fallita" ? testiCorrezioneOre(anteprimaCorrente, numero) : [];

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setMessaggio(null);
    if (erroreCampo || numero === null) {
      setMessaggio({ ok: false, testo: erroreCampo ?? "Scrivi quante ore vale l'incontro." });
      return;
    }
    setSalvataggio(true);
    try {
      const { error } = await createClient().rpc("correggi_ore_evento", { p_evento_id: eventoId, p_ore: numero });
      if (error) {
        console.error("CorreggiOreForm:", error);
        setMessaggio({ ok: false, testo: messaggioCorrezioneOre(error.message) });
        return;
      }
      setMessaggio({ ok: true, testo: messaggioCorrezioneOre(null) });
      // Salvato, il numero è diventato un dato del server: il campo torna a
      // seguirlo (la regola del campo, qui sopra).
      setValoreScritto(null);
      router.refresh();
    } catch (err) {
      console.error("CorreggiOreForm:", err);
      setMessaggio({ ok: false, testo: messaggioCorrezioneOre("eccezione") });
    } finally {
      setSalvataggio(false);
    }
  }

  // ⚠️ Testi della riga di stato e del bottone: miei, provvisori.
  //
  // ⚠️ SENZA CORREZIONE LA SORGENTE SI TACE: la prima stesura diceva
  // «calcolate dall'orario» per ogni evento non corretto, ed era falso per gli
  // eventi creati prima del 26/10, dove le ore le ha scritte l'ente — e il
  // database non distingue i due casi. La correzione a mano invece si nomina:
  // è un fatto registrato, con data.
  const stato = fissateIl
    ? fissateDa
      ? `Ore PCTO: ${oreDueDecimali(oreAttuali)}, fissate a mano da ${fissateDa} il ${formattaDataOra(fissateIl, "short")}.`
      : `Ore PCTO: ${oreDueDecimali(oreAttuali)}, fissate a mano il ${formattaDataOra(fissateIl, "short")} (non siamo riusciti a leggere da chi).`
    : `Ore PCTO: ${oreDueDecimali(oreAttuali)}.`;

  if (!aperto) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-kireo-light">{stato}</p>
        <button type="button" onClick={() => { setGiro((g) => g + 1); setAperto(true); }} className="text-sm text-kireo-orange underline underline-offset-2">
          Correggi le ore PCTO
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={salva} className="space-y-3">
      <p className="text-sm font-semibold text-kireo-light">Correggi le ore PCTO</p>
      <p className="text-xs text-kireo-muted">{stato}</p>
      <label className="block text-xs text-kireo-muted">
        Ore PCTO
        <input
          type="number"
          min="0"
          step="0.01"
          value={valore}
          onChange={(e) => setValoreScritto(e.target.value)}
          aria-invalid={Boolean(erroreCampo)}
          className="mt-1 block w-32 rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
        />
      </label>
      {erroreCampo && <p className="text-xs text-red-400">{erroreCampo}</p>}
      {anteprimaCorrente === null && <p className="text-xs text-kireo-muted">Calcolo il massimo riconoscibile…</p>}
      {/* Mio, provvisorio: senza l'anteprima la correzione resta possibile —
          non cancella la scelta di nessuno, e il numero lo scrive chi lo vede —
          ma si dice che manca la frase sul massimo. */}
      {anteprimaCorrente === "fallita" && (
        <p className="text-xs text-red-400">Non siamo riusciti a calcolare il massimo riconoscibile per questo incontro: la correzione resta possibile.</p>
      )}
      {righe.map((riga) => (
        <p key={riga} className="text-xs text-kireo-light">
          {riga}
        </p>
      ))}
      <div className="flex items-center gap-4">
        {/* Spento mentre l'anteprima di QUESTO stato si sta leggendo (Mario,
            27/10): il bottone che conferma non si preme accanto a una frase che
            non c'è ancora. Ad anteprima FALLITA resta acceso, come deciso il
            26/10: la correzione non cancella la scelta di nessuno, e la riga
            rossa dice che la frase sul massimo manca. */}
        <Button type="submit" variant="outline" disabled={salvataggio || anteprimaCorrente === null}>
          {salvataggio ? "Salvataggio…" : "Salva le ore"}
        </Button>
        <button type="button" onClick={() => setAperto(false)} className="text-xs text-kireo-muted underline underline-offset-2">
          Annulla
        </button>
      </div>
      {messaggio && <p className={`text-xs ${messaggio.ok ? "text-kireo-green-light" : "text-red-400"}`}>{messaggio.testo}</p>}
    </form>
  );
}
