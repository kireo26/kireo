import Link from "next/link";
import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";

export default async function ScuolaHomePage() {
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  const [
    { count: daVerificare, error: erroreDaVerificare },
    { count: verificati, error: erroreVerificati },
    { data: prossimiEventi, error: erroreProssimiEventi },
  ] = await Promise.all([
    supabase
      .from("student_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("school_code", contesto.scuolaId)
      .eq("stato_verifica", "dichiarato"),
    supabase
      .from("student_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("school_code", contesto.scuolaId)
      .eq("stato_verifica", "verificato"),
    supabase
      .from("iscrizioni_classe_eventi")
      .select("evento_id, eventi(titolo, data_inizio), classi!inner(nome_visualizzato, scuola_profilo_id)")
      .eq("classi.scuola_profilo_id", contesto.scuolaProfiloId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (erroreDaVerificare) console.error("[/scuola] errore count daVerificare:", erroreDaVerificare);
  if (erroreVerificati) console.error("[/scuola] errore count verificati:", erroreVerificati);
  if (erroreProssimiEventi) console.error("[/scuola] errore query prossimiEventi:", erroreProssimiEventi);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">La tua scuola</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">{contesto.nomeScuola}</h1>
        <p className="mt-2 text-kireo-muted">
          Ciao {contesto.nome} — {contesto.ruoloStaff === "referente" ? "referente" : "tutor"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contesto.puoVerificareStudenti ? (
          <Link href="/scuola/studenti" className="rounded-2xl border border-white/5 bg-kireo-card p-5 transition-colors hover:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Da verificare</p>
            <p className="mt-1 font-heading text-3xl font-bold text-kireo-orange">{daVerificare ?? 0}</p>
          </Link>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Da verificare</p>
            <p className="mt-1 font-heading text-3xl font-bold text-kireo-muted">{daVerificare ?? 0}</p>
          </div>
        )}
        <Link href="/scuola/studenti" className="rounded-2xl border border-white/5 bg-kireo-card p-5 transition-colors hover:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Studenti verificati</p>
          <p className="mt-1 font-heading text-3xl font-bold text-kireo-light">{verificati ?? 0}</p>
        </Link>
        <Link href="/scuola/eventi" className="rounded-2xl border border-white/5 bg-kireo-card p-5 transition-colors hover:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Eventi con iscrizioni</p>
          <p className="mt-1 font-heading text-3xl font-bold text-kireo-light">{prossimiEventi?.length ?? 0}</p>
        </Link>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Prossime iscrizioni</h2>
        {!prossimiEventi || prossimiEventi.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessuna classe iscritta a un evento per ora.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {prossimiEventi.map((riga, i) => {
              const evento = Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi;
              const classe = Array.isArray(riga.classi) ? riga.classi[0] : riga.classi;
              return (
                <li key={i} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">{evento?.titolo ?? "Evento"}</p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {classe?.nome_visualizzato ?? "Classe"} ·{" "}
                    {evento?.data_inizio ? new Date(evento.data_inizio).toLocaleDateString("it-IT", { dateStyle: "long" }) : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
