import { requireAdmin } from "@/lib/admin/context";
import Schede from "@/components/admin/Schede";
import { coseDaDecidere } from "@/lib/admin/coseDaDecidere";

// LE NEWSLETTER DEGLI ENTI (31/10). Tutte · Da approvare · Approvate ·
// Rifiutate. Una newsletter arriva nella posta degli studenti con il nome di
// KIREO sopra: per questo si approva, e i post no. Il numero accanto a «Da
// approvare» esce da `coseDaDecidere`, la stessa fonte di «Oggi».
export default async function AdminNewsletterLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();
  const n = (await coseDaDecidere(supabase)).find((c) => c.chiave === "newsletter")?.numero ?? null;
  return (
    <div className="space-y-6">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Newsletter</h1>
      <Schede
        etichetta="Newsletter"
        schede={[
          { href: "/admin/newsletter", label: "Tutte" },
          { href: "/admin/newsletter/da-approvare", label: n === null ? "Da approvare (non letto)" : `Da approvare (${n})` },
          { href: "/admin/newsletter/approvate", label: "Approvate" },
          { href: "/admin/newsletter/rifiutate", label: "Rifiutate" },
        ]}
      />
      {children}
    </div>
  );
}
