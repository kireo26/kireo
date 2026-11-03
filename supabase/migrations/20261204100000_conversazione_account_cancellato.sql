-- Una parola nuova per lo stato di una conversazione con un ente (Mario, 03/11):
-- quando lo studente cancella l'account la conversazione RESTA (è un fatto, e
-- metà l'ha scritta l'ente), e si chiude con uno stato suo. «Chiusa da KIREO»
-- o «bloccata dallo studente» direbbero una cosa falsa.
--
-- Da sola e prima di 20261204110000: un valore nuovo di un enum non si usa
-- nella transazione che lo aggiunge.
alter type public.conversazione_ente_stato add value if not exists 'account_cancellato';
