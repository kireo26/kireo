import type { Metadata } from "next";
import RegistrazioneForm from "@/components/RegistrazioneForm";

export const metadata: Metadata = {
  title: "Registrazione studenti — KIREO",
  description: "Crea il tuo profilo gratuito su KIREO: bastano due minuti.",
};

export default function Registrazione() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20 sm:pt-28">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
        Registrazione
      </p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">
        Inizia il tuo percorso
      </h1>
      <p className="mt-4 text-lg text-kireo-muted">
        Crea il tuo profilo gratuito: bastano due minuti.
      </p>

      <div className="mt-10">
        <RegistrazioneForm />
      </div>
    </section>
  );
}
