import { TEST_ATTIVO } from "@/lib/test/config";

// Nota di rotta — NON compete per il «cosa faccio adesso» (voce sola: il blocco
// affinità in cima, con la sua CTA per stato). Nessun bottone, nessun link al
// test. Dà solo il preavviso onesto che a settembre arriverà un'altra lettura,
// così chi si chiede «è tutto qui?» sa che no.
//
// ⚠️ STRINGA DATATA. La frase sul test a settembre è legata a TEST_ATTIVO
// (lib/test/config.ts): si spegne da sola quando il test va live. NON è «test
// attitudinale» di proposito — non sappiamo ancora cosa dirà davvero, e
// «attitudinale» prometterebbe più di quanto possiamo mantenere.
export default function CardProssimaTappa() {
  return (
    <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-card p-6">
      <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Il tuo percorso</p>
      <p className="text-sm leading-relaxed text-kireo-light/90">
        Le missioni costruiscono le tue affinità.
        {!TEST_ATTIVO && " A settembre arriva anche il test, che aggiungerà una lettura diversa."}
      </p>
    </div>
  );
}
