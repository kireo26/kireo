import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { descriviErrore } from "@/lib/erroreSupabase";
import { statoEta, type StatoEta } from "@/lib/eta";
import ComunicazioniStudente, { type IscrizioneNewsletter } from "@/components/app/ComunicazioniStudente";
import { mostraLeScelte, type ConsensoKireo } from "@/lib/app/comunicazioniKireo";

// Pagina di gestione delle comunicazioni FACOLTATIVE, destinazione del link
// di disiscrizione nel footer di tutti i template email
// (lib/email/templates.ts).
//
// Dal 28/10 (20261107100000) la pagina LEGGE il consenso vero: la casella
// della registrazione è il consenso alle comunicazioni di KIREO, e uno
// studente collegato lo vede e lo cambia qui, insieme alle newsletter degli
// enti a cui è iscritto. Prima la pagina diceva, onestamente, che non c'era
// niente da revocare — e la casella finiva in un metadato che nessuno leggeva.
//
// Chi non ha fatto l'accesso legge come funziona e il link per entrare: un
// consenso non si cambia senza sapere di chi è.
//
// noindex: pagina di utilità raggiunta solo dal link nelle email, non
// pensata per la ricerca (stesso trattamento delle landing del funnel).
export const metadata: Metadata = {
  title: "Disiscrizione — KIREO",
  description: "Gestisci le comunicazioni facoltative che ricevi da KIREO.",
  robots: { index: false, follow: false },
};

export default async function Disiscrizione() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Le scelte le vede chi ha qualcosa da revocare, non chi è studente oggi
  // (mostraLeScelte): il ruolo cambia, il consenso dato resta.
  let studente: { consenso: ConsensoKireo | undefined; eta: StatoEta; iscrizioni: IscrizioneNewsletter[] | undefined } | null = null;
  if (user) {
    const { data: profilo, error } = await supabase
      .from("profiles")
      .select("ruolo, data_nascita, comunicazioni_kireo")
      .eq("id", user.id)
      .maybeSingle();
    if (error) console.error("Disiscrizione, profilo:", descriviErrore(error));
    const iscr = await supabase
      .from("newsletter_iscrizioni")
      .select("id, created_at, istituzioni(nome, slug)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });
    if (iscr.error) console.error("Disiscrizione, iscrizioni:", descriviErrore(iscr.error));
    const consenso: ConsensoKireo | undefined = error ? undefined : ((profilo?.comunicazioni_kireo as boolean | null | undefined) ?? null);
    if (mostraLeScelte({ ruolo: profilo?.ruolo, consenso, iscrizioni: iscr.error ? undefined : (iscr.data ?? []).length })) {
      studente = {
        consenso,
        eta: statoEta(profilo?.data_nascita ?? null),
        iscrizioni: iscr.error
          ? undefined
          : (iscr.data ?? []).map((r) => {
              const ist = Array.isArray(r.istituzioni) ? r.istituzioni[0] : r.istituzioni;
              return { id: r.id, istituzioneNome: ist?.nome ?? "Istituzione", istituzioneSlug: ist?.slug ?? "", creataIl: r.created_at };
            }),
      };
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
        Comunicazioni
      </p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">
        Disiscrizione dalle comunicazioni facoltative
      </h1>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-kireo-muted">
        <div>
          <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
            Due tipi di email
          </h2>
          <p className="mt-3">
            KIREO distingue due categorie di email. Le <strong className="text-kireo-light">email di servizio</strong>{" "}
            sono quelle che hai richiesto tu o che seguono direttamente a una tua azione: la conferma di una richiesta di
            contatto, il link a una guida che hai scaricato, la conferma della registrazione o il reimposta password. Non
            puoi disiscriverti da queste, perché servono a completare qualcosa che hai avviato.
          </p>
          <p className="mt-3">
            Le <strong className="text-kireo-light">comunicazioni facoltative</strong> — promemoria, aggiornamenti sul tuo
            percorso, suggerimenti, newsletter — sono un&apos;altra cosa: le ricevi solo se hai dato il consenso, e da
            queste puoi sempre disiscriverti.
          </p>
        </div>

        <div>
          <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
            Le tue scelte
          </h2>
          <p className="mt-3">
            Oggi KIREO non manda ancora comunicazioni facoltative. Il consenso che dai serve per le comunicazioni di KIREO;
            le newsletter degli enti sono a parte, e ognuna ha la sua uscita.
          </p>
          {studente ? (
            <div className="mt-6">
              <ComunicazioniStudente
                consensoIniziale={studente.consenso}
                eta={studente.eta}
                iscrizioniIniziali={studente.iscrizioni}
                origine="disiscrizione"
              />
            </div>
          ) : user ? (
            <p className="mt-3">Il tuo account non riceve comunicazioni facoltative da KIREO.</p>
          ) : (
            <p className="mt-3">
              Per vedere e cambiare le tue scelte,{" "}
              <Link href="/accedi?redirectedFrom=%2Fdisiscrizione" className="text-kireo-orange underline underline-offset-2">
                accedi
              </Link>
              : le trovi qui e nel tuo profilo.
            </p>
          )}
        </div>

        <div>
          <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
            Hai bisogno subito?
          </h2>
          <p className="mt-3">
            Se vuoi comunque segnalarci qualcosa sulle email che ricevi, scrivici dalla{" "}
            <Link href="/contatti" className="text-kireo-orange underline underline-offset-2">
              pagina Contatti
            </Link>
            : ce ne occupiamo noi. Per capire come trattiamo i tuoi dati, consulta l&apos;{" "}
            <Link href="/privacy" className="text-kireo-orange underline underline-offset-2">
              informativa sulla privacy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
