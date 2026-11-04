-- verifica-assistente-richieste-lettura.sql — lo studente legge le proprie
-- domande all'assistente, e solo quelle (20261210110000). Solo replica:
-- `npm run sql:tutti`.
begin;
create temp table esiti (n int, prova text, atteso text, visto text, ok boolean);
grant all on esiti to authenticated;

insert into auth.users (id, email) values
  ('44444444-0000-0000-0000-0000000000b1', 'ar-uno@prova.invalid'),
  ('44444444-0000-0000-0000-0000000000b2', 'ar-due@prova.invalid');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('44444444-0000-0000-0000-0000000000b1', 'studente', 'Uno', 'Prova', '2008-01-01'),
  ('44444444-0000-0000-0000-0000000000b2', 'studente', 'Due', 'Prova', '2008-01-01');
-- Scritte da postgres: la prova riguarda la lettura, non il tetto.
insert into public.assistente_richieste (student_id) values
  ('44444444-0000-0000-0000-0000000000b1'),
  ('44444444-0000-0000-0000-0000000000b1'),
  ('44444444-0000-0000-0000-0000000000b2');

select set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000b1', true);
do $$
declare v int;
begin
  set local role authenticated;
  select count(*) into v from public.assistente_richieste;
  reset role;
  insert into esiti values (1, 'lo studente legge le sue due domande, e non quella dell''altro', '2', v::text, v = 2);
exception when others then
  reset role;
  insert into esiti values (1, 'lo studente legge le sue due domande, e non quella dell''altro', '2', sqlstate, false);
end $$;

do $$
begin
  set local role authenticated;
  perform id from public.assistente_richieste limit 1;
  reset role;
  insert into esiti values (2, 'l''id resta chiuso (nel file non serve)', '42501', 'riuscita', false);
exception when insufficient_privilege then
  reset role;
  insert into esiti values (2, 'l''id resta chiuso (nel file non serve)', '42501', '42501', true);
end $$;

insert into esiti select 3, 'anon non legge la tabella', 'false',
  has_column_privilege('anon', 'public.assistente_richieste', 'created_at', 'SELECT')::text,
  not has_column_privilege('anon', 'public.assistente_richieste', 'created_at', 'SELECT');
-- Il controllo: la scrittura del tetto resta com'era.
insert into esiti select 4, 'lo studente scrive ancora student_id (il tetto)', 'true',
  has_column_privilege('authenticated', 'public.assistente_richieste', 'student_id', 'INSERT')::text,
  has_column_privilege('authenticated', 'public.assistente_richieste', 'student_id', 'INSERT');

select n, prova, atteso, visto, case when ok then '✓' else '✗ ROTTA' end from esiti order by n;
select count(*) filter (where not ok) || ' ROTTE' from esiti;
rollback;
