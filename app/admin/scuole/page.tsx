import { requireAdmin } from "@/lib/admin/context";
import AttivaScuolaControlli from "@/components/admin/AttivaScuolaControlli";
import Paginazione from "@/components/admin/Paginazione";
import { CRITERI } from "@/lib/admin/coseDaDecidere";
import { intervallo, paginaDa, testoTotale } from "@/lib/admin/pagine";
import { formattaData, formattaDataOra } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

// SCUOLE (31/10). ⚠️ PROVVISORIA, fino al quarto lotto del riordino (che
// nasce insieme al capitolo della scuola): qui stanno le due sezioni delle
// scuole che prima erano in /admin, spostate intere — le attivazioni con la
// convenzione, e i messaggi delle scuole agli studenti, tutti e non più gli
// ultimi 20. Il quarto lotto porta la ricerca fra le scuole aderenti e la
// pagina di ogni scuola, con i numeri dall'adesione.
export default async function AdminScuolePage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  const pagina = paginaDa((await searchParams).pagina);
  const { da, a } = intervallo(pagina);
  const [{ data: scuoleInAttesa }, { data: messaggiScuola, count: contoMessaggi, error: erroreMessaggi }] = await Promise.all([
    CRITERI.scuoleInAttesa
      .filtra(supabase.from("scuole_profili").select("id, scuola_id, stato, convenzione_firmata_il, created_at"))
      .order("created_at", { ascending: true }),
    supabase
      .from("messaggi_scuola")
      .select("id, scuola_profilo_id, oggetto, corpo, destinatari, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(da, a),
  ]);
  if (erroreMessaggi) console.error("[admin] messaggi delle scuole:", descriviErrore(erroreMessaggi));
  const totaleMessaggi = erroreMessaggi ? null : (contoMessaggi ?? null);

  const { data: scuoleProfiloPerMessaggio } =
    messaggiScuola && messaggiScuola.length > 0
      ? await supabase.from("scuole_profili").select("id, scuola_id").in("id", messaggiScuola.map((m) => m.scuola_profilo_id))
      : { data: [] as { id: string; scuola_id: string }[] };
  const scuolaIdPerProfilo = new Map((scuoleProfiloPerMessaggio ?? []).map((s) => [s.id, s.scuola_id]));
  const scuoleIds = Array.from(
    new Set([...(scuoleInAttesa ?? []).map((s) => s.scuola_id), ...(scuoleProfiloPerMessaggio ?? []).map((s) => s.scuola_id)]),
  );
  const { data: nomiScuole } =
    scuoleIds.length > 0
      ? await supabase.from("schools").select("codice_meccanografico, denominazione").in("codice_meccanografico", scuoleIds)
      : { data: [] as { codice_meccanografico: string; denominazione: string }[] };
  const nomeScuolaPerCodice = new Map((nomiScuole ?? []).map((s) => [s.codice_meccanografico, s.denominazione]));

  return (
    <div className="space-y-12">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Scuole</h1>
      <section id="in-attesa">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Scuole in attesa di attivazione</h2>
        {!scuoleInAttesa || scuoleInAttesa.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessuna scuola in attesa.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {scuoleInAttesa.map((s) => (
              <li key={s.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-semibold text-kireo-light">
                      {nomeScuolaPerCodice.get(s.scuola_id) ?? s.scuola_id}
                    </p>
                    <p className="mt-1 text-xs text-kireo-muted">
                      richiesta il {formattaData(s.created_at, "long")}
                    </p>
                  </div>
                  <AttivaScuolaControlli
                    scuolaProfiloId={s.id}
                    stato={s.stato}
                    convenzioneFirmataIl={s.convenzione_firmata_il}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="messaggi">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Messaggi delle scuole</h2>
        <p className="mt-1 text-xs text-kireo-muted">Sola lettura, a posteriori — le comunicazioni scuola→studenti non passano da revisione KIREO.</p>
        <p className="mt-3 text-sm text-kireo-light">{testoTotale(totaleMessaggi, pagina, messaggiScuola?.length ?? 0)}</p>
        {!messaggiScuola || messaggiScuola.length === 0 ? (
          <p className="mt-4 text-sm text-kireo-muted">Nessun messaggio inviato finora.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {messaggiScuola.map((m) => {
              const scuolaId = scuolaIdPerProfilo.get(m.scuola_profilo_id);
              const nomeScuola = scuolaId ? nomeScuolaPerCodice.get(scuolaId) : undefined;
              return (
                <li key={m.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">{m.oggetto}</p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {nomeScuola ?? "Scuola"} · {m.destinatari} · {formattaDataOra(m.created_at, "long")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{m.corpo}</p>
                </li>
              );
            })}
          </ul>
        )}
        <Paginazione base="/admin/scuole" pagina={pagina} totale={totaleMessaggi} />
      </section>

    </div>
  );
}
