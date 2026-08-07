const PUNTI = [
  "Il cliente ha vincoli rigidi (non cede su budget e valori) e margini aperti (si convince con i dati).",
  "Porta numeri ed esempi concreti, non opinioni.",
  "Fai domande: chiedi cosa gli serve davvero.",
  "Se dice di no, non mollare: chiedi perché e riprova con un'altra proposta.",
];

export default function ComeParlareConCliente({ chiusura }: { chiusura: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
      <h2 className="font-heading text-sm font-semibold text-kireo-light">Come parlare con il cliente</h2>
      <ul className="mt-3 space-y-2">
        {PUNTI.map((punto) => (
          <li key={punto} className="flex gap-2 text-sm text-kireo-light/90">
            <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-kireo-orange" />
            {punto}
          </li>
        ))}
        <li className="flex gap-2 text-sm text-kireo-light/90">
          <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-kireo-orange" />
          {chiusura}
        </li>
      </ul>
    </div>
  );
}
