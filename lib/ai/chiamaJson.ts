// Chiamata AI che restituisce JSON, robusta al "poscritto": alcuni modelli
// scrivono l'oggetto JSON richiesto e POI aggiungono una riga di prosa
// («Spero sia utile!»). Un JSON.parse sull'INTERA risposta lancia
// SyntaxError su quel testo in coda — ed era la causa, silenziosa, per cui il
// revisore di Escape produceva zero prove: la proposta veniva letta dal
// modello ma il parse falliva e il catch tornava null, senza che nessuno lo
// sapesse. Perverso, perché una proposta disonesta invita il modello a
// commentare di più → più prosa in coda → più probabilità di rottura.
//
// Qui l'estrazione NON fa il parse dell'intera stringa: prende la sottostringa
// dalla prima graffa aperta all'ultima graffa chiusa (dopo aver tolto i fence
// ```json). Un fallimento — di chiamata o di estrazione — è un ESITO tipizzato,
// non un'eccezione ingoiata: il chiamante decide cosa farne (persistere lo
// stato, mostrarlo, avvisare). Un solo ritentativo, che copre entrambi i motivi.

import Anthropic from "@anthropic-ai/sdk";
import { REGOLA_LINGUA_INVARIANTE, trovaAccordiInJson } from "@/lib/lingua/accordoGenere";
import { REGOLA_REGISTRO, trovaRegistroInJson } from "@/lib/lingua/registroStudente";
import { registraGuardiaLingua } from "@/lib/lingua/contatoreGuardia";
import { togliFormulaTesta } from "@/lib/lingua/formulaTesta";
import { mappaStringheInJson } from "@/lib/lingua/scansione";

// Istruzione appesa centralmente a ogni system prompt: riduce il poscritto alla
// fonte, invece di doverlo togliere a valle in ogni prompt sparso.
const ISTRUZIONE_ANTI_POSCRITTO =
  "\n\nRispondi SOLO con l'oggetto JSON richiesto: nessun testo prima della parentesi graffa iniziale, nessun testo dopo la parentesi graffa finale.";

// `troncata` è un motivo a sé, non un caso di `estrazione`: significa che il
// modello ha scritto una risposta buona e si è fermato a metà per il tetto di
// token, quindi la cura è alzare il tetto — mentre `estrazione` significa che
// ha scritto qualcosa che non contiene JSON, e lì il tetto non c'entra. Prima
// erano indistinguibili nel log, e per capire quale dei due fosse bisognava
// andare a leggere i log di Vercel e ragionare per indizi.
export type EsitoAI = { ok: true; dati: unknown } | { ok: false; motivo: "chiamata" | "estrazione" | "troncata" };

// Sopra questa frazione del tetto una risposta RIUSCITA viene comunque
// segnalata: è la risposta successiva, un filo più lunga, quella che si
// troncherà. Un guasto che si annuncia prima di succedere costa un log.
const SOGLIA_AVVISO_TETTO = 0.85;

// Estrae un oggetto JSON dal testo di un modello. Toglie i fence ```json, poi
// isola la sottostringa dalla PRIMA `{` all'ULTIMA `}` — così un poscritto in
// prosa dopo il JSON (la causa del bug del revisore) non rompe più il parse.
// Ritorna `undefined` se non c'è un oggetto o se il frammento non è JSON valido:
// mai un'eccezione (il chiamante distingue "vuoto" da "riuscito").
export function estraiJson(testo: string): unknown | undefined {
  const pulito = testo.replace(/```json|```/g, "");
  const inizio = pulito.indexOf("{");
  const fine = pulito.lastIndexOf("}");
  if (inizio === -1 || fine === -1 || fine < inizio) return undefined;
  try {
    return JSON.parse(pulito.slice(inizio, fine + 1));
  } catch {
    return undefined;
  }
}

