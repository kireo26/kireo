import { notFound } from "next/navigation";
import Link from "next/link";
import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { pianoAPagamento } from "@/lib/ente/pianoSuccessivo";
import ThreadMessaggi from "@/components/messaggi/ThreadMessaggi";

export default async function ConversazioneEntePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const { data: conversazione } = await supabase
    .from("conversazioni_enti")
    .select("id, stato, istituzione_id, profiles!student_id(nome, cognome)")
    .eq("id", id)
    .maybeSingle();

  if (!conversazione || conversazione.istituzione_id !== contesto.istituzioneId) notFound();

  const { data: messaggi } = await supabase
    .from("messaggi_enti")
    .select("id, mittente, corpo, created_at, letta")
    .eq("conversazione_id", id)
    .order("created_at", { ascending: true });

  const profilo = Array.isArray(conversazione.profiles) ? conversazione.profiles[0] : conversazione.profiles;
  const aPagamento = pianoAPagamento(contesto.pianoNome);

  let notaNonScrivibile = "Questa conversazione non è più scrivibile.";
  if (!aPagamento) notaNonScrivibile = "Il tuo piano attuale non include la risposta ai messaggi: passa a un piano superiore.";
  else if (conversazione.stato === "bloccata_da_studente") notaNonScrivibile = "Lo studente ha bloccato questa conversazione.";
  else if (conversazione.stato === "chiusa_da_admin") notaNonScrivibile = "Questa conversazione è stata chiusa da KIREO.";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/ente/messaggi" className="text-sm text-kireo-orange underline underline-offset-2">
          ← Tutte le conversazioni
        </Link>
        <h1 className="mt-2 py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">
          {profilo?.nome ?? "Studente"} {profilo?.cognome ?? ""}
        </h1>
      </div>
      <ThreadMessaggi
        conversazioneId={id}
        ruolo="ente"
        messaggiIniziali={messaggi ?? []}
        stato={conversazione.stato}
        puoScrivere={conversazione.stato === "aperta" && aPagamento}
        notaNonScrivibile={notaNonScrivibile}
      />
    </div>
  );
}
