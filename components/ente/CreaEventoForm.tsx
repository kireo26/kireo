"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import AreeInteresseGrid from "@/components/app/AreeInteresseGrid";
import { FILONI_DOCENTI } from "@/data/filoniDocenti";
import { estraiIdYoutube } from "@/lib/youtube";
import { messaggioErroreEvento } from "@/lib/ente/erroreEvento";
import { istanteDaOrarioItaliano, millisecondiDaOrarioItaliano } from "@/lib/formato";
import { eventoCominciato } from "@/lib/live";
import { useSondaIncorporamento } from "@/lib/useSondaIncorporamento";
import { serveDichiarazioneIncorporamento, sondaBlocca, testoSonda } from "@/lib/sondaYoutube";
import EsitoSondaIncorporamento from "@/components/EsitoSondaIncorporamento";

type ChiaveChecklist = "non_in_elenco" | "incorporamento_attivo" | "chat_disattivata" | "no_contenuti_terzi";

// LA SPUNTA DELL'INCORPORAMENTO È L'UNICA CHE SI PUÒ MISURARE, e per questo
// è l'unica che vive in un elenco a parte: compare solo quando la sonda non
// ha potuto rispondere (vedi `serveDichiarazioneIncorporamento`). Le altre
// tre restano dichiarazioni perché non c'è modo di misurarle da qui — la
// visibilità e la chat le vede solo chi ha il canale, e «non trasmetterò
// musica» è una promessa sul futuro.
//
// Una dichiarazione accanto a una misura è peggio di niente: la prima volta
// che divergono nessuno sa a quale credere. Qui non possono stare insieme a
// schermo per costruzione.
const VOCI_CHECKLIST: { chiave: ChiaveChecklist; testo: string }[] = [
  { chiave: "non_in_elenco", testo: "La diretta è impostata come \"non in elenco\" su YouTube (non pubblica, raggiungibile solo dal link)." },
  { chiave: "chat_disattivata", testo: "La chat dal vivo di YouTube è disattivata (le domande passano solo dalla piattaforma KIREO)." },
  { chiave: "no_contenuti_terzi", testo: "Non trasmetterò musica di alcun tipo né contenuti audio/video di terzi non licenziati." },
];

const VOCE_INCORPORAMENTO: { chiave: ChiaveChecklist; testo: string } = {
  chiave: "incorporamento_attivo",
  testo: "L'incorporamento (embed) del video è attivo nelle impostazioni dello studio di YouTube.",
};

const TIPI = [
  { value: "webinar", label: "Webinar" },
  { value: "workshop", label: "Workshop" },
  { value: "altro", label: "Altro" },
];

const MAX_AREE_EVENTO = 2;

const MAX_EVENTI_IN_REVISIONE = 4;

