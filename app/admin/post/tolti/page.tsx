import { requireAdmin } from "@/lib/admin/context";
import ElencoPost from "../ElencoPost";

export default async function AdminPostToltiPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  return <ElencoPost supabase={supabase} filtro="tolti" base="/admin/post/tolti" cerca={await searchParams} />;
}
