import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import ThreadMessaggi from "@/components/messaggi/ThreadMessaggi";

export default async function ConversazioneAppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: conversazione } = await supabase
    .from("conversazioni_enti")
    .select("id, stato, student_id, istituzioni(nome)")
    .eq("id", id)
    .maybeSingle();

  if (!conversazione || conversazione.student_id !== contesto.userId) notFound();

  const { data: messaggi } = await supabase
    .from("messaggi_enti")
    .select("id, mittente, corpo, created_at, letta")
    .eq("conversazione_id", id)
    .order("created_at", { ascending: true });

  const istituzione = Array.isArray(conversazione.istituzioni) ? conversazione.istituzioni[0] : conversazione.istituzioni;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/app/messaggi" className="text-sm text-kireo-orange underline underline-offset-2">
          ← Tutte le conversazioni
        </Link>
        <h1 className="mt-2 py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">{istituzione?.nome ?? "Istituzione"}</h1>
      </div>
      <ThreadMessaggi
        conversazioneId={id}
        ruolo="studente"
        messaggiIniziali={messaggi ?? []}
        stato={conversazione.stato}
        puoScrivere={conversazione.stato === "aperta"}
        notaNonScrivibile={conversazione.stato === "bloccata_da_studente" ? "Hai bloccato questa conversazione." : "Questa conversazione è stata chiusa da KIREO."}
      />
    </div>
  );
}
