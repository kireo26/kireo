import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { finalizzaRegistrazioneEnteSeNecessario } from "@/lib/finalizzaRegistrazioneEnte";

export type EnteContext = {
  userId: string;
  istituzioneId: string;
  nome: string;
  slug: string;
  stato: string;
  pianoNome: string;
};

// Stesso principio di lib/app/studentContext.ts (cache() di React: layout
// e pagina condividono lo stesso risultato nella stessa richiesta),
// applicato al ruolo istituzione.
export const getEnteContext = cache(async (): Promise<EnteContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: profiloEsistente } = await supabase.from("profiles").select("ruolo").eq("id", user.id).maybeSingle();

  if (!profiloEsistente) {
    const esito = await finalizzaRegistrazioneEnteSeNecessario(supabase, user);
    if (!esito.ok) {
      redirect(`/accedi?errore=ente_${esito.motivo}`);
    }
  } else if (profiloEsistente.ruolo !== "istituzione") {
    redirect("/dopo-accesso");
  }

  const { data: link } = await supabase
    .from("institution_profiles")
    .select("istituzione_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!link) {
    redirect("/accedi?errore=ente_dati_incompleti");
  }

  const { data: istituzione } = await supabase
    .from("istituzioni")
    .select("nome, slug, stato, piani(nome)")
    .eq("id", link.istituzione_id)
    .maybeSingle();

  const pianoRel = istituzione?.piani as { nome: string } | { nome: string }[] | null | undefined;
  const pianoNome = Array.isArray(pianoRel) ? pianoRel[0]?.nome : pianoRel?.nome;

  return {
    userId: user.id,
    istituzioneId: link.istituzione_id,
    nome: istituzione?.nome ?? "",
    slug: istituzione?.slug ?? "",
    stato: istituzione?.stato ?? "in_attesa",
    pianoNome: pianoNome ?? "free",
  };
});
