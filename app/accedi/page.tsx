import type { Metadata } from "next";
import { Suspense } from "react";
import AccediForm from "@/components/AccediForm";

export const metadata: Metadata = {
  title: "Accedi — KIREO",
  description: "Accedi al tuo profilo KIREO.",
};

export default function Accedi() {
  return (
    <section className="mx-auto max-w-md px-6 py-20 sm:pt-28">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Accedi</p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">Bentornato</h1>
      <p className="mt-4 text-lg text-kireo-muted">Accedi al tuo profilo KIREO.</p>

      <div className="mt-10">
        <Suspense fallback={null}>
          <AccediForm />
        </Suspense>
      </div>
    </section>
  );
}
