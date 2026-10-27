-- Verifica di 20261103110000 (Mario, 27/10): il limite delle aree di un ente
-- dipende dal tipo (universita 6, gli altri 3), da un posto solo.
--
-- CONTROPROVA: su una replica nata senza la migrazione sono rosse la 1, la 3
-- e la 4 (la funzione non c'è, e l'università si ferma a 3). La 2 e la 5 sono
-- verdi anche prima: sono il comportamento di prima, che non deve cambiare.
--
-- Transazione con ROLLBACK. Le aree le scrive l'ente dalla propria sessione,
-- come il form.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000a1', 'uni-aree@test.it'),
  ('11111111-0000-0000-0000-0000000000a2', 'its-aree@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000a1', 'istituzione', 'U', 'Ni', '1980-01-01'),
  ('11111111-0000-0000-0000-0000000000a2', 'istituzione', 'I', 'Ts', '1980-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Uni Aree', 'uni-aree', 'universita', 'attiva'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'ITS Aree', 'its-aree', 'its', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1'),
  ('11111111-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a2');

-- Quante aree riesce a dichiarare ciascuno, provando la stessa lista di sette.
create or replace function pg_temp.dichiara(p_user uuid, p_ist uuid) returns integer language plpgsql as $$
declare
  v_slug text;
  v_fatte integer := 0;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  foreach v_slug in array array['informatica-digitale', 'salute-professioni-sanitarie', 'economia-management',
    'giurisprudenza-pa', 'scienze-ricerca', 'lingue-relazioni-internazionali', 'studi-umanistici-beni-culturali'] loop
    begin
      insert into public.istituzioni_aree (istituzione_id, area_slug) values (p_ist, v_slug);
      v_fatte := v_fatte + 1;
    exception
      when unique_violation then null; -- già dichiarata: non conta
      when others then
        if sqlerrm <> 'troppe_aree_istituzione' then raise; end if;
    end;
  end loop;
  return v_fatte;
end $$;
grant execute on function pg_temp.dichiara(uuid, uuid) to authenticated;

do $$
declare
  v_uni integer; v_its integer; v_max_uni text; v_max_its text; v_esiste boolean;
begin
  v_esiste := to_regprocedure('public.max_aree_istituzione(uuid)') is not null;
  set local role authenticated;
  v_uni := pg_temp.dichiara('11111111-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1');
  v_its := pg_temp.dichiara('11111111-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a2');
  if v_esiste then
    perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a1', true);
    execute 'select public.max_aree_istituzione($1)::text' into v_max_uni using 'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid;
    execute 'select public.max_aree_istituzione($1)::text' into v_max_its using 'aaaaaaaa-0000-0000-0000-0000000000a2'::uuid;
  end if;
  reset role;
  insert into esiti values (1, 'il limite si chiede a una funzione sola (quella che il form chiama)', 'esiste',
    case when v_esiste then 'esiste' else 'assente' end, v_esiste);
  insert into esiti values (2, 'un ITS si ferma a 3 aree, come prima', '3', v_its::text, v_its = 3);
  insert into esiti values (3, 'un''università arriva a 6', '6', v_uni::text, v_uni = 6);
  insert into esiti values (4, 'la funzione dice al form lo stesso numero che il trigger applica', '6 / 3',
    coalesce(v_max_uni, '?') || ' / ' || coalesce(v_max_its, '?'), v_max_uni = '6' and v_max_its = '3');
end $$;

-- 5 · un'area rifiutata non conta: l'ITS, con una rifiutata, ne dichiara ancora una.
do $$
declare v_dopo integer;
begin
  update public.istituzioni_aree set stato = 'rifiutata'
  where istituzione_id = 'aaaaaaaa-0000-0000-0000-0000000000a2' and area_slug = 'informatica-digitale';
  set local role authenticated;
  v_dopo := pg_temp.dichiara('11111111-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a2');
  reset role;
  insert into esiti values (5, 'un''area rifiutata libera un posto', '1', v_dopo::text, v_dopo = 1);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