// Chiama il modello e restituisce l'oggetto JSON estratto. Un solo ritentativo,
// che copre ENTRAMBI i motivi (la chiamata fallisce, oppure l'estrazione non
// trova JSON valido): il secondo fallimento diventa un esito `{ok:false}`.
//
// Su questa funzione passano TUTTI i revisori che scrivono testo letto da uno
// studente. Quelli che una pagina chiama davvero sono TRE:
//   1. Escape — non-approfondire, proposta, riflessione (lib/escape/scoring.ts,
//      da app/api/escape/finalizza)
//   2. revisione di tappa            (app/api/cron/workshop-motore)
//   3. feedback finale del progetto  (app/api/cron/workshop-motore, ultima tappa)
//
// Erano quattro fino al 2026-08-29: il quarto era l'analisi del file caricato
// (app/api/workshop/consegna), chiusa insieme al caricamento file del workshop.
// Ne resta un quinto RAGGIUNGIBILE MA ORFANO: il feedback finale in
// app/api/workshop/elaborato/consegna, che nessun componente chiama più da
// quando la chiusura del progetto la fa il cron sull'ultima tappa. Sta qui
// scritto perché non venga contato per errore fra i vivi, e perché la
// decisione se chiuderlo sia presa apposta invece che dimenticata.
//
// È il punto giusto per la guardia sulla lingua invariante — vedi `chiamaJson`
// più sotto, che la avvolge.
async function chiamaJsonGrezzo(
  client: Anthropic,
  opzioni: {
    model: string;
    maxTokens: number;
    system: string;
    // string per i prompt testuali (Escape, revisione), array di blocchi per il
    // multimodale (analisi di un'immagine/PDF di consegna workshop).
    user: Anthropic.Messages.MessageParam["content"];
  },
): Promise<EsitoAI> {
  const system = opzioni.system + ISTRUZIONE_ANTI_POSCRITTO;
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    const ultimo = tentativo === 1;

    let testo: string;
    let troncata = false;
    try {
      const risposta = await client.messages.create({
        model: opzioni.model,
        max_tokens: opzioni.maxTokens,
        system,
        messages: [{ role: "user", content: opzioni.user }],
      });
      testo = risposta.content[0]?.type === "text" ? risposta.content[0].text : "";
      troncata = risposta.stop_reason === "max_tokens";
      const usati = risposta.usage?.output_tokens ?? 0;
      if (troncata) {
        console.error(`chiamaJson — risposta TRONCATA dal tetto (tentativo ${tentativo + 1}): ${usati}/${opzioni.maxTokens} token. Alzare il tetto del chiamante.`);
      } else if (usati >= opzioni.maxTokens * SOGLIA_AVVISO_TETTO) {
        console.warn(`chiamaJson — risposta vicina al tetto: ${usati}/${opzioni.maxTokens} token. La prossima potrebbe troncarsi.`);
      }
    } catch (errore) {
      if (errore instanceof Anthropic.APIError) {
        console.error(`chiamaJson — errore API (tentativo ${tentativo + 1}): status=${errore.status} type=${errore.type ?? "sconosciuto"} messaggio=${errore.message}`);
      } else {
        console.error(`chiamaJson — errore chiamata (tentativo ${tentativo + 1}):`, errore);
      }
      if (ultimo) return { ok: false, motivo: "chiamata" };
      continue;
    }

    const dati = estraiJson(testo);
    if (dati !== undefined) return { ok: true, dati };

    console.error(`chiamaJson — estrazione JSON fallita (tentativo ${tentativo + 1}), troncata=${troncata}. Inizio risposta: ${testo.slice(0, 300)}`);
    if (ultimo) return { ok: false, motivo: troncata ? "troncata" : "estrazione" };
  }
  // irraggiungibile: il ramo `ultimo` ritorna sempre.
  return { ok: false, motivo: "chiamata" };
}

