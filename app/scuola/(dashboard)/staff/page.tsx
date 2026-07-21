import { getScuolaContext, richiedeReferente } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import InvitaTutorForm from "@/components/scuola/InvitaTutorForm";
import DisattivaStaffButton from "@/components/scuola/DisattivaStaffButton";
import TogglePermessiTutor from "@/components/scuola/TogglePermessiTutor";

export default async function ScuolaStaffPage() {
  const contesto = await getScuolaContext();
  richiedeReferente(contesto);
  const supabase = await createClient();

  const { data: staff, error: erroreStaff } = await supabase
    .from("school_staff")
    .select(
      "id, ruolo_staff, attivo, user_id, codice_invito, nome_invitato, email_invitato, puo_verificare_studenti, puo_gestire_classi, puo_certificare_presenze, puo_inviare_comunicazioni, profiles!user_id(nome, cognome)",
    )
    .eq("scuola_profilo_id", contesto.scuolaProfiloId)
    .order("created_at", { ascending: true });

  if (erroreStaff) console.error("[/scuola/staff] errore query staff:", erroreStaff);

  const tutor = (staff ?? []).filter((s) => s.ruolo_staff === "tutor");

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Staff</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Tutor della tua scuola</h1>
      </div>

      <InvitaTutorForm />

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Tutor</h2>
        {tutor.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessun tutor ancora.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tutor.map((t) => {
              const profilo = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
              const inAttesa = !t.user_id;
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4">
                  <div className="flex-1">
                    <p className="font-heading text-sm font-semibold text-kireo-light">
                      {inAttesa ? (t.nome_invitato ?? "Invito in attesa") : `${profilo?.nome} ${profilo?.cognome}`}
                    </p>
                    <p className="mt-1 text-xs text-kireo-muted">
                      {inAttesa ? `In attesa di registrazione — codice ${t.codice_invito}` : t.attivo ? "Attivo" : "Disattivato"}
                    </p>
                    <TogglePermessiTutor
                      staffId={t.id}
                      permessiIniziali={{
                        puo_verificare_studenti: t.puo_verificare_studenti,
                        puo_gestire_classi: t.puo_gestire_classi,
                        puo_certificare_presenze: t.puo_certificare_presenze,
                        puo_inviare_comunicazioni: t.puo_inviare_comunicazioni,
                      }}
                    />
                  </div>
                  {!inAttesa && <DisattivaStaffButton staffId={t.id} attivo={t.attivo} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
