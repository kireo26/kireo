import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inviaEmail } from "@/lib/email/brevo";
import { templateFollowUpGuida } from "@/lib/email/templates";
import { getAreaBySlug } from "@/data/aree";
import { percorsoGuidaUno } from "@/lib/guide/config";
import { SITE_URL } from "@/lib/site";
import { segnalaGuasto } from "@/lib/guasti/registra";

// Follow-up via email dopo il download di una guida (area o ente), collegato al
// client Brevo condiviso (lib/email/brevo.ts).
//
// ⚠️⚠️ FINO AL 5/10/2026 QUESTA ROUTE MANDAVA UN'EMAIL A CHIUNQUE, DA
// `noreply@kireo.it`, E IL CONTENUTO LO SCRIVEVA CHI CHIAMAVA. Nessuna
// sessione (nessun client Supabase importato), `/api` non è in AREE_PROTETTE,
// nessun limite: dal corpo arrivavano il DESTINATARIO, il LINK del bottone, il
// NOME nel saluto e il TITOLO in grassetto — e il template interpolava in HTML
// senza escape. Misurato su build di produzione senza sessione e senza cookie:
// la richiesta arrivava fino a `inviaEmail` con l'indirizzo di chi chiamava.
// Qui si è fermata solo perché mancava la chiave Brevo; in produzione c'è.
//
// È una specie diversa dalle sei falle di policy degli stessi giorni: non è
// una lettura, è un'AZIONE NEL MONDO compiuta a nome nostro verso persone che
// non hanno mai usato KIREO — e irreversibile, perché un'email mandata non si
// cancella e un dominio bruciato porta nello spam le email vere alle scuole,
// che è il canale su cui poggia il progetto.
//
// ══════ LE DUE CURE CHE NON ERANO DECISIONI, fatte qui ══════
//
//   1. IL LINK E IL TITOLO NON VENGONO DAL CORPO. Per le guide d'area già non
//      venivano (li compone il server da `data/aree` + `percorsoGuidaUno`); per
//      quelle ente si legge la riga di `guide_enti` e il nome dell'istituzione
//      dal database. Dal corpo arriva solo un `guidaId`, che è una chiave da
//      verificare — non un contenuto da stampare: se quella guida non è
//      dell'istituzione indicata, non si manda niente.
//   2. L'escape HTML nei template (`esc()` in lib/email/templates.ts), più il
//      rifiuto di qualunque link che non sia http/https (`linkSicuro`).
//
// La lettura passa dal client NORMALE e non dalla service-role, apposta: la
// policy `guide_enti_select_pubblico` serve le guide delle sole istituzioni
// `attiva`, quindi il controllo «questa istituzione è pubblicata» lo fa la RLS
// invece di una riga di codice che qualcuno può dimenticare.
//
// ══════ COSA RESTA, e Mario lo sa ══════
//
//   • NESSUNA SESSIONE: chiunque può ancora farci mandare a un indirizzo a
//     caso una guida VERA di KIREO. È spam e quota, non più phishing — il
//     salto di gravità sta tutto nelle due cure sopra. Se richiedere la
//     sessione sia giusto è una decisione di prodotto (una guida è un'esca:
//     se per scaricarla devi registrarti, l'esca non pesca più), e la strada
//     proposta è che questa route SCRIVA una riga — da cui eredita il limite
//     per email, come la route sorella `/api/richiesta-contatto`, e da cui
//     nasce il registro di chi ha chiesto quale guida.
//   • `guide_enti.pdf_url` è testo libero scritto dall'ente e NON passa da
//     nessuna revisione: un ente registrato può metterci un suo https
//     qualunque, e noi lo mandiamo. L'attore scende da «chiunque su internet»
//     a «un'istituzione registrata», ed è la ragione per cui non è urgente —
//     ma «la guida deve vivere nel nostro Storage» è una regola di prodotto,
//     non una riga di codice.
//
// Un fallimento nell'invio non risale come errore al form chiamante (il
// download del PDF è già partito prima di questa chiamata, vedi
// GuidaAreaForm/GuidaEnteForm): risposta sempre 200 con `inviata` a indicare
// l'esito reale.
const PROCESSO = "guida-email";

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  if (!corpo?.email || typeof corpo.email !== "string" || (!corpo?.areaSlug && !corpo?.istituzioneId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const nomeDestinatario = typeof corpo.nome === "string" ? corpo.nome.trim() : "";

  let titoloGuida: string;
  let linkGuida: string;

  if (corpo.areaSlug) {
    const area = getAreaBySlug(corpo.areaSlug);
    if (!area) return NextResponse.json({ ok: false }, { status: 400 });
    titoloGuida = `Guida di orientamento — ${area.nome}`;
    // La scelta fra guida vera e segnaposto NON si riscrive qui: fino al
    // 2026-09-26 questa riga puntava sempre al segnaposto, quindi chi lasciava
    // la mail scaricava la guida vera dalla pagina e riceveva per email un PDF
    // che dichiara di non essere ancora scritto.
    linkGuida = `${SITE_URL}${percorsoGuidaUno(area.slug)}`;
  } else {
    if (typeof corpo.istituzioneId !== "string" || typeof corpo.guidaId !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // ⚠️ LA LETTURA STA DENTRO IL TRY, E `createClient()` DENTRO CON LEI.
    // Quella chiamata LANCIA quando Supabase non è configurato, e fuori dal try
    // produceva un 500 grezzo senza corpo e senza traccia — identico al
    // difetto già pagato il 26/09 sulla rotta delle guide. `test:log5xx` non lo
    // vede, perché guarda i 5xx che RITORNIAMO e non quelli che lasciamo
    // accadere. Qui si fallisce CHIUSO: nessuna email, e il guasto registrato.
    let guida: { pdf_url: string; istituzione_id: string } | null = null;
    let istituzione: { nome: string } | null = null;
    try {
      const supabase = await createClient();
      // La guida si legge DAL DATABASE e si verifica che sia di quell'istituzione:
      // il `guidaId` è una chiave, non un contenuto. La RLS filtra già alle
      // istituzioni `attiva`.
      const [g, i] = await Promise.all([
        supabase.from("guide_enti").select("pdf_url, istituzione_id").eq("id", corpo.guidaId).maybeSingle(),
        supabase.from("istituzioni").select("nome").eq("id", corpo.istituzioneId).maybeSingle(),
      ]);
      guida = g.data;
      istituzione = i.data;
    } catch (errore) {
      await segnalaGuasto(
        { processo: PROCESSO, specie: "email_guida", motivo: "lettura_guida", dettaglio: errore },
        "Errore [guida-email]: non ho potuto leggere la guida, email non mandata —",
      );
      return NextResponse.json({ ok: true, inviata: false });
    }
    if (!guida || !istituzione || guida.istituzione_id !== corpo.istituzioneId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    titoloGuida = `Guida di ${istituzione.nome}`;
    linkGuida = guida.pdf_url;
  }

  let corpoHtml: string;
  try {
    corpoHtml = templateFollowUpGuida({ nome: nomeDestinatario, titoloGuida, linkGuida });
  } catch (errore) {
    // `linkSicuro` ha rifiutato il link (schema non http/https): meglio non
    // mandare niente che mandare un bottone che non si può correggere dopo
    // l'invio. Si registra, perché è un dato che non va: una guida con un
    // `pdf_url` inutilizzabile nessuno la scarica.
    await segnalaGuasto(
      { processo: PROCESSO, specie: "email_guida", motivo: "link_non_ammesso", dettaglio: errore },
      "Errore [guida-email]: link non ammesso, email non mandata —",
    );
    return NextResponse.json({ ok: true, inviata: false });
  }

  const esito = await inviaEmail(corpo.email, "La tua guida KIREO", corpoHtml, nomeDestinatario || undefined);

  // L'artefatto che non arriva è lo stesso — il follow-up — quindi è la stessa
  // specie con un motivo diverso: `link_non_ammesso` è un dato da correggere,
  // `invio_non_riuscito` è il fornitore. Fin qui restava in un `console.error`,
  // cioè in un log che dura poche ore.
  if (!esito.ok) {
    await segnalaGuasto(
      { processo: PROCESSO, specie: "email_guida", motivo: "invio_non_riuscito", dettaglio: esito.motivo },
      `Errore [guida-email]: invio non riuscito a ${corpo.email} —`,
    );
  }

  return NextResponse.json({ ok: true, inviata: esito.ok });
}
