"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import DomandaConsegnaForm from "./DomandaConsegnaForm";
import {
  statoChiusura,
  testoEsitoChiusura,
  testoStatoChiusura,
  type EsitoChiusura,
  type StatoChiusura,
} from "@/lib/eventi/chiusuraDiretta";
import { rigaTocco } from "@/lib/eventi/tocco";
import { rigaFreschezza, numeroStantio, NUMERO_NON_AGGIORNATO, type Freschezza } from "@/lib/eventi/freschezza";

type Domanda = {
  id: string;
  testo: string;
  stato: string;
  creata_il: string;
  nome_completo: string | null;
  /** Chi ha toccato la riga DA PARTE NOSTRA, e quando: serve ai due moderatori per vedersi (vedi `lib/eventi/tocco.ts`). */
  stato_da_tipo: string | null;
  stato_il: string | null;
};

// Pannello di controllo diretta per l'organizzatore: SOLO aggregati
// (conteggio_presenti_live) e domande — mai una riga individuale di
// presenze_live, mai user_id (domande_live_organizzatore lo garantisce
// per costruzione lato server, vedi la migration). Le classi in modalità
// DAD non sono toccate: nessun heartbeat individuale, la certificazione
// resta manuale della scuola (nota esplicita in fondo).
export default function ControlloDirettaEvento({
  eventoId,
  domandaConsegna = null,
  dataInizio,
  dataFine,
  chiusaIl = null,
  chiusaDaTipo = null,
  chiusaPresenti = null,
  chiusaCertificati = null,
}: {
  eventoId: string;
  domandaConsegna?: string | null;
  dataInizio: string;
  dataFine: string | null;
  /** Dalla colonna `eventi.diretta_chiusa_il`: lo stato al caricamento della pagina. */
  chiusaIl?: string | null;
  chiusaDaTipo?: string | null;
  /** La ricevuta: i due numeri che la chiusura ha prodotto, riletti dopo un F5. */
  chiusaPresenti?: number | null;
  chiusaCertificati?: number | null;
}) {
  const [presenti, setPresenti] = useState<number | null>(null);
  const [domande, setDomande] = useState<Domanda[]>([]);
  const [caricamento, setCaricamento] = useState(false);
  const [erroreChiusura, setErroreChiusura] = useState<string | null>(null);
  const [esitoChiusura, setEsitoChiusura] = useState<EsitoChiusura | null>(null);
  const [chiusura, setChiusura] = useState<StatoChiusura>(
    statoChiusura({ chiusaIl, chiusaDaTipo, presenti: chiusaPresenti, certificati: chiusaCertificati }),
  );
  // L'ora sta nello STATO e non si legge nel render: `new Date()` dentro un
  // render è impuro (lo dice `react-hooks/purity`, e lo ha già detto su
  // `CardEvento`). Stesso idioma di `PannelloLive`.
  //
  // ⚠️ L'OROLOGIO HA UN INTERVALLO SUO, SEPARATO DAL POLL, e non è una
  // rifinitura: se una `fetch` resta appesa, il poll non ritorna — e un
  // `setOra` dentro di lui non scatterebbe, quindi l'età dei numeri non
  // crescerebbe e un dato vecchio di due minuti si leggerebbe come appena
  // arrivato. È precisamente il difetto che la riga di freschezza esiste per
  // chiudere.
  const [ora, setOra] = useState(() => new Date());
  const [freschezza, setFreschezza] = useState<Freschezza>({ quando: null, falliti: 0 });

  const aggiorna = useCallback(async () => {
    const supabase = createClient();
    // ⚠️ LA CHIUSURA ENTRA NEL POLL CHE C'È GIÀ, e non è una rifinitura: il
    // prop del server è una fotografia del caricamento, quindi se l'altro
    // moderatore chiude mentre questa pagina è aperta, qui si continuerebbe a
    // vedere il bottone. Premendolo la risposta sarebbe comunque onesta («era
    // già chiusa il…», vedi la funzione SQL), ma scoprirlo premendo è il
    // difetto 1.2a in piccolo — e la risposta costa una `select` dentro un giro
    // di rete che si fa comunque.
    // ⚠️ IL `try` COMPRENDE LE TRE LETTURE, non solo la terza: `Promise.all`
    // RIGETTA quando una qualunque delle tre lancia (una `fetch` che non
    // arriva, non un errore restituito), e fuori da un try quel caso lascia
    // `freschezza` a quello che era — cioè «aggiornato alle 19:07» su dei
    // numeri che da allora nessuno ha più riletto. È il difetto che questa
    // riga esiste per chiudere, nella sua forma meno visibile.
    try {
      const [{ data: n, error: eN }, { data: d, error: eD }, { data: ev, error: erroreEv }] = await Promise.all([
        supabase.rpc("conteggio_presenti_live", { p_evento_id: eventoId }),
        supabase.rpc("domande_live_organizzatore", { p_evento_id: eventoId }),
        supabase
          .from("eventi")
          .select("diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_presenti, diretta_chiusa_certificati")
          .eq("id", eventoId)
          .maybeSingle(),
      ]);
      if (typeof n === "number") setPresenti(n);
      if (d) setDomande(d as Domanda[]);
      // Una lettura fallita LASCIA quello che c'era: degradare verso «non chiusa»
      // rimetterebbe il bottone su una diretta chiusa per un problema di rete.
      if (erroreEv) console.error("ControlloDirettaEvento: lettura stato chiusura", erroreEv);
      else if (ev)
        setChiusura(
          statoChiusura({
            chiusaIl: ev.diretta_chiusa_il,
            chiusaDaTipo: ev.diretta_chiusa_da_tipo,
            // ⚠️ LA RICEVUTA ARRIVA ANCHE DAL POLL, non solo dai prop: se è
            // l'ALTRO moderatore a chiudere mentre questa pagina è aperta, qui
            // la riga di stato deve portare i due numeri come li porta a lui —
            // senza, uno dei due vedrebbe «chiusa» e l'altro «chiusa, presenti
            // 12, certificazioni 9».
            presenti: ev.diretta_chiusa_presenti,
            certificati: ev.diretta_chiusa_certificati,
          }),
        );
      // ⚠️ BASTA UNO DEI TRE PER DIRE CHE IL GIRO NON È ANDATO: i numeri a
      // schermo sono tre, e dichiararli freschi perché DUE sono arrivati è la
      // stessa bugia in forma più piccola.
      const andata = !eN && !eD && !erroreEv;
      if (eN) console.error("ControlloDirettaEvento: conteggio presenti", eN);
      if (eD) console.error("ControlloDirettaEvento: domande", eD);
      // Un successo AZZERA il conto dei falliti: il numero che arriva è fresco
      // qualunque cosa sia successa prima. Un fallimento lo alza di uno — serve
      // a sapere quanti giri di fila non tornano, che è la soglia oltre la
      // quale il numero stesso si degrada.
      setFreschezza(andata ? { quando: new Date(), falliti: 0 } : (f) => ({ quando: f.quando, falliti: f.falliti + 1 }));
    } catch (e) {
      console.error("ControlloDirettaEvento: giro di aggiornamento non riuscito", e);
      setFreschezza((f) => ({ quando: f.quando, falliti: f.falliti + 1 }));
    }
  }, [eventoId]);

  useEffect(() => {
    aggiorna();
    const intervallo = setInterval(aggiorna, 15000);
    return () => clearInterval(intervallo);
  }, [aggiorna]);

  // L'orologio, separato: deve avanzare anche quando il poll non ritorna.
  useEffect(() => {
    const intervallo = setInterval(() => setOra(new Date()), 5000);
    return () => clearInterval(intervallo);
  }, []);

  // Calcolato UNA volta e non a ogni uso: due chiamate sarebbero due copie
  // della stessa decisione, e nel giro di un render potrebbero perfino dare due
  // risposte diverse (l'ora la legge `ora`, che è stato, quindi non succede —
  // ma la ragione per cui non succede è questa).
  const stantio = numeroStantio(freschezza, ora);

  async function segnaStato(domandaId: string, stato: string) {
    const supabase = createClient();
    await supabase.rpc("aggiorna_stato_domanda_live", { p_domanda_id: domandaId, p_stato: stato });
    aggiorna();
  }

  async function chiudiDiretta() {
    setCaricamento(true);
    setErroreChiusura(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("chiudi_diretta_evento", { p_evento_id: eventoId });
      const riga = Array.isArray(data) ? data[0] : data;
      if (error || !riga) {
        if (error?.message?.includes("evento_ancora_in_corso")) {
          setErroreChiusura("L'evento non è ancora terminato: puoi chiudere la diretta solo dopo l'orario di fine.");
        } else if (error?.message?.includes("evento_senza_data_fine")) {
          setErroreChiusura("Questo evento non ha una data di fine impostata: impossibile calcolare le presenze.");
        } else {
          setErroreChiusura("Non è stato possibile chiudere la diretta. Riprova.");
        }
        return;
      }
      // La terza colonna distingue «l'ho chiusa io adesso» da «era già chiusa»:
      // senza, la seconda pressione rispondeva «0 nuove certificazioni», cioè
      // un'affermazione sugli studenti al posto di «l'ho già fatto».
      setEsitoChiusura(
        riga.gia_chiusa_il
          ? { tipo: "gia_chiusa", presenti: riga.presenti, quando: riga.gia_chiusa_il }
          : { tipo: "chiusa", presenti: riga.presenti, certificati: riga.certificati },
      );
      aggiorna();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-white/5 pt-4">
      <div>
        <p className="text-sm text-kireo-light">
          Presenti ora:{" "}
          {/* ⚠️ IL NUMERO SI DEGRADA, e non è una rifinitura della riga qui
              sotto: chi guarda lo schermo due secondi in mezzo a una diretta
              legge il numero e non la nota piccola accanto. Oltre la soglia il
              numero NON deve più somigliare a uno fresco — il barrato lo dice a
              chi guarda, `NUMERO_NON_AGGIORNATO` a chi usa un lettore di
              schermo. Il dato resta leggibile: era vero, alle 19:07. */}
          <strong className={stantio ? "text-kireo-muted line-through" : undefined}>{presenti ?? "…"}</strong>
          {stantio && <span className="sr-only"> {NUMERO_NON_AGGIORNATO}</span>}
        </p>
        {/* ⚠️ QUANDO QUESTI NUMERI SONO ARRIVATI. «Presenti ora: 12» è
            un'affermazione sul presente, e se l'ultimo giro è fallito due
            minuti fa è un'affermazione sul passato travestita — su cui qualcuno
            sta prendendo decisioni mentre modera. Vedi `lib/eventi/freschezza.ts`. */}
        <p
          className={`mt-1 text-xs ${freschezza.falliti > 0 || stantio ? "text-kireo-orange" : "text-kireo-muted"}`}
          aria-live="polite"
        >
          {rigaFreschezza(freschezza, ora)}
        </p>
      </div>

      {domande.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Domande ({domande.length})</p>
          <ul className="space-y-2">
            {domande.map((d) => {
              // Chi l'ha toccata e quando: senza, due moderatori rispondono
              // entrambi alla stessa domanda davanti a una classe, e alla
              // successiva nessuno. Calcolata UNA volta: due chiamate sarebbero
              // due copie della stessa cosa, e divergerebbero al primo che ne
              // tocca una.
              const tocco = rigaTocco(d, ora);
              return (
              <li key={d.id} className="rounded-lg border border-white/5 bg-kireo-dark p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {d.nome_completo && <p className="text-xs font-semibold text-kireo-orange">{d.nome_completo}</p>}
                    <p className="text-sm text-kireo-light/90">{d.testo}</p>
                    {tocco && <p className="mt-1 text-xs text-kireo-muted">{tocco}</p>}
                  </div>
                  <div className="flex flex-none gap-3">
                    {d.stato === "nuova" && (
                      <button type="button" onClick={() => segnaStato(d.id, "letta")} className="text-xs text-kireo-orange underline underline-offset-2">
                        Segna letta
                      </button>
                    )}
                    {d.stato !== "risposta_live" && (
                      <button
                        type="button"
                        onClick={() => segnaStato(d.id, "risposta_live")}
                        className="text-xs text-kireo-green-light underline underline-offset-2"
                      >
                        Risposta data
                      </button>
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      <DomandaConsegnaForm eventoId={eventoId} domandaAttuale={domandaConsegna} dataInizio={dataInizio} dataFine={dataFine} />

      {/* Tre stati e non due. L'esito di una pressione viene prima perché sa
          più cose (i conteggi) della riga di stato; la riga di stato prende il
          posto del BOTTONE, che su una diretta chiusa sparisce — vedi
          `lib/eventi/chiusuraDiretta.ts` per il perché non è disabilitato. */}
      {esitoChiusura ? (
        <p className="rounded-lg border border-kireo-green/40 bg-kireo-green/10 px-4 py-3 text-sm text-kireo-light">
          {testoEsitoChiusura(esitoChiusura)}
        </p>
      ) : chiusura.tipo === "chiusa" ? (
        <p className="rounded-lg border border-white/10 bg-kireo-dark px-4 py-3 text-sm text-kireo-light/90">
          {testoStatoChiusura(chiusura)}
        </p>
      ) : (
        <div>
          <Button type="button" variant="outline" onClick={chiudiDiretta} disabled={caricamento}>
            {caricamento ? "Chiusura…" : "Concludi diretta e certifica presenze"}
          </Button>
          {erroreChiusura && <p className="mt-2 text-xs text-red-400">{erroreChiusura}</p>}
        </div>
      )}

      <p className="text-xs text-kireo-muted">
        Le iscrizioni di classe in modalità DAD non sono coperte dall&apos;heartbeat: per quegli studenti la certificazione resta manuale, a cura della
        scuola.
      </p>
    </div>
  );
}
