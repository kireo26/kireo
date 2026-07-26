import Link from "next/link";
import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { pianoAPagamento } from "@/lib/ente/pianoSuccessivo";

const ETICHETTA_STATO: Record<string, string> = {
  aperta: "Aperta",
  bloccata_da_studente: "Bloccata dallo studente",
  chiusa_da_admin: "Chiusa",
};

export default async function EnteMessaggiPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();
  const aPagamento = pianoAPagamento(contesto.pianoNome);

  const { data: conversazioni } = await supabase
    .from("conversazioni_enti")
    .select("id, stato, created_at, profiles!student_id(nome, cognome)")
    .eq("istituzione_id", contesto.istituzioneId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Messaggi</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Conversazioni con gli studenti</h1>
        {!aPagamento && (
          <p className="mt-2 text-sm text-kireo-orange">
            Con il piano Free puoi leggere ma non rispondere.{" "}
            <a href="/ente/piano" className="underline underline-offset-2">
              Passa a un piano superiore
            </a>{" "}
            per poter scrivere.
          </p>
        )}
      </div>

      {!conversazioni || conversazioni.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Nessuno studente ti ha ancora scritto.
        </div>
      ) : (
        <ul className="space-y-3">
          {conversazioni.map((c) => {
            const profilo = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            return (
              <li key={c.id}>
                <Link href={`/ente/messaggi/${c.id}`} className="flex items-center justify-between rounded-xl border border-white/5 bg-kireo-card p-4 transition-colors hover:border-kireo-green/40">
                  <div>
                    <p className="font-heading text-sm font-semibold text-kireo-light">
                      {profilo?.nome ?? "Studente"} {profilo?.cognome ?? ""}
                    </p>
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
