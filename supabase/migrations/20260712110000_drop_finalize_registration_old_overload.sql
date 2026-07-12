-- Rimuove l'overload orfano di finalize_registration a 10 parametri.
--
-- CREATE OR REPLACE FUNCTION con un parametro aggiuntivo in coda (vedi
-- 20260712100000_student_area_interests.sql) non sostituisce una funzione
-- esistente in Postgres: la identità di una funzione è nome + tipi dei
-- parametri, quindi aggiungere un parametro crea un secondo overload
-- invece di rimpiazzare il primo. Verificato dopo l'applicazione di quella
-- migration che il DB reale conteneva infatti entrambe le firme (10 e 11
-- parametri). Nessun codice applicativo chiama più quella a 10 parametri
-- (tutte le chiamate passano anche p_aree_interesse), quindi va rimossa.
drop function public.finalize_registration(
  public.profile_role, text, text, date, text, text, integer, text, boolean, text
);
