// IL BANCO DEL PLAYER — l'ingresso che esbuild impacchetta.
//
// ⚠️ MONTA IL COMPONENTE VERO, NON I SUOI PARAMETRI (Mario, 25/10). Se il
// banco costruisse un iframe con «gli stessi parametri» scritti qui a mano,
// misurerebbe un altro player il giorno in cui PlayerDiretta cambia — la
// quarta delle tredici specie applicata a un iframe. Quindi qui non c'è
// nessun `playerVars`, nessun `rel`, nessun indirizzo di YouTube: c'è
// PlayerDiretta, e quello che gli arriva da lì. `npm run test:banco` lo pretende.
//
// Quello che aggiunge è solo un registro degli eventi con l'ora, perché le
// schermate finali di YouTube arrivano PRIMA della fine del video, e una
// fotografia senza l'ora non dice quale delle due cose si sta guardando.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import PlayerDiretta from "@/components/live/PlayerDiretta";

const params = new URLSearchParams(location.search);
const videoId = params.get("v") ?? "";

function Banco() {
  const [eventi, setEventi] = useState<string[]>([]);
  const scrivi = (e: string) =>
    setEventi((x) => [`${new Date().toLocaleTimeString("it-IT")} — ${e}`, ...x]);
  return (
    <div style={{ maxWidth: 900, margin: "24px auto", fontFamily: "sans-serif", color: "#F0EDE8" }}>
      <p>Banco del player — video <code>{videoId || "(nessuno)"}</code>. Il player qui sotto è PlayerDiretta, quello del prodotto.</p>
      <div style={{ position: "relative", aspectRatio: "16 / 9", overflow: "hidden", borderRadius: 16 }}>
        <PlayerDiretta
          videoId={videoId}
          titolo="Banco del player"
          onErrore={(esito) => scrivi(`errore: ${esito}`)}
          onPronto={() => scrivi("pronto (nessun errore dopo la grazia)")}
          onAvvio={() => scrivi("in riproduzione")}
          onRipiego={() => scrivi("RIPIEGO: l'IFrame API non si è caricata, è il riquadro semplice")}
          onFine={() => scrivi("fine del video (stato 0)")}
          onFermo={() => scrivi("fermo (pausa o caricamento)")}
        />
      </div>
      <ol style={{ fontSize: 13, lineHeight: 1.6 }}>
        {eventi.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ol>
    </div>
  );
}

createRoot(document.getElementById("radice")!).render(<Banco />);
