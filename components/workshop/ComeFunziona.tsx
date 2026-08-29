// I cinque passi raccontano il giro VERO: l'elaborato a tappe. Il salvataggio
// automatico e il tutor su richiesta li dice già il blocco «Il tuo progetto
// online» dentro la pagina del ruolo: qui non si ripetono, così le due schede
// non finiscono per dire la stessa cosa in due modi diversi.
const PASSI = [
  { titolo: "Scegli il tuo ruolo", testo: "coprirai una delle 5 aree del progetto. Se cambi idea puoi lasciarlo e prenderne un altro." },
  { titolo: "Conosci il cliente", testo: "ha vincoli precisi e non li molla. Prima di scrivere, chiedigli quello che ti serve." },
  { titolo: "Lavora a tappe", testo: "quattro consegne, una alla volta. Ogni tappa si costruisce su quella prima." },
  { titolo: "Fatti dire cosa non torna", testo: "a ogni tappa un tutor legge quello che hai scritto, e il cliente reagisce." },
  { titolo: "Chiudi il progetto", testo: "all'ultima tappa arriva il giudizio sull'intero lavoro." },
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
      <p className="mt-4 text-sm text-kireo-muted">Non serve essere esperti: la guida del tuo ruolo ti dà i dati e il metodo.</p>
    </div>
  );
}
