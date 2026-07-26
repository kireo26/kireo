import Link from "next/link";
import { finestraDirettaVisibile } from "@/lib/live";

// Condiviso studenti/docenti (stessa pagina live parametrizzata lato
// server, vedi app/app/eventi/[id]/live e app/docente/webinar/[id]/live).
// Visibile solo a chi è iscritto, solo nella finestra della diretta (da 15
// minuti prima dell'inizio alla chiusura). Se l'id del video manca ancora
// (hosting_diretta=kireo non ancora programmato, o kill switch admin) resta
// un testo onesto invece di un link morto.
export default function EntraDirettaLink({
  href,
  dataInizio,
  dataFine,
  youtubeVideoId,
  iscritto,
}: {
  href: string;
  dataInizio: string;
  dataFine: string | null;
  youtubeVideoId: string | null;
  iscritto: boolean;
}) {
  if (!iscritto || !finestraDirettaVisibile(dataInizio, dataFine)) return null;

  if (!youtubeVideoId) {
    return <p className="mt-3 text-xs text-kireo-muted">Diretta in preparazione: il link comparirà a breve.</p>;
  }

  return (
    <Link
      href={href}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-kireo-orange px-4 py-2 text-xs font-semibold text-kireo-dark transition-colors hover:bg-kireo-orange/90"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-kireo-dark" /> Entra nella diretta
    </Link>
  );
}
