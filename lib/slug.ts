// Slug da un nome libero (es. nome ente): minuscolo, senza accenti, solo
// lettere/numeri separati da trattini. Usato per /istituzioni/[slug].
//
// Gli accenti si tolgono filtrando i codepoint dei segni diacritici
// combinanti (0x0300-0x036f) dopo la decomposizione NFD, invece di un
// range Unicode scritto come escape in una regex — più esplicito e senza
// rischio di refusi sui codepoint.
export function generaSlug(testo: string): string {
  const senzaAccenti = Array.from(testo.normalize("NFD"))
    .filter((carattere) => {
      const codice = carattere.codePointAt(0) ?? 0;
      return codice < 0x0300 || codice > 0x036f;
    })
    .join("");

  return senzaAccenti
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
