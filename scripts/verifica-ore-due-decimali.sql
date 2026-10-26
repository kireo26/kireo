-- Le ore PCTO a due decimali (`20261018110000`). Gira anche nel SQL Editor:
-- tutto in una transazione che finisce con ROLLBACK, e il risultato è un
-- `select` invece di un silenzio.
begin;
create temp table esiti (n int, proprieta text, ok boolean, visto text);

-- Un evento e una riga di attività, scritti come service-role.
insert into public.istituzioni (id, nome, slug, stato)
  values ('00000000-0000-0000-0000-00000000a001', 'Ente prova ore', 'ente-prova-ore', 'attiva');
-- ⚠️ LA FINESTRA DURA UN'ORA, NON 45 MINUTI, ED È APPOSTA (26/10). Fino al
-- 26/10 la finestra era di 45 minuti e 0,75 arrivava dall'insert. Da
-- `20261029100000` l'insert ignora `ore_pcto` e scrive la durata: con 45 minuti
-- il trigger avrebbe CONSEGNATO 0,75 da sé, e la proprietà 1 sarebbe rimasta
-- verde anche con una colonna a un decimale — un verde che non può più fallire
-- per il motivo per cui è stato scritto (Mario). Quindi: un'ora (il trigger
-- scrive 1,00, e la 0 lo verifica), poi 0,75 fissato con un update, che è la
-- strada della correzione dell'admin. Finestra e valore dichiarato tornano due
-- cose diverse, e la 1 torna a guardare la colonna.
insert into public.eventi (id, titolo, tipo, data_inizio, data_fine, stato, organizzatore_id, descrizione)
  values ('00000000-0000-0000-0000-00000000e001', 'Webinar di un''ora', 'webinar',
          now() - interval '2 hours', now() - interval '1 hour', 'approvato',
          '00000000-0000-0000-0000-00000000a001', 'prova');
insert into esiti select 0, 'premessa: il trigger ha scritto la durata (1,00), non il valore da provare', ore_pcto = 1.00, ore_pcto::text
  from public.eventi where id = '00000000-0000-0000-0000-00000000e001';
update public.eventi set ore_pcto = 0.75 where id = '00000000-0000-0000-0000-00000000e001';

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
