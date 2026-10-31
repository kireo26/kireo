import { requireAdmin } from "@/lib/admin/context";
import ElencoNewsletter from "../ElencoNewsletter";

export default async function AdminNewsletterRifiutatePage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  return <ElencoNewsletter supabase={supabase} filtro="rifiutate" base="/admin/newsletter/rifiutate" cerca={await searchParams} />;
}
