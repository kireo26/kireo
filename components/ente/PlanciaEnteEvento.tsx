import { getEnteContext } from "@/lib/ente/context";
import { getQuoteEnte } from "@/lib/ente/quote";
import { createClient } from "@/lib/supabase/server";
import MettiInEvidenzaButton from "@/components/ente/MettiInEvidenzaButton";
import RegistroPresenzeDocenti from "@/components/ente/RegistroPresenzeDocenti";
import ChiaveTrasmissione from "@/components/ente/ChiaveTrasmissione";
import { statoChiaveTrasmissione } from "@/lib/eventi/chiaveTrasmissione";
import type { ContestoModerazione } from "@/lib/eventi/moderazione";

// LE PARTI DELLA PLANCIA CHE SONO SOLO DELL'ENTE, nella pagina dell'evento
// (Mario, 27/10). Fino al 27/10 stavano nella lista di `/ente/eventi`, una per
// riga, accanto alla console della diretta: la messa in evidenza, il registro
// dei docenti, la chiave di trasmissione. La lista ora dice solo cosa c'è e
// quando; quello che si FA su un evento si fa qui, in un posto solo.
//
// Solo per `parte === "ente"`: l'admin queste tre cose le ha nella sua coda
// (la chiave la scrive lui, `GestisciChiaveTrasmissioneForm`).
export default async function PlanciaEnteEvento({ evento }: { evento: ContestoModerazione["evento"] }) {
  const contesto = await getEnteContext();
  const supabase = await createClient();
  const eDocenti = evento.pubblico === "docenti";
  const conChiave = evento.tipo === "webinar" && evento.hosting_diretta === "kireo";

  // Chi può essere messo in evidenza si decide qui, non da `quote`: dal 27/10
  // `getQuoteEnte` dà null anche quando la lettura fallisce, e il bottone non
  // deve sparire per questo (il limite lo difende la funzione SQL).
  const puoEvidenza = evento.stato === "approvato" && !evento.in_evidenza;
  const [quote, iscrizioni, chiave] = await Promise.all([
    puoEvidenza ? getQuoteEnte(supabase, contesto.istituzioneId, contesto.pianoNome) : Promise.resolve(null),
    eDocenti && evento.stato === "approvato"
      ? supabase.from("iscrizioni_eventi").select("student_id, stato, profiles!student_id(nome, cognome)").eq("evento_id", evento.id)
      : Promise.resolve(null),
    // Le chiavi dei propri eventi ospitati da KIREO: la RLS fa già passare
    // solo le proprie (chiavi_trasmissione_select_propria). L'errore si logga —
    // una lettura muta qui direbbe «non ancora preparata» su una chiave che
    // c'è, cioè farebbe aspettare qualcuno che non deve più aspettare.
    conChiave
      ? supabase.from("chiavi_trasmissione").select("chiave, server, aggiornata_il").eq("evento_id", evento.id).maybeSingle()
      : Promise.resolve(null),
  ]);
  if (iscrizioni?.error) console.error("[ente/eventi] registro docenti:", iscrizioni.error);
  if (chiave?.error) console.error("[ente/eventi] chiavi_trasmissione:", chiave.error);

  const registro = (iscrizioni?.data ?? []).map((riga) => {
    const profilo = Array.isArray(riga.profiles) ? riga.profiles[0] : riga.profiles;
    return { userId: riga.student_id, nomeCompleto: profilo ? `${profilo.nome} ${profilo.cognome}` : "Docente", stato: riga.stato };
  });
  const c = chiave?.data ?? null;

  if (!puoEvidenza && !iscrizioni && !conChiave && !evento.in_evidenza) return null;

  return (
    <>
      {(evento.in_evidenza || puoEvidenza) && (
        <section className="mt-6 rounded-xl border border-white/5 bg-kireo-card p-4">
          {evento.in_evidenza ? (
            <p className="text-sm text-kireo-light">Questo evento è in evidenza.</p>
          ) : (
            <MettiInEvidenzaButton eventoId={evento.id} quotaRimasta={quote ? quote.evidenzaTotali - quote.evidenzaUsate : null} />
          )}
        </section>
      )}
      {iscrizioni && (
        <section className="mt-6 rounded-xl border border-white/5 bg-kireo-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Registro presenze</p>
          <RegistroPresenzeDocenti eventoId={evento.id} iscritti={registro} />
        </section>
      )}
      {/*
        FINO AL 4/10 QUI C'ERA UNA PROMESSA: «riceverai la chiave di
        trasmissione da KIREO prima dell'evento» — e nel prodotto non c'era
        niente che gliela mandasse. Adesso i tre momenti si distinguono, e il
        buco si vede (vedi lib/eventi/chiaveTrasmissione.ts).
      */}
      {conChiave && (
        <section className="mt-6 rounded-xl border border-white/5 bg-kireo-card p-4">
          <ChiaveTrasmissione
            stato={statoChiaveTrasmissione({
              haChiave: !!c,
              haServer: !!c?.server,
              dataInizio: evento.data_inizio,
              dataFine: evento.data_fine,
              chiusaIl: evento.diretta_chiusa_il,
            })}
            chiave={c?.chiave ?? null}
            server={c?.server ?? null}
            aggiornataIl={c?.aggiornata_il ?? null}
          />
        </section>
      )}
    </>
  );
}
