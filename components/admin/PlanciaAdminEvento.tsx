import { createClient } from "@/lib/supabase/server";
import AzioneApprovazione from "@/components/admin/AzioneApprovazione";
import GestisciChiaveTrasmissioneForm from "@/components/admin/GestisciChiaveTrasmissioneForm";
import type { ContestoModerazione } from "@/lib/eventi/moderazione";
import { getQuotePerRevisione, testoQuotaRevisione } from "@/lib/ente/quote";

// LE PARTI DELLA PLANCIA CHE SONO SOLO DELL'ADMIN, nella pagina dell'evento
// (Mario, 27/10). Fino al 27/10 stavano nella coda di `/admin`, riga per riga:
// la descrizione intera, la CTA esterna, approva/rifiuta, e la chiave di
// trasmissione degli eventi ospitati da KIREO. La coda ora dice solo cosa c'è,
// di chi e quando (`/admin/eventi`); quello che si FA su un evento si fa qui,
// come per l'ente (`PlanciaEnteEvento`).
export default async function PlanciaAdminEvento({ evento }: { evento: ContestoModerazione["evento"] }) {
  const daDecidere = evento.stato === "in_approvazione";
  const conChiave = evento.tipo === "webinar" && evento.hosting_diretta === "kireo";

  // QUANDO È STATA PREPARATA, non la chiave: l'admin deve sapere se c'è e da
  // quando, e un valore segreto ricaricato a schermo a ogni apertura sarebbe
  // esposto senza che nessuno l'abbia chiesto. L'errore si logga: una lettura
  // muta farebbe dire «non preparata» su una chiave che c'è, e l'admin la
  // sostituirebbe per niente.
  let chiave: { aggiornata_il: string; server: string | null } | null = null;
  if (conChiave) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("chiavi_trasmissione")
      .select("server, aggiornata_il")
      .eq("evento_id", evento.id)
      .maybeSingle();
    if (error) console.error("[admin] chiavi_trasmissione:", error);
    chiave = data ?? null;
  }

  // Una CTA esterna consuma una quota del piano, e da quando le quote contano
  // solo l'approvato è l'admin a fermare chi l'ha finita (27/10).
  const quotaCta =
    daDecidere && evento.cta_esterna_url && evento.organizzatore_id
      ? testoQuotaRevisione(await getQuotePerRevisione(await createClient(), evento.organizzatore_id), "cta")
      : null;

  if (!daDecidere && !conChiave) return null;

  return (
    <>
      {daDecidere && (
        <section className="mt-6 rounded-xl border border-kireo-orange/30 bg-kireo-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-orange">Da approvare</p>
          {evento.descrizione && <p className="text-sm text-kireo-light/90">{evento.descrizione}</p>}
          {evento.cta_esterna_url && <p className="mt-2 text-xs text-kireo-muted">CTA esterna richiesta: {evento.cta_esterna_url}</p>}
          {quotaCta && <p className={`mt-1 text-xs ${quotaCta.piena ? "text-kireo-orange" : "text-kireo-muted"}`}>{quotaCta.testo}</p>}
          {evento.tipo === "webinar" && (
            <p className="mt-2 text-xs text-kireo-muted">
              Hosting diretta: {evento.hosting_diretta === "proprio" ? "canale proprio dell'ente" : "ospitata da KIREO"}
            </p>
          )}
          <AzioneApprovazione tabella="eventi" id={evento.id} statoApprovato="approvato" statoRifiutato="rifiutato" />
        </section>
      )}
      {/* La chiave sta accanto al video perché è lo stesso momento in cui
          l'admin prepara la diretta: altrove sarebbe un gesto in più da
          ricordare, e il gesto che si ricorda a parte è quello che si dimentica. */}
      {conChiave && (
        <section className="mt-6 rounded-xl border border-white/5 bg-kireo-card p-4">
          <GestisciChiaveTrasmissioneForm eventoId={evento.id} aggiornataIl={chiave?.aggiornata_il ?? null} server={chiave?.server ?? null} />
        </section>
      )}
    </>
  );
}
