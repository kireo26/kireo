import { requireAdmin } from "@/lib/admin/context";
import Schede from "@/components/admin/Schede";
import { contaDaApprovare } from "@/lib/admin/caricaEventiAdmin";
import { etichettaDaApprovare } from "@/lib/admin/eventiAdmin";

// GLI EVENTI DI TUTTI GLI ENTI, per l'admin. Dal 31/10 le schede sono quelle
// di Mario: Tutti · Da approvare · Approvati · Rifiutati («Approvati» tiene
// insieme quelli in programmazione e quelli passati, in due gruppi). Il numero
// accanto a «Da approvare» esce dalla stessa divisione della scheda. La
// plancia di un evento sta nella sua pagina (`/diretta/[id]`).
export default async function AdminEventiLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();
  const daApprovare = await contaDaApprovare(supabase);
  const schede = [
    { href: "/admin/eventi", label: "Tutti" },
    { href: "/admin/eventi/da-approvare", label: etichettaDaApprovare(daApprovare) },
    { href: "/admin/eventi/approvati", label: "Approvati" },
    { href: "/admin/eventi/rifiutati", label: "Rifiutati" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Eventi</h1>
      <Schede etichetta="Eventi" schede={schede} />
      {children}
    </div>
  );
}
