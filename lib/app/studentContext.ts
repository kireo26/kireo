import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { finalizzaRegistrazioneSeNecessario } from "@/lib/finalizzaRegistrazione";

export type AppContext = {
  userId: string;
  nome: string;
  cognome: string;
  ruolo: string;
  schoolCode: string | null;
  schoolName: string | null;
  classe: string | null;
};

// Contesto condiviso da layout.tsx e da ogni pagina sotto /app: chi è
// l'utente, il suo ruolo, la sua scuola/classe. Avvolto in cache() di React
// così, nella stessa richiesta, layout + pagina leggono lo stesso risultato
// senza duplicare le query verso Supabase.
//
// Include la stessa auto-riparazione già in uso altrove (vedi
// lib/finalizzaRegistrazione.ts): un profilo mancante dopo la conferma email
// viene creato al volo dai metadata, invece di lasciare l'utente bloccato.
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: profiloEsistente } = await supabase
    .from("profiles")
    .select("nome, cognome, ruolo")
    .eq("id", user.id)
    .maybeSingle();

  let nome: string;
  let cognome: string;
  let ruolo: string;
  let schoolCodeDaMetadata: string | null = null;

  if (profiloEsistente) {
    nome = profiloEsistente.nome;
    cognome = profiloEsistente.cognome;
    ruolo = profiloEsistente.ruolo;
  } else {
    const esito = await finalizzaRegistrazioneSeNecessario(supabase, user);

    if (!esito.ok) {
      redirect(`/accedi?errore=${esito.motivo}`);
    }

    const meta = user.user_metadata as Record<string, unknown>;
    nome = meta.nome as string;
    cognome = meta.cognome as string;
    ruolo = meta.ruolo as string;
    schoolCodeDaMetadata = typeof meta.school_code === "string" ? meta.school_code : null;
  }

  let schoolCode: string | null = schoolCodeDaMetadata;
  let classe: string | null = null;

  if (ruolo === "studente") {
    const { data: datiStudente } = await supabase
      .from("student_profiles")
      .select("school_code, classe")
      .eq("user_id", user.id)
      .maybeSingle();
    schoolCode = datiStudente?.school_code ?? schoolCodeDaMetadata;
    classe = datiStudente?.classe ?? null;
  } else {
    const { data: datiRuolo } = await supabase
      .from("teacher_profiles")
      .select("school_code")
      .eq("user_id", user.id)
      .maybeSingle();
    schoolCode = datiRuolo?.school_code ?? schoolCodeDaMetadata;
  }

  let schoolName: string | null = null;
  if (schoolCode) {
    const { data: scuola } = await supabase
      .from("schools")
      .select("denominazione")
      .eq("codice_meccanografico", schoolCode)
      .maybeSingle();
    schoolName = scuola?.denominazione ?? null;
  }

  return { userId: user.id, nome, cognome, ruolo, schoolCode, schoolName, classe };
});
