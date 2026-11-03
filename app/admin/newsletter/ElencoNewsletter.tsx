import AzioneApprovazione from "@/components/admin/AzioneApprovazione";
import Ricerca from "@/components/admin/Ricerca";
import Paginazione from "@/components/admin/Paginazione";
import { CRITERI } from "@/lib/admin/coseDaDecidere";
import { intervallo, paginaDa, testoTotale } from "@/lib/admin/pagine";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parolaDiStato } from "@/lib/statoNonRiconosciuto";

export type FiltroNewsletter = "tutte" | "da_approvare" | "approvate" | "rifiutate";

// Una bozza non è ancora stata mandata in approvazione: è dell'ente, e qui non
// c'è. «Approvate» comprende quelle già partite (`inviata`).
const ETICHETTA: Record<string, string> = {
  in_approvazione: "Da approvare",
  approvata: "Approvata",
  inviata: "Partita",
  rifiutata: "Rifiutata",
};

// Dal 30/10 la newsletter nasce in `newsletter_enti`: le proposte di prima in
// `comunicazioni` non le legge più nessuno, e non partono. La quota del piano
// e il giorno pieno li fa rispettare il database quando l'ente manda in
// approvazione: qui non c'è niente da superare.
export default async function ElencoNewsletter({
  supabase,
  filtro,
  base,
  cerca,
}: {
  supabase: SupabaseClient;
  filtro: FiltroNewsletter;
  base: string;
  cerca: { q?: string; pagina?: string };
}) {
  const q = cerca.q?.trim() || undefined;
  const pagina = paginaDa(cerca.pagina);
  const { da, a } = intervallo(pagina);
  let query = supabase
    .from("newsletter_enti")
    .select("id, oggetto, corpo, giorno, ultimo_giorno, stato, nota_revisione, approvata_il, inviata_il, istituzione_id, istituzioni(nome)", { count: "exact" });
  if (filtro === "da_approvare") query = CRITERI.newsletterDaApprovare.filtra(query);
  else if (filtro === "approvate") query = query.in("stato", ["approvata", "inviata"]);
  else if (filtro === "rifiutate") query = query.eq("stato", "rifiutata");
  else query = query.neq("stato", "bozza");
  if (q) query = query.or(`oggetto.ilike.%${q.replace(/[,()]/g, " ")}%,corpo.ilike.%${q.replace(/[,()]/g, " ")}%`);
  // La coda di lavoro va per giorno di partenza, dal più vicino; le altre dal più recente.
  query = filtro === "da_approvare" ? query.order("giorno", { ascending: true }) : query.order("giorno", { ascending: false });
  const { data: newsletter, count, error } = await query.range(da, a);
  if (error) console.error("[admin] newsletter:", descriviErrore(error));
  const totale = error ? null : (count ?? null);

  return (
    <div className="space-y-4">
      <Ricerca base={base} q={q} segnaposto="Cerca nell'oggetto o nel testo" />
      {error ? (
        <p className="text-sm text-red-300">Non siamo riusciti a leggere le newsletter: ricarica la pagina.</p>
      ) : (
        <>
          <p className="text-sm text-kireo-light">{testoTotale(totale, pagina, newsletter?.length ?? 0)}</p>
          {newsletter && newsletter.length > 0 && (
            <ul className="space-y-4">
              {newsletter.map((n) => {
                const ente = Array.isArray(n.istituzioni) ? n.istituzioni[0] : n.istituzioni;
                return (
                  <li key={n.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                    <p className="font-heading text-sm font-semibold text-kireo-light">
                      {n.oggetto}{" "}
                      <span className="ml-1 inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-muted">
                        {parolaDiStato(ETICHETTA, n.stato as string)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-kireo-muted">
                      {ente?.nome ?? "—"} · parte il {formattaData(n.giorno, "long")} alle 7:30 · per email fino al{" "}
                      {formattaData(n.ultimo_giorno, "long")}
                      {n.approvata_il ? ` · approvata il ${formattaData(n.approvata_il as string, "long")}` : ""}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{n.corpo}</p>
                    {n.stato === "rifiutata" && n.nota_revisione && <p className="mt-2 text-xs text-red-300">Nota di revisione: {n.nota_revisione as string}</p>}
                    {n.stato === "in_approvazione" && <AzioneApprovazione cosa="newsletter" id={n.id} />}
                  </li>
                );
              })}
            </ul>
          )}
          <Paginazione base={base} pagina={pagina} totale={totale} q={q} />
        </>
      )}
    </div>
  );
}
