-- Email degli studenti per la scuola: il nome di uno studente in
-- "Verifica studenti" è autodichiarato e può risultare vuoto (caso reale
-- osservato in produzione) — senza un secondo identificatore il referente
-- non ha modo di distinguere/decidere. auth.users non è mai leggibile
-- direttamente da un client (schema riservato a Supabase Auth): questa
-- funzione espone SOLO l'email (nessun altro campo di auth.users), SOLO
-- per gli user_id richiesti che risultano studenti della scuola del
-- chiamante, SOLO se il chiamante è staff attivo (referente o tutor) di
-- quella scuola. Il filtro è nella clausola WHERE di una SELECT, non in un
-- IF/RAISE: una condizione NULL lì esclude semplicemente la riga (fail
-- closed "per costruzione"), quindi non ricade nella stessa trappola dei
-- confronti <> su current_ruolo_staff() nullable già corretta altrove — ma
-- gli operatori sono comunque scritti in forma esplicita (IS NOT NULL +
-- IN, mai <>) per coerenza con quella lezione.
create or replace function public.email_studenti_scuola(p_user_ids uuid[])
returns table(user_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email
  from auth.users u
  join public.student_profiles sp on sp.user_id = u.id
  where u.id = any(p_user_ids)
    and public.current_ruolo_staff() is not null
    and public.current_ruolo_staff() in ('referente', 'tutor')
    and public.current_scuola_id() is not null
    and sp.school_code = public.current_scuola_id();
$$;

comment on function public.email_studenti_scuola(uuid[]) is
  'Espone solo email (nessun altro campo di auth.users) per gli user_id che sono studenti della scuola del chiamante, solo se il chiamante è referente/tutor attivo di quella scuola. Usata da /scuola/studenti, /scuola/classi e dal registro presenze per mostrare un identificatore affidabile accanto al nome autodichiarato.';

grant execute on function public.email_studenti_scuola(uuid[]) to authenticated;
