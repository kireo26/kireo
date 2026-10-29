import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIstituzionePubblicaBySlug, getGuideEnte, isIscrittoNewsletter, getConteggioFollower, isSeguito, etichettaTipoIstituzione, getAreeApprovateIstituzione } from "@/lib/app/istituzioni";
import { getEventiIstituzione, getAreeDegliEventi, getIscrizioniStudente, eventoNonFinito } from "@/lib/app/eventi";
import { statoEta, type StatoEta } from "@/lib/eta";
import { contattoEnti, type ContattoEnti, TESTO_MANCA_DATA_CONTATTO, HREF_AGGIUNGI_DATA, TESTO_AGGIUNGI_DATA } from "@/lib/app/contattoEnti";
import { TESTO_NEWSLETTER_SOLO_MAGGIORENNI } from "@/lib/app/comunicazioniKireo";
import { DIDASCALIA_SEGUI, DIDASCALIA_NEWSLETTER, DIDASCALIA_CONDIVIDI } from "@/lib/app/gestiEnte";
import GuidaEnteForm from "@/components/app/GuidaEnteForm";
import { testoEsitoGuida } from "@/lib/guide/testiScaricamento";
import IscrivitiNewsletterButton from "@/components/app/IscrivitiNewsletterButton";
import SeguiButton from "@/components/app/SeguiButton";
import ManifestazioneInteresseButton from "@/components/app/ManifestazioneInteresseButton";
import MessaggioEnteButton from "@/components/app/MessaggioEnteButton";
import CardEvento from "@/components/app/CardEvento";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const istituzione = await getIstituzionePubblicaBySlug(supabase, slug);
  if (!istituzione) return {};
  return {
    title: `${istituzione.nome} — KIREO`,
    description: istituzione.descrizione ?? `Profilo di ${istituzione.nome} su KIREO.`,
  };
}

