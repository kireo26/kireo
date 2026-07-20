import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Smart-redirect post-login: AccediForm porta sempre qui (a meno di un
// redirectedFrom esplicito, che ha la precedenza per non perdere la pagina
// protetta che ha innescato il login), e questa pagina decide la
// destinazione in base al ruolo. Nessun contenuto proprio: solo redirect.
export default async function DopoAccesso() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: profilo } = await supabase.from("profiles").select("ruolo").eq("id", user.id).maybeSingle();
  const meta = user.user_metadata as Record<string, unknown>;
  const ruolo = profilo?.ruolo ?? (typeof meta.ruolo === "string" ? meta.ruolo : null);

  if (ruolo === "istituzione") {
    redirect("/ente");
  }
  if (ruolo === "referente_scuola" || ruolo === "tutor_scuola") {
    redirect("/scuola");
  }
  if (ruolo === "admin") {
    redirect("/admin");
  }

  // Studente, docente (o profilo non ancora finalizzato): /app fa già la
  // sua auto-riparazione e mostra il fallback minimo per i ruoli
  // non-studente.
  redirect("/app");
}
