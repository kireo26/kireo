import type { Metadata } from "next";
import RecuperaPasswordForm from "@/components/RecuperaPasswordForm";

export const metadata: Metadata = {
  title: "Recupera password — KIREO",
  description: "Reimposta la password del tuo profilo KIREO.",
};

export default function RecuperaPassword() {
  return (
    <section className="mx-auto max-w-md px-6 py-20 sm:pt-28">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Recupera password</p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">Password dimenticata?</h1>
      <p className="mt-4 text-lg text-kireo-muted">Ti mandiamo un link per sceglierne una nuova.</p>

      <div className="mt-10">
        <RecuperaPasswordForm />
      </div>
    </section>
  );
}
