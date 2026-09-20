// Quali tappe una passata NON ha giocato da zero.
//
// PERCHÉ ESISTE. Una passata ripresa non è identica a una pulita, e il banco
// esiste per confrontare passate: se una ripresa entra in un confronto senza
// che si sappia, la differenza si legge come un cambiamento del PRODOTTO. È il
// 19/09: `palestra > legale` è caduto su un `fetch failed` a metà della tappa
// `forma`, la passata è stata ripresa, e nel log non compariva nessuna riga
// «messaggi al cliente» per quella tappa. La spiegazione era innocua — quei
// messaggi erano già stati mandati prima del guasto, quindi non c'era niente
// da rimandare — ma per arrivarci è servito leggere il codice. Il rapporto non
// lo diceva.
//
// «NON HO GUARDATO» NON È «NON CE NE SONO». Un rapporto scritto prima di oggi
// non ha il campo su nessuna tappa, e l'assenza del campo è indistinguibile da
// «nessuna ripresa». Per questo il robot scrive `ripresa: null` anche quando la
// tappa è pulita: la PRESENZA della chiave dice che quella passata sapeva
// guardare. Se manca anche su una sola tappa, si dichiara di non poterlo dire —
// fallisce verso «non lo so», che è la direzione giusta.

// Le riprese di una passata, dai suoi esiti grezzi.
function riprese(esiti) {
  let tappeViste = 0;
  let conCampo = 0;
  const tappe = [];
  for (const e of esiti ?? []) {
    for (const t of e.tappe ?? []) {
      tappeViste++;
      if (!("ripresa" in t)) continue;
      conCampo++;
      if (t.ripresa) tappe.push({ etichetta: e.etichetta, faseId: t.faseId, ...t.ripresa });
    }
  }
  return {
    noto: tappeViste > 0 && conCampo === tappeViste,
    tappeViste,
    tappe,
    ruoli: new Set(tappe.map((t) => t.etichetta)).size,
  };
}

// Cosa vuol dire, in una riga. Il nome dello stato non basta: «consegnata»
// dice al robot che c'è da aspettare solo la revisione, a chi legge non dice
// quale pezzo del lavoro viene da un'altra passata.
function descriviRipresa(r) {
  if (r.trovata === "revisionata") {
    return "era già revisionata: questa passata non l'ha toccata, e i suoi testi non sono fra quelli contati qui";
  }
  if (r.trovata === "consegnata") {
    return "era già consegnata: sezioni, chat e consegna vengono dalla passata di prima — qui si è fatta solo la revisione";
  }
  const pezzi = [];
  if (r.sezioniGia) pezzi.push("le sezioni erano già salvate");
  if (r.chatGia > 0) pezzi.push(`${r.chatGia} ${r.chatGia === 1 ? "messaggio al cliente c'era" : "messaggi al cliente c'erano"} già`);
  return `era aperta, ma ${pezzi.join(" e ")}`;
}

module.exports = { riprese, descriviRipresa };
