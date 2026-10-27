import Link from "next/link";
import { formattaDataOra } from "@/lib/formato";
import { ETICHETTA_STATO, ETICHETTA_TIPO, type EventoEnte } from "@/lib/ente/eventiEnte";

// UNA RIGA DELL'ELENCO DEGLI EVENTI DI UN ENTE (Mario, 27/10): pastiglia di
// stato, titolo, data e ora, tipo, area, «Apri» — nient'altro. Tutto il resto
// (la console della diretta, la domanda finale, la chiusura, il report, il
// registro dei docenti, la messa in evidenza) sta nella pagina dell'evento.
// Nei passati, sotto, una riga sola: com'è andata.
//
// La stessa riga serve la coda dell'admin (27/10), con `ente`: su un elenco di
// tutti gli enti chi ha proposto l'evento è metà dell'informazione. Un nome
// assente è «KIREO» (un evento senza organizzatore è nostro), come altrove.
//
// ⚠️ UNO STATO CHE LA TABELLA NON CONOSCE SI MOSTRA COL SUO NOME: fino al
// 27/10 ricadeva sulla pastiglia «Bozza», cioè diceva una cosa falsa.
export default function RigaEventoEnte({
  evento,
  area,
  esito,
  ente,
}: {
  evento: EventoEnte;
  area: string | null;
  esito?: string | null;
  ente?: string | null;
}) {
  const stato = ETICHETTA_STATO[evento.stato] ?? { label: evento.stato, classe: "bg-white/10 text-kireo-light" };
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4">
      <div className="min-w-0">
        <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stato.classe}`}>{stato.label}</span>
        <span className="font-heading text-sm font-semibold text-kireo-light">{evento.titolo}</span>
        <p className="mt-1 text-xs text-kireo-muted">
          {ente !== undefined && `${ente ?? "KIREO"} · `}
          {formattaDataOra(evento.data_inizio, "long")} · {ETICHETTA_TIPO[evento.tipo] ?? "Incontro"}
          {area ? ` · ${area}` : ""}
        </p>
        {esito && <p className="mt-1 text-xs text-kireo-light/90">{esito}</p>}
      </div>
      <Link href={`/diretta/${evento.id}`} className="text-sm font-semibold text-kireo-orange underline underline-offset-2">
        Apri
      </Link>
    </li>
  );
}
