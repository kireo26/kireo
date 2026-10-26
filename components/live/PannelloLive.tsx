"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fineEffettiva, presenzaRilevabile, statoDiretta, testoAttesaDiretta } from "@/lib/live";
import { useHeartbeatDiretta } from "@/lib/useHeartbeatDiretta";
import BoxDomandeLive, { type Domanda } from "./BoxDomandeLive";
import { formattaDataOra } from "@/lib/formato";
import PlayerDiretta from "./PlayerDiretta";
import { type EsitoSonda, presenzaDaContare, sondaBlocca, testoDirettaRotta } from "@/lib/sondaYoutube";
import {
  AVVISO_PLAYER,
  AVVISO_PLAYER_TELEFONO,
  ETICHETTA_RIFAI_ACCESSO,
  letturaPresenza,
  TESTO_BATTITO_RIFIUTATO,
  testoChiusuraStudente,
  TESTO_CONTEGGIO_NON_LETTO,
  TESTO_SESSIONE_PERSA,
  MS_DURATA_AVVISO_RIENTRO,
  MS_MINIMO_ASSENZA,
  minutiNecessari,
  MS_PAUSA_TOLLERATA,
  causaFermo,
  erroreVideoPrimaDellInizio,
  presenzaConta,
  testoVideoPrimaDellInizio,
  testoContatore,
  testoRientro,
  testoVideoFinito,
  TESTO_RIPIEGO,
  rigaDiretta,
  TESTO_FINITO_NON_CHIUSO,
  TESTO_RIGA_VIDEO_FINITO,
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
  chiusaIl,
  youtubeVideoId,
  domandeIniziali,
  hrefRitorno,
  pubblico,
}: {
  eventoId: string;
  userId: string;
  titolo: string;
  dataInizio: string;
  dataFine: string | null;
  /** La chiusura letta dal server: una diretta chiusa è finita, anche prima della fine programmata. */
  chiusaIl: string | null;
  youtubeVideoId: string | null;
  domandeIniziali: Domanda[];
  hrefRitorno: string;
  pubblico: "studenti" | "docenti";
}) {
  const [ora, setOra] = useState(() => new Date());
  const [esitoPlayer, setEsitoPlayer] = useState<EsitoSonda | null>(null);

  useEffect(() => {
    const intervallo = setInterval(() => setOra(new Date()), 30000);
    return () => clearInterval(intervallo);
  }, []);

  // ⚠️ LA FINE È QUELLA EFFETTIVA (25/10): una diretta chiusa alle 14:24 è
  // finita alle 14:24, non alle 14:30 programmate. Vedi `fineEffettiva`.
  const fine = fineEffettiva(dataInizio, dataFine, chiusaIl);
  const statoOrologio = statoDiretta(dataInizio, fine, ora);
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
  const inDiretta = presenzaRilevabile(dataInizio, fine, ora);
  // ⚠️ E DAL 18/10 SERA, LA PRESENZA COMINCIA QUANDO IL VIDEO PARTE LA PRIMA
  // VOLTA: venti minuti di player nero contavano. La regola e il suo perché
  // stanno in `presenzaConta` (lib/live/presenza.ts).
  const [avviato, setAvviato] = useState(false);
  // ⚠️ E UNA PAUSA LUNGA NON CONTA (25/10 sera): vedi `presenzaConta`. Il video
  // fermo si ricorda da quando; oltre `MS_PAUSA_TOLLERATA` il conteggio si
  // ferma, e il primo «in riproduzione» lo fa ripartire.
  const [fermoDal, setFermoDal] = useState<number | null>(null);
  const [inPausaLunga, setInPausaLunga] = useState(false);
  const segnaAvvio = useCallback(() => {
    setAvviato(true);
    setFermoDal(null);
    setInPausaLunga(false);
  }, []);
  const segnaFermo = useCallback(() => setFermoDal((t) => t ?? Date.now()), []);
  useEffect(() => {
    if (fermoDal === null) return;
    const t = setTimeout(() => setInPausaLunga(true), Math.max(0, fermoDal + MS_PAUSA_TOLLERATA - Date.now()));
    return () => clearTimeout(t);
  }, [fermoDal]);
  // E FINISCE QUANDO IL VIDEO FINISCE (25/10): vedi `presenzaConta`.
  const [videoFinito, setVideoFinito] = useState(false);
  // ⚠️ L'arrivo del segnale si REGISTRA (Mario, 25/10): che una diretta YouTube
  // mandi lo stato 0 quando chi trasmette chiude è documentato, non osservato.
  // Se non arriva, la presenza corre fino alla fine della finestra come prima,
  // in silenzio — e senza questa riga «si è fermata alla fine» e «non abbiamo
  // mai saputo che era finita» resterebbero indistinguibili. Una volta per pagina.
  const fineContata = useRef(false);
  const segnaFine = useCallback(() => {
    setVideoFinito(true);
    if (fineContata.current) return;
    fineContata.current = true;
    fetch("/api/live/fine-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId }),
    })
      .then((r) => {
        if (!r.ok) console.error("PannelloLive: fine del video non registrata", r.status);
      })
      .catch((e) => console.error("PannelloLive: fine del video non registrata", e));
  }, [eventoId]);
  // IL RIQUADRO SEMPLICE: lo script di YouTube non si è caricato, il video
  // forse si vede ma il suo avvio non lo sappiamo — quindi `avviato` resta
  // falso e la presenza non avanza (decisione di Mario, vedi `TESTO_RIPIEGO`).
  // Si registra una volta per caricamento della pagina: è la frequenza che la
  // decisione deve poter imparare. Un fallimento si logga e basta — la frase
  // allo studente non dipende da questa riga.
  const [ripiego, setRipiego] = useState(false);
  const ripiegoContato = useRef(false);
  const segnaRipiego = useCallback(() => {
    setRipiego(true);
    if (ripiegoContato.current) return;
    ripiegoContato.current = true;
    fetch("/api/live/ripiego", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId }),
    })
      .then((r) => {
        if (!r.ok) console.error("PannelloLive: ripiego del player non registrato", r.status);
      })
      .catch((e) => console.error("PannelloLive: ripiego del player non registrato", e));
  }, [eventoId]);
  const contaLaPresenza = presenzaConta({ inDiretta, videoRotto: !presenzaDaContare(esitoPlayer), avviato, finito: videoFinito, pausaLunga: inPausaLunga });
  const battito = useHeartbeatDiretta(eventoId, statoOrologio === "in_corso" && contaLaPresenza);
  // ⚠️ DAL 26/10 LA DIRETTA SI CHIUDE ANCHE PRIMA DELLA FINE: il server lo dice
  // respingendo il battito (`diretta_chiusa`), l'heartbeat smette da sé di
  // battere, e la pagina lo dice al posto del contatore. Lo sa SOLO da quel
  // battito — la pagina non legge la chiusura — quindi lo scopre entro un
  // minuto, non subito.
  const chiusaDaOrganizzatore = battito === "chiusa";
  // ⚠️ UNA CHIUSURA CAMBIA TUTTA LA PAGINA, NON UNA FRASE (giro del 25/10): il
  // pallino rosso «In diretta» due righe sopra «è stato chiuso», le istruzioni per
  // una diretta che non c'è più, «Fai una domanda» aperto su un campo che verrà
  // rifiutato, e il video che continuava (il player era indietro). Un cambiamento
  // di stato che aggiorna una riga e lascia il resto è un annuncio. Quindi la
  // chiusura porta la pagina nello stato «conclusa», tutta insieme: il player si
  // smonta, e quello che resta è l'esito.
  const chiusa = Boolean(chiusaIl) || chiusaDaOrganizzatore;
  const stato = chiusa ? "conclusa" : statoOrologio;
  // Il pallino: a video finito non dice «In diretta» (giro del 26/10, vedi `rigaDiretta`).
  const statoRiga = rigaDiretta({ inDiretta, videoFinito });
  // La consegna sta sotto il pannello e la decide il server: alla chiusura vista
  // da qui si rilegge la pagina, così compare senza un ricaricamento.
  const router = useRouter();
  useEffect(() => {
    if (chiusaDaOrganizzatore) router.refresh();
  }, [chiusaDaOrganizzatore, router]);
  // Un battito riuscito su questa pagina: da quel momento la riga di
  // `presenze_live` esiste, e non vederla vuol dire non aver letto.
  const battitoRiuscito = useRef(false);
  useEffect(() => {
    if (battito === "ok") battitoRiuscito.current = true;
  }, [battito]);
  const sessionePersa = battito === "sessione_persa";
  const pathname = usePathname();

  // IL CONTATORE: lo studente vede a che punto è. La cosa che decide le sue ore
  // era invisibile proprio a lui. Legge la propria riga di `presenze_live`
  // (policy `select_own`); una lettura fallita lascia il valore di prima.
  const necessari = minutiNecessari(dataInizio, dataFine);
  const [contati, setContati] = useState<number | null>(null);
  // ⚠️ 25/10: «Presente da 4 minuti» e poi «Presente da 0 minuti». Una lettura
  // senza sessione restituisce zero righe senza errore, e la pagina scriveva
  // zero. Ora il valore si tiene (non scende) e si dice che non abbiamo letto.
  const [nonLetto, setNonLetto] = useState(false);
  const contatiRef = useRef<number | null>(null);
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
      const l = letturaPresenza({
        dato: data?.ping_totali ?? null,
        errore: Boolean(error),
        precedente: contatiRef.current,
        battitoRiuscito: battitoRiuscito.current,
      });
      setNonLetto(l.tipo === "non_letto");
      if (l.tipo === "non_letto") {
        if (!error) console.error("PannelloLive: conteggio non leggibile (riga assente o in calo)", data, contatiRef.current);
        return;
      }
      contatiRef.current = l.minuti;
      setContati(l.minuti);
    };
    const primo = setTimeout(leggi, 2000);
    const intervallo = setInterval(leggi, 30000);
    return () => {
      vivo = false;
      clearTimeout(primo);
      clearInterval(intervallo);
    };
  }, [eventoId, userId, inDiretta]);

  // ⚠️ ALLA CHIUSURA SI LEGGE COM'È ANDATA (26/10): la chiusura scrive nella
  // stessa transazione la durata, la certificazione e le ore, e il battito vede
  // la chiusura solo dopo il commit — quindi qui l'esito è già leggibile. Tre
  // letture (evento, propria iscrizione, propria presenza); una che non arriva
  // vale `null`, e il testo degrada alla forma corta invece di inventare.
  const [testoChiusura, setTestoChiusura] = useState<string | null>(null);
  useEffect(() => {
    if (!chiusa) return;
    let vivo = true;
    (async () => {
      const supabase = createClient();
      const [ev, isc, pres] = await Promise.all([
        supabase.from("eventi").select("diretta_durata_minuti").eq("id", eventoId).maybeSingle(),
        supabase.from("iscrizioni_eventi").select("stato, ore_riconosciute").eq("evento_id", eventoId).eq("student_id", userId).maybeSingle(),
        supabase.from("presenze_live").select("ping_totali").eq("evento_id", eventoId).eq("user_id", userId).maybeSingle(),
      ]);
      if (!vivo) return;
      for (const r of [ev, isc, pres]) if (r.error) console.error("PannelloLive: esito della chiusura non leggibile", r.error);
      const contatiLetti = pres.error ? null : (pres.data?.ping_totali ?? null);
      const ore = isc.data?.ore_riconosciute;
      setTestoChiusura(
        testoChiusuraStudente({
          durata: ev.error ? null : (ev.data?.diretta_durata_minuti ?? null),
          stato: isc.error ? null : (isc.data?.stato ?? null),
          ore: ore === null || ore === undefined ? null : Number(ore),
          contati: contatiLetti ?? contatiRef.current,
          pubblico,
        }),
      );
    })();
    return () => {
      vivo = false;
    };
  }, [chiusa, eventoId, userId, pubblico]);

  // IL RIENTRO: quando la pagina torna in primo piano, si dice cosa si è perso
  // — solo se in quel momento la presenza si stava contando, e solo sopra il
  // minuto (sotto è rumore).
  const contaRef = useRef(contaLaPresenza);
  const inRiproduzioneRef = useRef(fermoDal === null);
  useEffect(() => {
    contaRef.current = contaLaPresenza;
    inRiproduzioneRef.current = fermoDal === null;
  }, [contaLaPresenza, fermoDal]);
  const [rientro, setRientro] = useState<string | null>(null);
  useEffect(() => {
    let uscita: { t: number; contava: boolean } | null = null;
    const fineMs = new Date(fine).getTime();
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
      const finita = adesso >= fineMs;
      const persi = (finita ? fineMs : adesso) - t;
      if (persi < MS_MINIMO_ASSENZA) return;
      setRientro(testoRientro({ minutiFuori: Math.floor(persi / 60000), direttaFinita: finita, riprende: !finita && contaRef.current && inRiproduzioneRef.current }));
    }
    document.addEventListener("visibilitychange", cambio);
    return () => document.removeEventListener("visibilitychange", cambio);
  }, [fine]);
  // L'avviso se ne va dopo qualche minuto di conteggio ripreso: vedi
  // `MS_DURATA_AVVISO_RIENTRO`. Mentre il conteggio è fermo resta.
  useEffect(() => {
    if (!rientro || !contaLaPresenza) return;
    const t = setTimeout(() => setRientro(null), MS_DURATA_AVVISO_RIENTRO);
    return () => clearTimeout(t);
  }, [rientro, contaLaPresenza]);
  const videoRotto = esitoPlayer !== null && sondaBlocca(esitoPlayer);
  // Se la console del moderatore sa che questo studente non vede: è l'unica
  // condizione a cui la pagina può dire «lo stiamo segnalando» (18/10).
  const [segnalato, setSegnalato] = useState(false);
  const primaDellInizio = erroreVideoPrimaDellInizio(dataInizio, ora.getTime());
  const riquadroRotto = primaDellInizio ? testoVideoPrimaDellInizio() : testoDirettaRotta(segnalato);
  // Il numero del tentativo è la `key` del player: cambiarlo lo rimonta, cioè lo
  // riprova da capo.
  const [tentativo, setTentativo] = useState(0);
  const eraRotto = useRef(false);

  const segnalaErrorePlayer = useCallback(
    (esito: EsitoSonda) => {
      setEsitoPlayer(esito);
      if (!sondaBlocca(esito)) return;
      eraRotto.current = true;
      // Prima dell'inizio non si segnala: vedi `erroreVideoPrimaDellInizio`.
      if (erroreVideoPrimaDellInizio(dataInizio, Date.now())) return;
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
    [eventoId, dataInizio],
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
        {/* Chiusa dall'organizzatore: si dice com'è andata (`testoChiusuraStudente`),
            anche a chi apre la pagina il giorno dopo. Finita senza chiusura: i
            minuti sono contati ma le ore non sono ancora riconosciute (manca il
            gesto di chiusura), e lo si dice con la frase dello storico invece di
            «Grazie per aver partecipato» (giro del 26/10). */}
        <p className="mt-2 text-sm text-kireo-muted" aria-live="polite">
          {chiusa
            ? (testoChiusura ?? testoChiusuraStudente({ durata: null, stato: null, ore: null, contati: null, pubblico }))
            : TESTO_FINITO_NON_CHIUSO}
        </p>
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
            className={`h-2 w-2 rounded-full ${statoRiga === "in_diretta" ? "animate-pulse bg-red-500" : "bg-kireo-muted"}`}
          />{" "}
          {statoRiga === "in_diretta"
            ? "In diretta"
            : statoRiga === "video_finito"
              ? TESTO_RIGA_VIDEO_FINITO
              : testoAttesaDiretta(dataInizio, ora)}
          {contaLaPresenza && !sessionePersa && contati === null ? " · presenza in rilevamento" : ""}
        </p>
        {/* Nel riquadro semplice il contatore direbbe «finché il video non si
            vede», che qui è falso: il video forse si vede, è il suo avvio che non
            sappiamo. Al suo posto la frase di Mario, che dice anche cosa fare. */}
        {ripiego && (
          <p className="mt-2 rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-3 py-2 text-sm text-kireo-light" role="status">
            {TESTO_RIPIEGO}
          </p>
        )}
        {/* LA SESSIONE PERSA viene prima di tutto: da qui nessun battito è
            accettato, e il contatore direbbe una cosa che non sta più
            succedendo. È l'unico caso con una cosa da fare. */}
        {sessionePersa && (
          <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-kireo-light" role="alert">
            {TESTO_SESSIONE_PERSA}{" "}
            <Link
              href={`/accedi?redirectedFrom=${encodeURIComponent(pathname ?? hrefRitorno)}`}
              className="text-kireo-orange underline underline-offset-2"
            >
              {ETICHETTA_RIFAI_ACCESSO}
            </Link>
          </p>
        )}
        {!sessionePersa && battito === "rifiutato" && (
          <p className="mt-2 rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-3 py-2 text-sm text-kireo-light" role="status">
            {TESTO_BATTITO_RIFIUTATO}
          </p>
        )}
        {videoFinito && !sessionePersa && (
          <p className="mt-1 text-sm text-kireo-light/90" aria-live="polite">
            {testoVideoFinito(nonLetto ? null : contati, necessari)}
          </p>
        )}
        {!videoFinito && !ripiego && !sessionePersa && !chiusaDaOrganizzatore && inDiretta && necessari !== null && nonLetto && (
          <p className="mt-1 text-sm text-kireo-light/90" aria-live="polite">
            {TESTO_CONTEGGIO_NON_LETTO}
          </p>
        )}
        {!videoFinito && !ripiego && !sessionePersa && !chiusaDaOrganizzatore && !nonLetto && inDiretta && necessari !== null && contati !== null && (
          <p className="mt-1 text-sm text-kireo-light/90" aria-live="polite">
            {testoContatore(contati, necessari, contaLaPresenza, causaFermo({ avviato, videoRotto: !presenzaDaContare(esitoPlayer), pausaLunga: inPausaLunga }))}
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
              onRipiego={segnaRipiego}
              onFine={segnaFine}
              onFermo={segnaFermo}
            />
          </div>
          {/* ⚠️ IL COLORE È UN TESTO (26/10). Prima dell'inizio la frase dice «va
              tutto come deve» e la cornice rossa diceva «c'è un problema» — a
              ogni studente che arriva in anticipo, cioè quello che gli chiediamo
              di fare. Il giorno in cui il rosso serve davvero l'avrebbe già
              visto tante volte da non guardarlo. Prima dell'inizio: lo stesso
              tono neutro del «Comincia alle…». */}
          {videoRotto && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl border px-6 text-center ${
                primaDellInizio ? "border-white/5 bg-kireo-card" : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <p className="font-heading text-lg font-semibold text-kireo-light">{riquadroRotto.titolo}</p>
              {riquadroRotto.dettaglio && <p className="mt-2 max-w-md text-sm text-kireo-muted">{riquadroRotto.dettaglio}</p>}
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

      <BoxDomandeLive
        eventoId={eventoId}
        userId={userId}
        domandeIniziali={domandeIniziali}
        dataInizio={dataInizio}
        dataFine={fine}
        hrefRitorno={hrefRitorno}
        pubblico={pubblico}
      />
    </div>
  );
}
