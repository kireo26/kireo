import { percorsoAperturaGuida, type LivelloGuida } from "@/lib/guide/config";

// Aprire una guida di KIREO passa da UN posto solo, ed è un link al server.
//
// Fino al 10/11 questo bottone scriveva l'apertura in activity_log dal browser e
// poi apriva il PDF: era la riga che il cancello dei livelli 2 e 3 leggeva come
// «l'hai già scaricata», e il client poteva scriversela da sé. Ora l'apertura la
// scrive la route (`/api/guide/<area>/<livello>`, dopo il cancello), che poi
// serve il file: *un registro di attività non è un titolo di accesso*. Qui non
// si scrive niente.
export default function ApriGuidaButton({
  areaSlug,
  livello,
  etichetta,
}: {
  areaSlug: string;
  livello: LivelloGuida;
  etichetta: string;
}) {
  return (
    <a
      href={percorsoAperturaGuida(areaSlug, livello)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-full bg-kireo-green px-4 py-1.5 text-sm font-semibold text-white hover:bg-kireo-green-light"
    >
      {etichetta}
    </a>
  );
}
