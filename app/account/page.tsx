import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HREF_LA_MIA_AREA } from "@/lib/ruoli/casa";
import { descriviErrore } from "@/lib/erroreSupabase";
import { ETICHETTA_RUOLO_ACCOUNT, leggiStatoCancellazione, TESTI_ACCOUNT } from "@/lib/account/cancellazione";
import CambiaPassword from "@/components/account/CambiaPassword";
import CancellaAccount from "@/components/account/CancellaAccount";
import ScaricaIMieiDati from "@/components/account/ScaricaIMieiDati";

// La pagina dell'account di una persona (02/11), una sola per tutti i ruoli:
// i dati, la password, «Scarica i miei dati», la cancellazione. Prima non
// esisteva per nessuno tranne lo studente, e neanche lui cambiava la password
// da dentro. *Due aree che risolvono la stessa cosa in due modi* è come è nato
// il disordine dell'admin (Mario): per questo è una pagina fuori dalle aree, e
// ogni area ci porta.
export const dynamic = "force-dynamic";

export default async function PaginaAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/accedi?redirectedFrom=/account");

  const [{ data: profilo, error: erroreProfilo }, { data: datiStato, error: erroreStato }] = await Promise.all([
    supabase.from("profiles").select("ruolo, nome, cognome").eq("id", user.id).maybeSingle(),
    supabase.rpc("stato_cancellazione_mio_account"),
  ]);
  if (erroreProfilo) console.error("account: profilo non letto", descriviErrore(erroreProfilo));
  if (erroreStato) console.error("account: stato della cancellazione non letto", descriviErrore(erroreStato));
  const stato = erroreStato ? null : leggiStatoCancellazione(datiStato);
  const ruolo = profilo?.ruolo ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 sm:pt-28">
      <Link href={HREF_LA_MIA_AREA} className="text-sm text-kireo-orange underline underline-offset-2">
        ← La mia area
      </Link>
      <h1 className="mt-4 py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Il mio account</h1>

      <div className="mt-8 space-y-4">
        <section className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">I tuoi dati</h2>
          {profilo ? (
            <dl className="mt-3 space-y-1 text-sm">
              <div>
                <dt className="inline text-kireo-muted">Nome: </dt>
                <dd className="inline text-kireo-light">
                  {profilo.nome} {profilo.cognome}
                </dd>
              </div>
              <div>
                <dt className="inline text-kireo-muted">Email: </dt>
                <dd className="inline text-kireo-light">{user.email}</dd>
              </div>
              <div>
                <dt className="inline text-kireo-muted">Ruolo: </dt>
                <dd className="inline text-kireo-light">{ETICHETTA_RUOLO_ACCOUNT[profilo.ruolo] ?? profilo.ruolo}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1 text-sm text-kireo-muted">Non siamo riusciti a leggere i tuoi dati: ricarica la pagina.</p>
          )}
          {ruolo === "studente" ? (
            <p className="mt-3 text-sm text-kireo-muted">
              Scuola, classe, telefono e aree di interesse si cambiano dal{" "}
              <Link href="/app/profilo" className="text-kireo-orange underline underline-offset-2">
                tuo profilo
              </Link>
              .
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <h2 className="mb-4 py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">La password</h2>
          {user.email ? <CambiaPassword email={user.email} /> : null}
        </section>

        <section className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">I tuoi dati in un file</h2>
          {ruolo === "studente" ? (
            <>
              <p className="mb-4 mt-1 text-sm text-kireo-muted">Scarica una copia dei tuoi dati salvati su KIREO, in formato JSON.</p>
              <ScaricaIMieiDati userId={user.id} />
            </>
          ) : (
            <p className="mt-1 text-sm text-kireo-muted">{TESTI_ACCOUNT.esportaNonDisponibile}</p>
          )}
        </section>

        <CancellaAccount stato={stato} email={user.email ?? ""} />
      </div>
    </div>
  );
}
