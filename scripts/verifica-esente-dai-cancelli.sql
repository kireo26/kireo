-- Verifica di 20261031100000_esente_dai_cancelli.sql (Mario, 27/10, strada (b)):
-- «fuori dai conti» e «esente dai cancelli» sono due colonne, il valore di
-- partenza di di_prova è vero, e nessuno si marca o si esenta da sé — né
-- all'update né all'insert.
--
-- PERCHÉ ESISTE: fino al 27/10 il trigger era provato solo da
-- `verifica-flag-di-prova.sql`, che è una diagnostica da leggere e non una
-- prova; e copriva solo l'update. La porta dell'insert (la policy
-- `profiles_insert_own`) non la guardava nessuno.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA la migrazione: la colonna
-- e le funzioni non esistono, e lo script muore alla prima — rosso per crash.
-- Quella che conta è la seconda: con il trigger riportato al solo UPDATE
-- (`before update`), la 3 e la 4 diventano rosse.
--
-- Transazione con ROLLBACK. Le colonne dicono «negato»/«concesso» e non f/t:
-- `verifica-sql-tutti.sh` legge una `f` in fondo a una riga come un booleano falso.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000e1', 'nuovo-ec@test.it'),
  ('11111111-0000-0000-0000-0000000000e2', 'stud-ec@test.it'),
  ('11111111-0000-0000-0000-0000000000e3', 'admin-ec@test.it'),
  ('11111111-0000-0000-0000-0000000000e4', 'altro-ec@test.it');
-- Seminati come postgres (auth.uid() NULL): il trigger li lascia passare.
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000e2', 'studente', 'S', 'Tud', '2008-01-01'),
  ('11111111-0000-0000-0000-0000000000e3', 'admin', 'Ad', 'Min', '1980-01-01'),
  ('11111111-0000-0000-0000-0000000000e4', 'studente', 'Al', 'Tro', '2008-01-01');

-- Esegue `sql` come `chi`, collegato. Restituisce 'riuscito' o l'errore.
create function pg_temp.come(chi uuid, sql text) returns text language plpgsql as $$
declare v text := 'riuscito';
begin
  perform set_config('request.jwt.claim.sub', chi::text, true);
  set local role authenticated;
  begin
    execute sql;
  exception when others then v := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end $$;

-- 1) Il valore di partenza: un profilo che nasce senza dire niente è di prova e non esente.
insert into esiti select 1, 'un profilo nuovo nasce di prova e non esente', 'di_prova/non_esente',
  format('%s/%s', case when di_prova then 'di_prova' else 'non_di_prova' end, case when esente_cancelli then 'esente' else 'non_esente' end),
  di_prova and not esente_cancelli
  from public.profiles where id = '11111111-0000-0000-0000-0000000000e2';

-- 2) Il default della colonna È la funzione: il giorno dell'apertura si rovescia in un posto solo.
insert into esiti select 2, 'il default di di_prova è di_prova_di_partenza(), che oggi vale vero', 'di_prova_di_partenza()/vero',
  format('%s/%s', pg_get_expr(d.adbin, d.adrelid), case when public.di_prova_di_partenza() then 'vero' else 'falso' end),
  pg_get_expr(d.adbin, d.adrelid) like '%di_prova_di_partenza()%' and public.di_prova_di_partenza()
  from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'public.profiles'::regclass and a.attname = 'di_prova';

-- 3) LA PORTA DELL'INSERT: chi crea il proprio profilo e prova a scrivere
--    di_prova falso ed esente vero è RESPINTO (dal 27/10, 20261105100000: le
--    due colonne non sono più concesse al client). Fino al 27/10 l'insert
--    riusciva e il trigger rimetteva i valori; con la colonna tolta l'insert
--    falliva e il `select … from profiles` qui sotto non trovava righe, quindi
--    la proprietà SPARIVA dall'uscita e il lanciatore la contava verde (il
--    modo 2). Per questo la riga dell'esito ora si scrive sempre.
do $$
declare r text; v_di_prova boolean; v_esente boolean;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000e1',
    $q$insert into public.profiles (id, ruolo, nome, cognome, data_nascita, di_prova, esente_cancelli)
       values ('11111111-0000-0000-0000-0000000000e1', 'studente', 'N', 'Uovo', '2008-01-01', false, true)$q$);
  insert into esiti values (3, 'insert del proprio profilo con esente=vero, di_prova=falso: respinto',
    'permission denied', r, r like 'permission denied%');
end $$;

