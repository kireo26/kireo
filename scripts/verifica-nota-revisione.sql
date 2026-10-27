-- Verifica di 20261101100000_nota_revisione_per_chi_la_riceve.sql (G1) e
-- 20261101110000_nota_revisione_fuori_dalla_lettura.sql (G2) (Mario, 27/10): la
-- nota di revisione di un evento la leggono l'admin e l'organizzatore, e
-- nessun altro — nemmeno su un evento approvato, che tutti possono vedere.
--
-- Il caso: fino al 27/10 `eventi_select_approvati` non limitava le colonne, e
-- la nota di un evento approvato la leggeva chiunque, studenti compresi.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA G2 (la 2, 3 e 9 rosse: lo
-- studente e anon leggono la nota) e su una nata senza G1 (lo script muore
-- sulla 4: la funzione non c'è).
--
-- Transazione con ROLLBACK. Le colonne dicono «negato»/«concesso» e non f/t:
-- `verifica-sql-tutti.sh` legge una `f` in fondo a una riga come un booleano falso.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000d1', 'ente-a-nr@test.it'),
  ('11111111-0000-0000-0000-0000000000d2', 'ente-b-nr@test.it'),
  ('11111111-0000-0000-0000-0000000000d3', 'admin-nr@test.it'),
  ('11111111-0000-0000-0000-0000000000d4', 'stud-nr@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000d1', 'istituzione', 'E', 'A', '1980-01-01'),
  ('11111111-0000-0000-0000-0000000000d2', 'istituzione', 'E', 'B', '1980-01-01'),
  ('11111111-0000-0000-0000-0000000000d3', 'admin', 'Ad', 'Min', '1980-01-01'),
  ('11111111-0000-0000-0000-0000000000d4', 'studente', 'S', 'Tud', '2008-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'Ente A', 'ente-a-nr', 'universita', 'attiva'),
  ('aaaaaaaa-0000-0000-0000-0000000000d2', 'Ente B', 'ente-b-nr', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1'),
  ('11111111-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-0000000000d2');

-- Un evento APPROVATO con una nota: è quello che tutti vedono, e il caso della falla.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, note_revisione) values
  ('e0000000-0000-0000-0000-0000000000d1', 'NR', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   '2026-12-01 10:00+01', '2026-12-01 11:00+01', 'approvato', 'studenti', 'La CTA esterna non va: la tolgo.');
insert into public.eventi_aree (evento_id, area_slug) values ('e0000000-0000-0000-0000-0000000000d1', 'informatica-digitale');

-- Esegue `sql` come `chi` (null = anon) e restituisce il primo valore, o l'errore.
create function pg_temp.come(chi uuid, sql text) returns text language plpgsql as $$
declare v text;
begin
  if chi is null then
    set local role anon;
  else
    perform set_config('request.jwt.claim.sub', chi::text, true);
    set local role authenticated;
  end if;
  begin
    execute sql into v;
    v := coalesce(v, '(nessuna riga)');
  exception when others then v := 'ERRORE: ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end $$;

-- 1) La funzione c'è.
insert into esiti select 1, 'note_revisione_eventi esiste', 'presente',
  case when to_regprocedure('public.note_revisione_eventi(uuid[])') is null then 'assente' else 'presente' end,
  to_regprocedure('public.note_revisione_eventi(uuid[])') is not null;

-- 2) IL CASO: uno studente non legge la nota di un evento approvato dalla tabella.
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000d4', $q$select note_revisione from public.eventi where id = 'e0000000-0000-0000-0000-0000000000d1'$q$);
  insert into esiti values (2, 'uno studente non legge la nota di un evento approvato', 'permesso negato', r, r like 'ERRORE:%permission denied%');
end $$;

-- 3) Nemmeno anon.
do $$
declare r text;
begin
  r := pg_temp.come(null, $q$select note_revisione from public.eventi where id = 'e0000000-0000-0000-0000-0000000000d1'$q$);
  insert into esiti values (3, 'anon non legge la nota', 'permesso negato', r, r like 'ERRORE:%permission denied%');
end $$;

-- 4) …e lo studente legge ancora l'evento: si è tolta una colonna, non la tabella.
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000d4', $q$select titolo from public.eventi where id = 'e0000000-0000-0000-0000-0000000000d1'$q$);
  insert into esiti values (4, 'lo studente legge ancora il titolo dell''evento approvato', 'NR', r, r = 'NR');
end $$;

-- 5) L'organizzatore la legge dalla funzione.
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000d1', $q$select note_revisione from public.note_revisione_eventi(array['e0000000-0000-0000-0000-0000000000d1']::uuid[])$q$);
  insert into esiti values (5, 'l''organizzatore legge la nota dalla funzione', 'La CTA esterna non va: la tolgo.', r, r = 'La CTA esterna non va: la tolgo.');
end $$;

-- 6) L'admin pure.
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000d3', $q$select note_revisione from public.note_revisione_eventi(array['e0000000-0000-0000-0000-0000000000d1']::uuid[])$q$);
  insert into esiti values (6, 'l''admin legge la nota dalla funzione', 'La CTA esterna non va: la tolgo.', r, r = 'La CTA esterna non va: la tolgo.');
end $$;

-- 7) Un altro ente non riceve la riga (non «null»: niente).
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000d2', $q$select count(*)::text from public.note_revisione_eventi(array['e0000000-0000-0000-0000-0000000000d1']::uuid[])$q$);
  insert into esiti values (7, 'un altro ente non riceve la riga', '0', r, r = '0');
end $$;

-- 8) Lo studente nemmeno, dalla funzione.
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000d4', $q$select count(*)::text from public.note_revisione_eventi(array['e0000000-0000-0000-0000-0000000000d1']::uuid[])$q$);
  insert into esiti values (8, 'lo studente non riceve la riga dalla funzione', '0', r, r = '0');
end $$;

-- 9) I privilegi, con la colonna di controllo.
insert into esiti select 9, 'note_revisione: authenticated e anon negati; titolo concesso', 'negato/negato/concesso',
  concat_ws('/',
    case when has_column_privilege('authenticated', 'public.eventi', 'note_revisione', 'SELECT') then 'concesso' else 'negato' end,
    case when has_column_privilege('anon', 'public.eventi', 'note_revisione', 'SELECT') then 'concesso' else 'negato' end,
    case when has_column_privilege('authenticated', 'public.eventi', 'titolo', 'SELECT') then 'concesso' else 'negato' end),
  not has_column_privilege('authenticated', 'public.eventi', 'note_revisione', 'SELECT')
    and not has_column_privilege('anon', 'public.eventi', 'note_revisione', 'SELECT')
    and has_column_privilege('authenticated', 'public.eventi', 'titolo', 'SELECT');

-- 10) Ogni altra colonna di eventi resta leggibile dal client: G2 l'ha scritte a
--     mano, e una dimenticata romperebbe una lettura senza dirlo qui.
insert into esiti select 10, 'tutte le altre colonne di eventi restano leggibili', '0 negate',
  count(*) filter (where not has_column_privilege('authenticated', 'public.eventi', column_name, 'SELECT')) || ' negate',
  count(*) filter (where not has_column_privilege('authenticated', 'public.eventi', column_name, 'SELECT')) = 0
  from information_schema.columns where table_schema = 'public' and table_name = 'eventi' and column_name <> 'note_revisione';

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
