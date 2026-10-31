import { requireAdmin } from "@/lib/admin/context";
import ElencoPost from "./ElencoPost";

export default async function AdminPostTuttiPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  return <ElencoPost supabase={supabase} filtro="tutti" base="/admin/post" cerca={await searchParams} />;
}
