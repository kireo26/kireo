// Il testo dell'avviso «Come è fatto questo post», che sta in cima a ogni
// articolo scritto con l'aiuto di un'intelligenza artificiale.
//
// PERCHÉ È GENERATO E NON SCRITTO A MANO. Fino al 2026-09-26 la stessa
// dichiarazione viveva in due posti: quattro chiavi nel frontmatter
// (`aiAssisted`, `aiTools`, `aiRole`, `aiReviewedBy`) che NESSUNO leggeva, e un
// blockquote ricopiato a mano in testa a ognuno degli otto articoli. Due copie
// della stessa affermazione, una delle quali nessuno aggiorna — e qui la copia
// che arrivava al lettore era quella scritta a mano, cioè quella che un giorno
// qualcuno si dimentica di incollare. In quel giorno il file direbbe
// `aiAssisted: true` e la pagina non direbbe niente: una cosa scritta che
// dichiara uno stato diverso da quello vero, sull'unica riga della pagina che è
// una dichiarazione di responsabilità. Nell'altro verso non può succedere.
//
// PERCHÉ È UN VALORE IN UN FILE SUO, e non tre rami dentro il JSX: una
// proprietà dichiarata è un test che non c'è ancora, e una frase composta dentro
// un `.tsx` non si può controllare da uno script Node. Qui si può
// (`npm run test:avviso`).
//
// I VALORI NON SI PIEGANO. Le frasi sono costruite perché `aiRole`, `aiTools` e
// `aiReviewedBy` entrino verbatim: niente articoli aggiunti davanti, niente
// accordi al plurale. Il produttore sta già DENTRO ogni voce di `aiTools`
// («Claude (Anthropic)»), quindi un elenco di due strumenti non attribuisce mai
// il primo al produttore del secondo — il difetto che nascerebbe scrivendo
// «(Perplexity e Claude, di Anthropic)» a partire da una lista.
//
// I DUE PUNTI SONO LA RAGIONE PER CUI `aiRole` ENTRA VERBATIM SENZA SUONARE
// COME L'ETICHETTA DI UN CAMPO. Il valore è un sintagma senza articolo
// («ricerca delle fonti e stesura del testo»): attaccato a un verbo diventa un
// modulo da compilare, dopo i due punti diventa una frase. È il solo punto della
// pagina in cui suonare come un form costa qualcosa, perché è la riga in cui
// qualcuno si prende una responsabilità.
//
// E OGNI CAMPO ASSENTE TOGLIE LA SUA FRASE, non la sostituisce con una generica:
// meglio un avviso che dice meno di uno che afferma una revisione che nessuno ha
// fatto. Che `aiAssisted: true` senza `aiReviewedBy` non debba esistere affatto
// lo pretende `npm run test:news`.
//
// ⚠️ Il testo è voce. La frase con i due punti è di Mario; la seconda —
// «Ogni fonte è stata poi aperta e controllata» — è la stessa che stava a mano
// negli otto articoli, e sta aspettando una sua decisione (vedi «Punti aperti»
// in CLAUDE.md): generandola, da un'affermazione che una persona ripeteva
// articolo per articolo è diventata una cosa che la pagina dice da sola su ogni
// articolo futuro. Non si tocca finché non risponde.

export type DichiarazioneAI = {
  aiAssisted?: boolean;
  aiTools?: string[];
  aiRole?: string;
  aiReviewedBy?: string;
};

export const INTESTAZIONE_AVVISO_AI = "Come è fatto questo post.";

function elenca(voci: string[]): string {
  if (voci.length === 1) return voci[0];
  return `${voci.slice(0, -1).join(", ")} e ${voci[voci.length - 1]}`;
}

// Il corpo dell'avviso, senza l'intestazione in grassetto. `null` quando
// l'articolo non è assistito: non c'è niente da dichiarare, quindi non c'è
// nessun riquadro.
export function componiAvvisoAI(dichiarazione: DichiarazioneAI): string | null {
  if (!dichiarazione.aiAssisted) return null;

  const strumenti = (dichiarazione.aiTools ?? [])
    .filter((s) => typeof s === "string" && s.trim() !== "")
    .map((s) => s.trim());
  const quali = strumenti.length > 0 ? ` — ${elenca(strumenti)} — ` : " ";

  const ruolo = dichiarazione.aiRole?.trim();
  // Senza `aiRole` i due punti non hanno niente da introdurre, quindi la frase
  // cambia forma invece di restare aperta su un vuoto.
  const primaFrase = ruolo
    ? `Il contributo dell'intelligenza artificiale${quali}è stato: ${ruolo}.`
    : `Un'intelligenza artificiale${quali}ha contribuito a questo articolo.`;

  const revisore = dichiarazione.aiReviewedBy?.trim();
  const secondaFrase = revisore
    ? `Ogni fonte è stata poi aperta e controllata, e il testo è stato letto, corretto e approvato da ${revisore}, che ne ha la responsabilità editoriale.`
    : "Ogni fonte è stata poi aperta e controllata.";

  return `${primaFrase} ${secondaFrase}`;
}
