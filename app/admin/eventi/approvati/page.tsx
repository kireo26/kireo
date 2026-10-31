import { requireAdmin } from "@/lib/admin/context";
import Ricerca from "@/components/admin/Ricerca";
import { caricaEventiAdmin } from "@/lib/admin/caricaEventiAdmin";
import { caricaCertificatiDocenti } from "@/lib/ente/caricaEventiEnte";
import { cercaEventiAdmin, dividiEventiAdmin } from "@/lib/admin/eventiAdmin";
import { esitoEventoPassato } from "@/lib/ente/eventiEnte";
import { LetturaFallita, Righe, Vuoto } from "../ElencoAdmin";

// APPROVATI (31/10): le due schede di prima, in programmazione e passati, in
// due gruppi di una scheda sola. In programmazione per gruppo e per data (la
// fine EFFETTIVA: una diretta chiusa prima è passata); i passati dal più
// recente, ognuno con com'è andata (la stessa frase che legge l'ente).
export default async function AdminEventiApprovatiPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await requireAdmin();
  const { eventi, aree, letturaFallita } = await caricaEventiAdmin(supabase);
  if (letturaFallita) return <LetturaFallita />;
  const { inProgrammazione, passati } = dividiEventiAdmin(cercaEventiAdmin(eventi, q));
  const docenti = passati.filter((e) => e.pubblico === "docenti" && e.tipo !== "webinar").map((e) => e.id);
  const certificati = await caricaCertificatiDocenti(supabase, docenti);
  const quanti = inProgrammazione.reduce((n, g) => n + g.eventi.length, 0) + passati.length;
  return (
    <div className="space-y-6">
      <Ricerca base="/admin/eventi/approvati" q={q} segnaposto="Cerca per titolo o nome dell'ente" />
      <p className="text-sm text-kireo-light">In tutto: {quanti}</p>
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-kireo-light">In programmazione</h2>
        {inProgrammazione.length === 0 ? (
          <Vuoto testo="Nessun evento in programmazione." />
        ) : (
          <div className="space-y-6">
            {inProgrammazione.map((g) => (
              <section key={g.chiave}>
                <h3 className="mb-3 font-heading text-base font-semibold text-kireo-light">{g.titolo}</h3>
                <Righe eventi={g.eventi} aree={aree} />
              </section>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-kireo-light">Passati</h2>
        {passati.length === 0 ? (
          <Vuoto testo="Nessun evento passato." />
        ) : (
          <Righe
            eventi={passati}
            aree={aree}
            esito={(e) => esitoEventoPassato(e, certificati === null ? null : (certificati.get(e.id) ?? 0))}
          />
        )}
      </section>
    </div>
  );
}
