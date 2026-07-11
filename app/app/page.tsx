import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";

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

  const { data: profilo } = await supabase.from("profiles").select("nome, ruolo").eq("id", user.id).maybeSingle();

  if (!profilo) {
    // Nessun profilo ancora: probabilmente l'email non è stata confermata
    // (la creazione del profilo avviene in /auth/confirm).
    redirect("/accedi?errore=profilo_non_trovato");
  }

  const tabellaRuolo = profilo.ruolo === "studente" ? "student_profiles" : "teacher_profiles";
  const { data: datiRuolo } = await supabase.from(tabellaRuolo).select("school_code").eq("user_id", user.id).maybeSingle();

  let denominazioneScuola: string | null = null;
  if (datiRuolo?.school_code) {
    const { data: scuola } = await supabase
      .from("schools")
      .select("denominazione")
      .eq("codice_meccanografico", datiRuolo.school_code)
      .maybeSingle();
    denominazioneScuola = scuola?.denominazione ?? null;
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-20 sm:pt-28">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Area personale</p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">Ciao {profilo.nome}</h1>
      {denominazioneScuola && <p className="mt-3 text-lg text-kireo-muted">{denominazioneScuola}</p>}
      <p className="mt-6 text-lg text-kireo-light">Il tuo percorso di orientamento sta per iniziare.</p>

      <div className="mt-10">
        <LogoutButton />
      </div>
    </section>
  );
}
