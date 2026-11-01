-- Lo studente rifiutato riceve il motivo (01/11, passo 3 del capitolo della
-- scuola; decisione di Mario). A: le parole, da sole.
--
-- Un valore nuovo di un enum non si usa nella transazione che lo aggiunge:
-- per questo la notifica e la funzione che la scrive stanno in B
-- (20261130110000), in un'esecuzione separata.
--
-- I due motivi sono un ELENCO CORTO E CHIUSO, apposta (Mario): niente testo
-- libero. Un campo in cui una scuola scrive di un suo studente finirebbe
-- davanti a quel ragazzo, scritto da un adulto che non sa di scriverlo a lui.
-- Un motivo nuovo è una migrazione nuova, cioè una decisione, non una frase
-- scritta al volo da un referente.

alter type public.notifica_tipo add value if not exists 'verifica_rifiutata';

create type public.motivo_rifiuto_verifica as enum ('non_risulta_studente', 'scuola_sbagliata');

comment on type public.motivo_rifiuto_verifica is
  '20261130100000: il motivo con cui una scuola rifiuta uno studente che l''ha dichiarata. non_risulta_studente = «Non risulta fra i nostri studenti»; scuola_sbagliata = «Hai scelto la scuola sbagliata». Elenco chiuso: niente testo libero, perché lo legge lo studente.';
