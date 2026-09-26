// L'avviso «Come è fatto questo post», generato dal frontmatter.
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
// una dichiarazione di responsabilità.
//
// Nell'altro verso non può succedere: se il riquadro nasce da `aiAssisted`, non
// esiste un articolo assistito senza avviso, e non esiste un avviso che nomina
// uno strumento diverso da quello dichiarato.
//
// I VALORI NON SI PIEGANO. Le frasi sono costruite perché `aiRole`,
// `aiTools` e `aiReviewedBy` entrino verbatim: niente articoli aggiunti davanti,
// niente accordi al plurale. Il produttore sta già DENTRO ogni voce di `aiTools`
// («Claude (Anthropic)»), quindi un elenco di due strumenti non attribuisce mai
// il primo al produttore del secondo — il difetto che nascerebbe scrivendo
// «(Perplexity e Claude, di Anthropic)» a partire da una lista.
//
// E OGNI CAMPO ASSENTE TOGLIE LA SUA FRASE, non la sostituisce con una
// generica: meglio un avviso che dice meno di uno che afferma una revisione che
// nessuno ha fatto. Che `aiAssisted: true` senza `aiReviewedBy` non debba
// esistere affatto lo pretende `npm run test:news`.

type Props = {
  aiAssisted?: boolean;
  aiTools?: string[];
  aiRole?: string;
  aiReviewedBy?: string;
};

function elenca(voci: string[]): string {
  if (voci.length === 1) return voci[0];
  return `${voci.slice(0, -1).join(", ")} e ${voci[voci.length - 1]}`;
}

export default function AvvisoAI({ aiAssisted, aiTools, aiRole, aiReviewedBy }: Props) {
  if (!aiAssisted) return null;

  const strumenti = (aiTools ?? []).filter((s) => typeof s === "string" && s.trim() !== "");
  const quali = strumenti.length > 0 ? ` — ${elenca(strumenti)} — ` : " ";
  const cosaHaFatto = aiRole?.trim() ? `ha fatto ${aiRole.trim()}` : "ha contribuito a questo articolo";

  return (
    <blockquote>
      <p>
        <strong>Come è fatto questo post.</strong> Un&apos;intelligenza artificiale{quali}
        {cosaHaFatto}. Ogni fonte è stata poi aperta e controllata
        {aiReviewedBy?.trim()
          ? `, e il testo è stato letto, corretto e approvato da ${aiReviewedBy.trim()}, che ne ha la responsabilità editoriale.`
          : "."}
      </p>
    </blockquote>
  );
}
