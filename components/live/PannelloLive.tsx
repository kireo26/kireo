"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { presenzaRilevabile, statoDiretta, testoAttesaDiretta } from "@/lib/live";
import { useHeartbeatDiretta } from "@/lib/useHeartbeatDiretta";
import BoxDomandeLive, { type Domanda } from "./BoxDomandeLive";
import { formattaDataOra } from "@/lib/formato";
import PlayerDiretta from "./PlayerDiretta";
import { type EsitoSonda, presenzaDaContare, sondaBlocca, testoDirettaRotta } from "@/lib/sondaYoutube";
import {
  AVVISO_PLAYER,
  AVVISO_PLAYER_TELEFONO,
  MS_MINIMO_ASSENZA,
  minutiNecessari,
  presenzaConta,
  testoContatore,
  testoRientro,
} from "@/lib/live/presenza";

// Ogni quanto il player rotto si RIPROVA (e la segnalazione alla console si
// rinnova: `conteggio_player_rotti_live` conta solo le righe degli ultimi tre
// minuti). Il 18/10 l'incorporamento si è spento al Go live e riacceso a mano
// sette minuti dopo: senza un nuovo tentativo, lo studente restava davanti al
// riquadro rosso fino a un ricaricamento che nessuno gli aveva detto di fare.
const MS_RIPROVA_PLAYER = 60000;

