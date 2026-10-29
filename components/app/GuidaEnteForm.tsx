import ScaricaGuidaForm from "@/components/ScaricaGuidaForm";

// La guida di un ente sulla sua pagina pubblica. Lo scaricamento passa da
// `/api/scarica-guida/ente/[guidaId]`, che registra chi l'ha presa PRIMA di
// mandare il file (29/10): fino ad allora la scrittura stava qui, dopo il
// download, e non partiva quasi mai (vedi `lib/guide/scaricamento.ts`).
// L'indirizzo dell'account lo sa la pagina, che l'ha già letto sul server.
export default function GuidaEnteForm({
  guidaId,
  emailAccount,
  esito,
}: {
  guidaId: string;
  emailAccount: string | null;
  esito: string | null;
}) {
  return <ScaricaGuidaForm azione={`/api/scarica-guida/ente/${guidaId}`} emailAccount={emailAccount} esito={esito} />;
}
