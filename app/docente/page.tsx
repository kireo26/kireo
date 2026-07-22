import Link from "next/link";
import { getDocenteContext } from "@/lib/docente/context";
import { getProssimiWebinar, getIscrizioniDocente } from "@/lib/docente/eventi";
import { getAttestatiDocente } from "@/lib/docente/attestati";
import { createClient } from "@/lib/supabase/server";
import { getFiloneBySlug } from "@/data/filoniDocenti";
import CardWebinarDocente from "@/components/docente/CardWebinarDocente";

export default async function DocenteHomePage() {
  const contesto = await getDocenteContext();
  const supabase = await createClient();

  const [prossimiWebinar, iscrizioni, attestati, { data: newsletter }] = await Promise.all([
    getProssimiWebinar(supabase, 3),
    getIscrizioniDocente(supabase, contesto.userId),
    getAttestatiDocente(supabase, contesto.userId),
    supabase.from("newsletter_docenti").select("user_id").eq("user_id", contesto.userId).maybeSingle(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">La tua area</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          Ciao {contesto.nome}
        </h1>
        <p className="mt-2 text-kireo-muted">
          {contesto.materia ?? "Docente"}
          {contesto.schoolName ? ` · ${contesto.schoolName}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">I miei attestati</p>
          <p className="mt-1 font-heading text-2xl font-bold text-kireo-light">{attestati.length}</p>
          <Link href="/docente/attestati" className="mt-2 inline-block text-xs text-kireo-orange underline underline-offset-2">
            Vedi tutti →
          </Link>
        </div>
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Newsletter</p>
          <p className="mt-1 font-heading text-lg font-semibold text-kireo-light">{newsletter ? "Iscritto" : "Non iscritto"}</p>
          <Link href="/docente/profilo" className="mt-2 inline-block text-xs text-kireo-orange underline underline-offset-2">
            Gestisci →
          </Link>
        </div>
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Prossimi webinar</p>
          <p className="mt-1 font-heading text-2xl font-bold text-kireo-light">{prossimiWebinar.length}</p>
          <Link href="/docente/webinar" className="mt-2 inline-block text-xs text-kireo-orange underline underline-offset-2">
            Vedi tutti →
          </Link>
        </div>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Prossimi webinar per te</h2>
        {prossimiWebinar.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Il calendario si sta riempiendo: torna a trovarci a breve.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {prossimiWebinar.map((w) => (
              <CardWebinarDocente key={w.id} webinar={w} userId={contesto.userId} stato={iscrizioni[w.id]} />
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">I cinque filoni</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "ai_didattica",
            "valutazione_ai",
            "etica_normativa",
            "ai_burocrazia",
            "orientamento_pcto",
          ].map((slug) => {
            const filone = getFiloneBySlug(slug);
            return filone ? (
              <span key={slug} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-kireo-light/90">
                {filone.nome}
              </span>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
