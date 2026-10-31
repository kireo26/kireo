import { requireAdmin } from "@/lib/admin/context";
import ElencoNewsletter from "../ElencoNewsletter";

export default async function AdminNewsletterApprovatePage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  return <ElencoNewsletter supabase={supabase} filtro="approvate" base="/admin/newsletter/approvate" cerca={await searchParams} />;
}
