-- Verifica di 20261018120000_player_rotto_live.sql e
-- 20261018130000_sposta_finestra_evento.sql — la diretta fallita del 18/10.
--
-- Gira anche nel SQL Editor di Supabase: una transazione con ROLLBACK, e in coda
-- un `select` invece di un silenzio.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA le due migrazioni: senza la
-- prima la console non può contare chi non vede (1-12 rosse), senza la seconda
-- la finestra non si sposta (13-19 rosse) — cioè quello che è successo il 18/10.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'ente@test.it'),
  ('11111111-0000-0000-0000-000000000002', 'altro-ente@test.it'),
  ('11111111-0000-0000-0000-000000000003', 'admin@test.it'),
  ('22222222-0000-0000-0000-000000000001', 'iscritto@test.it'),
  ('22222222-0000-0000-0000-000000000002', 'non-iscritto@test.it');

insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-000000000001', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('11111111-0000-0000-0000-000000000002', 'istituzione', 'Al', 'Tro', '1980-01-01'),
  ('11111111-0000-0000-0000-000000000003', 'admin', 'Ad', 'Min', '1980-01-01'),
  ('22222222-0000-0000-0000-000000000001', 'studente', 'Is', 'Critto', '2008-01-01'),
  ('22222222-0000-0000-0000-000000000002', 'studente', 'Non', 'Iscritto', '2008-01-01');

insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ente Uno', 'ente-uno', 'universita', 'attiva'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ente Due', 'ente-due', 'universita', 'attiva');

insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');

-- VIVA: la diretta del 18/10 in miniatura, in corso adesso. FINITA: un'ora fa.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                           hosting_diretta, youtube_video_id, incorporamento_sonda) values
  ('e0000000-0000-0000-0000-0000000000aa', 'Viva', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '7 minutes', now() + interval '38 minutes', 'approvato', 'studenti', 'kireo', 'ABfkEeZD7sQ', 'attivo'),
  ('e0000000-0000-0000-0000-0000000000bb', 'Finita', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '2 hours', now() - interval '1 hour', 'approvato', 'studenti', 'kireo', 'ABfkEeZD7sQ', 'attivo');

insert into public.eventi_aree (evento_id, area_slug) values ('e0000000-0000-0000-0000-0000000000bb', 'informatica-digitale');

insert into public.iscrizioni_eventi (evento_id, student_id) values
  ('e0000000-0000-0000-0000-0000000000aa', '22222222-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-0000000000bb', '22222222-0000-0000-0000-000000000001');

