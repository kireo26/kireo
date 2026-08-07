-- Workshop 2.0 v2 (percorso a tappe gated): due nuovi tipi di notifica per
-- il cron del motore (revisione+reazione del cliente pronte, nuova tappa
-- aperta). Migration isolata perché un valore enum appena aggiunto non può
-- essere usato nella stessa transazione in cui viene creato (stesso
-- vincolo Postgres già incontrato più volte nel progetto, es.
-- 20260713100000_ruolo_istituzione_admin.sql, 20260727210000_notifica_tipo_proposte.sql).
alter type public.notifica_tipo add value 'workshop_tappa_revisionata';
alter type public.notifica_tipo add value 'workshop_tappa_aperta';