// Un'istituzione di tipo formazione_docenti propone SOLO eventi per
// docenti (pubblico=docenti + filone al posto delle aree): niente
// eventi_aree per questi eventi, il trigger blocca_aree_su_eventi_docenti
// lo impedirebbe comunque, ma il client non deve nemmeno tentarlo.
export default function CreaEventoForm({
  istituzioneId,
  eventiInRevisione,
  perDocenti = false,
  propostaIncontroId = null,
  descrizionePrefill = null,
}: {
  istituzioneId: string;
  eventiInRevisione: number;
  perDocenti?: boolean;
  propostaIncontroId?: string | null;
  descrizionePrefill?: string | null;
}) {
  const fairUseRaggiunto = eventiInRevisione >= MAX_EVENTI_IN_REVISIONE;
  const router = useRouter();
  const [titolo, setTitolo] = useState("");
  const [tipo, setTipo] = useState("webinar");
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [sede, setSede] = useState("");
  const [link, setLink] = useState("");
  const [posti, setPosti] = useState("");
  const [orePcto, setOrePcto] = useState("0");
  const [scaletta, setScaletta] = useState(descrizionePrefill ?? "");
  const [ctaEsternaUrl, setCtaEsternaUrl] = useState("");
  const [aree, setAree] = useState<string[]>([]);
  const [filone, setFilone] = useState("");
  const [hostingDiretta, setHostingDiretta] = useState<"kireo" | "proprio">("kireo");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const eDiretta = tipo === "webinar";

  // LA SONDA PARTE NEL MOMENTO IN CUI IL LINK VIENE INCOLLATO, giorni prima,
  // non alle 17:01 con una classe davanti. Gira solo quando c'è un id vero da
  // provare e solo sul ramo in cui il video lo fornisce l'ente.
  const idYoutube = estraiIdYoutube(youtubeLink);
  const { esito: esitoSonda, inCorso: sondaInCorso } = useSondaIncorporamento(
    eDiretta && hostingDiretta === "proprio" ? idYoutube : null,
  );
  const vociChecklist = serveDichiarazioneIncorporamento(esitoSonda) ? [...VOCI_CHECKLIST, VOCE_INCORPORAMENTO] : VOCI_CHECKLIST;

  const [errori, setErrori] = useState<Record<string, string>>({});
  const [inviando, setInviando] = useState(false);
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [inviato, setInviato] = useState(false);
  const [areeNonSalvate, setAreeNonSalvate] = useState(false);

  function toggleArea(slug: string) {
    setAree((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_AREE_EVENTO) return prev;
      return [...prev, slug];
    });
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!titolo.trim()) next.titolo = "Inserisci un titolo.";
    if (!dataInizio) next.dataInizio = "Inserisci data e ora.";
    if (!scaletta.trim()) next.scaletta = "La scaletta/argomento è obbligatoria per la revisione di KIREO.";
    if (perDocenti && !filone) next.filone = "Seleziona il filone del webinar.";
    // ALMENO UN'AREA su un evento per studenti, e il posto è QUESTO: un evento
    // senza aree non accredita niente a chi partecipa (chiudi_diretta_evento
    // scrive il credito con un insert…select da eventi_aree, che su zero aree
    // scrive zero righe e riporta successo), e la consegna finale non potrebbe
    // nemmeno aprirsi. Qui il vincolo costa una scelta a chi lo incontra,
    // mentre scoperto a diretta chiusa non costa più niente a nessuno perché
    // non c'è più modo di rimediare. NON è un vincolo di tabella: gli eventi
    // per docenti non devono avere aree (il trigger blocca_aree_su_eventi_docenti
    // le VIETA), e un vincolo che vale per metà delle righe è un vincolo che
    // qualcuno toglierà.
    if (!perDocenti && aree.length === 0) {
      next.aree = "Scegli almeno un'area: è così che l'incontro raggiunge gli studenti giusti, e senza un'area chi partecipa non se ne porta niente nel profilo.";
    }
    // Un orario che non si sa leggere non si scrive con un ripiego: si dice
    // qui, dove l'ente può ancora correggerlo. Il browser produce sempre la
    // forma giusta, quindi questo ramo è una rete — ma una rete che parla.
    if (dataInizio && istanteDaOrarioItaliano(dataInizio) === null) next.dataInizio = "Data e ora non valide.";
    if (dataFine && istanteDaOrarioItaliano(dataFine) === null) next.dataFine = "Data e ora non valide.";
    // L'ORDINE DELLE DATE, prima che lo dica il database. Il vincolo
    // `eventi_date_order` esiste dal 12/07 e faceva il suo mestiere — ma il
    // rifiuto arrivava come un errore generico che diceva «riprova più tardi»,
    // cioè un consiglio falso su un campo non nominato.
    //
    // Si confrontano gli ISTANTI, non le due stringhe lette nella zona del
    // browser: è quello che confronta il vincolo del database, quindi è quello
    // che deve confrontare il form se non vuole dire una cosa diversa da lui.
    if (dataInizio && dataFine && millisecondiDaOrarioItaliano(dataFine) < millisecondiDaOrarioItaliano(dataInizio)) {
      next.dataFine = "La fine non può venire prima dell'inizio.";
    }
    if (eDiretta) {
      if (!dataFine) next.dataFine = "Per un webinar in diretta la data e ora di fine sono obbligatorie (servono a calcolare le presenze).";
      if (hostingDiretta === "proprio") {
        if (!idYoutube) next.youtubeLink = "Incolla il link della tua diretta YouTube (non in elenco).";
        // LA MISURA VINCE, e il no arriva sul campo del link: lì sta la cosa
        // da cambiare. Non è un avviso — un video che non si riproduce dentro
        // KIREO non è un rischio, è una diretta che una classe non vedrà.
        if (idYoutube && esitoSonda && sondaBlocca(esitoSonda)) next.youtubeLink = testoSonda(esitoSonda).titolo;
        if (vociChecklist.some((v) => !checklist[v.chiave])) next.checklist = "Devi confermare tutte le voci della checklist per trasmettere dal tuo canale.";
      }
    }
    return next;
  }

  // L'avviso sulla data già passata: la conversione (pura) e il confronto con
  // l'adesso (che legge l'ora dentro `eventoCominciato`) stanno in due funzioni
  // di libreria, così nel render non compare nessuna chiamata impura.
  const inizioItaliano = dataInizio ? istanteDaOrarioItaliano(dataInizio) : null;
  const inizioGiaPassato = inizioItaliano !== null && eventoCominciato(inizioItaliano);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroreGenerale(null);
    if (fairUseRaggiunto) {
      setErroreGenerale("Hai già 4 eventi in attesa di revisione: attendi l'esito prima di proporne altri.");
      return;
    }
    const validazione = validate();
    setErrori(validazione);
    if (Object.keys(validazione).length > 0) return;

    // QUELLO CHE L'ENTE HA DIGITATO È UN ORARIO ITALIANO, non un orario di chi
    // lo digita: `new Date("2026-09-28T15:00")` lo leggerebbe nella zona del
    // browser, e da Londra o da una macchina configurata male salverebbe un
    // istante diverso da quello scritto. Vedi lib/formato.ts.
    const inizioIso = istanteDaOrarioItaliano(dataInizio);
    const fineIso = dataFine ? istanteDaOrarioItaliano(dataFine) : null;
    // `validate()` l'ha già escluso: se succede comunque, non si scrive un
    // istante inventato — si dice dov'è il problema.
    if (inizioIso === null || (dataFine && fineIso === null)) {
      setErrori({ ...validazione, [inizioIso === null ? "dataInizio" : "dataFine"]: "Data e ora non valide." });
      return;
    }

    setInviando(true);
    try {
      const supabase = createClient();
      const usaChecklist = eDiretta && hostingDiretta === "proprio";
      const oraAccettazione = usaChecklist ? new Date().toISOString() : null;
      // SI REGISTRA SOLO QUELLO CHE È STATO DAVVERO DICHIARATO: la voce
      // dell'incorporamento entra nel jsonb solo se la spunta c'era (cioè
      // solo se la sonda non ha potuto misurare). Scriverla anche dove la
      // misura ha risposto vorrebbe dire registrare una dichiarazione che
      // nessuno ha fatto — la specie esatta che questo giro chiude.
      const checklistDaSalvare: Record<string, string> = {};
      if (oraAccettazione) {
        for (const voce of vociChecklist) checklistDaSalvare[voce.chiave] = oraAccettazione;
      }
      const { data: evento, error } = await supabase
        .from("eventi")
        .insert({
          titolo: titolo.trim(),
          descrizione: scaletta.trim(),
          tipo,
          organizzatore_id: istituzioneId,
          data_inizio: inizioIso,
          data_fine: fineIso,
          sede: sede.trim() || null,
          link: link.trim() || null,
          posti: posti ? Number(posti) : null,
          ore_pcto: orePcto ? Number(orePcto) : 0,
          cta_esterna_url: ctaEsternaUrl.trim() || null,
          stato: "in_approvazione",
          pubblico: perDocenti ? "docenti" : "studenti",
          filone: perDocenti ? filone : null,
          hosting_diretta: eDiretta ? hostingDiretta : "kireo",
          youtube_video_id: usaChecklist ? idYoutube : null,
          checklist_diretta: usaChecklist ? checklistDaSalvare : null,
          checklist_diretta_accettata_il: oraAccettazione,
          incorporamento_sonda: usaChecklist ? esitoSonda : null,
          proposta_incontro_id: propostaIncontroId,
        })
        .select("id")
        .single();

      if (error || !evento) {
        // Un rifiuto del DATO non si dice «riprova più tardi»: il tempo non lo
        // cambia. Vedi lib/ente/erroreEvento.ts.
        setErroreGenerale(messaggioErroreEvento(error));
        return;
      }

      // L'evento c'è già: se le aree non si salvano NON si può dire «non è
      // stato possibile inviare» (chi legge riproverebbe, e creerebbe un
      // doppione). Si dice quello che è successo davvero — un'insert fallita e
      // ignorata sarebbe la stessa specie che questo giro chiude: un'assenza
      // che passa per un risultato.
      if (!perDocenti) {
        const { error: erroreAree } = await supabase
          .from("eventi_aree")
          .insert(aree.map((area_slug) => ({ evento_id: evento.id, area_slug })));
        if (erroreAree) setAreeNonSalvate(true);
      }

      setInviato(true);
      router.refresh();
    } catch {
      setErroreGenerale("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setInviando(false);
    }
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
          Evento inviato in approvazione
        </h3>
        <p className="mt-2 text-sm text-kireo-muted">
          KIREO lo revisiona prima che compaia pubblicamente. Puoi seguirne lo stato qui sotto.
        </p>
        {areeNonSalvate && (
          <p className="mt-3 rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-4 py-3 text-left text-sm text-kireo-orange">
            Le aree tematiche però non si sono salvate, e senza un&apos;area l&apos;incontro non lascia niente nel
            profilo di chi partecipa. Non rimandarlo: scrivici da{" "}
            <a href="/contatti" target="_blank" className="underline underline-offset-2">
              contatti
            </a>{" "}
            e le sistemiamo prima della revisione.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>
      )}

      {fairUseRaggiunto && (
        <div className="rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-4 py-3 text-sm text-kireo-orange">
          Hai già 4 eventi in attesa di revisione. Attendi l&apos;esito di KIREO su almeno uno di questi prima di proporne altri.
        </div>
      )}

      <div>
        <label htmlFor="titolo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Titolo
        </label>
        <input
          id="titolo"
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          aria-invalid={Boolean(errori.titolo)}
          className={`${inputClass} ${fieldBorder(Boolean(errori.titolo))}`}
        />
        {errori.titolo && <p className="mt-1.5 text-sm text-red-400">{errori.titolo}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="tipo" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Tipo
          </label>
          <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`}>
            {TIPI.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="orePcto" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Ore PCTO (0 se non applicabile)
          </label>
          <input
            id="orePcto"
            type="number"
            min="0"
            step="0.5"
            value={orePcto}
            onChange={(e) => setOrePcto(e.target.value)}
            className={`${inputClass} ${fieldBorder(false)}`}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="dataInizio" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Data e ora di inizio
          </label>
          <input
            id="dataInizio"
            type="datetime-local"
            value={dataInizio}
            onChange={(e) => setDataInizio(e.target.value)}
            aria-invalid={Boolean(errori.dataInizio)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.dataInizio))}`}
          />
          {errori.dataInizio && <p className="mt-1.5 text-sm text-red-400">{errori.dataInizio}</p>}
          {/*
            UNA DATA NEL PASSATO NON È VIETATA, ed è una scelta: un ente può
            voler caricare un incontro già tenuto (per certificarne le presenze,
            per farlo comparire sul proprio profilo). Quello che non deve
            succedere è che la pagina poi chieda agli studenti di prenotarsi, e
            quello lo chiude `CardEvento`, che su un evento già cominciato non
            mostra il bottone.

            Qui resta un avviso, non un errore: informa di cosa comporta, non
            blocca un uso legittimo. Non entra in `validate()` apposta — una
            riga in `errori` bloccherebbe l'invio.

            Il confronto è fra ISTANTI: `new Date(dataInizio)` leggerebbe
            l'orario nella zona del browser e lo metterebbe contro l'adesso
            vero, quindi da un'altra zona l'avviso comparirebbe (o mancherebbe)
            per un margine di ore. Lo calcola `inizioGiaPassato`, sopra: l'ora
            si legge dentro `eventoCominciato`, così nel render non compare una
            chiamata impura (stessa cura di CardEvento).
          */}
          {inizioGiaPassato && !errori.dataInizio && (
            <p className="mt-1.5 text-sm text-kireo-muted">
              Questa data è già passata: l&apos;incontro resterà visibile, ma gli studenti non potranno più prenotarsi.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="dataFine" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Data e ora di fine {eDiretta ? "" : "(facoltativa)"}
          </label>
          <input
            id="dataFine"
            type="datetime-local"
            value={dataFine}
            onChange={(e) => setDataFine(e.target.value)}
            aria-invalid={Boolean(errori.dataFine)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.dataFine))}`}
          />
          {errori.dataFine && <p className="mt-1.5 text-sm text-red-400">{errori.dataFine}</p>}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="sede" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Sede (vuoto se online)
          </label>
          <input id="sede" value={sede} onChange={(e) => setSede(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`} />
        </div>
        <div>
          <label htmlFor="posti" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Posti disponibili (facoltativo)
          </label>
          <input
            id="posti"
            type="number"
            min="1"
            value={posti}
            onChange={(e) => setPosti(e.target.value)}
            className={`${inputClass} ${fieldBorder(false)}`}
          />
        </div>
      </div>

      {eDiretta ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-kireo-dark/40 p-4">
          <div>
            <p className="mb-2 text-sm font-medium text-kireo-light">Dove si svolge la diretta?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${hostingDiretta === "kireo" ? "border-kireo-green bg-kireo-green/10" : "border-white/10"}`}>
                <input
                  type="radio"
                  name="hostingDiretta"
                  checked={hostingDiretta === "kireo"}
                  onChange={() => setHostingDiretta("kireo")}
                  className="mt-1 h-4 w-4 accent-kireo-green"
                />
                <span>
                  <span className="block text-sm font-semibold text-kireo-light">Ospitata da KIREO</span>
                  {/* Dove la chiave comparirà, non solo che comparirà: la
                      promessa generica è quella che lasciava l'ente a non
                      sapere se stava aspettando noi o se aveva perso un
                      passaggio. */}
                  <span className="block text-xs text-kireo-muted">
                    Nessun link da fornire ora: la chiave di trasmissione la prepara KIREO e la trovi qui, nella scheda di questo evento.
                  </span>
                </span>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${hostingDiretta === "proprio" ? "border-kireo-green bg-kireo-green/10" : "border-white/10"}`}>
                <input
                  type="radio"
                  name="hostingDiretta"
                  checked={hostingDiretta === "proprio"}
                  onChange={() => setHostingDiretta("proprio")}
                  className="mt-1 h-4 w-4 accent-kireo-green"
                />
                <span>
                  <span className="block text-sm font-semibold text-kireo-light">Sul nostro canale YouTube</span>
                  <span className="block text-xs text-kireo-muted">Trasmetti tu da una diretta YouTube "non in elenco".</span>
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-kireo-orange/30 bg-kireo-orange/5 p-3 text-xs text-kireo-light/90">
            <p className="font-semibold text-kireo-orange">Nei webinar KIREO non è consentita musica di alcun tipo (nemmeno in attesa) né contenuti audio/video di terzi.</p>
            <p className="mt-1 text-kireo-muted">Una diretta con audio non autorizzato rischia l&apos;interruzione automatica per copyright da parte di YouTube: protegge la diretta e chi partecipa.</p>
          </div>

          {hostingDiretta === "proprio" && (
            <div className="space-y-4 border-t border-white/10 pt-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Come creare una diretta non in elenco su YouTube</p>
                <ol className="list-decimal space-y-1 pl-5 text-xs text-kireo-muted">
                  <li>Su YouTube Studio, crea una nuova diretta (o programmala per l&apos;orario dell&apos;evento).</li>
                  <li>Visibilità: imposta "Non in elenco" (mai "Pubblica" o "Privata").</li>
                  <li>Nelle impostazioni della diretta, disattiva la chat dal vivo.</li>
                  <li>Verifica che l&apos;incorporamento (embed) sia consentito.</li>
                  <li>Copia il link della diretta e incollalo qui sotto.</li>
                </ol>
              </div>

              <div>
                <label htmlFor="youtubeLink" className="mb-1.5 block text-sm font-medium text-kireo-light">
                  Link della diretta YouTube
                </label>
                <input
                  id="youtubeLink"
                  type="url"
                  value={youtubeLink}
                  onChange={(e) => setYoutubeLink(e.target.value)}
                  aria-invalid={Boolean(errori.youtubeLink)}
                  className={`${inputClass} ${fieldBorder(Boolean(errori.youtubeLink))}`}
                  placeholder="https://youtube.com/watch?v=..."
                />
                {errori.youtubeLink && <p className="mt-1.5 text-sm text-red-400">{errori.youtubeLink}</p>}
                {/*
                  IL REFERTO DELLA SONDA, qui sotto il campo: è il momento in
                  cui l'ente può ancora rimediare. Fino al 4/10 al suo posto
                  c'era una spunta con cui l'ente dichiarava la stessa cosa, e
                  noi la registravamo come se l'avessimo verificata.
                */}
                <EsitoSondaIncorporamento esito={esitoSonda} inCorso={sondaInCorso} />
              </div>

              <div className="space-y-2">
                {vociChecklist.map((voce) => (
                  <label key={voce.chiave} className="flex items-start gap-3 text-sm text-kireo-light/90">
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[voce.chiave])}
                      onChange={(e) => setChecklist((prev) => ({ ...prev, [voce.chiave]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-kireo-dark accent-kireo-green"
                    />
                    {voce.testo}
                  </label>
                ))}
                {errori.checklist && <p className="mt-1.5 text-sm text-red-400">{errori.checklist}</p>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="link" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Link di partecipazione (facoltativo)
          </label>
          <input id="link" type="url" value={link} onChange={(e) => setLink(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`} />
        </div>
      )}

      <div>
        <label htmlFor="ctaEsternaUrl" className="mb-1.5 block text-sm font-medium text-kireo-light">
          CTA verso il tuo sito (facoltativa, soggetta a quota e ad approvazione)
        </label>
        <input
          id="ctaEsternaUrl"
          type="url"
          value={ctaEsternaUrl}
          onChange={(e) => setCtaEsternaUrl(e.target.value)}
          className={`${inputClass} ${fieldBorder(false)}`}
          placeholder="https://..."
        />
      </div>

      <div>
        <label htmlFor="scaletta" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Scaletta o argomento, per la revisione di KIREO
        </label>
        <textarea
          id="scaletta"
          value={scaletta}
          onChange={(e) => setScaletta(e.target.value)}
          rows={4}
          aria-invalid={Boolean(errori.scaletta)}
          className={`${inputClass} ${fieldBorder(Boolean(errori.scaletta))}`}
          placeholder="Cosa tratterà l'evento, chi interviene, come si svolge."
        />
        {errori.scaletta && <p className="mt-1.5 text-sm text-red-400">{errori.scaletta}</p>}
        <p className="mt-1.5 text-xs text-kireo-muted">Diventa la descrizione visibile pubblicamente una volta approvato.</p>
      </div>

      {perDocenti ? (
        <div>
          <label htmlFor="filone" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Filone
          </label>
          <select
            id="filone"
            value={filone}
            onChange={(e) => setFilone(e.target.value)}
            aria-invalid={Boolean(errori.filone)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.filone))}`}
          >
            <option value="" disabled>
              Seleziona il filone
            </option>
            {FILONI_DOCENTI.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.nome}
              </option>
            ))}
          </select>
          {errori.filone && <p className="mt-1.5 text-sm text-red-400">{errori.filone}</p>}
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-kireo-light">Aree tematiche (almeno una, fino a 2)</label>
            <span className="text-sm text-kireo-muted">
              {aree.length}/{MAX_AREE_EVENTO}
            </span>
          </div>
          <AreeInteresseGrid selezionate={aree} onToggle={toggleArea} max={MAX_AREE_EVENTO} />
          {errori.aree && <p className="mt-1.5 text-sm text-red-400">{errori.aree}</p>}
        </div>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={inviando || fairUseRaggiunto}>
        {fairUseRaggiunto ? "4 eventi già in revisione" : inviando ? "Invio in corso…" : "Invia in approvazione"}
      </Button>
      <p className="text-center text-xs text-kireo-muted">
        Ricorda il{" "}
        <a href="/ente/regolamento" target="_blank" className="text-kireo-orange underline underline-offset-2">
          regolamento enti
        </a>
        .
      </p>
    </form>
  );
}
