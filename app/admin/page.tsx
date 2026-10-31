import { requireAdmin } from "@/lib/admin/context";
import { coseDaDecidere } from "@/lib/admin/coseDaDecidere";
import CoseDaDecidere from "@/components/admin/CoseDaDecidere";

// OGGI (Mario, 31/10): le sette cose che aspettano una decisione, ognuna con il
// suo numero e il link a dove si decide. Niente statistiche, niente elenchi.
// È una schermata che risponde a una domanda sola, e deve restare così anche
// quando la dashboard arriverà: la dashboard avrà un posto suo.
//
// I numeri li legge `coseDaDecidere`, la stessa funzione della cima di
// «Notifiche»: questa pagina non conta niente da sé.
export default async function AdminOggiPage() {
  const { supabase } = await requireAdmin();
  const cose = await coseDaDecidere(supabase);
  return (
    <div className="space-y-8">
      <h1 className="sr-only">Oggi</h1>
      <CoseDaDecidere cose={cose} />
    </div>
  );
}
