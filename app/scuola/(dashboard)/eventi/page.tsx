import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import { getEventiConIscrizioniScuola, getRegistroPresenze } from "@/lib/scuola/eventi";
import IscriviClasseEventoForm from "@/components/scuola/IscriviClasseEventoForm";
import IscriviTuttiVerificatiButton from "@/components/scuola/IscriviTuttiVerificatiButton";
import RegistroPresenzeEvento from "@/components/scuola/RegistroPresenzeEvento";

export default async function ScuolaEventiPage() {
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  const [{ data: prossimi, error: erroreProssimi }, { data: classi, error: erroreClassi }, { data: verificati, error: erroreVerificati }, eventiConIscrizioni] =
    await Promise.all([
      supabase.from("eventi").select("id, titolo, tipo, data_inizio, ore_pcto").eq("stato", "approvato").gte("data_inizio", new Date().toISOString()).order("data_inizio", { ascending: true }),
      supabase.from("classi").select("id, nome_visualizzato").eq("scuola_profilo_id", contesto.scuolaProfiloId).order("anno", { ascending: true }),
      supabase.from("student_profiles").select("user_id").eq("school_code", contesto.scuolaId).eq("stato_verifica", "verificato"),
      getEventiConIscrizioniScuola(supabase, contesto.scuolaProfiloId, contesto.scuolaId),
    ]);

  if (erroreProssimi) console.error("[/scuola/eventi] errore query prossimi:", erroreProssimi);
  if (erroreClassi) console.error("[/scuola/eventi] errore query classi:", erroreClassi);
  if (erroreVerificati) console.error("[/scuola/eventi] errore query verificati:", erroreVerificati);

  const classiOpzioni = (classi ?? []).map((c) => ({ id: c.id, nomeVisualizzato: c.nome_visualizzato ?? "Classe" }));
  const idVerificati = (verificati ?? []).map((s) => s.user_id);

  const eventiPassati = eventiConIscrizioni.filter((e) => new Date(e.data_inizio) < new Date());
  const registri = await Promise.all(
    eventiPassati.map(async (e) => ({
      evento: e,
      righe: await getRegistroPresenze(supabase, e.id, contesto.scuolaProfiloId, contesto.scuolaId),
    })),
  );

  return (
    <div className="space-y-10">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Eventi</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Eventi e presenze</h1>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Prossimi eventi</h2>
        {!prossimi || prossimi.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessun evento approvato al momento.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {prossimi.map((e) => (
              <li key={e.id} className="rounded-2xl border border-white/5 bg-kireo-card p-5">
                <p className="font-heading text-sm font-semibold text-kireo-light">{e.titolo}</p>
                <p className="mt-1 text-xs text-kireo-muted">
                  {new Date(e.data_inizio).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })}
                  {e.ore_pcto > 0 && ` · ${e.ore_pcto}h PCTO`}
                </p>
                <IscriviClasseEventoForm eventoId={e.id} classi={classiOpzioni} />
                <IscriviTuttiVerificatiButton eventoId={e.id} studentIds={idVerificati} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Registro presenze</h2>
        <p className="mt-1 text-sm text-kireo-muted">Eventi passati con iscrizioni della tua scuola: certifica chi ha partecipato davvero.</p>
        {registri.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessun evento passato con iscrizioni della tua scuola.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {registri.map(({ evento, righe }) => (
              <li key={evento.id} className="rounded-2xl border border-white/5 bg-kireo-card p-5">
                <p className="font-heading text-sm font-semibold text-kireo-light">{evento.titolo}</p>
                <p className="mt-1 text-xs text-kireo-muted">
                  {new Date(evento.data_inizio).toLocaleDateString("it-IT", { dateStyle: "long" })}
                </p>
                <RegistroPresenzeEvento eventoId={evento.id} righe={righe} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
