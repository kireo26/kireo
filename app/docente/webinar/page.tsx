import { getDocenteContext } from "@/lib/docente/context";
import { getProssimiWebinar, getWebinarPassati, getIscrizioniDocente } from "@/lib/docente/eventi";
import { createClient } from "@/lib/supabase/server";
import CardWebinarDocente from "@/components/docente/CardWebinarDocente";

export default async function DocenteWebinarPage() {
  const contesto = await getDocenteContext();
  const supabase = await createClient();

  const [prossimi, passati, iscrizioni] = await Promise.all([
    getProssimiWebinar(supabase),
    getWebinarPassati(supabase),
    getIscrizioniDocente(supabase, contesto.userId),
  ]);

  const passatiIscritti = passati.filter((w) => iscrizioni[w.id]);

  return (
    <div className="space-y-10">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Webinar</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Formazione continua</h1>
        <p className="mt-2 text-kireo-muted">Webinar gratuiti sui cinque filoni della formazione docenti KIREO, con attestato di partecipazione.</p>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Prossimi webinar</h2>
        {prossimi.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Il calendario si sta riempiendo: torna a trovarci a breve.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {prossimi.map((w) => (
              <CardWebinarDocente key={w.id} webinar={w} userId={contesto.userId} stato={iscrizioni[w.id]} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">I tuoi webinar passati</h2>
        {passatiIscritti.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Non hai ancora partecipato a nessun webinar.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {passatiIscritti.map((w) => (
              <CardWebinarDocente key={w.id} webinar={w} userId={contesto.userId} stato={iscrizioni[w.id]} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
