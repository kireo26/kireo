-- verifica-profilo-di-prova-chiusa.sql — e_profilo_di_prova la esegue solo il
-- server (20261210100000). Solo replica: lancia `npm run sql:tutti`.
begin;
create temp table esiti (n int, prova text, atteso text, visto text, ok boolean);

insert into esiti select 1, 'anon non esegue e_profilo_di_prova', 'false',
  has_function_privilege('anon', 'public.e_profilo_di_prova(uuid)', 'execute')::text,
  not has_function_privilege('anon', 'public.e_profilo_di_prova(uuid)', 'execute');
insert into esiti select 2, 'authenticated non esegue e_profilo_di_prova', 'false',
  has_function_privilege('authenticated', 'public.e_profilo_di_prova(uuid)', 'execute')::text,
  not has_function_privilege('authenticated', 'public.e_profilo_di_prova(uuid)', 'execute');
-- I controlli: chi la chiama davvero deve poterla ancora chiamare.
insert into esiti select 3, 'service_role la esegue (il cron)', 'true',
  has_function_privilege('service_role', 'public.e_profilo_di_prova(uuid)', 'execute')::text,
  has_function_privilege('service_role', 'public.e_profilo_di_prova(uuid)', 'execute');
insert into esiti select 4, 'segnala_player_live, che la chiama, resta definer', 'true',
  (select prosecdef::text from pg_proc where proname = 'segnala_player_live'),
  (select bool_and(prosecdef) from pg_proc where proname = 'segnala_player_live');

-- Il gesto, non solo il catalogo: chiamata da collegato, a voce alta.
do $$
begin
  set local role authenticated;
  perform public.e_profilo_di_prova(gen_random_uuid());
  reset role;
  insert into esiti values (5, 'un collegato che la chiama riceve 42501', '42501', 'riuscita', false);
exception when insufficient_privilege then
  reset role;
  insert into esiti values (5, 'un collegato che la chiama riceve 42501', '42501', '42501', true);
end $$;

select n, prova, atteso, visto, case when ok then '✓' else '✗ ROTTA' end from esiti order by n;
select count(*) filter (where not ok) || ' ROTTE' from esiti;
rollback;
