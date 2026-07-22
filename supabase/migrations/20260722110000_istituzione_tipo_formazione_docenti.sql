-- Area docente: nuovo tipo di istituzione organizzatrice di webinar per
-- docenti (es. docenti.it). Migration isolata: un valore enum appena
-- aggiunto non può essere usato nella stessa transazione in cui viene
-- creato (stesso vincolo già incontrato per profile_role/school_staff_ruolo
-- altrove in questo schema) — le migration successive che lo usano
-- (seed demo) restano in file separati applicati dopo questo.
alter type public.istituzione_tipo add value 'formazione_docenti';
