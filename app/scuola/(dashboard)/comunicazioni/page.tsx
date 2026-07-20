import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import InviaMessaggioScuolaForm from "@/components/scuola/InviaMessaggioScuolaForm";

const ETICHETTA_DESTINATARI: Record<string, string> = {
  tutta_scuola: "Tutta la scuola",
  classe: "Una classe",
  selezione: "Selezione di studenti",
};

export default async function ScuolaComunicazioniPage() {
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  const [{ data: inviati }, { data: classi }, { data: verificati }] = await Promise.all([
    supabase
      .from("messaggi_scuola")
      .select("id, oggetto, destinatari, created_at")
      .eq("scuola_profilo_id", contesto.scuolaProfiloId)
      .order("created_at", { ascending: false }),
    supabase.from("classi").select("id, nome_visualizzato").eq("scuola_profilo_id", contesto.scuolaProfiloId).order("anno", { ascending: true }),
    supabase.from("student_profiles").select("user_id, profiles(nome, cognome)").eq("school_code", contesto.scuolaId).eq("stato_verifica", "verificato"),
  ]);

  const classiOpzioni = (classi ?? []).map((c) => ({ id: c.id, nomeVisualizzato: c.nome_visualizzato ?? "Classe" }));
  const studentiOpzioni = (verificati ?? []).map((s) => {
    const profilo = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    return { userId: s.user_id, nome: profilo?.nome ?? "", cognome: profilo?.cognome ?? "" };
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Comunicazioni</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Messaggi agli studenti</h1>
        <p className="mt-2 text-kireo-muted">Rapporto interno alla scuola: nessuna revisione KIREO prima dell&apos;invio.</p>
      </div>

      {contesto.ruoloStaff === "referente" && <InviaMessaggioScuolaForm classi={classiOpzioni} studenti={studentiOpzioni} />}

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Storico inviati</h2>
        {!inviati || inviati.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessun messaggio inviato ancora.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {inviati.map((m) => (
              <li key={m.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <p className="font-heading text-sm font-semibold text-kireo-light">{m.oggetto}</p>
                <p className="mt-1 text-xs text-kireo-muted">
                  {ETICHETTA_DESTINATARI[m.destinatari] ?? m.destinatari} ·{" "}
                  {new Date(m.created_at).toLocaleDateString("it-IT", { dateStyle: "long" })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
