import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import SchedeEventi from "@/components/ente/SchedeEventi";
import { contaDaApprovare } from "@/lib/admin/caricaEventiAdmin";
import { etichettaDaApprovare } from "@/lib/admin/eventiAdmin";

// GLI EVENTI DI TUTTI GLI ENTI, per l'admin (Mario, 27/10). Quattro schede,
// e la prima è la coda di lavoro: «l'admin guarda questa pagina per sapere
// cosa deve fare». Il numero sta accanto alla voce perché si veda da ogni
// scheda. La plancia di un evento sta nella sua pagina (`/diretta/[id]`).
export default async function AdminEventiLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();
  const daApprovare = await contaDaApprovare(supabase);
  const schede = [
    { href: "/admin/eventi", label: etichettaDaApprovare(daApprovare) },
    { href: "/admin/eventi/in-programmazione", label: "In programmazione" },
    { href: "/admin/eventi/passati", label: "Eventi passati" },
    { href: "/admin/eventi/rifiutati", label: "Rifiutati" },
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-20 sm:pt-28">
      <div>
        <Link href="/admin" className="text-sm text-kireo-orange underline underline-offset-2">
          ← Torna alla coda KIREO
        </Link>
        <p className="mb-2 mt-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Admin KIREO</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Eventi</h1>
      </div>
      <SchedeEventi schede={schede} />
      {children}
    </div>
  );
}
