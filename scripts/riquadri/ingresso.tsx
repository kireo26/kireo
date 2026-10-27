// I due riquadri VERI della pagina della diretta, montati come li vede l'admin:
// le props vengono dal server finto, e `router.refresh()` le rilegge.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import CorreggiOreForm from "@/components/admin/CorreggiOreForm";
import SpostaFinestraForm from "@/components/ente/SpostaFinestraForm";

function props() {
  return { ...window.__server };
}
function Pagina() {
  const [p, setP] = useState(props);
  window.__refresh = () => setP(props());
  return (
    <div>
      <section id="correzione">
        <CorreggiOreForm eventoId="e" oreAttuali={p.ore ?? 0} fissateIl={p.fissate} fissateDa={p.fissate ? "Mario Izzo" : null} dataInizio={p.inizio} dataFine={p.fine} chiusaIl={p.chiusa} />
      </section>
      <section id="spostamento">
        <SpostaFinestraForm eventoId="e" dataInizio={p.inizio} dataFine={p.fine} oreAttuali={p.ore} fissateIl={p.fissate} />
      </section>
    </div>
  );
}
createRoot(document.getElementById("radice")!).render(<Pagina />);
