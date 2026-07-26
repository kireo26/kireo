-- Proposte di incontro scuola->ente (1/2): due nuovi valori di
-- notifica_tipo, in una migration isolata perché un valore enum appena
-- aggiunto non può essere usato nella stessa transazione in cui viene
-- creato (stesso vincolo Postgres già incontrato per profile_role in
-- 20260713100000). La tabella notifiche_studenti viene riusata così com'è
-- (nessuna nuova colonna): "student_id" diventa qui semanticamente
-- "destinatario_id" — un referente/tutor scuola o il referente di un ente
-- possono ricevere una notifica esattamente come uno studente, la RLS
-- (student_id = auth.uid()) copre già qualunque ruolo autenticato senza
-- bisogno di modifiche.
alter type public.notifica_tipo add value 'proposta_incontro_ricevuta';
alter type public.notifica_tipo add value 'proposta_incontro_risposta';