// Pannello condiviso studenti/docenti (stessa meccanica, l'unica differenza
// — nome visibile o meno all'organizzatore nelle domande — è decisa lato
// server da domande_live_organizzatore, non qui). Ricalcola lo stato ogni
// 30s così la pagina passa da sola da "non ancora iniziata" a "in diretta"
// a "conclusa" senza bisogno di un refresh manuale.
export default function PannelloLive({
  eventoId,
  userId,
  titolo,
  dataInizio,
  dataFine,
  youtubeVideoId,
  domandeIniziali,
  hrefRitorno,
}: {
  eventoId: string;
  userId: string;
  titolo: string;
  dataInizio: string;
  dataFine: string | null;
  youtubeVideoId: string | null;
  domandeIniziali: Domanda[];
  hrefRitorno: string;
}) {
  const [ora, setOra] = useState(() => new Date());
  const [esitoPlayer, setEsitoPlayer] = useState<EsitoSonda | null>(null);

  useEffect(() => {
    const intervallo = setInterval(() => setOra(new Date()), 30000);
    return () => clearInterval(intervallo);
  }, []);

  const stato = statoDiretta(dataInizio, dataFine, ora);
  // SE IL VIDEO NON SI VEDE, SI SMETTE DI CONTARE. Tenere qualcuno su una
  // pagina vuota e registrargli una presenza è un falso che scriviamo noi:
  // quei ping dicono «era qui a seguire», e da quei ping escono le ore PCTO.
  // La regola sta in `presenzaDaContare`, con il perché e con il motivo per
  // cui i ping già registrati non si scontano.
  // DUE DOMANDE, DUE FUNZIONI. `stato` decide cosa si vede (e dice `in_corso`
  // già quindici minuti prima, apposta); `presenzaRilevabile` decide cosa si
  // conta, e comincia all'inizio vero. Accendere l'heartbeat su `stato` è il
  // difetto del 4/10: quattro ping nel pre-roll hanno certificato una presenza
  // a una diretta di cinque minuti mai vista. La guardia vera resta lato DB
  // (`evento_in_diretta` dentro `ping_presenza_live`): questa è l'altra metà,
  // quella che non manda un ping che verrebbe comunque respinto.
  const inDiretta = presenzaRilevabile(dataInizio, dataFine, ora);
  // ⚠️ E DAL 18/10 SERA, LA PRESENZA COMINCIA QUANDO IL VIDEO PARTE LA PRIMA
  // VOLTA: venti minuti di player nero contavano. La regola e il suo perché
  // stanno in `presenzaConta` (lib/live/presenza.ts).
  const [avviato, setAvviato] = useState(false);
  const segnaAvvio = useCallback(() => setAvviato(true), []);
  const contaLaPresenza = presenzaConta({ inDiretta, videoRotto: !presenzaDaContare(esitoPlayer), avviato });
  useHeartbeatDiretta(eventoId, stato === "in_corso" && contaLaPresenza);

  // IL CONTATORE: lo studente vede a che punto è. La cosa che decide le sue ore
  // era invisibile proprio a lui. Legge la propria riga di `presenze_live`
  // (policy `select_own`); una lettura fallita lascia il valore di prima.
  const necessari = minutiNecessari(dataInizio, dataFine);
  const [contati, setContati] = useState<number | null>(null);
  useEffect(() => {
    if (!inDiretta) return;
    let vivo = true;
    const leggi = async () => {
      const { data, error } = await createClient()
        .from("presenze_live")
        .select("ping_totali")
        .eq("evento_id", eventoId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!vivo) return;
      if (error) console.error("PannelloLive: lettura della propria presenza", error);
      else setContati(data?.ping_totali ?? 0);
    };
    const primo = setTimeout(leggi, 2000);
    const intervallo = setInterval(leggi, 30000);
    return () => {
      vivo = false;
      clearTimeout(primo);
      clearInterval(intervallo);
    };
  }, [eventoId, userId, inDiretta]);

  // IL RIENTRO: quando la pagina torna in primo piano, si dice cosa si è perso
  // — solo se in quel momento la presenza si stava contando, e solo sopra il
  // minuto (sotto è rumore).
  const contaRef = useRef(contaLaPresenza);
  useEffect(() => {
    contaRef.current = contaLaPresenza;
  }, [contaLaPresenza]);
  const [rientro, setRientro] = useState<string | null>(null);
  useEffect(() => {
    let uscita: { t: number; contava: boolean } | null = null;
    const fine = dataFine ? new Date(dataFine).getTime() : null;
    function cambio() {
      if (document.visibilityState === "hidden") {
        uscita = { t: Date.now(), contava: contaRef.current };
        return;
      }
      if (!uscita) return;
      const { t, contava } = uscita;
      uscita = null;
      if (!contava) return;
      const adesso = Date.now();
      const finita = fine !== null && adesso >= fine;
      const persi = (finita && fine !== null ? fine : adesso) - t;
      if (persi < MS_MINIMO_ASSENZA) return;
      setRientro(testoRientro({ minutiFuori: Math.floor(persi / 60000), direttaFinita: finita, riprende: !finita && contaRef.current }));
    }
    document.addEventListener("visibilitychange", cambio);
    return () => document.removeEventListener("visibilitychange", cambio);
  }, [dataFine]);
  const videoRotto = esitoPlayer !== null && sondaBlocca(esitoPlayer);
  // Se la console del moderatore sa che questo studente non vede: è l'unica
  // condizione a cui la pagina può dire «lo stiamo segnalando» (18/10).
  const [segnalato, setSegnalato] = useState(false);
  // Il numero del tentativo è la `key` del player: cambiarlo lo rimonta, cioè lo
  // riprova da capo.
  const [tentativo, setTentativo] = useState(0);
  const eraRotto = useRef(false);

  const segnalaErrorePlayer = useCallback(
    (esito: EsitoSonda) => {
      setEsitoPlayer(esito);
      if (!sondaBlocca(esito)) return;
      eraRotto.current = true;
      // ⚠️ La segnalazione passa dalla funzione che controlla iscrizione e
      // finestra; un fallimento si logga e NON fa dire alla pagina che stiamo
      // segnalando — la frase sta in piedi solo se questa riga è riuscita.
      createClient()
        .rpc("segnala_player_live", { p_evento_id: eventoId, p_esito: esito })
        .then(({ error }) => {
          if (error) console.error("PannelloLive: segnalazione del player rotto non riuscita", error);
          setSegnalato(!error);
        });
    },
    [eventoId],
  );

  // Il player riprovato si vede: la presenza torna a contare da adesso (i
  // minuti persi non si recuperano, vedi `presenzaDaContare`) e la console del
  // moderatore smette di contare questo studente fra chi non vede.
  const segnalaPlayerPronto = useCallback(() => {
    setEsitoPlayer(null);
    setSegnalato(false);
    if (!eraRotto.current) return;
    eraRotto.current = false;
    createClient()
      .rpc("segnala_player_live", { p_evento_id: eventoId, p_esito: null })
      .then(({ error }) => {
        if (error) console.error("PannelloLive: ripresa del player non segnalata", error);
      });
  }, [eventoId]);

  useEffect(() => {
    if (!videoRotto) return;
    const intervallo = setInterval(() => setTentativo((t) => t + 1), MS_RIPROVA_PLAYER);
    return () => clearInterval(intervallo);
  }, [videoRotto]);

  if (stato === "non_ancora") {
    return (
      <div className="rounded-2xl border border-white/5 bg-kireo-card p-8 text-center">
        <p className="font-heading text-lg font-semibold text-kireo-light">La diretta non è ancora iniziata</p>
        <p className="mt-2 text-sm text-kireo-muted">
          Inizia il {formattaDataOra(dataInizio, "full")}. Questa pagina si aggiorna da sola, torna
          a trovarci qualche minuto prima.
        </p>
        <Link href={hrefRitorno} className="mt-4 inline-block text-sm text-kireo-orange underline underline-offset-2">
          ← Torna indietro
        </Link>
      </div>
    );
  }

  if (stato === "conclusa") {
    return (
      <div className="rounded-2xl border border-white/5 bg-kireo-card p-8 text-center">
        <p className="font-heading text-lg font-semibold text-kireo-light">La diretta è terminata</p>
        <p className="mt-2 text-sm text-kireo-muted">Grazie per aver partecipato.</p>
        {rientro && <p className="mt-2 text-sm text-kireo-orange">{rientro}</p>}
        <Link href={hrefRitorno} className="mt-4 inline-block text-sm text-kireo-orange underline underline-offset-2">
          ← Torna indietro
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">{titolo}</h1>
        {/* La riga non dichiara un rilevamento che abbiamo appena fermato:
            quando il video non si vede smettiamo di contare, e dirlo
            comunque sarebbe la stessa bugia un piano più in su.
            E non dice «In diretta» nei quindici minuti prima dell'inizio: il
            player compare già (apposta, così chi arriva prima lo vede
            comparire da sé) ma la diretta non è cominciata — e da quando la
            presenza non si conta lì, lasciare «In diretta» sarebbe una
            contraddizione nella stessa riga. Al suo posto l'ORARIO: vedi
            `testoAttesaDiretta` in lib/live.ts per il perché. */}
        <p className="mt-1 flex items-center gap-2 text-xs text-kireo-muted">
          <span
            className={`h-2 w-2 rounded-full ${inDiretta ? "animate-pulse bg-red-500" : "bg-kireo-muted"}`}
          />{" "}
          {inDiretta ? "In diretta" : testoAttesaDiretta(dataInizio, ora)}
          {contaLaPresenza && contati === null ? " · presenza in rilevamento" : ""}
        </p>
        {inDiretta && necessari !== null && contati !== null && (
          <p className="mt-1 text-sm text-kireo-light/90" aria-live="polite">
            {testoContatore(contati, necessari, contaLaPresenza)}
          </p>
        )}
        {rientro && (
          <p className="mt-2 rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-3 py-2 text-sm text-kireo-light" role="status">
            {rientro}
          </p>
        )}
      </div>

      {youtubeVideoId && (
        <div className="text-xs text-kireo-muted">
          <p>{AVVISO_PLAYER}</p>
          <p className="sm:hidden">{AVVISO_PLAYER_TELEFONO}</p>
        </div>
      )}

      {youtubeVideoId ? (
        /*
          IL PLAYER RESTA MONTATO ANCHE QUANDO È ROTTO, nascosto sotto il
          riquadro: è il modo in cui si riprova (la `key` cambia ogni minuto) e
          il modo in cui ci si accorge che adesso si vede. La pagina RESTA
          APERTA e non dichiara l'evento non seguibile: le domande qui sotto e la
          consegna finale funzionano lo stesso.
        */
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/5">
          <div className={videoRotto ? "invisible h-full w-full" : "h-full w-full"} aria-hidden={videoRotto}>
            <PlayerDiretta
              key={tentativo}
              videoId={youtubeVideoId}
              titolo={titolo}
              onErrore={segnalaErrorePlayer}
              onPronto={segnalaPlayerPronto}
              onAvvio={segnaAvvio}
            />
          </div>
          {videoRotto && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/5 px-6 text-center">
              <p className="font-heading text-lg font-semibold text-kireo-light">{testoDirettaRotta(segnalato).titolo}</p>
              <p className="mt-2 max-w-md text-sm text-kireo-muted">{testoDirettaRotta(segnalato).dettaglio}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-white/5 bg-kireo-card text-center">
          <p className="font-heading text-lg font-semibold text-kireo-light">Diretta non disponibile</p>
          <p className="mt-2 max-w-sm text-sm text-kireo-muted">
            Riprova tra qualche minuto: se il problema persiste, contatta l&apos;organizzatore.
          </p>
        </div>
      )}

      <BoxDomandeLive eventoId={eventoId} userId={userId} domandeIniziali={domandeIniziali} />
    </div>
  );
}
