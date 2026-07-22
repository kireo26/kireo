import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/app/studentContext";
import { getAreaBySlug } from "@/data/aree";
import { isAreaAttiva } from "@/lib/assistente/config";
import ChatAssistente from "@/components/app/assistente/ChatAssistente";

// Autenticazione + ruolo studente già garantiti da app/app/layout.tsx (ogni
// rotta sotto /app eredita quella guardia): qui basta leggere il contesto
// per coerenza con le altre pagine, senza ripetere il controllo.
export default async function AssistenteAreaPage({ params }: { params: Promise<{ areaSlug: string }> }) {
  await getAppContext();
  const { areaSlug } = await params;
  const area = getAreaBySlug(areaSlug);
  if (!area) notFound();

  if (!isAreaAttiva(areaSlug)) {
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Assistente digitale
          </p>
          <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">{area.nome}</h1>
        </div>
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center">
          <p className="text-kireo-muted">
            L&apos;assistente digitale di quest&apos;area non è ancora attivo. Nel frattempo scarica la guida o dai
            un&apos;occhiata agli eventi.
          </p>
          <Link href={`/aree/${area.slug}`} className="mt-4 inline-block text-sm text-kireo-orange underline underline-offset-2">
            Vai alla pagina dell&apos;area →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
          Assistente digitale
        </p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">{area.nome}</h1>
      </div>
      <ChatAssistente areaSlug={area.slug} areaNome={area.nome} />
    </div>
  );
}
