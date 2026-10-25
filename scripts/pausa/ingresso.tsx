// Il PannelloLive VERO, montato con YouTube finto: è la pagina che gli studenti
// aprono, non una copia del suo cablaggio. Le date arrivano da window.__props.
import { createRoot } from "react-dom/client";
import PannelloLive from "@/components/live/PannelloLive";
declare global { interface Window { __props: { dataInizio: string; dataFine: string } } }
const p = window.__props;
createRoot(document.getElementById("radice")!).render(
  <PannelloLive
    eventoId="e" userId="u" titolo="Prova" dataInizio={p.dataInizio} dataFine={p.dataFine} chiusaIl={null}
    youtubeVideoId="VIDEO" domandeIniziali={[]} hrefRitorno="/app/agenda" pubblico="studenti"
  />,
);
