import { getScuolaContext, richiedeReferente } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import GestioneStudentiDichiarati from "@/components/scuola/GestioneStudentiDichiarati";

export default async function ScuolaStudentiPage() {
  const contesto = await getScuolaContext();
  richiedeReferente(contesto);
  const supabase = await createClient();

  const [{ data: dichiarati, error: erroreDichiarati }, { data: verificati, error: erroreVerificati }, { data: classiStudenti, error: erroreClassiStudenti }] =
    await Promise.all([
      supabase
        .from("student_profiles")
        .select("user_id, classe, profiles!user_id(nome, cognome)")
        .eq("school_code", contesto.scuolaId)
        .eq("stato_verifica", "dichiarato"),
      supabase
        .from("student_profiles")
        .select("user_id, classe, profiles!user_id(nome, cognome)")
        .eq("school_code", contesto.scuolaId)
        .eq("stato_verifica", "verificato")
        .order("classe", { ascending: true }),
      supabase.from("classi_studenti").select("student_id, classi(nome_visualizzato)"),
    ]);

  if (erroreDichiarati) console.error("[/scuola/studenti] errore query dichiarati:", erroreDichiarati);
  if (erroreVerificati) console.error("[/scuola/studenti] errore query verificati:", erroreVerificati);
  if (erroreClassiStudenti) console.error("[/scuola/studenti] errore query classiStudenti:", erroreClassiStudenti);

  const classePerStudente = new Map<string, string>();
  for (const riga of classiStudenti ?? []) {
    const classe = Array.isArray(riga.classi) ? riga.classi[0] : riga.classi;
    if (classe?.nome_visualizzato) classePerStudente.set(riga.student_id, classe.nome_visualizzato);
  }

  const studentiDichiarati = (dichiarati ?? []).map((s) => {
    const profilo = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    return { userId: s.user_id, nome: profilo?.nome ?? "", cognome: profilo?.cognome ?? "", classe: s.classe };
  });

  return (
    <div className="space-y-10">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Studenti</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Verifica studenti</h1>
        <p className="mt-2 text-kireo-muted">
          Conferma che uno studente autodichiarato appartiene davvero alla tua scuola. La verifica è definitiva: uno studente
          verificato non può cambiare scuola da solo, e non può essere sganciato da qui.
        </p>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">In attesa di verifica</h2>
        <div className="mt-4">
          <GestioneStudentiDichiarati studenti={studentiDichiarati} />
        </div>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Studenti verificati</h2>
        {!verificati || verificati.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessuno studente verificato ancora.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {verificati.map((s) => {
              const profilo = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
              return (
                <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4">
                  <span className="font-heading text-sm font-semibold text-kireo-light">
                    {profilo?.nome} {profilo?.cognome}
                  </span>
                  <span className="text-xs text-kireo-muted">
                    {classePerStudente.get(s.user_id) ?? "Nessuna classe assegnata"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
