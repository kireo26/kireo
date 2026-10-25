// ⚠️⚠️ LA VIA «OSPITATA DA KIREO» NON SI PUÒ SCEGLIERE (decisione di Mario,
// 26/10 sera: l'ente trasmette dal proprio canale YouTube).
//
// Una funzione incompiuta ma selezionabile non è «in arrivo»: è una trappola con
// un'etichetta rassicurante, e il costo lo paga chi si fida dell'elenco delle
// opzioni. È successo il 26/10 a chi il prodotto l'ha costruito: e non per
// sbaglio — era il DEFAULT del form, quindi bastava non toccare niente per
// finire in «chiave di trasmissione: non preparata».
//
// Tolta dalle scelte nel modo che non mente: NON un'opzione grigia (una domanda
// a cui nessuno risponde) e NON cancellata dal codice (il lavoro c'è ed è
// buono: colonna `server`, validazione `rtmp://`, quarto stato della chiave,
// pannello admin). Gli eventi già creati così restano gestibili da KIREO.
//
// LA CONDIZIONE, scritta perché la decisione si possa rovesciare senza
// riscoprire tutto (Mario, parola per parola):
// «La via "ospitata da KIREO" è completa nel database e nei pannelli, e manca
// di tre cose: il testo per l'ente, la verifica dell'indirizzo RTMP su una
// trasmissione vera, e una risposta a come trasmette un ente che non ha OBS.
// Torna selezionabile quando le tre esistono.»
// E quel giorno il default del form si decide di nuovo: non torna «kireo» da sé.
export const HOSTING_KIREO_SELEZIONABILE = false;
