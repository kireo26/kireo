import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizzaRegistrazioneSeNecessario } from "@/lib/finalizzaRegistrazione";
import { finalizzaRegistrazioneEnteSeNecessario } from "@/lib/finalizzaRegistrazioneEnte";

type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

// Punto unico di arrivo dei link nelle email di Supabase Auth (conferma
// iscrizione e recupero password). Dopo la verifica, per una conferma di
// iscrizione crea profilo + dati specifici del ruolo in un'unica
// transazione (finalize_registration / finalize_registration_istituzione),
// poi porta l'utente a destinazione.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dopo-accesso";

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
      const esito = await finalizzaRegistrazioneSeNecessario(supabase, data.user);
      if (!esito.ok) {
        redirect(`/accedi?errore=${esito.motivo}`);
      }
    }

    if (meta?.ruolo === "istituzione") {
      const esito = await finalizzaRegistrazioneEnteSeNecessario(supabase, data.user);
      if (!esito.ok) {
        // A differenza di studente/docente, l'errore torna sulla pagina che
        // ospita il form di richiesta accesso (non su /accedi, che non
        // c'entra con la registrazione di un ente): RichiestaAccessoEnteForm
        // legge ?errore= e mostra un messaggio specifico lì.
        redirect(`/istituzioni?errore=ente_${esito.motivo}#richiedi-accesso`);
      }
    }
  }

  redirect(next);
}
