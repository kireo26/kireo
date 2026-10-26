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
export default function CorreggiOreForm({
  eventoId,
  oreAttuali,
  fissateIl,
  fissateDa,
}: {
  eventoId: string;
  oreAttuali: number | string;
  fissateIl: string | null;
  // Il nome di chi ha corretto (Mario, 26/10): la colonna lo registra e una
  // chiave esterna impedisce di cancellare quell'account per non perderlo —
  // senza questa riga, si bloccherebbe una cancellazione per conservare un nome
  // che nessuno legge. Null quando non c'è correzione, o quando il nome non si
  // è potuto leggere (lo dice la riga, senza inventarlo).
  fissateDa: string | null;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [valore, setValore] = useState(() => String(Number(oreAttuali)));
  const [anteprima, setAnteprima] = useState<AnteprimaCorrezione | "fallita" | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);

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
          setAnteprima("fallita");
          return;
        }
        setAnteprima(riga);
      }, (err: unknown) => {
        if (!attivo) return;
        console.error("CorreggiOreForm: anteprima", err);
        setAnteprima("fallita");
      });
    return () => {
      attivo = false;
    };
  }, [aperto, eventoId]);

  const erroreCampo = valore.trim() === "" ? "Scrivi quante ore vale l'incontro." : erroreOrePcto(valore);
  const numero = erroreCampo ? null : Number(valore);
  const righe = anteprima && anteprima !== "fallita" ? testiCorrezioneOre(anteprima, numero) : [];

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
        <button type="button" onClick={() => setAperto(true)} className="text-sm text-kireo-orange underline underline-offset-2">
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
          onChange={(e) => setValore(e.target.value)}
          aria-invalid={Boolean(erroreCampo)}
          className="mt-1 block w-32 rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
        />
      </label>
      {erroreCampo && <p className="text-xs text-red-400">{erroreCampo}</p>}
      {anteprima === null && <p className="text-xs text-kireo-muted">Calcolo il massimo riconoscibile…</p>}
      {/* Mio, provvisorio: senza l'anteprima la correzione resta possibile —
          non cancella la scelta di nessuno, e il numero lo scrive chi lo vede —
          ma si dice che manca la frase sul massimo. */}
      {anteprima === "fallita" && (
        <p className="text-xs text-red-400">Non siamo riusciti a calcolare il massimo riconoscibile per questo incontro: la correzione resta possibile.</p>
      )}
      {righe.map((riga) => (
        <p key={riga} className="text-xs text-kireo-light">
          {riga}
        </p>
      ))}
      <div className="flex items-center gap-4">
        <Button type="submit" variant="outline" disabled={salvataggio}>
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
