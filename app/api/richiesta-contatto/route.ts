import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inviaEmail } from "@/lib/email/brevo";
import { templateConfermaRichiestaContatto, templateNotificaRichiestaContatto } from "@/lib/email/templates";
import { EMAIL_PUBBLICA } from "@/lib/site";
import { segnalaGuasto } from "@/lib/guasti/registra";
import { oggettoConferma } from "@/lib/contatti/testi";

export const runtime = "nodejs";

// ⚠️ `EMAIL_PERSONALE` è la copia personale di Mario e NON COMPARE DA NESSUNA
// PARTE SUL SITO: sta qui, in un file che gira solo sul server, e in nessun
// componente né pagina. `npm run test:contatti` lo pretende. L'indirizzo
// PUBBLICO invece arriva da `lib/site.ts`, accanto all'URL canonico: è l'altra
// coordinata pubblica del prodotto, e al 10/10/2026 viveva in cinque posti.
const EMAIL_PERSONALE = "mario.izzo@hotmail.it";

/**
 * Una riga per origine: dove va la notifica, e se `istituto` è obbligatorio.
 *
 * Una tabella invece di `if` sparsi, perché il 10/10/2026 è stata aggiunta la
 * QUARTA origine e cercare i posti da toccare è il modo in cui la quinta
 * dimenticherà qualcosa.
 *
 * ⚠️ `EMAIL_PUBBLICA` È SEMPRE FRA I DESTINATARI, E NON È UNA SIMMETRIA: È LA
 * PRECONDIZIONE DEL `Reply-To` QUI SOTTO. L'avviso porta come `Reply-To`
 * l'indirizzo di chi ha scritto, quindi premere «rispondi» recapita alla
 * persona giusta — ma il MITTENTE lo decide la casella da cui si sta leggendo,
 * e quello non lo scegliamo noi. Se l'avviso arriva SOLO alla copia personale,
 * il gesto naturale fa partire la risposta dall'indirizzo privato di Mario
 * verso un dirigente scolastico che ha scritto a kireo.it: esattamente il
 * difetto per cui il 10/10/2026 è uscito il bottone «Rispondi» della coda.
 *
 * Fino a quel giorno `dirigenti` e `scuole` avevano la sola copia personale, e
 * NON era una decisione: prima di questa tabella i destinatari erano un
 * ternario (`origine === "enti" ? EMAIL_NOTIFICA_ENTI : EMAIL_NOTIFICA_INTERNA`),
 * quindi i due indirizzi erano mutuamente esclusivi per costruzione — e
 * `info@` si chiamava «l'indirizzo degli enti» perché nasceva con quel canale
 * (27/07), due giorni dopo le landing (25/07), quando l'unica casella era
 * quella personale. La tabella ha permesso più destinatari, /contatti ne ha
 * presi due, e le due landing hanno ereditato il loro ramo del ternario
 * invariato: una copia stantia nei DESTINATARI invece che nel testo.
 *
 * Così la copia personale torna a essere una copia — una notifica sul telefono,
 * non il posto da cui si risponde. `npm run test:contatti` pretende questo
 * invariante per ogni origine: è un appoggio dichiarato, non una fortuna.
 *
 * `istitutoObbligatorio` è falso solo per /contatti: la colonna è nullable
 * dal 10/10/2026, e chi scrive da lì può essere uno studente che un istituto
 * non ce l'ha nel senso in cui lo intendono le landing. Il database dice «può
 * mancare», questa tabella dice «per queste origini no»: due livelli, due
 * cose diverse, apposta.
 */
const ORIGINI = {
  dirigenti: { notifica: [EMAIL_PUBBLICA, EMAIL_PERSONALE], istitutoObbligatorio: true },
  scuole: { notifica: [EMAIL_PUBBLICA, EMAIL_PERSONALE], istitutoObbligatorio: true },
  enti: { notifica: [EMAIL_PUBBLICA], istitutoObbligatorio: true },
  contatti: { notifica: [EMAIL_PUBBLICA, EMAIL_PERSONALE], istitutoObbligatorio: false },
} as const;

