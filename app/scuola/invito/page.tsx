import type { Metadata } from "next";
import { Suspense } from "react";
import RiscattaInvitoTutorForm from "@/components/scuola/RiscattaInvitoTutorForm";

export const metadata: Metadata = {
  title: "Registrati come tutor — KIREO",
  description: "Completa la registrazione come tutor della tua scuola su KIREO con il codice invito ricevuto dal referente.",
};

export default async function InvitoTutorPage({
  searchParams,
}: {
  searchParams: Promise<{ codice?: string }>;
}) {
  const { codice } = await searchParams;

  return (
    <section className="mx-auto max-w-2xl px-6 py-20 sm:pt-28">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Registrazione tutor</p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">Sei stato invitato come tutor</h1>
      <p className="mt-4 text-lg text-kireo-muted">
        Inserisci il codice invito ricevuto dal referente della tua scuola e crea il tuo account.
      </p>
      <div className="mt-10">
        <Suspense fallback={null}>
          <RiscattaInvitoTutorForm codiceIniziale={codice ?? ""} />
        </Suspense>
      </div>
    </section>
  );
}
