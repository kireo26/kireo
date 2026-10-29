import { inviaEmail } from "@/lib/email/brevo";
import { templateFollowUpGuida } from "@/lib/email/templates";
import { EMAIL_PUBBLICA } from "@/lib/site";
import { segnalaGuasto } from "@/lib/guasti/registra";

// Il follow-up dopo lo scaricamento di una guida: solo del server (le due route
// di `/api/scarica-guida`). Prima stava in `/api/guida-email`, una route senza
// sessione che chiunque poteva chiamare a parte; ora parte solo insieme a uno
// scaricamento vero, dopo la risposta.

/** Il follow-up con il link. Da chiamare dentro `after()`: il download non lo aspetta. */
export async function mandaEmailGuida(processo: string, email: string, titoloGuida: string, linkGuida: string): Promise<void> {
  let corpoHtml: string;
  try {
    corpoHtml = templateFollowUpGuida({ nome: "", titoloGuida, linkGuida });
  } catch (errore) {
    await segnalaGuasto(
      { processo, specie: "email_guida", motivo: "link_non_ammesso", dettaglio: errore },
      "Errore [scarica-guida]: link non ammesso, email non mandata —",
    );
    return;
  }
  const esito = await inviaEmail(email, "La tua guida KIREO", corpoHtml, { rispondiA: EMAIL_PUBBLICA });
  if (!esito.ok) {
    await segnalaGuasto(
      { processo, specie: "email_guida", motivo: "invio_non_riuscito", dettaglio: esito.motivo },
      `Errore [scarica-guida]: invio non riuscito a ${email} —`,
    );
  }
}
