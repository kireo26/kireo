import { requireAdmin } from "@/lib/admin/context";
import ElencoPost from "../ElencoPost";

export default async function AdminPostPubblicatiPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  return <ElencoPost supabase={supabase} filtro="pubblicati" base="/admin/post/pubblicati" cerca={await searchParams} />;
}
