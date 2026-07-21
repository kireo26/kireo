import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import CreaClasseForm from "@/components/scuola/CreaClasseForm";
import GestioneClasseStudenti from "@/components/scuola/GestioneClasseStudenti";

export default async function ScuolaClassiPage() {
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  const [{ data: classi, error: erroreClassi }, { data: verificati, error: erroreVerificati }, { data: classiStudenti, error: erroreClassiStudenti }] =
    await Promise.all([
      supabase
        .from("classi")
        .select("id, anno, sezione, nome_visualizzato")
        .eq("scuola_profilo_id", contesto.scuolaProfiloId)
        .order("anno", { ascending: true })
        .order("sezione", { ascending: true }),
      supabase
        .from("student_profiles")
        .select("user_id, profiles!user_id(nome, cognome)")
        .eq("school_code", contesto.scuolaId)
        .eq("stato_verifica", "verificato"),
      supabase.from("classi_studenti").select("classe_id, student_id"),
    ]);

  if (erroreClassi) console.error("[/scuola/classi] errore query classi:", erroreClassi);
  if (erroreVerificati) console.error("[/scuola/classi] errore query verificati:", erroreVerificati);
  if (erroreClassiStudenti) console.error("[/scuola/classi] errore query classiStudenti:", erroreClassiStudenti);

  const studentiVerificati = (verificati ?? []).map((s) => {
    const profilo = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    return { userId: s.user_id, nome: profilo?.nome ?? "", cognome: profilo?.cognome ?? "" };
  });

  const membriPerClasse = new Map<string, Set<string>>();
  for (const riga of classiStudenti ?? []) {
    const set = membriPerClasse.get(riga.classe_id) ?? new Set<string>();
    set.add(riga.student_id);
    membriPerClasse.set(riga.classe_id, set);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Classi</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Le tue classi</h1>
        <p className="mt-2 text-kireo-muted">Solo studenti verificati della tua scuola possono entrare in una classe.</p>
      </div>

      <CreaClasseForm scuolaProfiloId={contesto.scuolaProfiloId} />

      {!classi || classi.length === 0 ? (
        <p className="text-sm text-kireo-muted">Non hai ancora creato nessuna classe.</p>
      ) : (
        <ul className="space-y-4">
          {classi.map((c) => {
            const membriIds = membriPerClasse.get(c.id) ?? new Set<string>();
            const membri = studentiVerificati.filter((s) => membriIds.has(s.userId));
            const disponibili = studentiVerificati.filter((s) => !membriIds.has(s.userId));
            return (
              <li key={c.id} className="rounded-2xl border border-white/5 bg-kireo-card p-5">
                <p className="font-heading text-lg font-semibold text-kireo-light">{c.nome_visualizzato ?? `${c.anno}ª${c.sezione}`}</p>
                <p className="text-xs text-kireo-muted">{membri.length} studenti</p>
                <GestioneClasseStudenti classeId={c.id} membri={membri} disponibili={disponibili} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
