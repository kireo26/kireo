"use client";

import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={handleLogout}>
      Esci
    </Button>
  );
}
