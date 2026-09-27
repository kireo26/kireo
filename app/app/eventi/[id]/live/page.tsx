import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import PannelloLive from "@/components/live/PannelloLive";
import ConsegnaEvento from "@/components/live/ConsegnaEvento";
import { MAX_CARATTERI_CONSEGNA, MIN_CARATTERI_CONSEGNA } from "@/lib/eventi/consegna";
import { statoPortaConsegna } from "@/lib/eventi/portaConsegna";
import RileggiConsegna from "@/components/live/RileggiConsegna";
import { consegnaAperta } from "@/lib/live";

// Accesso solo autenticato (garantito dal layout /app + middleware) E
// iscritto: un evento non trovato o non pubblico=studenti dà 404 (RLS
// legge solo eventi approvati, un id di bozza/in_approvazione risulta
// semplicemente assente), un evento trovato ma senza iscrizione mostra un
// messaggio onesto invece del pannello live.
export default async function EventoLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventi")
    .select("id, titolo, data_inizio, data_fine, youtube_video_id, pubblico, domanda_consegna")
    .eq("id", id)
    .maybeSingle();

  if (!evento || evento.pubblico !== "studenti") notFound();

  const { data: iscrizione } = await supabase
    .from("iscrizioni_eventi")
    .select("student_id")
    .eq("evento_id", id)
    .eq("student_id", contesto.userId)
    .maybeSingle();

  if (!iscrizione) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="font-heading text-lg font-semibold text-kireo-light">Non risulti iscritto a questo evento</p>
        <p className="mt-2 text-sm text-kireo-muted">Iscriviti dall&apos;Agenda per accedere alla diretta.</p>
        <Link href="/app/agenda" className="mt-4 inline-block text-sm text-kireo-orange underline underline-offset-2">
          ← Vai all&apos;Agenda
        </Link>
      </div>
    );
  }

  const { data: domande } = await supabase
    .from("domande_live")
    .select("id, testo, stato, creata_il")
    .eq("evento_id", id)
    .eq("user_id", contesto.userId)
    .order("creata_il", { ascending: false });

  // La consegna sta SOTTO il pannello e la decide il server, non il pannello:
  // quello passa da "in corso" a "conclusa" da sé ogni 30s lato client, e legare
  // la consegna a quella transizione vorrebbe dire renderla da uno stato che il
  // server non ha visto. Chi resta sulla pagina fino alla fine legge l'avviso qui
  // sotto e ricaricando trova il campo.
  const porta = evento.domanda_consegna ? await statoPortaConsegna(supabase, evento, contesto.userId) : null;
  const { data: consegnaMia } = evento.domanda_consegna
    ? await supabase
        .from("consegne_evento")
        .select("testo, valutata_il")
        .eq("evento_id", id)
        .eq("student_id", contesto.userId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 sm:py-16">
      <PannelloLive
        eventoId={evento.id}
        userId={contesto.userId}
        titolo={evento.titolo}
        dataInizio={evento.data_inizio}
        dataFine={evento.data_fine}
        youtubeVideoId={evento.youtube_video_id}
        domandeIniziali={domande ?? []}
        hrefRitorno="/app/agenda"
      />

      {porta?.aperta && evento.domanda_consegna ? (
        <ConsegnaEvento
          eventoId={evento.id}
          domanda={evento.domanda_consegna}
          minCaratteri={MIN_CARATTERI_CONSEGNA}
          maxCaratteri={MAX_CARATTERI_CONSEGNA}
        />
      ) : null}

      {consegnaMia && evento.domanda_consegna ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <p className="font-heading text-base font-semibold text-kireo-light">La tua risposta</p>
          <p className="mt-3 border-l-2 border-kireo-orange pl-4 text-sm text-kireo-muted">{evento.domanda_consegna}</p>
          <p className="mt-4 whitespace-pre-wrap text-sm text-kireo-light">{consegnaMia.testo}</p>
          {/*
            `valutata_il` nullo vuol dire UNA cosa sola, da quando esiste
            `segna_consegna_letta`: la lettura non è arrivata. Prima ne voleva
            dire due — quella, e «letta, nessuna area riconosciuta» — e nel
            secondo caso l'invito a farla rileggere sarebbe stato una porta che
            riporta sempre allo stesso posto, a pagamento ogni giro.

            Fuori dalla finestra il bottone non si mostra: la route cadrebbe sul
            42501 della policy e risponderebbe «il tempo per rispondere è
            scaduto», che a chi ha già risposto dice la cosa sbagliata.
          */}
          {consegnaMia.valutata_il ? null : consegnaAperta(evento.data_inizio, evento.data_fine) ? (
            <RileggiConsegna eventoId={evento.id} testo={consegnaMia.testo} />
          ) : (
            <p className="mt-4 text-sm text-kireo-muted">
              Non siamo riusciti a leggerla, e il tempo per rileggerla è passato. Il testo resta tuo e al sicuro: non è un giudizio su
              quello che hai scritto, è un problema nostro. Se ti va, scrivici da{" "}
              <Link href="/contatti" className="text-kireo-orange underline underline-offset-2">
                Contatti
              </Link>
              .
            </p>
          )}
        </div>
      ) : null}

      {porta && !porta.aperta && porta.motivo !== "gia_consegnata" ? (
        <p className="text-sm text-kireo-muted">{porta.testo}</p>
      ) : null}
    </div>
  );
}
