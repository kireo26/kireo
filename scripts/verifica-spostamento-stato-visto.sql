-- Verifica di 20261030100000_spostamento_con_stato_visto.sql e
-- 20261030110000_spostamento_senza_tre_argomenti.sql (Mario, 27/10): lo
-- spostamento della finestra sa cosa ha letto chi preme, e se nel frattempo le
-- ore sono cambiate rifiuta con un errore SUO, senza toccare niente.
--
-- Il caso è quello delle due persone: l'ente legge «da 0,33 a 1,00», l'admin da
-- un altro computer fissa le ore a mano, l'ente preme. Prima del 27/10 la
-- correzione dell'admin spariva senza che nessuno l'avesse letto.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA le due migrazioni (la
-- funzione a sei argomenti non esiste: 1-9 rosse) e su una nata con la
-- versione a sei ma senza il confronto (2-5 rosse: lo spostamento passa).
--
-- Transazione con ROLLBACK: gira anche nel SQL Editor di Supabase. Le colonne
-- dicono «negato»/«concesso» e non f/t: `verifica-sql-tutti.sh` legge una `f`
-- in fondo a una riga come un booleano falso.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000c1', 'ente-sv@test.it'),
  ('11111111-0000-0000-0000-0000000000c2', 'admin-sv@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000c1', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('11111111-0000-0000-0000-0000000000c2', 'admin', 'Ad', 'Min', '1980-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'Ente SV', 'ente-sv', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1');

-- 20 minuti: il trigger scrive 0,33.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico) values
  ('e0000000-0000-0000-0000-0000000000c1', 'SV', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000c1',
   '2026-12-01 10:00+01', '2026-12-01 10:20+01', 'approvato', 'studenti');
insert into public.eventi_aree (evento_id, area_slug) values ('e0000000-0000-0000-0000-0000000000c1', 'informatica-digitale');

-- Chiama come `chi`, e restituisce 'riuscito' o il messaggio d'errore.
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

-- 1) La funzione a sei argomenti c'è, e NESSUNO dei suoi argomenti ha un default
-- (Mario: un default farebbe passare un client vecchio senza il controllo).
insert into esiti select 1, 'la versione a sei argomenti esiste, senza valori predefiniti', '6 argomenti, 0 default',
  coalesce((select format('%s argomenti, %s default', pronargs, pronargdefaults) from pg_proc
            where oid = to_regprocedure('public.sposta_finestra_evento(uuid, timestamptz, timestamptz, numeric, boolean, boolean)')), 'assente'),
  coalesce((select pronargs = 6 and pronargdefaults = 0 from pg_proc
            where oid = to_regprocedure('public.sposta_finestra_evento(uuid, timestamptz, timestamptz, numeric, boolean, boolean)')), false);

-- 2) IL CASO: l'admin fissa le ore a mano DOPO che l'ente ha visto 0,33.
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000c2', $q$select public.correggi_ore_evento('e0000000-0000-0000-0000-0000000000c1', 5)$q$);
  r := pg_temp.come('11111111-0000-0000-0000-0000000000c1',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000c1', '2026-12-01 10:00+01', '2026-12-01 11:00+01', 0.33, false, true)$q$);
  insert into esiti values (2, 'ore corrette mentre l''ente guardava: rifiutato con un errore suo', 'stato_cambiato', r, r like '%stato_cambiato%');
end $$;

-- 3) …e il rifiuto non tocca niente: la correzione dell'admin e l'orario restano.
insert into esiti select 3, 'dopo il rifiuto: 5,00 fissate, fine alle 10:20', '5.00/fissata/10:20',
  format('%s/%s/%s', ore_pcto, case when ore_pcto_fissate_il is not null then 'fissata' else 'tolta' end, to_char(data_fine at time zone 'Europe/Rome', 'HH24:MI')),
  ore_pcto = 5 and ore_pcto_fissate_il is not null and data_fine = '2026-12-01 10:20+01'
  from public.eventi where id = 'e0000000-0000-0000-0000-0000000000c1';

-- 4) Le ore uguali ma la correzione non vista: rifiutato. (Due correzioni allo
-- stesso valore danno la stessa frase; una correzione che nessuno ha visto no.)
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000c1',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000c1', '2026-12-01 10:00+01', '2026-12-01 11:00+01', 5, false, true)$q$);
  insert into esiti values (4, 'stesse ore, ma la correzione non vista', 'stato_cambiato', r, r like '%stato_cambiato%');
end $$;

-- 5) La fine non vista (un evento che ce l'ha, letto come se non l'avesse).
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000c1',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000c1', '2026-12-01 10:00+01', '2026-12-01 11:00+01', 5, true, false)$q$);
  insert into esiti values (5, 'la presenza della fine non vista', 'stato_cambiato', r, r like '%stato_cambiato%');
end $$;

-- 6) Un null passato apposta è un valore, non «salta il controllo».
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000c1',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000c1', '2026-12-01 10:00+01', '2026-12-01 11:00+01', null, null, null)$q$);
  insert into esiti values (6, 'tre null non scavalcano il confronto', 'stato_cambiato', r, r like '%stato_cambiato%');
end $$;

-- 7) Con lo stato che c'è davvero lo spostamento passa: ricalcola e toglie il segno.
do $$
declare r text;
begin
  r := pg_temp.come('11111111-0000-0000-0000-0000000000c1',
    $q$select public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000c1', '2026-12-01 10:00+01', '2026-12-01 11:00+01', 5, true, true)$q$);
  insert into esiti select 7, 'con lo stato vero: spostato, 1,00, segno tolto', 'riuscito/1.00/tolta',
    format('%s/%s/%s', r, ore_pcto, case when ore_pcto_fissate_il is null then 'tolta' else 'fissata' end),
    r = 'riuscito' and ore_pcto = 1.00 and ore_pcto_fissate_il is null
    from public.eventi where id = 'e0000000-0000-0000-0000-0000000000c1';
end $$;

-- 8) La versione a tre argomenti non c'è più: nessuna porta senza il controllo.
insert into esiti select 8, 'la versione a tre argomenti è tolta', 'assente',
  coalesce(to_regprocedure('public.sposta_finestra_evento(uuid, timestamptz, timestamptz)')::text, 'assente'),
  to_regprocedure('public.sposta_finestra_evento(uuid, timestamptz, timestamptz)') is null;

-- 9) anon non esegue, authenticated sì.
insert into esiti select 9, 'esecuzione: anon negato, authenticated concesso', 'negato/concesso',
  case when has_function_privilege('anon', p, 'execute') then 'concesso' else 'negato' end || '/' ||
  case when has_function_privilege('authenticated', p, 'execute') then 'concesso' else 'negato' end,
  not has_function_privilege('anon', p, 'execute') and has_function_privilege('authenticated', p, 'execute')
  from (select to_regprocedure('public.sposta_finestra_evento(uuid, timestamptz, timestamptz, numeric, boolean, boolean)') p) x
  where p is not null;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
