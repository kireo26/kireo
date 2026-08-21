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

// Istruzione appesa centralmente a ogni system prompt: riduce il poscritto alla
// fonte, invece di doverlo togliere a valle in ogni prompt sparso.
const ISTRUZIONE_ANTI_POSCRITTO =
  "\n\nRispondi SOLO con l'oggetto JSON richiesto: nessun testo prima della parentesi graffa iniziale, nessun testo dopo la parentesi graffa finale.";

export type EsitoAI = { ok: true; dati: unknown } | { ok: false; motivo: "chiamata" | "estrazione" };

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
export async function chiamaJson(
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
    try {
      const risposta = await client.messages.create({
        model: opzioni.model,
        max_tokens: opzioni.maxTokens,
        system,
        messages: [{ role: "user", content: opzioni.user }],
      });
      testo = risposta.content[0]?.type === "text" ? risposta.content[0].text : "";
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

    console.error(`chiamaJson — estrazione JSON fallita (tentativo ${tentativo + 1}). Inizio risposta: ${testo.slice(0, 300)}`);
    if (ultimo) return { ok: false, motivo: "estrazione" };
  }
  // irraggiungibile: il ramo `ultimo` ritorna sempre.
  return { ok: false, motivo: "chiamata" };
}
