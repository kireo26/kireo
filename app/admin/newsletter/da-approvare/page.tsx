import { requireAdmin } from "@/lib/admin/context";
import ElencoNewsletter from "../ElencoNewsletter";

export default async function AdminNewsletterDaApprovarePage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  return <ElencoNewsletter supabase={supabase} filtro="da_approvare" base="/admin/newsletter/da-approvare" cerca={await searchParams} />;
}
