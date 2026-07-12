import BadgeProfiloPercentuale, { type VoceChecklist } from "./BadgeProfiloPercentuale";

export default function HeaderSaluto({
  nome,
  schoolName,
  classe,
  percentualeProfilo,
  vociProfilo,
}: {
  nome: string;
  schoolName: string | null;
  classe: string | null;
  percentualeProfilo: number;
  vociProfilo: VoceChecklist[];
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-1 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Home</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Ciao {nome}</h1>
        {schoolName && (
          <p className="mt-1 text-kireo-muted">
            {schoolName}
            {classe ? ` — ${classe}` : ""}
          </p>
        )}
      </div>
      <BadgeProfiloPercentuale percentuale={percentualeProfilo} voci={vociProfilo} />
    </div>
  );
}
