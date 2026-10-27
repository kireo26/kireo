-- Verifica di 20261102100000_sito_ufficiale_con_schema.sql (Mario, 27/10): il
-- sito ufficiale di un ente si salva sempre con uno schema, qualunque cosa la
-- persona scriva, e una scrittura senza schema che scavalca il trigger fallisce.
--
-- Il caso: `www.davante.it` salvato così com'era, e dalla pagina pubblica lo
-- studente arrivava al 404 di kireo.it.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA la migrazione: rosse la
-- 1, 2, 3, 5, 6, 7 e 8. Restano verdi la 4 (un indirizzo con lo schema non ha
-- niente da normalizzare) e nessun'altra.
--
-- Transazione con ROLLBACK. Le colonne dicono «sì»/«no» e non f/t:
-- `verifica-sql-tutti.sh` legge una `f` in fondo a una riga come un booleano falso.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values ('11111111-0000-0000-0000-0000000000e1', 'ente-sito@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000e1', 'istituzione', 'E', 'Sito', '1980-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato, sito_ufficiale) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'Ente Sito', 'ente-sito', 'universita', 'attiva', 'www.davante.it');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-0000000000e1');

-- 1) All'insert (la strada della registrazione): il caso di Davante.
insert into esiti select 1, 'all''insert, «www.davante.it» diventa un indirizzo assoluto', 'https://www.davante.it',
  sito_ufficiale, sito_ufficiale = 'https://www.davante.it'
  from public.istituzioni where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';

-- 2-6) All'update, dalla sessione dell'ente (la strada del profilo).
create temp table casi (n int, scritto text, atteso text) on commit drop;
grant all on casi to authenticated;
insert into casi values
  (2, 'davante.it', 'https://davante.it'),
  (3, '  https://www.davante.it  ', 'https://www.davante.it'),
  (4, 'HTTP://Davante.it/corsi', 'HTTP://Davante.it/corsi'),
  (5, '//www.davante.it', 'https://www.davante.it'),
  (6, '   ', null);

do $$
declare
  c record;
  v text;
begin
  for c in select * from casi order by n loop
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000e1', true);
    update public.istituzioni set sito_ufficiale = c.scritto where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
    reset role;
    select sito_ufficiale into v from public.istituzioni where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
    insert into esiti values (c.n, format('l''ente scrive «%s»', c.scritto), coalesce(c.atteso, 'null'), coalesce(v, 'null'),
      v is not distinct from c.atteso);
  end loop;
end $$;

-- 7) La guardia: con il trigger spento, una scrittura senza schema fallisce.
--    È il giorno in cui qualcuno aggiunge una strada che non passa di lì.
do $$
declare
  v_rifiutata boolean := false;
  -- Nel mondo senza migrazione il trigger non c'è: lo script lo dice con la
  -- proprietà rossa invece di morire (e far sembrare rotte tutte le altre).
  v_trigger boolean := exists (select 1 from pg_trigger where tgname = 'normalizza_sito_ufficiale');
begin
  if v_trigger then
    alter table public.istituzioni disable trigger normalizza_sito_ufficiale;
  end if;
  begin
    update public.istituzioni set sito_ufficiale = 'www.davante.it' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
  exception when check_violation then
    v_rifiutata := true;
  end;
  if v_trigger then
    alter table public.istituzioni enable trigger normalizza_sito_ufficiale;
  end if;
  insert into esiti values (7, 'senza trigger, una scrittura senza schema è rifiutata dal vincolo', 'rifiutata: sì',
    'rifiutata: ' || case when v_rifiutata then 'sì' else 'no' end, v_rifiutata);
end $$;

-- 8) Nessuna riga in tabella senza schema (le seed e quelle sistemate dalla migrazione).
insert into esiti select 8, 'nessun sito salvato senza schema', '0', count(*)::text, count(*) = 0
  from public.istituzioni where sito_ufficiale !~* '^https?://';

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
