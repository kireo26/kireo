"use client";

import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { createClient } from "@/lib/supabase/client";
import { USCITA_SOLO_QUI } from "@/lib/supabase/uscita";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: USCITA_SOLO_QUI });
    router.push("/");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={handleLogout}>
      Esci
    </Button>
  );
}
