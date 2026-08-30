import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app/studentContext";
import { WORKSHOP_CLIENTE_NOME, WORKSHOP_CLIENTE_APERTURA, WORKSHOP_CLIENTE_HINT } from "@/lib/workshop/config";
import ChatCliente from "@/components/workshop/ChatCliente";
import ComeParlareConCliente from "@/components/workshop/ComeParlareConCliente";
import { getStatoChatTappa } from "@/lib/workshop/chatTappa";
import { getIscrizioniWorkshop, scegliIscrizione, STATI_APRIBILI } from "@/lib/workshop/iscrizioneCorrente";

export const metadata = { title: "Parla con il cliente — KIREO" };

export default async function ClienteWorkshopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: ws } = await supabase.from("workshop").select("id, slug, titolo").eq("slug", slug).eq("attivo", true).maybeSingle();
  if (!ws) notFound();

  const iscrizione = scegliIscrizione(await getIscrizioniWorkshop(supabase, ws.id, contesto.userId), STATI_APRIBILI);
  if (!iscrizione) redirect(`/app/workshop/${slug}`);

  const ruolo = iscrizione.workshop_ruoli;

  const [{ data: storico }, statoChat] = await Promise.all([
    supabase
      .from("workshop_chat_cliente")
      .select("mittente, contenuto")
      .eq("iscrizione_id", iscrizione.id)
      .order("created_at", { ascending: true }),
    getStatoChatTappa(supabase, iscrizione.id, slug, ruolo?.slug ?? ""),
  ]);

  return (
    <div className="space-y-4">
      <Link href={`/app/workshop/${slug}`} className="text-xs text-kireo-muted hover:text-kireo-light">
        ← {ws.titolo}
      </Link>
      <ComeParlareConCliente chiusura={WORKSHOP_CLIENTE_HINT[slug] ?? "Parla semplice e diretto."} />
      <ChatCliente
        iscrizioneId={iscrizione.id}
        nomeCliente={WORKSHOP_CLIENTE_NOME[slug] ?? "Il cliente"}
        messaggioApertura={WORKSHOP_CLIENTE_APERTURA[slug] ?? "Allora, raccontami tutto. Da dove partiamo?"}
        messaggiIniziali={storico ?? []}
        hrefProgetto={`/app/workshop/${slug}/progetto`}
        statoChat={statoChat}
      />
      <p className="text-center text-xs text-kireo-muted">Questo è un personaggio simulato dall&apos;intelligenza artificiale. Usa dati reali per convincerlo.</p>
    </div>
  );
}
