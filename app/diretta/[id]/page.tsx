import Link from "next/link";
import { fineEffettiva } from "@/lib/live";
import { getContestoModerazione } from "@/lib/eventi/moderazione";
import ControlloDirettaEvento from "@/components/ente/ControlloDirettaEvento";
import ReportEventoButton from "@/components/ente/ReportEventoButton";
import GestisciVideoDirettaForm from "@/components/admin/GestisciVideoDirettaForm";
import SpostaFinestraForm from "@/components/ente/SpostaFinestraForm";
import CorreggiOreForm from "@/components/admin/CorreggiOreForm";
import PlanciaEnteEvento from "@/components/ente/PlanciaEnteEvento";
import { formattaDataOra } from "@/lib/formato";
import { getFiloneBySlug } from "@/data/filoniDocenti";

// LA PAGINA DI UNA DIRETTA, PER CHI LA STA MODERANDO.
//
// ⚠️ PERCHÉ ESISTE: fino all'11/10 si moderava da `/admin`, scorrendo una lista
// di TUTTI gli eventi e restando lì quaranta minuti mentre la pagina attorno
// parla di istituzioni in attesa di attivazione, post da approvare e richieste
// di upgrade. Qui c'è un evento solo, e tutto quello che serve durante quei
// quaranta minuti: quanti sono collegati, le domande con i loro bottoni, il
// campo della domanda finale, la chiusura, l'export.
//
// ⚠️ UNA PAGINA PER DUE RUOLI, e l'unica differenza è COSA SI PORTA VIA: è un
// vincolo di Mario, «due pagine gemelle divergono sempre». La guardia che
// ammette tutti e due e dice quale dei due è sta in `lib/eventi/moderazione.ts`.
//
// ⚠️ NESSUNA SHELL ATTORNO, ed è il punto: `EnteShell` sarebbe sbagliata per
// l'admin e la chrome di `/admin` per l'ente — ma soprattutto una barra di
// navigazione qui è la cosa da cui si sta scappando. Resta un link indietro,
// che va dove la persona era.
//
// LA FRESCHEZZA è dentro `ControlloDirettaEvento` e non qui: è una proprietà
// dei NUMERI, non della pagina, e sta accanto a loro anche su `/admin` e
// `/ente/eventi` (dove il difetto era identico e nessuno l'aveva notato).

export const dynamic = "force-dynamic";

