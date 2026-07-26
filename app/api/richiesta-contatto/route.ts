import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inviaEmail } from "@/lib/email/brevo";
import { templateConfermaRichiestaContatto, templateNotificaRichiestaContatto } from "@/lib/email/templates";

export const runtime = "nodejs";

const EMAIL_NOTIFICA_INTERNA = "mario.izzo@hotmail.it";
const EMAIL_NOTIFICA_ENTI = "info@kireo.it";

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

// Form "Richiedi informazioni" delle landing del funnel scuole
// (/dirigenti, /scuole). Insert pubblico (RLS: anon può solo inserire, mai
// leggere — vedi la migration), poi due email best-effort: conferma al
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

  if (typeof origine !== "string" || (origine !== "dirigenti" && origine !== "scuole" && origine !== "enti")) {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }
  const campiTesto = [nome, ruolo, istituto, email, messaggio];
  if (campiTesto.some((v) => typeof v !== "string" || !v.trim())) {
    return erroreDiCortesia("Compila tutti i campi obbligatori.", 400);
  }
  const nomeStr = (nome as string).trim();
  const ruoloStr = (ruolo as string).trim();
  const istitutoStr = (istituto as string).trim();
  const emailStr = (email as string).trim();
  const messaggioStr = (messaggio as string).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return erroreDiCortesia("Inserisci un indirizzo email valido.", 400);
  }
  if (nomeStr.length > 200 || ruoloStr.length > 200 || istitutoStr.length > 300 || messaggioStr.length > 3000) {
    return erroreDiCortesia("Uno dei campi supera la lunghezza massima consentita.", 400);
  }
  const codice = typeof codiceMeccanografico === "string" && codiceMeccanografico.trim() ? codiceMeccanografico.trim() : null;

  const supabase = await createClient();
  const { error } = await supabase.from("richieste_contatto").insert({
    origine,
    nome: nomeStr,
    ruolo: ruoloStr,
    istituto: istitutoStr,
    codice_meccanografico: codice,
    email: emailStr,
    messaggio: messaggioStr,
  });

  if (error) {
    if (error.message?.includes("richiesta_recente")) {
      return erroreDiCortesia("Hai già inviato una richiesta di recente: ti ricontatteremo presto!", 429);
    }
    console.error("Errore insert richieste_contatto:", error);
    return erroreDiCortesia("Non è stato possibile inviare la richiesta. Riprova tra qualche istante.", 500);
  }

  const emailNotificaDestinatario = origine === "enti" ? EMAIL_NOTIFICA_ENTI : EMAIL_NOTIFICA_INTERNA;
  const oggettoNotifica = origine === "enti" ? "Richiesta informazione ente formativo" : `Nuova richiesta (${origine}) da ${istitutoStr}`;

  const [esitoConferma, esitoNotifica] = await Promise.all([
    inviaEmail(emailStr, "Abbiamo ricevuto la tua richiesta — KIREO", templateConfermaRichiestaContatto(nomeStr, origine), nomeStr),
    inviaEmail(
      emailNotificaDestinatario,
      oggettoNotifica,
      templateNotificaRichiestaContatto({
        origine,
        nome: nomeStr,
        ruolo: ruoloStr,
        istituto: istitutoStr,
        codiceMeccanografico: codice,
        email: emailStr,
        messaggio: messaggioStr,
      }),
    ),
  ]);

  if (!esitoConferma.ok) console.error("Email di conferma richiesta contatto non inviata:", esitoConferma.motivo);
  if (!esitoNotifica.ok) console.error("Email di notifica richiesta contatto non inviata:", esitoNotifica.motivo);

  return NextResponse.json({ ok: true });
}
