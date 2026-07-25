// Prova sociale sobria: nessun logo (nessun asset disponibile), solo tre
// affermazioni verificabili — coerenti con le regole di business del
// progetto (gratuità per le scuole, mai lessico commerciale, dati
// studenti mai ceduti a terzi).
const PUNTI = [
  "In collaborazione con docenti.it per la formazione continua dei docenti",
  "Gratuito per le scuole superiori, oggi e in futuro",
  "I dati degli studenti restano su KIREO: non vengono mai ceduti a terzi",
];

export default function ProvaSociale() {
  return (
    <section className="border-t border-white/5 bg-kireo-card/40">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <ul className="grid gap-4 sm:grid-cols-3">
          {PUNTI.map((punto) => (
            <li key={punto} className="flex items-start gap-2 text-sm text-kireo-light/90">
              <span className="mt-0.5 text-kireo-orange">✓</span>
              {punto}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
