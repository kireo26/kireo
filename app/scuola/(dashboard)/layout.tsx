import ScuolaShell from "@/components/scuola/ScuolaShell";
import { getScuolaContext } from "@/lib/scuola/context";

const MESSAGGIO_STATO: Record<string, { titolo: string; testo: string }> = {
  richiesta: {
    titolo: "La tua richiesta è in attesa",
    testo:
      "Stiamo verificando la richiesta della tua scuola. Le funzioni (verifica studenti, classi, eventi, comunicazioni) si sbloccano dopo l'attivazione della convenzione da parte di KIREO.",
  },
  convenzionata: {
    titolo: "Convenzione firmata, attivazione in corso",
    testo: "La convenzione è stata registrata: KIREO sta completando l'attivazione, questione di poco.",
  },
  sospesa: {
    titolo: "Profilo sospeso",
    testo: "Il profilo della tua scuola è sospeso. Contattaci da /contatti per maggiori informazioni.",
  },
};

// Solo stato "attiva" sblocca le funzioni: prima di allora il referente (o
// il tutor) vede solo lo stato della richiesta, non il resto della
// dashboard — a differenza dell'area ente (dove lo stato è solo un banner
// informativo mentre il resto resta comunque navigabile), qui il requisito
// è esplicito: "SOLO attiva sblocca le funzioni".
export default async function ScuolaLayout({ children }: { children: React.ReactNode }) {
  const contesto = await getScuolaContext();
  const messaggio = MESSAGGIO_STATO[contesto.stato];

  return (
    <ScuolaShell nomeScuola={contesto.nomeScuola} ruoloStaff={contesto.ruoloStaff}>
      {contesto.stato !== "attiva" && messaggio ? (
        <div className="rounded-2xl border border-kireo-orange/40 bg-kireo-orange/10 p-6">
          <h1 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">{messaggio.titolo}</h1>
          <p className="mt-2 text-sm text-kireo-light/80">{messaggio.testo}</p>
        </div>
      ) : (
        children
      )}
    </ScuolaShell>
  );
}
