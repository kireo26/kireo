-- Livello social (2/8): regolamento enti. Accettazione obbligatoria alla
-- registrazione (nuovi enti) e bloccante al primo accesso per gli enti già
-- esistenti (nessuna migration di dati: la colonna nasce nullable, un ente
-- già attivo semplicemente non l'ha ancora accettato finché non passa dal
-- blocco lato app).
--
-- Nessuna nuova RLS necessaria: istituzioni_update_propria (già live,
-- 20260713130000) copre già la scrittura di questa colonna da parte
-- dell'ente sulla propria riga — non è protetta dal trigger
-- blocca_autoescalation_istituzione (che riguarda solo stato/piano_id/
-- piano_attivato_il/piano_scade_il).

alter table public.istituzioni
  add column regolamento_accettato_il timestamptz;

comment on column public.istituzioni.regolamento_accettato_il is
  'Timestamp di accettazione del regolamento enti (/ente/regolamento): obbligatoria alla registrazione (checkbox, impostata da un update lato client subito dopo finalize_registration_istituzione — nessuna modifica alla sua firma, per non ricadere nella trappola dell''overload già documentata) e bloccante al primo accesso per gli enti già esistenti. NULL = non ancora accettato.';
