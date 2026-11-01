import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import { emailVerificato, leggiStudentiDellaScuola, soloVerificati } from "@/lib/scuola/studenti";
import CreaClasseForm from "@/components/scuola/CreaClasseForm";
import GestioneClasseStudenti from "@/components/scuola/GestioneClasseStudenti";

export default async function ScuolaClassiPage() {
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  const [{ data: classi, error: erroreClassi }, studenti, { data: classiStudenti, error: erroreClassiStudenti }] =
    await Promise.all([
      supabase
        .from("classi")
        .select("id, anno, sezione, nome_visualizzato")
        .eq("scuola_profilo_id", contesto.scuolaProfiloId)
        .order("anno", { ascending: true })
        .order("sezione", { ascending: true }),
      leggiStudentiDellaScuola(supabase),
      supabase.from("classi_studenti").select("classe_id, student_id"),
    ]);

  if (erroreClassi) console.error("[/scuola/classi] errore query classi:", erroreClassi);
  if (erroreClassiStudenti) console.error("[/scuola/classi] errore query classiStudenti:", erroreClassiStudenti);

  const studentiVerificati = soloVerificati(studenti ?? []).map((s) => ({
    userId: s.userId,
    nome: s.nome ?? "",
    cognome: s.cognome ?? "",
    email: emailVerificato(s),
  }));

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

      {contesto.puoGestireClassi ? (
        <CreaClasseForm scuolaProfiloId={contesto.scuolaProfiloId} />
      ) : (
        <p className="text-sm text-kireo-muted">
          Puoi vedere le classi della tua scuola, ma non hai il permesso di crearne o modificarne: chiedi al referente di attivarlo da
          Staff.
        </p>
      )}

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
                <GestioneClasseStudenti classeId={c.id} membri={membri} disponibili={disponibili} puoGestire={contesto.puoGestireClassi} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
