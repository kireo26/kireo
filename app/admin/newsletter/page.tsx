import { requireAdmin } from "@/lib/admin/context";
import ElencoNewsletter from "./ElencoNewsletter";

export default async function AdminNewsletterTuttePage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  return <ElencoNewsletter supabase={supabase} filtro="tutte" base="/admin/newsletter" cerca={await searchParams} />;
}