// La guardia su come il revisore parla allo studente.
//
// Sorveglia tre cose, con lo STESSO meccanismo e DUE terminali diversi.
//
// IL MECCANISMO. Nel testo cablato la linea la garantisce il tripwire; qui il
// testo lo scrive un modello, e le regole nel prompt — che ci sono, appese qui
// sotto — ORIENTANO senza GARANTIRE: misurate, lasciano passare qualcosa.
// Quindi il codice rilegge la risposta e, se trova qualcosa, ne chiede UN'ALTRA.
// Una volta sola, e una sola per tutte e tre: il secondo tentativo non è di
// questo o quel controllo, è della risposta.
//
//   1. l'ACCORDO DI GENERE (lib/lingua/accordoGenere.ts) — KIREO non sa chi
//      legge, e non lo saprà mai;
//   2. il REGISTRO (lib/lingua/registroStudente.ts) — le parole-verdetto e la
//      terza persona: «performance non perfetta», «lo studente lo nomina»;
//   3. un CONTROLLO DEL CHIAMANTE, facoltativo (`controlloExtra`), per ciò che
//      non è decidibile sulla stringa sola. Oggi ne esiste uno: le cifre
//      citabili di Escape, che si possono giudicare solo conoscendo il payload
//      dello studente e i documenti che ha aperto — cose che questa funzione,
//      che è trasporto, non conosce e non deve conoscere.
//
// LA REGOLA CHE NON VA CAMBIATA IN BUONA FEDE: se anche il secondo tentativo
// torna sporco — o fallisce del tutto — si SPEDISCE LO STESSO. La guardia non
// deve mai poter trattenere il feedback di uno studente per una questione di
// lingua: meglio un participio al maschile che una schermata vuota. È la stessa
// lezione già pagata con il JSON.parse, dove un revisore che aveva letto
// benissimo produceva zero perché il parse falliva in silenzio.
//
// IL SECONDO TERMINALE non sta qui, e non può starci: una cifra fuori
// dall'insieme citabile è un'affermazione falsa su una scelta dello studente,
// e quella non si spedisce — al suo posto va un ripiego cablato. Ma è il
// CHIAMANTE a saperlo fare, perché è lui che sa quale frase sostituire e con
// che cosa. Qui si chiede la seconda risposta e la si restituisce; il
// chiamante rifà il suo controllo su ciò che riceve e decide. Vedi
// lib/escape/scoring.ts, al punto in cui nascono le prove del revisore.
//
// I pattern sono larghi e restano larghi: un falso positivo qui costa una
// chiamata e nient'altro, perché il testo che torna è buono uguale.
export async function chiamaJson(
  client: Anthropic,
  opzioni: {
    model: string;
    maxTokens: number;
    system: string;
    user: Anthropic.Messages.MessageParam["content"];
    // Ritorna i frammenti da correggere (vuoto = niente da correggere). Vive
    // nelle opzioni e non in un parametro a sé perché i chiamanti che non ne
    // hanno bisogno — quasi tutti — non devono nemmeno sapere che esiste.
    controlloExtra?: (dati: unknown) => string[];
    // Se il testo che stiamo generando è per un PROFILO DI PROVA (il robot del
    // banco). Non cambia niente nella chiamata: separa il contatore della
    // guardia, che altrimenti mescola le passate del robot con il tasso vero
    // sugli studenti. Il 31 agosto 2026 undici interventi e quattro esposizioni
    // del robot sono finiti nella riga di produzione, e la mail di
    // osservabilità li ha riportati come «lo studente ha comunque letto».
    // `chiamaJson` non può saperlo da sé — è trasporto, non conosce il
    // contesto — quindi glielo dice chi chiama, che lo sa.
    diProva?: boolean;
  },
): Promise<EsitoAI> {
  const conRegola = { ...opzioni, system: opzioni.system + REGOLA_LINGUA_INVARIANTE + REGOLA_REGISTRO };
  const sporco = (dati: unknown) =>
    trovaAccordiInJson(dati).length > 0 ||
    trovaRegistroInJson(dati).length > 0 ||
    (opzioni.controlloExtra?.(dati).length ?? 0) > 0;

  const primo = await chiamaJsonGrezzo(client, conRegola);
  if (!primo.ok) return primo;
  if (!sporco(primo.dati)) return primo;

  const secondo = await chiamaJsonGrezzo(client, conRegola);
  const risposta = secondo.ok ? secondo : primo;

  // I due contatori restano quelli della LINGUA, e solo di quella: misurano il
  // tasso di forme accordate per sostituire, fra qualche settimana, la stima
  // fatta su una consegna-fixture (~8% su 24 chiamate). Contare qui anche i
  // secondi tentativi chiesti per il registro o per una cifra renderebbe quel
  // tasso illeggibile — stesso numeratore, denominatore gonfiato da un'altra
  // popolazione. Quindi: si conta un intervento solo se la PRIMA risposta era
  // accordata (la definizione scritta nella migrazione), e «ancora accordato»
  // si misura sulla risposta che parte davvero, comunque sia stata innescata.
  if (trovaAccordiInJson(primo.dati).length > 0) {
    const ancoraAccordato = !secondo.ok || trovaAccordiInJson(secondo.dati).length > 0;
    // Atteso, anche se è solo osservabilità: su Vercel una promessa lasciata
    // in volo dopo il ritorno della route può non essere mai eseguita, e un
    // contatore che si perde a caso è peggio di nessun contatore. Costa una RPC,
    // e non può fallire in modo visibile (è tutta dentro un try/catch).
    await registraGuardiaLingua(ancoraAccordato, opzioni.diProva === true);
  }

  // ── e qui il registro smette di essere una richiesta ──────────────────────
  // «Hai capito che X» → «X», in codice, perché tre giri di prompt non l'hanno
  // spostato di un punto (60%, 60%, 61%) e la terza volta è perfino salito.
  // Vale per ogni revisore che passa di qui — la reazione del cliente non ci
  // passa, ed è giusto: Tonino parla in carattere.
  //
  // IL NUMERO CHE SI STAMPA È QUELLO PRIMA DELLA RISCRITTURA. Se ci limitassimo
  // a riscrivere, la misura del banco vedrebbe zero e ci racconterebbe che il
  // modello ha smesso: non ha smesso, l'abbiamo coperto. `riscritte` dice
  // quanto copriamo, `residue` quanto resta scoperto — le forme senza «che»,
  // che non si riscrivono meccanicamente senza rompere la frase.
  if (risposta.ok) {
    let riscritte = 0;
    let residue = 0;
    const puliti = mappaStringheInJson(risposta.dati, (t) => {
      const e = togliFormulaTesta(t);
      riscritte += e.riscritte;
      residue += e.residue;
      return e.testo;
    });
    if (riscritte > 0 || residue > 0) {
      console.log(`formulaTesta — riscritte=${riscritte} residue=${residue}${opzioni.diProva ? " (profilo di prova)" : ""}`);
    }
    return { ok: true, dati: puliti };
  }
  return risposta;
}
