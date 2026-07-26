import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";

const ETICHETTA_STATO: Record<string, string> = {
  aperta: "Aperta",
  bloccata_da_studente: "Bloccata",
  chiusa_da_admin: "Chiusa",
};

export default async function MessaggiAppPage() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: conversazioni } = await supabase
    .from("conversazioni_enti")
    .select("id, stato, created_at, istituzioni(nome, slug)")
    .eq("student_id", contesto.userId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Messaggi</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Le tue conversazioni</h1>
      </div>

      {!conversazioni || conversazioni.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non hai ancora scritto a nessun ente. Puoi farlo dal profilo pubblico di un&apos;istituzione, se hai 18 anni o più.
        </div>
      ) : (
        <ul className="space-y-3">
          {conversazioni.map((c) => {
            const istituzione = Array.isArray(c.istituzioni) ? c.istituzioni[0] : c.istituzioni;
            return (
              <li key={c.id}>
                <Link href={`/app/messaggi/${c.id}`} className="flex items-center justify-between rounded-xl border border-white/5 bg-kireo-card p-4 transition-colors hover:border-kireo-green/40">
                  <div>
                    <p className="font-heading text-sm font-semibold text-kireo-light">{istituzione?.nome ?? "Istituzione"}</p>
                    <p className="mt-1 text-xs text-kireo-muted">{new Date(c.created_at).toLocaleDateString("it-IT", { dateStyle: "long" })}</p>
                  </div>
                  <span className="text-xs text-kireo-muted">{ETICHETTA_STATO[c.stato] ?? c.stato}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
