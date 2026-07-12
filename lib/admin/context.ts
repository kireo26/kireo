import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Guardia per /admin: la vera protezione è la RLS (current_ruolo()='admin',
// vedi le policy *_admin_tutto), questa è solo l'esperienza a livello di
// pagina — un non-admin che aggirasse la UI non otterrebbe comunque dati
// diversi dai propri, l'RLS li nega.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: profilo } = await supabase.from("profiles").select("ruolo, nome").eq("id", user.id).maybeSingle();

  if (profilo?.ruolo !== "admin") {
    redirect("/dopo-accesso");
  }

  return { supabase, userId: user.id, nome: profilo.nome };
}