export default async function IstituzionePubblicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ guida?: string | string[] }>;
}) {
  const { slug } = await params;
  const esitoGuida = testoEsitoGuida((await searchParams).guida);
  const supabase = await createClient();

  const istituzione = await getIstituzionePubblicaBySlug(supabase, slug);
  if (!istituzione) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [guide, eventi, areeDichiarate] = await Promise.all([
    getGuideEnte(supabase, istituzione.id),
    getEventiIstituzione(supabase, istituzione.id),
    getAreeApprovateIstituzione(supabase, istituzione.id),
  ]);

  // `eventoNonFinito` è la stessa regola dell'Agenda e delle aree (la fine
  // effettiva: una diretta chiusa in anticipo è passata). L'archivio va dal più
  // recente: è quello che si cerca.
  const eventiInProgramma = eventi.filter((e) => eventoNonFinito(e));
  const eventiPassati = eventi.filter((e) => !eventoNonFinito(e)).reverse();

  const areeEventi = await getAreeDegliEventi(
    supabase,
    eventi.map((e) => e.id),
  );

  const iscrizioniEventi = user ? new Set(await getIscrizioniStudente(supabase, user.id)) : new Set<string>();
  const iscrittoNewsletter = user ? await isIscrittoNewsletter(supabase, user.id, istituzione.id) : false;
  const guidaPrincipale = guide[0] ?? null;

  const conteggioFollower = await getConteggioFollower(supabase, istituzione.id);
  const seguito = user ? await isSeguito(supabase, user.id, istituzione.id) : false;

  // L'età in tre stati e chi può contattare l'ente (lib/eta.ts,
  // lib/app/contattoEnti.ts). Una lettura che fallisce dà «sconosciuta» e
  // «non studente»: i bottoni non compaiono, e il database li rifiuterebbe
  // comunque — la direzione sicura.
  let eta: StatoEta = "sconosciuta";
  let contatto: ContattoEnti = "non_studente";
  let manifestazioneAttivaId: string | null = null;
  let condivisioneCopreAttivita = false;
  if (user) {
    const { data: profilo } = await supabase.from("profiles").select("ruolo, data_nascita").eq("id", user.id).maybeSingle();
    eta = statoEta(profilo?.data_nascita ?? null);
    contatto = contattoEnti(profilo?.ruolo ?? null, profilo?.data_nascita ?? null);
    const { data: manifestazione } = await supabase
      .from("manifestazioni_interesse")
      .select("id, copre_attivita")
      .eq("student_id", user.id)
      .eq("istituzione_id", istituzione.id)
      .is("revocata_il", null)
      .maybeSingle();
    manifestazioneAttivaId = manifestazione?.id ?? null;
    // Il consenso dato prima del 20261111100000 non nominava l'attività: la
    // riga sotto il bottone dice quello che l'ente vede DAVVERO, non quello
    // che vedrebbe con un consenso nuovo.
    condivisioneCopreAttivita = manifestazione?.copre_attivita === true;
  }

  let conversazioneEsistenteId: string | null = null;
  if (user) {
    const { data: conversazione } = await supabase
      .from("conversazioni_enti")
      .select("id")
      .eq("student_id", user.id)
      .eq("istituzione_id", istituzione.id)
      .eq("stato", "aperta")
      .order("created_at", { ascending: false })
      .maybeSingle();
    conversazioneEsistenteId = conversazione?.id ?? null;
  }

  return (
    <>
      <section className="border-b border-white/5">
        {istituzione.immagine_copertina_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={istituzione.immagine_copertina_url} alt="" className="h-56 w-full object-cover sm:h-72" />
        ) : (
          <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-kireo-green/30 to-kireo-orange/20 sm:h-72">
            <span className="font-heading text-5xl font-bold text-kireo-light/40">{istituzione.nome.charAt(0)}</span>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <p className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
          {etichettaTipoIstituzione(istituzione.tipo)}
        </p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          {istituzione.nome}
        </h1>
        {istituzione.provincia && <p className="mt-1 text-sm text-kireo-muted">Provincia di {istituzione.provincia}</p>}
        {istituzione.descrizione && <p className="mt-4 max-w-2xl text-lg text-kireo-muted">{istituzione.descrizione}</p>}
        {/* Le aree che l'ente dichiara (approvate da KIREO): è la risposta
            breve a «mi interessano?», prima della prova che sono gli eventi. */}
        {areeDichiarate.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Aree di competenza">
            {areeDichiarate.map((nome) => (
              <li key={nome} className="rounded-full border border-white/10 px-3 py-1 text-xs text-kireo-light/90">
                {nome}
              </li>
            ))}
          </ul>
        )}
        {istituzione.sito_ufficiale && (
          <a
            href={istituzione.sito_ufficiale}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-medium text-kireo-orange underline underline-offset-2"
          >
            Sito ufficiale ↗
          </a>
        )}

        {/* I TRE GESTI UNO ACCANTO ALL'ALTRO (Mario, 28/10): seguire, la
            newsletter e il profilo condiviso sono tre modi di stare in
            contatto con lo stesso ente, e stavano in due punti diversi della
            pagina. Il messaggio è un'altra cosa (una conversazione), e sta
            sotto. */}
        <div className="mt-6 flex flex-wrap items-start gap-x-6 gap-y-4">
          <SeguiButton istituzioneId={istituzione.id} userId={user?.id ?? null} seguitoIniziale={seguito} didascalia={DIDASCALIA_SEGUI} />
          {contatto !== "non_studente" || iscrittoNewsletter || !user ? (
            <IscrivitiNewsletterButton istituzioneId={istituzione.id} userId={user?.id ?? null} iscrittoIniziale={iscrittoNewsletter} eta={eta} didascalia={DIDASCALIA_NEWSLETTER} />
          ) : null}
          <ManifestazioneInteresseButton
            istituzioneId={istituzione.id}
            userId={user?.id ?? null}
            contatto={contatto}
            manifestazioneAttivaId={manifestazioneAttivaId}
            didascalia={DIDASCALIA_CONDIVIDI}
            copreAttivita={condivisioneCopreAttivita}
          />
        </div>
        {/* Le ragioni dei gesti che mancano stanno SOTTO la fila, mai al posto
            di un bottone (Mario, 28/10): da minorenne la frase della newsletter
            spezzava la riga e mandava «3 follower» in mezzo ai bottoni. */}
        {user && contatto === "manca_data" ? (
          <p className="mt-3 max-w-xl text-sm text-kireo-muted">
            {TESTO_MANCA_DATA_CONTATTO}{" "}
            <Link href={HREF_AGGIUNGI_DATA} className="text-kireo-orange underline underline-offset-2">
              {TESTO_AGGIUNGI_DATA}
            </Link>
          </p>
        ) : user && contatto === "si" && eta === "minorenne" && !iscrittoNewsletter ? (
          <p className="mt-3 max-w-xl text-sm text-kireo-muted">{TESTO_NEWSLETTER_SOLO_MAGGIORENNI}</p>
        ) : null}
        <p className="mt-3 text-sm text-kireo-muted">
          <strong className="text-kireo-light">{conteggioFollower}</strong> {conteggioFollower === 1 ? "follower" : "follower"}
        </p>

        <div className="mt-6">
          <MessaggioEnteButton
            istituzioneId={istituzione.id}
            userId={user?.id ?? null}
            contatto={contatto}
            conversazioneEsistenteId={conversazioneEsistenteId}
          />
        </div>
      </section>

      {/* L'ORDINE DELLA PAGINA (Mario, 27/10): chi è, cosa offre adesso, la
          guida, e in fondo l'archivio. Lo studente arriva qui per una domanda
          sola, «chi sono questi, e mi interessano?»: gli eventi sono la prova,
          non la risposta, e un archivio prima della guida la seppellisce. */}
      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          {/* DUE SEZIONI E NON UNA (Mario, 26/10). «Nessun evento in programma»
              misura SOLO gli eventi non finiti: con un archivio pieno e niente
              in programma, la frase deve comparire lo stesso — prima la lista
              era una sola, e un evento di due mesi fa la faceva tacere. */}
          <h2 className="py-0.5 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">Eventi in programma</h2>
          {eventiInProgramma.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
              Nessun evento in programma al momento.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {eventiInProgramma.map((evento) => (
                <CardEvento
                  key={evento.id}
                  evento={evento}
                  areeSlugs={areeEventi[evento.id] ?? []}
                  userId={user?.id ?? null}
                  iscritto={iscrizioniEventi.has(evento.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {guidaPrincipale && (
        <section id="guida" className="mx-auto max-w-2xl px-6 py-20">
          <div className="text-center">
            <h2 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">
              Scarica la guida di {istituzione.nome}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-kireo-muted">{guidaPrincipale.titolo}</p>
          </div>
          <div className="mt-10">
            <GuidaEnteForm guidaId={guidaPrincipale.id} emailAccount={user ? (user.email ?? "") : null} esito={esitoGuida} />
          </div>
        </section>
      )}

      {/* L'ARCHIVIO, IN FONDO E SENZA L'ETICHETTA DELLE ORE: le ore di un
          evento passato possono essere state corrette dopo la chiusura, e le
          ore di chi c'era sono quelle certificate allora — due numeri per la
          stessa cosa, e lo studente crederebbe alla card. */}
      {eventiPassati.length > 0 && (
        <section className="border-t border-white/5 bg-kireo-card/40">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="py-0.5 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">Eventi passati</h2>
            <ul className="mt-4 space-y-4">
              {eventiPassati.map((evento) => (
                <CardEvento
                  key={evento.id}
                  evento={evento}
                  areeSlugs={areeEventi[evento.id] ?? []}
                  userId={user?.id ?? null}
                  iscritto={iscrizioniEventi.has(evento.id)}
                  mostraOre={false}
                />
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
