import { requireAdmin } from "@/lib/admin/context";
import NotificheBell from "@/components/app/NotificheBell";
import LogoutButton from "@/components/LogoutButton";
import MenuAdmin from "@/components/admin/MenuAdmin";

// L'AREA ADMIN, RIORDINATA (Mario, 31/10). Fino a oggi era una pagina sola di
// dodici code una sotto l'altra, ciascuna con le sue ultime N righe: ogni lotto
// aveva aggiunto la sua. Ora i soggetti (scuole, enti) e le liste (eventi,
// post, newsletter) hanno una pagina loro, e «Oggi» dice una cosa sola: cosa
// aspetta una decisione. *Una decisione che vive solo dentro una lista lunga,
// prima o poi, non la prende nessuno.*
//
// ⚠️ La regola del riordino: niente di quello che si poteva fare diventa
// impossibile. La sorveglia `npm run test:admin`, scritta prima di spostare.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { nome, userId } = await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl px-6 py-20 sm:pt-28">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Admin KIREO</p>
          <p className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">Ciao {nome}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificheBell userId={userId} />
          <LogoutButton />
        </div>
      </div>
      <MenuAdmin />
      <div className="mt-8">{children}</div>
    </div>
  );
}
