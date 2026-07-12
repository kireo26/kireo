-- Estensioni al profilo (Fase 6 dell'area studente): telefono modificabile
-- e autoeliminazione dell'account.

alter table public.profiles add column telefono text;

comment on column public.profiles.telefono is
  'Facoltativo, modificabile dallo studente in Profilo. Non popolato al signup (vedi CLAUDE.md) per evitare di ridefinire finalize_registration con un parametro aggiuntivo (rischio di overload duplicato, vedi migration 20260712110000).';

-- Autoeliminazione account: cancella l'utente da auth.users. Le cascade FK
-- già esistenti (profiles -> student_profiles/student_area_interests/
-- student_activities, e webinar_registrations dalla Fase 4) ripuliscono
-- tutto il resto nella stessa transazione, senza bisogno di cancellarle
-- esplicitamente qui.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'non_autenticato';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

-- Esplicito invece di affidarsi ai soli privilegi di default: solo
-- authenticated può chiamarla (mai anon, che comunque fallirebbe per il
-- controllo su auth.uid() ma è più chiaro revocarlo qui).
revoke execute on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
