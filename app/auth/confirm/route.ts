import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

// Punto unico di arrivo dei link nelle email di Supabase Auth (conferma
// iscrizione e recupero password). Dopo la verifica, per una conferma di
// iscrizione crea profilo + dati specifici del ruolo in un'unica
// transazione (finalize_registration), poi porta l'utente in /app.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";

  if (!tokenHash || !type) {
    redirect("/accedi?errore=link_non_valido");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error || !data.user) {
    redirect("/accedi?errore=link_scaduto");
  }

  if (type === "recovery") {
    redirect("/reimposta-password");
  }

  if (type === "signup" || type === "email") {
    const meta = data.user.user_metadata as Record<string, unknown>;

    if (meta?.ruolo === "studente" || meta?.ruolo === "docente") {
      const { error: finalizeError } = await supabase.rpc("finalize_registration", {
        p_ruolo: meta.ruolo,
        p_nome: meta.nome,
        p_cognome: meta.cognome,
        p_data_nascita: meta.data_nascita,
        p_school_code: meta.school_code ?? null,
        p_classe: meta.classe ?? null,
        p_anno_diploma: meta.anno_diploma ?? null,
        p_materia: meta.materia ?? null,
        p_is_referente: meta.is_referente_orientamento ?? false,
        p_codice_classe: meta.codice_classe ?? null,
      });

      if (finalizeError) {
        redirect(`/accedi?errore=registrazione_fallita`);
      }
    }
  }

  redirect(next);
}
