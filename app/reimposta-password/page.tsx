import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ReimpostaPasswordForm from "@/components/ReimpostaPasswordForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reimposta password — KIREO",
  description: "Scegli una nuova password per il tuo profilo KIREO.",
};

export default async function ReimpostaPassword() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Questa pagina richiede la sessione temporanea di recupero creata da
  // /auth/confirm?type=recovery: senza sessione attiva non ha senso stare
  // qui, si torna al login.
  if (!user) {
    redirect("/accedi");
  }

  return (
    <section className="mx-auto max-w-md px-6 py-20 sm:pt-28">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Reimposta password</p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">Scegli una nuova password</h1>

      <div className="mt-10">
        <ReimpostaPasswordForm />
      </div>
    </section>
  );
}
