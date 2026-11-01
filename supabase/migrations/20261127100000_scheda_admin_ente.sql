-- LA PAGINA DI UN ENTE NELL'AREA ADMIN (lotto 2 del riordino, 01/11): due cose
-- che l'admin non può leggere dal client, e che la pagina di un ente deve dire.
--
--   a) CHI SEGUE L'ENTE. `seguiti` si legge solo riga per riga dal proprio
--      account (seguiti_select_own), e l'admin non ha una policy: non serve,
--      gli basta il numero. E il numero si dà DIVISO: «Segui» è aperto a
--      chiunque sia collegato (un docente, un altro ente), quindi un conto
--      unico chiamerebbe «studenti» anche chi non lo è. È il fatto che il punto
--      aperto «"Segui" e le notifiche sono aperti a chiunque sia collegato»
--      nomina: la prima statistica che conta i follower li conta divisi.
--   b) GLI ACCOUNT DELL'ENTE: chi entra in quell'area, con nome ed email, cioè
--      a chi arriva l'avviso di una decisione (lib/ente/avvisoDecisione.ts).
--      `institution_profiles` si legge solo dalla propria riga, ed è giusto;
--      qui lo legge l'admin, e nessun altro.
--
-- Una funzione sola, definer, che risponde solo all'admin. Non scrive niente.

create or replace function public.scheda_admin_ente(p_istituzione_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;
  if not exists (select 1 from public.istituzioni where id = p_istituzione_id) then
    return null;
  end if;
  select jsonb_build_object(
    'seguaci_studenti', (
      select count(*) from public.seguiti s join public.profiles p on p.id = s.student_id
      where s.istituzione_id = p_istituzione_id and p.ruolo = 'studente'
    ),
    'seguaci_altri', (
      select count(*) from public.seguiti s join public.profiles p on p.id = s.student_id
      where s.istituzione_id = p_istituzione_id and p.ruolo is distinct from 'studente'
    ),
    'account', coalesce((
      select jsonb_agg(jsonb_build_object('nome', p.nome, 'cognome', p.cognome, 'email', u.email::text, 'dal', ip.created_at) order by ip.created_at)
      from public.institution_profiles ip
      join public.profiles p on p.id = ip.user_id
      left join auth.users u on u.id = ip.user_id
      where ip.istituzione_id = p_istituzione_id
    ), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

comment on function public.scheda_admin_ente(uuid) is
  '20261127100000: per la pagina di un ente nell''area admin. Chi lo segue, diviso fra studenti e altri ruoli, e gli account dell''ente con nome ed email. Solo l''admin; null se l''ente non esiste.';

revoke all on function public.scheda_admin_ente(uuid) from public, anon;
grant execute on function public.scheda_admin_ente(uuid) to authenticated;

-- La rilettura: la funzione c'è, e un visitatore non la esegue.
do $$
begin
  if to_regprocedure('public.scheda_admin_ente(uuid)') is null then
    raise exception '20261127100000: scheda_admin_ente non c''è';
  end if;
  if has_function_privilege('anon', 'public.scheda_admin_ente(uuid)', 'execute') then
    raise exception '20261127100000: anon esegue scheda_admin_ente';
  end if;
end $$;