type Origine = keyof typeof ORIGINI;

// Il limite di cortesia è lo stesso trigger per tutte le origini (10 minuti
// per email), ma la parola con cui si nomina quello che è stato respinto no:
// su una landing è una «richiesta», su /contatti un «messaggio».
//
// ⚠️ IL TESTO DELLE LANDING BUTTAVA VIA IL SECONDO MESSAGGIO E NON LO DICEVA,
// dal 25 luglio. Diceva «Hai già inviato una richiesta di recente: ti
// ricontatteremo presto!» — vero, e vero della PRIMA richiesta: non della cosa
// che era appena successa, cioè che la seconda era stata respinta. Una frase
// rassicurante al posto del fatto, con il punto esclamativo sopra.
//
// E conta, perché chi scrive due volte di solito scrive per AGGIUNGERE
// qualcosa: un numero di telefono, una correzione, «in realtà siamo un
// istituto tecnico». Quella cosa sparisce, e la persona esce convinta di
// averla mandata. È lo stesso difetto appena tolto da /contatti, in una
// pagina di vendita — e lo si è visto solo mettendo i due testi accanto.
//
// Il testo nuovo tiene il «ti ricontatteremo» (vero, e rassicura sulla
// prima), dice che la seconda non è passata, e dà la strada per la cosa che
// la persona stava cercando di aggiungere. Niente punto esclamativo: non c'è
// niente da festeggiare in un messaggio che non è arrivato.
const RIFIUTO_LANDING = `Questa richiesta non è stata inviata: ne abbiamo già ricevuta una da questo indirizzo pochi minuti fa, e ti ricontatteremo su quella. Se devi aggiungere qualcosa, scrivici a ${EMAIL_PUBBLICA}.`;

const RIFIUTO_LIMITE: Record<Origine, string> = {
  dirigenti: RIFIUTO_LANDING,
  scuole: RIFIUTO_LANDING,
  enti: RIFIUTO_LANDING,
  contatti: `Questo messaggio non è stato inviato: ne abbiamo già ricevuto uno da questo indirizzo pochi minuti fa. Aspetta una decina di minuti, oppure scrivici direttamente a ${EMAIL_PUBBLICA}.`,
};

// L'oggetto della conferma è un ramo, perché è la riga più letta dell'email e
// risparmiare su un `if` lì sarebbe risparmiare nel punto in cui si decide se
// aprire. La distinzione («richiesta» o «messaggio») sta in `COSA_E_ARRIVATO`,
// un posto solo, perché la stessa serve all'oggetto della conferma, al titolo
// che compare al posto del modulo e al pronome della promessa dei tempi.
//
// (Questo commento nominava `NOME_RICHIESTA`, una tabella che non è mai
// esistita con quel nome, e la riga di prima citava un quarto consumatore
// uscito il 10/10/2026 — l'oggetto della risposta dalla coda, che se ne è
// andato col bottone «Rispondi». Due copie stantie in cinque righe, trovate di
// passaggio: la specie di casa non chiede il permesso.)

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