export default async function ModerazioneDirettaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { parte, evento } = await getContestoModerazione(id);
  const perDocenti = evento.pubblico === "docenti";
  // L'indirizzo e il nome del posto da cui si viene stanno in UN ramo solo, non
  // in due: due ternari sullo stesso ruolo sono due copie della stessa
  // decisione, e divergono — un href verso `/admin` con l'etichetta «ai tuoi
  // eventi» è a una modifica di distanza.
  const indietro =
    parte === "kireo" ? { href: "/admin", dove: "alla coda KIREO" } : { href: "/ente/eventi", dove: "ai tuoi eventi" };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href={indietro.href} className="text-sm text-kireo-orange underline underline-offset-2">
        ← Torna {indietro.dove}
      </Link>

      <header className="mt-4">
        <h1 className="py-0.5 font-heading text-2xl font-semibold leading-[1.25] text-kireo-light">{evento.titolo}</h1>
        <p className="mt-2 text-sm text-kireo-muted">
          {evento.organizzatore ?? "KIREO"} · {perDocenti ? "Docenti" : "Studenti"} · {formattaDataOra(evento.data_inizio, "long")}
          {/* La fine EFFETTIVA (25/10): chiusa alle 14:24, l'intestazione non dice 14:30. */}
          {(evento.data_fine || evento.diretta_chiusa_il) &&
            ` → ${formattaDataOra(fineEffettiva(evento.data_inizio, evento.data_fine, evento.diretta_chiusa_il), "short")}`}
          {evento.diretta_chiusa_il && evento.data_fine && new Date(evento.diretta_chiusa_il) < new Date(evento.data_fine) &&
            ` · chiusa in anticipo (prevista fino a ${formattaDataOra(evento.data_fine, "short")})`}
        </p>
        {perDocenti && (
          <p className="mt-1 text-sm text-kireo-muted">Filone: {getFiloneBySlug(evento.filone ?? null)?.nome ?? "—"}</p>
        )}
        {/* Lo stato dell'evento sta qui perché su una diretta che non è
            approvata niente di quello che segue funziona — e scoprirlo
            premendo è peggio che leggerlo. */}
        {evento.stato !== "approvato" && (
          <p className="mt-3 rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-4 py-3 text-sm text-kireo-orange">
            Questo evento non è approvato ({evento.stato}): finché non lo è, gli studenti non possono iscriversi né collegarsi.
          </p>
        )}
      </header>

      {/* Il kill switch sul video sta QUI e non solo nella coda: se il video si
          rompe durante la diretta, è il primo posto in cui si cerca. Solo
          admin — l'ente non può scrivere quella colonna su un evento approvato
          (`eventi_update_propria_non_revisionato` si chiude appena l'evento
          esce da bozza), e aprirgliela è una decisione a sé. */}
      {parte === "kireo" && evento.tipo === "webinar" && (
        <section className="mt-6 rounded-xl border border-white/5 bg-kireo-card p-4">
          <GestisciVideoDirettaForm eventoId={evento.id} videoIdAttuale={evento.youtube_video_id} />
        </section>
      )}

      {/* LE ORE PCTO, solo admin (26/10, `20261029100000`): si calcolano
          dall'orario, e solo KIREO le corregge a mano. Anche a diretta chiusa —
          non si vieta, si dice: le ore già certificate restano quelle di allora. */}
      {parte === "kireo" && (
        <section className="mt-6 rounded-xl border border-white/5 bg-kireo-card p-4">
          <CorreggiOreForm
            eventoId={evento.id}
            oreAttuali={evento.ore_pcto ?? 0}
            fissateIl={evento.ore_pcto_fissate_il}
            fissateDa={evento.ore_pcto_fissate_da_nome}
            dataInizio={evento.data_inizio}
            dataFine={evento.data_fine}
            chiusaIl={evento.diretta_chiusa_il}
          />
        </section>
      )}

      {/* SPOSTARE L'ORARIO, per tutti e due i ruoli (18/10): quella sera la
          finestra si è spostata due volte in SQL perché non c'era nessuna
          strada nel prodotto. A diretta chiusa non si mostra: la funzione lo
          rifiuterebbe, e un bottone che invita a un gesto per poi dire no è
          il difetto che il bottone di chiusura ha già avuto. */}
      {!evento.diretta_chiusa_il && (
        <section className="mt-6 rounded-xl border border-white/5 bg-kireo-card p-4">
          <SpostaFinestraForm
            eventoId={evento.id}
            dataInizio={evento.data_inizio}
            dataFine={evento.data_fine}
            oreAttuali={evento.ore_pcto}
            fissateIl={evento.ore_pcto_fissate_il}
          />
        </section>
      )}

      {/* Quello che fino al 27/10 stava nella lista di `/ente/eventi`, riga per
          riga: evidenza, registro dei docenti, chiave. Ora la lista dice cosa
          c'è e quando, e questa è la plancia dell'evento (Mario). */}
      {parte === "ente" && <PlanciaEnteEvento evento={evento} />}

      {/* ⚠️ LA CONSOLE E IL REPORT SOLO PER UNA DIRETTA (27/10): da quando
          «Apri» porta qui da ogni riga della lista dell'ente, ci arriva anche un
          incontro in presenza — e lì «presenti ora», la domanda finale e «chiudi
          la diretta» non descrivono niente. Prima del 27/10 la lista mostrava la
          console solo sui webinar; questa condizione è la stessa, spostata. */}
      {evento.tipo === "webinar" && (
      <>
      <section className="mt-6 rounded-xl border border-white/5 bg-kireo-card p-4">
        <ControlloDirettaEvento
          eventoId={evento.id}
          domandaConsegna={evento.domanda_consegna}
          dataInizio={evento.data_inizio}
          dataFine={evento.data_fine}
          chiusaIl={evento.diretta_chiusa_il}
          chiusaDaTipo={evento.diretta_chiusa_da_tipo}
          chiusaPresenti={evento.diretta_chiusa_presenti}
          chiusaCertificati={evento.diretta_chiusa_certificati}
          chiusaDurata={evento.diretta_durata_minuti}
          youtubeVideoId={evento.youtube_video_id}
        />
      </section>

      {/* ⚠️ L'UNICA DIFFERENZA FRA I DUE RUOLI, e non è una divergenza della
          pagina: è una differenza di POLITICA DEI DATI, decisa il 26/07 e
          confermata il 27/09. L'admin scarica il CSV individuale (nomi, scuola,
          classe: la scuola certifica delle ore a delle persone); l'ente scarica
          il report aggregato con la soppressione k=5, e i testi degli studenti
          non li vede — «quello che scrivono resta loro, tu vedi solo che è
          arrivato». */}
      <section className="mt-6">
        {parte === "kireo" ? (
          <a href={`/api/admin/presenze/${evento.id}`} className="text-sm text-kireo-orange underline underline-offset-2">
            Esporta presenze, domande e risposte (CSV)
          </a>
        ) : (
          <ReportEventoButton eventoId={evento.id} evento={evento} />
        )}
      </section>
      </>
      )}
    </main>
  );
}
