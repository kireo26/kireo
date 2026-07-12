import { getAppContext } from "@/lib/app/studentContext";

// Home minima per la Fase 1 (shell): saluto + scuola/classe. Il contenuto
// pieno (radar, PCTO, aree, webinar) arriva in Fase 2.
export default async function AreaPersonaleHome() {
  const contesto = await getAppContext();

  return (
    <div>
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Home</p>
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
        Ciao {contesto.nome}
      </h1>
      {contesto.schoolName && (
        <p className="mt-2 text-kireo-muted">
          {contesto.schoolName}
          {contesto.classe ? ` — ${contesto.classe}` : ""}
        </p>
      )}
    </div>
  );
}
