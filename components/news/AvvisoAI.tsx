import { componiAvvisoAI, INTESTAZIONE_AVVISO_AI, type DichiarazioneAI } from "@/lib/avvisoAI";

// Il riquadro «Come è fatto questo post». Il TESTO non sta qui: sta in
// `lib/avvisoAI.ts`, dove è un valore e quindi si può controllare da un test
// (`npm run test:avviso`) — vedi il commento in testa a quel file per il perché
// è generato dal frontmatter invece di essere ricopiato nel corpo degli
// articoli. Qui resta solo il rendering, e i `prose-blockquote:` li riceve dal
// contenitore in `app/news/[slug]/page.tsx`: sono gli stessi che aveva quando
// era un blockquote scritto a mano nel corpo, quindi per chi legge non cambia
// niente.

export default function AvvisoAI(props: DichiarazioneAI) {
  const corpo = componiAvvisoAI(props);
  if (!corpo) return null;

  return (
    <blockquote>
      <p>
        <strong>{INTESTAZIONE_AVVISO_AI}</strong> {corpo}
      </p>
    </blockquote>
  );
}
