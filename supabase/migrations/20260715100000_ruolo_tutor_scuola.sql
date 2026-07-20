-- Aggiunge il ruolo "tutor_scuola" a profile_role. Isolata in una migration
-- propria: Postgres non permette di usare un nuovo valore enum nella stessa
-- transazione in cui è stato aggiunto (stesso motivo per cui istituzione/
-- admin sono state aggiunte in una migration a sé, vedi 20260713100000).
alter type public.profile_role add value 'tutor_scuola';
