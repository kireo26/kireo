import { getDocenteContext } from "@/lib/docente/context";
import { createClient } from "@/lib/supabase/server";
import NewsletterToggle from "@/components/docente/NewsletterToggle";

export default async function DocenteProfiloPage() {
  const contesto = await getDocenteContext();
  const supabase = await createClient();

  const [{ data: userData }, { data: newsletter }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("newsletter_docenti").select("user_id").eq("user_id", contesto.userId).maybeSingle(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Profilo</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          {contesto.nome} {contesto.cognome}
        </h1>
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Email</p>
          <p className="mt-1 text-kireo-light">{userData.user?.email ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Materia</p>
          <p className="mt-1 text-kireo-light">{contesto.materia ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Scuola</p>
          <p className="mt-1 text-kireo-light">{contesto.schoolName ?? "—"}</p>
        </div>
      </div>

      <NewsletterToggle userId={contesto.userId} iscrittoIniziale={Boolean(newsletter)} />
    </div>
  );
}
