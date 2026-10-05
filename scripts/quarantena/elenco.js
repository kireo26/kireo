// ⏳ L'ELENCO DELLE FALLE IN QUARANTENA — dati puri, nessuna esecuzione.
//
// Sta in un file a sé perché lo leggono in DUE, e un file che si esegue quando
// lo si importa non si può leggere: `scripts/quarantena.js` lancia le sonde,
// `scripts/verifica-quarantena.js` controlla che l'ELENCO sia integro (e quello
// gira a ogni `npm test`, senza bisogno di un database).
//
// Ogni voce porta: il file della sonda, la data in cui la falla è stata
// trovata, cosa descrive, perché è ancora rossa, la cura prevista, e QUANTE
// proprietà sono rosse oggi — che è il numero su cui si accorge il cambiamento,
// in tutte e due le direzioni.
//
// IL GIORNO DELLA CURA non si scrive niente di nuovo: si toglie la voce da qui,
// si sposta la sonda fuori da `scripts/quarantena/`, e si verifica che diventi
// verde. Se non diventa verde, la cura non è finita.

const QUARANTENA = [
  {
    file: "tentativo-completato-non-congelato.sql",
    data: "2026-10-05",
    falla:
      "Un tentativo di missione `completata` non è congelato: gli ingressi si riscrivono e `registra_evidence` si richiama (performance 30 → 95). Rende decorativa la regola «conta il primo tentativo» del 23/08.",
    perche_rossa:
      "Non è cliccabile, non tocca dati di altri, non produce un valore formale come le ore PCTO: falsifica il proprio ritratto. Si cura in un passaggio solo con le altre, dopo aver finito di guardare le tabelle mute.",
    cura: "Una condizione sullo stato del contenitore nel `with check`/`using` di `step_response`, come su `iscrizioni_eventi`, più la stessa guardia dentro `registra_evidence`.",
    rosse_attese: 3,
  },
  {
    file: "t3-candidate-congelate.sql",
    data: "2026-10-05",
    falla:
      "`__t3_frozen__` è uno stato di sistema che abita una tabella dell'utente: lo studente riscrive le candidate di T3 e ottiene prove d'interesse su aree mai toccate (misurato: `sicurezza-difesa` a 1,0, l'area che il censimento dà a un tag in tutto il motore).",
    perche_rossa: "Stessa ragione della sorella: falsifica il proprio ritratto, e si cura nel passaggio unico.",
    cura: "Il congelamento passa a una SECURITY DEFINER e quell'`item_id` è vietato al client — un posto diverso, non una clausola. Resta aperta la domanda se `test_response` sia la casa giusta per una riga che non è una risposta.",
    rosse_attese: 1,
  },
  {
    file: "diario-portfolio-attempt-altrui.sql",
    data: "2026-10-05",
    falla:
      "In `journal_entry` e `portfolio_item` l'`attempt_id` non è vincolato: una riga si appende al tentativo di un altro studente. Specie nuova: una riga che oggi non ha lettori, e domani ne avrà.",
    perche_rossa:
      "Conseguenza oggi nessuna: quelle tabelle non le legge nessuno. Germoglia il giorno in cui si costruisce il portfolio ricco leggendo per `attempt_id` — cioè quando nessuno starà cercando un difetto.",
    cura: "Una riga nel `with check`: l'`attempt_id`, quando c'è, deve essere di un tentativo del chiamante.",
    rosse_attese: 2,
  },
];

module.exports = { QUARANTENA };
