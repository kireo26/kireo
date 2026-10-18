-- Le ore PCTO a due decimali (`20261018110000`). Gira anche nel SQL Editor:
-- tutto in una transazione che finisce con ROLLBACK, e il risultato è un
-- `select` invece di un silenzio.
begin;
create temp table esiti (n int, proprieta text, ok boolean, visto text);

-- Un evento e una riga di attività, scritti come service-role.
insert into public.istituzioni (id, nome, slug, stato)
  values ('00000000-0000-0000-0000-00000000a001', 'Ente prova ore', 'ente-prova-ore', 'attiva');
insert into public.eventi (id, titolo, tipo, data_inizio, data_fine, ore_pcto, stato, organizzatore_id, descrizione)
  values ('00000000-0000-0000-0000-00000000e001', 'Webinar di 45 minuti', 'webinar',
          now() - interval '2 hours', now() - interval '75 minutes', 0.75, 'approvato',
          '00000000-0000-0000-0000-00000000a001', 'prova');

-- 1. QUARANTACINQUE MINUTI RESTANO QUARANTACINQUE MINUTI.
insert into esiti select 1, '0,75 si salva come 0,75 (era 0,8)', ore_pcto = 0.75, ore_pcto::text
  from public.eventi where id = '00000000-0000-0000-0000-00000000e001';

-- 2. Anche dall'altra fonte delle ore.
insert into esiti select 2, 'ore_certificate tiene due decimali', numeric_scale = 2, numeric_scale::text
  from information_schema.columns where table_schema = 'public' and table_name = 'student_activities' and column_name = 'ore_certificate';

-- 3. Il TRONCAMENTO SI SPOSTA al terzo decimale, e la migrazione lo dichiara:
-- per questo il form rifiuta più di due decimali.
insert into esiti select 3, 'il terzo decimale si arrotonda ancora (lo rifiuta il form)', (0.755)::numeric(6,2) = 0.76, ((0.755)::numeric(6,2))::text;

-- 4. LA VISTA SOMMA I DUE DECIMALI e non è sparita col drop.
insert into esiti select 4, 'stats_scuola esiste ancora, e ore_pcto_totali è numeric', count(*) = 1, count(*)::text
  from information_schema.columns where table_schema = 'public' and table_name = 'stats_scuola' and column_name = 'ore_pcto_totali';

-- 5. I permessi della vista ricreata: authenticated legge come prima.
insert into esiti select 5, 'authenticated legge ancora stats_scuola', has_table_privilege('authenticated', 'public.stats_scuola', 'select'), '';

-- 6. ESCLUSIONE SCRITTA: activities.ore_pcto non è toccata.
insert into esiti select 6, 'activities.ore_pcto resta com''era (esclusione dichiarata)', numeric_scale = 1, numeric_scale::text
  from information_schema.columns where table_schema = 'public' and table_name = 'activities' and column_name = 'ore_pcto';

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, proprieta, visto from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) as verificate from esiti;
rollback;
