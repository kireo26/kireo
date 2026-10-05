import type { ProssimaTappa } from "@/lib/percorso/prossimaTappa";

// «Il tuo percorso»: indica il PASSO SUCCESSIVO CONSIGLIATO (guida → test →
// missioni → workshop). Componente presentazionale: il testo (gli otto stati) è
// deciso a monte da getProssimaTappa, l'unica fonte di verità dello stato del
// percorso.
//
// QUI C'ERA UNA RIGA che dichiarava il percorso interamente aperto — «consiglia
// e non impone, tutto è solo suggerito» — ed era vera fino al 2026-09-20. Da
// quella data due dei gradini sono cancelli veri (le missioni si aprono con i
// tre test, i workshop dopo un'esperienza): le prime cinque tappe restano
// consigli, le ultime due no. La riga non si rimette, e non si riproduce
// nemmeno per citarla — `npm run test:cancelli` la cerca alla lettera qui e nel
// motore, quindi una citazione la farebbe diventare rossa su codice giusto.
// `tappa` può essere null solo se la lettura del passo è andata in eccezione
// (`getPassoCorrente` lo registra e lo dichiara). In pratica non succede:
// `getProssimaTappa` degrada già da sé al primo gradino su qualunque
// errore di lettura. Qui non si ripete quella frase come ripiego — sarebbe una
// seconda copia della stessa istruzione, e la seconda copia è quella che un
// giorno nessuno aggiorna.
export default function CardProssimaTappa({ tappa }: { tappa: ProssimaTappa | null }) {
  if (!tappa) return null;
  return (
    <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-card p-6">
      <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Il tuo percorso</p>
      <p className="text-sm leading-relaxed text-kireo-light/90">{tappa.testo}</p>
      {/* La seconda riga esiste solo per chi ha presenze certificate, e solo sul
          primo gradino: altrove non c'è nessuna contraddizione da sciogliere.
          Decisa a monte come il testo — qui non si sceglie, si rende. */}
      {tappa.nota && <p className="mt-2 text-xs leading-relaxed text-kireo-muted">{tappa.nota}</p>}
    </div>
  );
}
