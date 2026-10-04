-- Due valori nuovi di notifica_tipo, in una migrazione ISOLATA perché un
-- valore enum appena creato non si può usare nella stessa transazione in cui
-- è stato creato (stesso vincolo Postgres già incontrato in
-- 20260713100000_ruolo_istituzione_admin.sql, 20260727210000_notifica_tipo_proposte.sql,
-- 20260809090000_notifica_tipo_workshop.sql).
--
-- DUE E NON UNO, e la differenza conta: «pronta» dice all'ente che può
-- preparare la trasmissione, «cambiata» dice che la chiave che aveva non
-- funziona più. Un solo valore che dicesse «pronta» anche a una rotazione
-- lascerebbe l'ente a provare con quella vecchia — e una chiave vecchia che
-- resta a schermo è peggio di nessuna chiave, perché ci si prova e non va.
alter type public.notifica_tipo add value 'chiave_trasmissione_pronta';
alter type public.notifica_tipo add value 'chiave_trasmissione_cambiata';
