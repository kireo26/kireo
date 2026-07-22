import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { finalizzaRegistrazioneSeNecessario } from "@/lib/finalizzaRegistrazione";

export type DocenteContext = {
  userId: string;
  nome: string;
  cognome: string;
  materia: string | null;
  schoolCode: string | null;
  schoolName: string | null;
};

// Stesso principio di lib/ente/context.ts e lib/scuola/context.ts
// (cache() di React: layout e pagina condividono lo stesso risultato
// nella stessa richiesta). Il docente riusa finalize_registration/
// finalizzaRegistrazioneSeNecessario già esistenti (non un percorso
// nuovo): l'unica cosa nuova qui è la destinazione /docente al posto del
// fallback minimo di /app.
export const getDocenteContext = cache(async (): Promise<DocenteContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: profiloEsistente } = await supabase.from("profiles").select("nome, cognome, ruolo").eq("id", user.id).maybeSingle();

  let nome: string;
  let cognome: string;

  if (!profiloEsistente) {
    const esito = await finalizzaRegistrazioneSeNecessario(supabase, user);
    if (!esito.ok) {
      redirect(`/accedi?errore=${esito.motivo}`);
    }
    const meta = user.user_metadata as Record<string, unknown>;
    nome = typeof meta.nome === "string" ? meta.nome : "";
    cognome = typeof meta.cognome === "string" ? meta.cognome : "";
  } else if (profiloEsistente.ruolo !== "docente") {
    redirect("/dopo-accesso");
  } else {
    nome = profiloEsistente.nome;
    cognome = profiloEsistente.cognome;
  }

  const { data: datiDocente } = await supabase.from("teacher_profiles").select("materia, school_code").eq("user_id", user.id).maybeSingle();

  let schoolName: string | null = null;
  if (datiDocente?.school_code) {
    const { data: scuola } = await supabase
      .from("schools")
      .select("denominazione")
      .eq("codice_meccanografico", datiDocente.school_code)
      .maybeSingle();
    schoolName = scuola?.denominazione ?? null;
  }

  return {
    userId: user.id,
    nome,
    cognome,
    materia: datiDocente?.materia ?? null,
    schoolCode: datiDocente?.school_code ?? null,
    schoolName,
  };
});