// Il punto unico da cui passa ogni richiesta di contatto del sito: le due
// landing del funnel scuole (/dirigenti, /scuole), /istituzioni e — dal
// 10/10/2026 — /contatti. Insert pubblico (RLS: anon può solo inserire, mai
// leggere — vedi la migration), poi le email best-effort: conferma al
// richiedente e notifica interna. Un fallimento email non fa fallire la
// richiesta: i dati sono già al sicuro in DB, l'admin li vede comunque in
// coda su /admin.
export async function POST(request: NextRequest) {
  let body: {
    origine?: unknown;
    nome?: unknown;
    ruolo?: unknown;
    istituto?: unknown;
    codiceMeccanografico?: unknown;
    email?: unknown;
    messaggio?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }

  const { origine, nome, ruolo, istituto, email, messaggio, codiceMeccanografico } = body;

  if (typeof origine !== "string" || !Object.prototype.hasOwnProperty.call(ORIGINI, origine)) {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }
  const conf = ORIGINI[origine as Origine];

  const campiTesto = [nome, ruolo, email, messaggio, ...(conf.istitutoObbligatorio ? [istituto] : [])];
  if (campiTesto.some((v) => typeof v !== "string" || !v.trim())) {
    return erroreDiCortesia("Compila tutti i campi obbligatori.", 400);
  }
  const nomeStr = (nome as string).trim();
  const ruoloStr = (ruolo as string).trim();
  const istitutoStr = typeof istituto === "string" && istituto.trim() ? istituto.trim() : null;
  const emailStr = (email as string).trim();
  const messaggioStr = (messaggio as string).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return erroreDiCortesia("Inserisci un indirizzo email valido.", 400);
  }
  if (nomeStr.length > 200 || ruoloStr.length > 200 || (istitutoStr?.length ?? 0) > 300 || messaggioStr.length > 3000) {
    return erroreDiCortesia("Uno dei campi supera la lunghezza massima consentita.", 400);
  }
  const codice = typeof codiceMeccanografico === "string" && codiceMeccanografico.trim() ? codiceMeccanografico.trim() : null;

  // ⚠️ `createClient()` LANCIA quando Supabase non è configurato, e fuori da
  // un try produce un 500 grezzo: nessun corpo, nessuna traccia — cioè il
  // modo 7, un guasto sul percorso eccezionale che `npm run test:log5xx` non
  // vede, perché quella guardia guarda i 5xx che RITORNIAMO e non quelli che
  // lasciamo accadere. Misurato su build di produzione il 10/10/2026 (POST
  // valido senza env: `500` con corpo vuoto). Dentro il try il caso fallisce
  // chiuso dicendolo.
  let error: { message?: string } | null = null;
  try {
    const supabase = await createClient();
    ({ error } = await supabase.from("richieste_contatto").insert({
      origine,
      nome: nomeStr,
      ruolo: ruoloStr,
      istituto: istitutoStr,
      codice_meccanografico: codice,
      email: emailStr,
      messaggio: messaggioStr,
    }));
  } catch (eccezione) {
    console.error("Errore insert richieste_contatto (eccezione):", eccezione);
    return erroreDiCortesia("Non è stato possibile inviare la richiesta. Riprova tra qualche istante.", 500);
  }

  if (error) {
    if (error.message?.includes("richiesta_recente")) {
      return erroreDiCortesia(RIFIUTO_LIMITE[origine as Origine], 429);
    }
    console.error("Errore insert richieste_contatto:", error);
    return erroreDiCortesia("Non è stato possibile inviare la richiesta. Riprova tra qualche istante.", 500);
  }

  const oggettoNotifica =
    origine === "enti"
      ? "Richiesta informazione ente formativo"
      : origine === "contatti"
        ? `Nuovo messaggio da /contatti — ${nomeStr}`
        : `Nuova richiesta (${origine}) da ${istitutoStr}`;

  const corpoNotifica = templateNotificaRichiestaContatto({
    origine: origine as Origine,
    nome: nomeStr,
    ruolo: ruoloStr,
    istituto: istitutoStr,
    codiceMeccanografico: codice,
    email: emailStr,
    messaggio: messaggioStr,
  });

  const [esitoConferma, ...esitiNotifica] = await Promise.all([
    inviaEmail(
      emailStr,
      oggettoConferma(origine as Origine),
      templateConfermaRichiestaContatto(nomeStr, origine as Origine),
      // ⚠️ Il mittente è `noreply@kireo.it`, che non riceve: senza questo, chi
      // premesse «rispondi» scriverebbe a una casella muta senza accorgersene.
      // Vedi `OpzioniInvioEmail.rispondiA` — e la prova dal vivo che manca.
      { nome: nomeStr, rispondiA: EMAIL_PUBBLICA },
    ),
    // ⚠️ IL `Reply-To` DELL'AVVISO È L'INDIRIZZO DI CHI HA SCRITTO, e non è una
    // rifinitura: è la strada per cui una risposta parte. Il 10/10/2026 Mario
    // ha letto in webmail l'avviso «Nuovo messaggio da /contatti» e ha premuto
    // «Rispondi»: il mittente è `noreply@kireo.it`, quindi la sua risposta è
    // andata a una casella muta. Con questo header il gesto naturale — apri,
    // rispondi, scrivi, manda — arriva a chi ha scritto, **senza passare da
    // /admin e senza copiare un indirizzo**, e la risposta parte dalla casella
    // da cui la si sta leggendo.
    //
    // ⚠️ LO `Reply-To` SISTEMA IL DESTINATARIO; IL MITTENTE LO DECIDE LA
    // CASELLA IN CUI SI STA LEGGENDO, e quello non lo scegliamo noi. Quindi
    // questo header è corretto su OGNI destinatario solo perché
    // `EMAIL_PUBBLICA` è sempre fra loro [l'invariante è scritto sopra
    // `ORIGINI` e lo pretende `npm run test:contatti`]: è un appoggio
    // dichiarato, non una cosa che regge per fortuna. Se un giorno un'origine
    // mandasse l'avviso solo alla copia personale, il gesto naturale farebbe
    // partire la risposta dall'indirizzo privato — il difetto per cui il
    // 10/10/2026 è uscito il bottone «Rispondi» della coda.
    //
    // La copia personale lo riceve uguale, ed è la scelta meno peggio delle
    // due: senza, chi premesse «rispondi» su quella scriverebbe a
    // `noreply@kireo.it` e il messaggio sparirebbe in silenzio. Il prodotto
    // non può impedire una risposta dalla casella sbagliata; può garantire che
    // quella giusta ce l'abbia sempre, e che una risposta non si perda.
    ...conf.notifica.map((destinatario) =>
      inviaEmail(destinatario, oggettoNotifica, corpoNotifica, { rispondiA: emailStr }),
    ),
  ]);

  // ⚠️ UN INVIO FALLITO LASCIA UNA RIGA, e non è una rifinitura. Il
  // 10/10/2026 Brevo ha bloccato l'email di conferma di un messaggio vero
  // (l'IP di Vercel non era fra quelli autorizzati) e lo abbiamo scoperto solo
  // perché Mario stava guardando se arrivava. Gli IP autorizzati erano UNDICI:
  // è già successo dieci volte, quindi un invio fallito qui è un evento
  // NORMALE — e il prodotto deve saperlo registrare senza che nessuno stia
  // guardando. `segnalaGuasto` stampa e scrive in un gesto solo: due chiamate
  // separate si dimenticano una alla volta, proprio nel ramo d'errore.
  if (!esitoConferma.ok) {
    await segnalaGuasto(
      {
        processo: "api/richiesta-contatto",
        specie: "email_contatto",
        motivo: "conferma_non_inviata",
        dettaglio: esitoConferma.motivo,
      },
      `Errore email di conferma richiesta contatto (${origine}) non inviata:`,
    );
  }
  for (const [i, esito] of esitiNotifica.entries()) {
    if (!esito.ok) {
      await segnalaGuasto(
        {
          processo: "api/richiesta-contatto",
          specie: "email_contatto",
          motivo: "notifica_non_inviata",
          dettaglio: `${conf.notifica[i]}: ${esito.motivo}`,
        },
        `Errore notifica richiesta contatto non inviata a ${conf.notifica[i]}:`,
      );
    }
  }

  // `confermaInviata` lo legge il modulo per scegliere cosa dire: con l'email
  // partita nomina la conferma, senza TACE su di lei — non si scusa, perché
  // dal punto di vista di chi scrive non è successo niente di male.
  return NextResponse.json({ ok: true, confermaInviata: esitoConferma.ok });
}