create or replace function pg_temp.esito_di(p_sub text, p_sql text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  set local role authenticated;
  begin
    execute p_sql;
    reset role;
    perform set_config('request.jwt.claim.sub', '', true);
    return 'riuscito';
  exception when others then
    reset role;
    perform set_config('request.jwt.claim.sub', '', true);
    return sqlerrm;
  end;
end $$;

create or replace function pg_temp.conteggio_come(p_sub text, p_evento uuid) returns text language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  set local role authenticated;
  begin
    v := public.conteggio_player_rotti_live(p_evento);
    reset role;
    perform set_config('request.jwt.claim.sub', '', true);
    return v::text;
  exception when others then
    reset role;
    perform set_config('request.jwt.claim.sub', '', true);
    return sqlerrm;
  end;
end $$;

-- ================================================================ §1 il player rotto
-- Senza la tabella il blocco dichiara la mancanza invece di far morire la
-- transazione: un copione che muore nel mondo rotto non si distingue da uno che
-- non gira.
do $$
declare r text; n int; g int; c text;
begin
  if to_regclass('public.player_live_stato') is null then
    insert into esiti values (1, 'la console può contare chi non vede', 'la tabella esiste', 'player_live_stato non esiste', false);
    return;
  end if;
  r := pg_temp.esito_di('22222222-0000-0000-0000-000000000001',
    $q$select public.segnala_player_live('e0000000-0000-0000-0000-0000000000aa', 'incorporamento_disattivato')$q$);
  select count(*) into n from public.player_live_stato where evento_id = 'e0000000-0000-0000-0000-0000000000aa';
  insert into esiti values (1, 'lo studente iscritto segnala il player rotto', 'riuscito, 1 riga', r || ', ' || n || ' righe', r = 'riuscito' and n = 1);

  c := pg_temp.conteggio_come('11111111-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000aa');
  insert into esiti values (2, 'la console dell''ente organizzatore conta chi non vede', '1', c, c = '1');

  select count(*) into g from public.guasti where specie = 'video_diretta';
  insert into esiti values (3, 'una riga in guasti (video_diretta)', '1', g::text, g = 1);

  r := pg_temp.esito_di('22222222-0000-0000-0000-000000000001',
    $q$select public.segnala_player_live('e0000000-0000-0000-0000-0000000000aa', 'incorporamento_disattivato')$q$);
  select count(*) into g from public.guasti where specie = 'video_diretta';
  select count(*) into n from public.player_live_stato where evento_id = 'e0000000-0000-0000-0000-0000000000aa';
  insert into esiti values (4, 'il rinnovo non duplica né la riga né il guasto', '1 riga, 1 guasto', n || ' righe, ' || g || ' guasti', n = 1 and g = 1);

  r := pg_temp.esito_di('22222222-0000-0000-0000-000000000002',
    $q$select public.segnala_player_live('e0000000-0000-0000-0000-0000000000aa', 'incorporamento_disattivato')$q$);
  insert into esiti values (5, 'chi non è iscritto non può segnalare', 'non_iscritto', r, r like '%non_iscritto%');

  r := pg_temp.esito_di('22222222-0000-0000-0000-000000000001',
    $q$select public.segnala_player_live('e0000000-0000-0000-0000-0000000000bb', 'incorporamento_disattivato')$q$);
  insert into esiti values (6, 'fuori dalla finestra non si segnala', 'fuori_finestra_diretta', r, r like '%fuori_finestra_diretta%');

  r := pg_temp.esito_di('22222222-0000-0000-0000-000000000001',
    $q$select public.segnala_player_live('e0000000-0000-0000-0000-0000000000aa', 'qualcosa')$q$);
  insert into esiti values (7, 'un esito inventato è rifiutato', 'violazione del check', r, r like '%player_live_stato_esito%');

  c := pg_temp.conteggio_come('11111111-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000aa');
  insert into esiti values (8, 'un altro ente non legge il conteggio', 'non_autorizzato', c, c like '%non_autorizzato%');

  c := pg_temp.conteggio_come('11111111-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-0000000000aa');
  insert into esiti values (9, 'l''admin legge il conteggio', '1', c, c = '1');

  update public.player_live_stato set segnalato_il = now() - interval '5 minutes';
  c := pg_temp.conteggio_come('11111111-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000aa');
  insert into esiti values (10, 'una segnalazione non rinnovata (pagina chiusa) non conta più', '0', c, c = '0');
  update public.player_live_stato set segnalato_il = now();

  r := pg_temp.esito_di('22222222-0000-0000-0000-000000000001',
    $q$select public.segnala_player_live('e0000000-0000-0000-0000-0000000000aa', null)$q$);
  c := pg_temp.conteggio_come('11111111-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000aa');
  insert into esiti values (11, 'il player che si riprende toglie la riga: il conteggio scende', 'riuscito, 0', r || ', ' || c, r = 'riuscito' and c = '0');

  r := pg_temp.esito_di('22222222-0000-0000-0000-000000000001',
    $q$insert into public.player_live_stato (evento_id, user_id, esito) values ('e0000000-0000-0000-0000-0000000000aa', '22222222-0000-0000-0000-000000000001', 'non_disponibile')$q$);
  insert into esiti values (12, 'nessuna scrittura diretta dal client: solo la funzione', 'respinto', r, r <> 'riuscito');
end $$;

do $$
declare v boolean; w boolean;
begin
  if to_regprocedure('public.segnala_player_live(uuid, text)') is null then
    insert into esiti values (20, 'anon non esegue né la segnalazione né il conteggio', 'false/false', 'funzioni assenti', false);
    return;
  end if;
  v := has_function_privilege('anon', 'public.segnala_player_live(uuid, text)', 'execute');
  w := has_function_privilege('anon', 'public.conteggio_player_rotti_live(uuid)', 'execute');
  insert into esiti values (20, 'anon non esegue né la segnalazione né il conteggio', 'false/false', v || '/' || w, not v and not w);
end $$;

-- ================================================================ §2 la finestra
do $$
declare r text; i timestamptz; f timestamptz;
begin
  r := pg_temp.esito_di('11111111-0000-0000-0000-000000000001',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000aa', now() + interval '13 minutes', now() + interval '58 minutes')$q$);
  select data_inizio, data_fine into i, f from public.eventi where id = 'e0000000-0000-0000-0000-0000000000aa';
  insert into esiti values (13, 'l''ente organizzatore sposta la finestra di una diretta approvata',
    'riuscito, +13/+58 min', r || ', ' || round(extract(epoch from i - now()) / 60) || '/' || round(extract(epoch from f - now()) / 60),
    r = 'riuscito' and round(extract(epoch from i - now()) / 60) = 13 and round(extract(epoch from f - now()) / 60) = 58);

  r := pg_temp.esito_di('11111111-0000-0000-0000-000000000002',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000aa', now(), now() + interval '1 hour')$q$);
  insert into esiti values (14, 'un altro ente no', 'non_autorizzato', r, r like '%non_autorizzato%');

  r := pg_temp.esito_di('22222222-0000-0000-0000-000000000001',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000aa', now(), now() + interval '1 hour')$q$);
  insert into esiti values (15, 'uno studente no', 'non_autorizzato', r, r like '%non_autorizzato%');

  r := pg_temp.esito_di('11111111-0000-0000-0000-000000000001',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000aa', now() + interval '1 hour', now())$q$);
  insert into esiti values (16, 'la fine prima dell''inizio è rifiutata', 'fine_prima_di_inizio', r, r like '%fine_prima_di_inizio%');

  r := pg_temp.esito_di('11111111-0000-0000-0000-000000000001',
    $q$select public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000bb')$q$);
  r := pg_temp.esito_di('11111111-0000-0000-0000-000000000001',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000bb', now(), now() + interval '1 hour')$q$);
  insert into esiti values (17, 'a diretta chiusa la finestra non si sposta più', 'diretta_gia_chiusa', r, r like '%diretta_gia_chiusa%');

  r := pg_temp.esito_di('11111111-0000-0000-0000-000000000003',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000aa', now() + interval '20 minutes', now() + interval '65 minutes')$q$);
  insert into esiti values (18, 'l''admin sposta la finestra', 'riuscito', r, r = 'riuscito');
end $$;

do $$
declare v boolean;
begin
  if to_regprocedure('public.sposta_finestra_evento(uuid, timestamptz, timestamptz)') is null then
    insert into esiti values (21, 'anon non sposta niente', 'false', 'funzione assente', false);
    return;
  end if;
  v := has_function_privilege('anon', 'public.sposta_finestra_evento(uuid, timestamptz, timestamptz)', 'execute');
  insert into esiti values (21, 'anon non sposta niente', 'false', v::text, not v);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