-- 3bis) …e lo stesso insert senza le due colonne riesce, e nasce di prova e
--      non esente: la cura non deve rompere la registrazione.
do $$
declare r text; v_di_prova boolean; v_esente boolean;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000e1',
    $q$insert into public.profiles (id, ruolo, nome, cognome, data_nascita)
       values ('11111111-0000-0000-0000-0000000000e1', 'studente', 'N', 'Uovo', '2008-01-01')$q$);
  select di_prova, esente_cancelli into v_di_prova, v_esente
  from public.profiles where id = '11111111-0000-0000-0000-0000000000e1';
  insert into esiti values (10, 'insert del proprio profilo senza le due colonne: riuscito, di prova e non esente',
    'riuscito/di_prova/non_esente',
    format('%s/%s/%s', r, case when v_di_prova then 'di_prova' when v_di_prova is null then '(nessuna riga)' else 'non_di_prova' end,
           case when v_esente then 'esente' else 'non_esente' end),
    r = 'riuscito' and coalesce(v_di_prova, false) and not coalesce(v_esente, true));
end $$;

-- 4) L'update di sé: né si esenta né esce dai conti. Dal 27/10 (20261105100000)
--    perché è respinto, non perché il trigger rimette i valori in silenzio: la
--    proprietà lo dice, così un ritorno al silenzio fa rosso.
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000e2',
    $q$update public.profiles set esente_cancelli = true, di_prova = false where id = '11111111-0000-0000-0000-0000000000e2'$q$);
  insert into esiti select 4, 'update di sé con esente=vero, di_prova=falso: respinto, resta di prova e non esente',
    'permission denied/di_prova/non_esente',
    format('%s/%s/%s', r, case when di_prova then 'di_prova' else 'non_di_prova' end, case when esente_cancelli then 'esente' else 'non_esente' end),
    r like 'permission denied%' and di_prova and not esente_cancelli
    from public.profiles where id = '11111111-0000-0000-0000-0000000000e2';
end $$;

-- 5) La via prescritta: una connessione privilegiata (SQL Editor, service_role,
--    auth.uid() NULL) esenta un altro profilo. ⚠️ MISURATO il 27/10: un admin
--    collegato dal client NON può — `profiles` non ha una policy di update per
--    l'admin, e la RLS filtra la riga senza errore (il modo 11). Il ramo «admin»
--    del trigger oggi non ha un chiamante: si marca e si esenta dal SQL Editor,
--    come dicono già i messaggi del banco.
update public.profiles set esente_cancelli = true where id = '11111111-0000-0000-0000-0000000000e4';
insert into esiti select 5, 'una connessione privilegiata esenta un altro profilo', 'esente',
  case when esente_cancelli then 'esente' else 'non_esente' end, esente_cancelli
  from public.profiles where id = '11111111-0000-0000-0000-0000000000e4';

-- 6) Il predicato legge la colonna nuova, non di_prova: e2 è di prova e non esente.
insert into esiti select 6, 'e_esente_dai_cancelli: falso per un di prova non esente, vero per un esente', 'falso/vero',
  format('%s/%s',
    case when public.e_esente_dai_cancelli('11111111-0000-0000-0000-0000000000e2') then 'vero' else 'falso' end,
    case when public.e_esente_dai_cancelli('11111111-0000-0000-0000-0000000000e4') then 'vero' else 'falso' end),
  not public.e_esente_dai_cancelli('11111111-0000-0000-0000-0000000000e2')
    and public.e_esente_dai_cancelli('11111111-0000-0000-0000-0000000000e4');

-- 7) Il cancello legge il predicato nuovo (l'esecuzione la prova verifica-tetto-workshop.sql, 0 e 11).
insert into esiti select 7, 'puo_iscriversi_a_un_workshop chiama e_esente_dai_cancelli e non e_profilo_di_prova', 'esente/non di prova',
  format('%s/%s',
    case when prosrc like '%e_esente_dai_cancelli%' then 'esente' else 'manca' end,
    case when prosrc like '%e_profilo_di_prova%' then 'di prova' else 'non di prova' end),
  prosrc like '%e_esente_dai_cancelli%' and prosrc not like '%e_profilo_di_prova%'
  from pg_proc where oid = 'public.puo_iscriversi_a_un_workshop()'::regprocedure;

-- 8) stato_tetto_workshop non porta più la colonna che nessuno leggeva.
insert into esiti select 8, 'stato_tetto_workshop senza la colonna esente', 'assente',
  case when 'esente' = any(proargnames) then 'presente' else 'assente' end,
  not ('esente' = any(proargnames))
  from pg_proc where oid = 'public.stato_tetto_workshop()'::regprocedure;

-- 9) Il predicato lo esegue solo la service-role.
insert into esiti select 9, 'e_esente_dai_cancelli: anon e authenticated negati, service_role concesso', 'negato/negato/concesso',
  concat_ws('/',
    case when has_function_privilege('anon', p, 'execute') then 'concesso' else 'negato' end,
    case when has_function_privilege('authenticated', p, 'execute') then 'concesso' else 'negato' end,
    case when has_function_privilege('service_role', p, 'execute') then 'concesso' else 'negato' end),
  not has_function_privilege('anon', p, 'execute')
    and not has_function_privilege('authenticated', p, 'execute')
    and has_function_privilege('service_role', p, 'execute')
  from (select 'public.e_esente_dai_cancelli(uuid)'::regprocedure p) x;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
