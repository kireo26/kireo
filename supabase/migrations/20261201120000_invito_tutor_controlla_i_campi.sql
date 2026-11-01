-- 20261201120000 — L'INVITO DI UN TUTOR CONTROLLA NOME ED EMAIL (dopo 20261201100000, prima del deploy)
--
-- Il passo 5.3 (01/11). Il modulo affiancava «Nome e cognome» e «Email
-- (facoltativa…)», e si leggeva «Nome | Cognome»: Mario ci ha scritto Anna e
-- Montefusco. Il modulo ora li mette uno sotto l'altro e controlla l'email, e il
-- database ripete il controllo, perché il client non è l'unica strada verso la
-- funzione. Il controllo è lo stesso di lib/scuola/invitoTutor.ts
-- (FORMA_EMAIL_INVITO): largo, una @ e un punto dopo, niente spazi.
--
-- Ricrea crea_invito_tutor com'è in 20261201100000 (definer, il codice lungo),
-- più i due controlli. Va applicata DOPO 20261201100000, che crea
-- genera_codice_invito_tutor.
create or replace function public.crea_invito_tutor(p_nome text, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codice text;
  v_nome text := nullif(trim(coalesce(p_nome, '')), '');
  v_email text := nullif(trim(coalesce(p_email, '')), '');
begin
  if public.current_ruolo_staff() is distinct from 'referente' then
    raise exception 'non_autorizzato';
  end if;

  if v_nome is null then
    raise exception 'nome_mancante';
  end if;
  if length(v_nome) > 120 then
    raise exception 'nome_troppo_lungo';
  end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email_non_valida';
  end if;

  v_codice := public.genera_codice_invito_tutor();

  insert into public.school_staff (scuola_profilo_id, ruolo_staff, user_id, codice_invito, nome_invitato, email_invitato, creato_da)
  values (public.current_scuola_profilo_id(), 'tutor', null, v_codice, v_nome, v_email, auth.uid());

  return v_codice;
end;
$$;
revoke all on function public.crea_invito_tutor(text, text) from public, anon;
grant execute on function public.crea_invito_tutor(text, text) to authenticated;

comment on function public.crea_invito_tutor(text, text) is
  '20261201120000: definer, il codice lo scrive solo lei (64 bit), e controlla nome ed email.';

do $$
begin
  if obj_description('public.crea_invito_tutor(text, text)'::regprocedure) not like '20261201120000:%' then
    raise exception 'crea_invito_tutor non è quella di 20261201120000';
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.crea_invito_tutor(text, text)'::regprocedure) then
    raise exception 'crea_invito_tutor non è definer';
  end if;
end $$;
