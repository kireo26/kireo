import { NextResponse } from "next/server";

export const runtime = "nodejs";

// CHIUSA il 2026-08-29. Qui viveva il caricamento file del workshop (motore
// v1): riceveva un PDF o un'immagine, la metteva su Storage, ne faceva
// analizzare il contenuto e scriveva una riga in `workshop_consegne` con il
// feedback.
//
// Il punto di ingresso è uscito dalla pagina del ruolo lo stesso giorno,
// perché tutti e 25 i ruoli hanno il loro elaborato a tappe e due modi di
// consegnare lo stesso lavoro producevano due giudizi sulla stessa iscrizione.
// La route però restava raggiungibile da chiunque avesse una sessione e una
// propria iscrizione: nessun bottone la chiamava, ma una richiesta a mano
// andava a buon fine — e avrebbe consumato una chiamata a pagamento per
// scrivere un giudizio su un contenuto che il prodotto non sa più produrre.
// Un revisore vivo che nessuna pagina chiama è la cosa che fra sei mesi
// nessuno sa più spiegare, quindi la porta si chiude qui.
//
// COSA NON È STATO TOCCATO: la tabella `workshop_consegne`, il bucket
// `workshop-consegne` e i file già caricati restano — `lib/percorso/stato.ts`
// li legge ancora, e chi aveva consegnato in v1 non deve retrocedere nel
// percorso. Anche `components/workshop/ConsegnaUpload.tsx` resta al suo posto.
//
// Per riaprirla servono due gesti, non uno: togliere questo handler e
// rimettere il blocco nella pagina. Il codice originale sta in git, prima di
// questo commit.
export async function POST() {
  return NextResponse.json(
    { errore: "Il caricamento file non fa più parte del workshop: il lavoro si consegna una tappa alla volta dal progetto online." },
    { status: 410 },
  );
}
