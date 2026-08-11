// KIREO Escape — costruzione della RESTITUZIONE dell'esito (v2). Non un
// riassunto: quattro momenti in linguaggio ipotetico, senza mai numeri grezzi
// di valore/peso. Logica pura (nessuna AI), calcolata dalle risposte autorevoli
// lette dal DB (step_response) + i segnali d'area aggregati. Usata lato server
// dalla pagina di esito. Retro-compatibile: su un tentativo vecchio (senza i
// nuovi step) i blocchi che non si possono ricostruire restano null/vuoti.

import type { LeggiRisposta, PayloadAlloca, PayloadScarta, PayloadSeleziona } from "./tipi";
import { dossierStanza2, mandatoScelto, materialiLetti, opzioniScarto, vociBudget } from "./config";

export type AreaTop = { slug: string; nome: string; status: "emergente" | "confermata" | "da_verificare" };

export type Restituzione = {
  costruito: string | null; // 1. Cosa avete costruito
  metodo: string | null; // 2. Come avete deciso
  occasioni: string[]; // 3. Le occasioni (conseguenze)
  ipotesi: string | null; // 4. Le ipotesi (intro + invito a verificare)
  notaVerifica: string | null; // nota se autoefficacia≠performance (status da_verificare)
};

const elenco = (nomi: string[]) =>
  nomi.length <= 1 ? nomi[0] ?? "" : `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]}`;

export function costruisciRestituzione(get: LeggiRisposta, areeTop: AreaTop[]): Restituzione {
  const mandato = mandatoScelto(get);
  const letti = materialiLetti(get);

  // ── 1. Cosa avete costruito
  let costruito: string | null = null;
  if (mandato) {
    const alloc = (get("s3_budget") as PayloadAlloca | undefined)?.allocazioni ?? {};
    const voci = vociBudget(mandato, letti);
    let topLabel: string | null = null;
    let topVal = 0;
    for (const v of voci) {
      const a = Number(alloc[v.id]) || 0;
      if (a > topVal) {
        topVal = a;
        topLabel = v.label.toLowerCase();
      }
    }
    costruito =
      `Hai immaginato l'ex mercato come ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topLabel ? ` Quando hai dovuto distribuire il budget, la fetta più grande è andata a «${topLabel}».` : "");
  }

  // ── 2. Come avete deciso (metodo: focalizzazione vs curiosità ampia)
  let metodo: string | null = null;
  const selezionati = (get("s2_informazioni") as PayloadSeleziona | undefined)?.selezionati ?? [];
  if (mandato && selezionati.length > 0) {
    const dossier = dossierStanza2(mandato);
    const areeMandato = new Set(mandato.aree);
    const areeToccate = new Set<string>();
    let dentroMandato = 0;
    for (const id of selezionati) {
      const m = dossier.find((d) => d.id === id);
      if (!m) continue;
      m.aree.forEach((a) => areeToccate.add(a));
      if (m.aree.some((a) => areeMandato.has(a))) dentroMandato++;
    }
    const tutti = dentroMandato === selezionati.length;
    if (tutti) {
      metodo = `Sei andato dritto: i ${selezionati.length} approfondimenti che hai speso erano tutti dentro il tuo campo. Hai preferito approfondire una direzione piuttosto che guardarti intorno — è uno stile, non un difetto.`;
    } else if (areeToccate.size >= 4) {
      metodo = `Hai voluto guardarti intorno: hai distribuito gli approfondimenti su ${areeToccate.size} aree diverse prima di impegnarti. Raccogli molti punti di vista — è uno stile, non una dispersione.`;
    } else {
      metodo = `Hai tenuto insieme il tuo mandato e uno sguardo più largo: qualche approfondimento nel tuo campo, qualcuno fuori. Un equilibrio tra concentrarsi e curiosare.`;
    }
  }

  // ── 3. Le occasioni (conseguenze di ciò che NON hai letto/scelto)
  const occasioni: string[] = [];
  const alloc = (get("s3_budget") as PayloadAlloca | undefined)?.allocazioni;
  const scartati = (get("s3_scarto") as PayloadScarta | undefined)?.scartati;

  if (alloc !== undefined && !letti.has("M4")) {
    occasioni.push(
      "Non hai aperto la perizia strutturale, e il tetto è arrivato quando il budget era già distribuito. Succede: nessuno può sapere tutto. Ma è un'informazione su di te — in questa missione hai preferito muoverti piuttosto che sapere prima.",
    );
  }

  if (scartati !== undefined) {
    const facciata = opzioniScarto(letti).find((o) => o.trappola);
    const facciataTenuta = facciata ? !scartati.includes(facciata.id) : false;
    if (facciataTenuta) {
      occasioni.push(
        letti.has("M6")
          ? "Hai proposto di rivestire la facciata anche se la perizia della Soprintendenza, che avevi letto, la dava per tutelata: la domanda sarebbe stata respinta. A volte si sa una cosa e si sceglie lo stesso di correre il rischio."
          : "Avresti proposto di coprire la facciata: la Soprintendenza l'avrebbe respinta. Era scritto in un documento che non hai aperto.",
      );
    }
  }

  if (mandato && alloc !== undefined && letti.has("M7")) {
    const voceGestione = vociBudget(mandato, letti).some((v) => v.id === "fondo_gestione");
    const fondo = Number(alloc["fondo_gestione"]) || 0;
    if (voceGestione && fondo === 0) {
      occasioni.push(
        "Sapevi dei costi di gestione dal terzo anno — l'avevi letto — ma non hai lasciato nulla da parte per coprirli. È il tipo di dettaglio che decide se un progetto regge nel tempo.",
      );
    }
  }

  // ── 4. Le ipotesi
  let ipotesi: string | null = null;
  if (areeTop.length > 0) {
    const nomi = areeTop.slice(0, 3).map((a) => a.nome);
    ipotesi = `Da come hai messo in ordine le priorità e da dove hai messo i soldi quando eri stretto, le aree che si sono attivate di più sono ${elenco(nomi)}. È un'ipotesi, non un verdetto: serve un'altra missione per capire se regge.`;
  }

  // ── nota da_verificare (autoefficacia≠performance)
  let notaVerifica: string | null = null;
  const daVerificare = areeTop.find((a) => a.status === "da_verificare");
  if (daVerificare) {
    notaVerifica = `Su ${daVerificare.nome} c'è un segnale interessante: la fiducia che ti sei dato e come te la sei cavata davvero non vanno nella stessa direzione. Vale la pena controllare se ti succede spesso — a volte ci si sottovaluta.`;
  }

  return { costruito, metodo, occasioni, ipotesi, notaVerifica };
}
