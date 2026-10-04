// LE DUE LISTE CHE NESSUNO AGGIORNAVA INSIEME.
//
// Fino al 4/10 vivevano dentro components/app/NotificheBell.tsx, e l'enum
// `notifica_tipo` aveva già sei valori mentre lì ce n'erano quattro: un
// referente scuola che riceveva la risposta a una proposta di incontro
// leggeva `proposta_incontro_risposta` — il nome grezzo del valore enum — e
// il link cadeva sul ripiego `/app`, che è l'area studente, cioè un posto da
// cui sarebbe stato rimbalzato. Vivo da fine luglio.
//
// Stanno in `lib/` e non nel .tsx per la ragione di casa: una cosa composta
// dentro un componente non si può provare da uno script Node, e una
// proprietà dichiarata e non provata è un test che non c'è ancora.
// `npm run test:sonda` confronta questo elenco con i valori dell'enum
// estratti dalle migrazioni, NEI DUE VERSI — un tipo senza etichetta mostra
// il nome grezzo, e un'etichetta senza tipo è una riga che nessuno vedrà mai.
//
// OGNI TIPO APPARTIENE A UN RUOLO SOLO, quindi il link lo decide il tipo e
// non serve sapere chi guarda: lo studente per post/eventi/workshop, l'ente
// per le proposte ricevute e per la chiave di trasmissione, la scuola per la
// risposta a una proposta. Un ripiego unico su `/app` manderebbe un
// referente e un ente in un'area che non è la loro.

export type TipoNotifica =
  | "nuovo_post"
  | "nuovo_evento_ente"
  | "workshop_tappa_revisionata"
  | "workshop_tappa_aperta"
  | "proposta_incontro_ricevuta"
  | "proposta_incontro_risposta"
  | "chiave_trasmissione_pronta"
  | "chiave_trasmissione_cambiata";

export const ETICHETTA_TIPO: Record<TipoNotifica, string> = {
  nuovo_post: "Nuovo post di un ente che segui",
  nuovo_evento_ente: "Nuovo evento di un ente che segui",
  workshop_tappa_revisionata: "Il tuo workshop ha una nuova revisione",
  workshop_tappa_aperta: "Si è aperta una nuova tappa del tuo workshop",
  proposta_incontro_ricevuta: "Una scuola ti ha proposto un incontro",
  proposta_incontro_risposta: "Un ente ha risposto alla tua proposta di incontro",
  chiave_trasmissione_pronta: "La chiave di trasmissione della tua diretta è pronta",
  chiave_trasmissione_cambiata: "La chiave di trasmissione della tua diretta è cambiata",
};

export const LINK_TIPO: Record<TipoNotifica, string> = {
  nuovo_post: "/app/bacheca",
  nuovo_evento_ente: "/app/agenda",
  workshop_tappa_revisionata: "/app/workshop",
  workshop_tappa_aperta: "/app/workshop",
  proposta_incontro_ricevuta: "/ente/eventi",
  proposta_incontro_risposta: "/scuola/esplora",
  chiave_trasmissione_pronta: "/ente/eventi",
  chiave_trasmissione_cambiata: "/ente/eventi",
};
