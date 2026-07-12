import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import { finalizzaRegistrazioneSeNecessario } from "@/lib/finalizzaRegistrazione";
import { getAreaBySlug } from "@/data/aree";

// Pagina minima post-login: il middleware garantisce già una sessione
// attiva per tutto ciò che sta sotto /app. Qui recuperiamo solo nome e
// scuola per il saluto.
export default async function AreaPersonale() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: profiloEsistente } = await supabase.from("profiles").select("nome, ruolo").eq("id", user.id).maybeSingle();

  let nome: string;
  let ruolo: string;
  let schoolCodeDaMetadata: string | null = null;

  if (profiloEsistente) {
    nome = profiloEsistente.nome;
    ruolo = profiloEsistente.ruolo;
  } else {
    // Nessun profilo ancora: la conferma email può non aver completato la
    // finalizzazione (es. link consumato da uno scanner prima del click
    // dell'utente). Auto-riparazione: finalizziamo ora, dalla sessione
    // autenticata, usando i metadata salvati al momento del signup.
    const esito = await finalizzaRegistrazioneSeNecessario(supabase, user);

    if (!esito.ok) {
      redirect(`/accedi?errore=${esito.motivo}`);
    }

    // Non rileggiamo subito da `profiles`/`student_profiles`: l'API REST
    // può impiegare qualche istante a riflettere una scrittura appena
    // fatta (osservato in test — non un problema di concorrenza, la riga
    // è già committata, solo non ancora visibile in lettura). Usiamo
    // direttamente i metadata già validati per questo render; scuola e
    // dati resteranno comunque coerenti dal prossimo caricamento.
    const meta = user.user_metadata as Record<string, unknown>;
    nome = meta.nome as string;
    ruolo = meta.ruolo as string;
    schoolCodeDaMetadata = typeof meta.school_code === "string" ? meta.school_code : null;
  }

  const tabellaRuolo = ruolo === "studente" ? "student_profiles" : "teacher_profiles";
  const { data: datiRuolo } = await supabase.from(tabellaRuolo).select("school_code").eq("user_id", user.id).maybeSingle();
  const schoolCode = datiRuolo?.school_code ?? schoolCodeDaMetadata;

  let denominazioneScuola: string | null = null;
  if (schoolCode) {
    const { data: scuola } = await supabase
      .from("schools")
      .select("denominazione")
      .eq("codice_meccanografico", schoolCode)
      .maybeSingle();
    denominazioneScuola = scuola?.denominazione ?? null;
  }

  let areeInteresse: { slug: string; nome: string; icona: string }[] = [];
  if (ruolo === "studente") {
    const { data: righeAree } = await supabase.from("student_area_interests").select("area_slug").eq("user_id", user.id);
    areeInteresse = (righeAree ?? [])
      .map((r) => getAreaBySlug(r.area_slug))
      .filter((area): area is NonNullable<typeof area> => Boolean(area))
      .map((area) => ({ slug: area.slug, nome: area.nome, icona: area.icona }));
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-20 sm:pt-28">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Area personale</p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">Ciao {nome}</h1>
      {denominazioneScuola && <p className="mt-3 text-lg text-kireo-muted">{denominazioneScuola}</p>}
      <p className="mt-6 text-lg text-kireo-light">Il tuo percorso di orientamento sta per iniziare.</p>

      {ruolo === "studente" && (
        <div className="mt-10 rounded-2xl border border-white/5 bg-kireo-card p-6">
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Le mie aree</h2>
          {areeInteresse.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-3">
              {areeInteresse.map((area) => (
                <li key={area.slug}>
                  <Link
                    href={`/aree/${area.slug}`}
                    className="flex items-center gap-2 rounded-full border border-white/10 py-1.5 pl-1.5 pr-4 text-sm text-kireo-light transition-colors hover:border-kireo-green"
                  >
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-xs font-bold text-kireo-orange">
                      {area.icona}
                    </span>
                    {area.nome}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-kireo-muted">
              Non hai ancora scelto le aree che ti incuriosiscono.{" "}
              <Link href="/per-gli-studenti" className="text-kireo-orange underline underline-offset-2">
                Scoprile qui
              </Link>
              .
            </p>
          )}
        </div>
      )}

      <div className="mt-10">
        <LogoutButton />
      </div>
    </section>
  );
}
