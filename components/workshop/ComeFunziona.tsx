const PASSI = [
  { titolo: "Scegli il tuo ruolo", testo: "coprirai una delle 5 aree del progetto. Un ruolo per persona." },
  { titolo: "Apri il kit", testo: "dentro trovi una guida, un template da compilare e un esempio già svolto." },
  { titolo: "Costruisci la tua consegna", testo: "segui il template, non partire dal foglio bianco." },
  { titolo: "Parla con il cliente", testo: "nella chat portagli i tuoi dati e le tue idee. È esigente: va convinto." },
  { titolo: "Carica la consegna", testo: "ricevi un feedback automatico e il punteggio sulla tua area." },
];

export default function ComeFunziona() {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Come funziona</h2>
      <ol className="mt-4 space-y-3">
        {PASSI.map((passo, indice) => (
          <li key={passo.titolo} className="flex gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-kireo-green/15 text-xs font-semibold text-kireo-green-light">
              {indice + 1}
            </span>
            <p className="text-sm text-kireo-light/90">
              <span className="font-semibold text-kireo-light">{passo.titolo}</span> — {passo.testo}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-kireo-muted">Non serve essere esperti: il kit ti guida passo per passo.</p>
    </div>
  );
}
