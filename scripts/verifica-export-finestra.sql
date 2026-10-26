-- Verifica di 20261011140000_export_presenze_finestra.sql: i minuti di
-- presenza tagliati alla finestra dell'evento, e la copertura senza tetto,
-- nelle DUE funzioni di export (admin e scuola).
--
-- Gira anche nel SQL Editor di Supabase: tutto dentro una transazione che
-- finisce con ROLLBACK, e in coda un `select` invece di un silenzio.
--
-- LA RIGA 1 È `test 2` DEL 4/10 RIPRODOTTA coi numeri del CSV di Mario:
-- finestra 17:15 → 17:20, primo battito 17:08:31 (6'29" prima), «8,9 minuti»,
-- quattro battiti. Prima di questa migrazione l'export stampava 8,9 minuti
-- (ultimo − primo) su un incontro di 5; ora stampa 2,4 — la parte di [primo,
-- ultimo] che cade dentro la finestra. La copertura resta 80%, e la proprietà 2
-- dichiara perché: `ping_totali` non ha date, quindi non si sa quanti dei
-- quattro battiti stanno dentro, e non si può tagliare.
--
-- LA RIGA «PreRollPuro» è il caso limite: tutto prima dell'inizio, zero minuti.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA la migrazione (un
-- `create or replace` riapplicato su una replica già sistemata non disfa
-- niente): con le funzioni di `20261011130000` diventano rosse 1, 3, 4, 5, 6,
-- 7, 8 e 11 — e la 1 stampa 8.9, cioè il numero del CSV di Mario. Con la
-- funzione aggregata di luglio (senza `20261011150000`) è rossa la 12, che
-- stampa 85.0.

begin;

set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

do $$
declare
  v_admin uuid := 'f1000000-0000-0000-0000-000000000001';
  v_staff uuid := 'f1000000-0000-0000-0000-000000000002';
  v_s1 uuid := 'f2000000-0000-0000-0000-000000000001';
  v_s2 uuid := 'f2000000-0000-0000-0000-000000000002';
  v_s3 uuid := 'f2000000-0000-0000-0000-000000000003';
  v_s4 uuid := 'f2000000-0000-0000-0000-000000000004';
  v_s5 uuid := 'f2000000-0000-0000-0000-000000000005';
  v_ev uuid := 'f3000000-0000-0000-0000-000000000001';
  v_ev_senza_fine uuid := 'f3000000-0000-0000-0000-000000000002';
  v_t timestamptz := '2026-10-04 15:15:00+00';
  v_scuola text;
  v_scuola_profilo uuid;
begin
  insert into auth.users (id, email) values
    (v_admin, 'admin@prova.invalid'), (v_staff, 'staff@prova.invalid'),
    (v_s1, 's1@prova.invalid'), (v_s2, 's2@prova.invalid'), (v_s3, 's3@prova.invalid'), (v_s4, 's4@prova.invalid'), (v_s5, 's5@prova.invalid');
  insert into public.profiles (id, ruolo, nome, cognome, data_nascita, di_prova) values
    (v_admin, 'admin', 'Prova', 'Admin', '1980-01-01', true),
    (v_staff, 'referente_scuola', 'Prova', 'Referente', '1980-01-01', true),
    (v_s1, 'studente', 'Uno', 'PreRoll', '2008-01-01', true),
    (v_s2, 'studente', 'Due', 'AMeta', '2008-01-01', true),
    (v_s3, 'studente', 'Tre', 'OltreFine', '2008-01-01', true),
    (v_s4, 'studente', 'Quattro', 'MaiVisto', '2008-01-01', true),
    (v_s5, 'studente', 'Cinque', 'PreRollPuro', '2008-01-01', true);

  select codice_meccanografico into v_scuola from public.schools limit 1;
  if v_scuola is null then
    insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto)
      values ('XX00000000', 'Scuola di prova', 'Roma', 'Liceo') returning codice_meccanografico into v_scuola;
  end if;
  insert into public.scuole_profili (scuola_id, stato) values (v_scuola, 'attiva') returning id into v_scuola_profilo;
  insert into public.school_staff (user_id, scuola_profilo_id, ruolo_staff, attivo, puo_certificare_presenze, creato_da)
    values (v_staff, v_scuola_profilo, 'referente', true, true, v_admin);
  insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica) values
    (v_s1, v_scuola, '5A', 2027, 'verificato'), (v_s2, v_scuola, '5A', 2027, 'verificato'),
    (v_s3, v_scuola, '5A', 2027, 'verificato'), (v_s4, v_scuola, '5A', 2027, 'verificato'),
    (v_s5, v_scuola, '5A', 2027, 'verificato');

  insert into public.eventi (id, titolo, tipo, data_inizio, data_fine, stato) values
    (v_ev, 'test 2', 'altro', v_t, v_t + interval '5 minutes', 'approvato');
  -- ⚠️ Un evento SENZA FINE oggi non si crea più (`20261029100000`: la fine è
  -- obbligatoria all'insert). Questo rappresenta un evento di prima del 26/10,
  -- che esiste ancora in produzione: lo si fabbrica col trigger spento per un
  -- insert solo, e il rollback in coda disfa anche questo.
  alter table public.eventi disable trigger eventi_ore_da_orario;
  insert into public.eventi (id, titolo, tipo, data_inizio, data_fine, stato) values
    (v_ev_senza_fine, 'senza fine', 'altro', v_t, null, 'approvato');
  alter table public.eventi enable trigger eventi_ore_da_orario;

  insert into public.iscrizioni_eventi (evento_id, student_id) values
    (v_ev, v_s1), (v_ev, v_s2), (v_ev, v_s3), (v_ev, v_s4), (v_ev, v_s5), (v_ev_senza_fine, v_s1);

  insert into public.presenze_live (evento_id, user_id, primo_ping, ultimo_ping, ping_totali) values
    -- test 2: 17:08:31 → 17:17:25 (8,9 minuti grezzi), quattro battiti
    (v_ev, v_s1, v_t - interval '6 minutes 29 seconds', v_t + interval '2 minutes 25 seconds', 4),
    -- entra due minuti prima, esce tre minuti dopo l'inizio; sei battiti su cinque attesi
    (v_ev, v_s2, v_t - interval '2 minutes', v_t + interval '3 minutes', 6),
    -- entra a un minuto, esce quattro minuti dopo la fine
    (v_ev, v_s3, v_t + interval '1 minute', v_t + interval '9 minutes', 3),
    (v_ev_senza_fine, v_s1, v_t, v_t + interval '10 minutes', 10),
    -- tutto nel pre-roll: zero minuti, non un numero negativo
    (v_ev, v_s5, v_t - interval '9 minutes', v_t - interval '4 minutes', 6);
end $$;

-- ---------------------------------------------------------------- admin
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);

create temp table admin_righe on commit drop as
  select cognome, minuti_presenza, minuti_contati, copertura_percento from public.esporta_presenze_admin('f3000000-0000-0000-0000-000000000001');
create temp table admin_senza_fine on commit drop as
  select cognome, minuti_presenza from public.esporta_presenze_admin('f3000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------- scuola
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
create temp table scuola_righe on commit drop as
  select cognome, minuti_presenza, minuti_contati, copertura_percento, row_number() over () as ordine from public.esporta_presenze_scuola('f3000000-0000-0000-0000-000000000001');

-- report aggregato dell'ente (20261011150000): la media senza tetto
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);
create temp table aggregato on commit drop as
  select copertura_media from public.report_evento_aggregato('f3000000-0000-0000-0000-000000000001');

reset role;
select set_config('request.jwt.claim.sub', '', true);

-- 25/10 (`20261025100000`): «Minuti presenza» sono i battiti, e chi non si è
-- mai collegato ha 0 e 0%, non due celle vuote.
insert into esiti
  select 13, 'admin · test 2: i minuti contati sono i battiti (4), non la distanza (2,4)', '4',
         (select minuti_contati::text from admin_righe where cognome = 'PreRoll'),
         (select minuti_contati = 4 from admin_righe where cognome = 'PreRoll');
insert into esiti
  select 14, 'admin · mai collegato: 0 minuti contati e 0%, non due celle vuote', '0 / 0.0',
         (select coalesce(minuti_contati::text, 'NULL') || ' / ' || coalesce(copertura_percento::text, 'NULL') from admin_righe where cognome = 'MaiVisto'),
         (select minuti_contati = 0 and copertura_percento = 0 from admin_righe where cognome = 'MaiVisto');
insert into esiti
  select 15, 'scuola · stessi minuti contati della route admin', '4',
         (select minuti_contati::text from scuola_righe where cognome = 'PreRoll'),
         (select minuti_contati = 4 from scuola_righe where cognome = 'PreRoll');
insert into esiti
  select 1, 'admin · test 2: 8,9 minuti grezzi su un incontro di 5 → 2,4 dentro la finestra', '2.4',
         (select minuti_presenza::text from admin_righe where cognome = 'PreRoll'),
         (select minuti_presenza = 2.4 from admin_righe where cognome = 'PreRoll');
insert into esiti
  select 2, 'admin · test 2: la copertura NON si può tagliare (ping senza date) — resta 80, incompatibile coi minuti, e il file lo mostra', '80.0',
         (select copertura_percento::text from admin_righe where cognome = 'PreRoll'),
         (select copertura_percento = 80 from admin_righe where cognome = 'PreRoll');
insert into esiti
  select 3, 'admin · entra prima dell''inizio: contano solo i minuti dentro la finestra', '3.0',
         (select minuti_presenza::text from admin_righe where cognome = 'AMeta'),
         (select minuti_presenza = 3 from admin_righe where cognome = 'AMeta');
insert into esiti
  select 4, 'admin · 6 battiti su 5 attesi: 120, non 100 (nessun tetto dove si misura)', '120.0',
         (select copertura_percento::text from admin_righe where cognome = 'AMeta'),
         (select copertura_percento = 120 from admin_righe where cognome = 'AMeta');
insert into esiti
  select 5, 'admin · esce dopo la fine: tagliato alla fine', '4.0',
         (select minuti_presenza::text from admin_righe where cognome = 'OltreFine'),
         (select minuti_presenza = 4 from admin_righe where cognome = 'OltreFine');
insert into esiti
  select 6, 'admin · evento senza data_fine: i minuti non si possono tagliare, quindi non si stampano', 'null',
         coalesce((select minuti_presenza::text from admin_senza_fine where cognome = 'PreRoll'), 'null'),
         (select minuti_presenza is null from admin_senza_fine where cognome = 'PreRoll');
insert into esiti
  select 7, 'scuola · test 2: stessi minuti dell''admin (2,4)', '2.4',
         (select minuti_presenza::text from scuola_righe where cognome = 'PreRoll'),
         (select minuti_presenza = 2.4 from scuola_righe where cognome = 'PreRoll');
insert into esiti
  select 11, 'admin · tutto prima dell''inizio: zero minuti, non un numero negativo', '0.0',
         (select minuti_presenza::text from admin_righe where cognome = 'PreRollPuro'),
         (select minuti_presenza = 0 from admin_righe where cognome = 'PreRollPuro');
insert into esiti
  select 8, 'scuola · 6 su 5: 120 anche qui', '120.0',
         (select copertura_percento::text from scuola_righe where cognome = 'AMeta'),
         (select copertura_percento = 120 from scuola_righe where cognome = 'AMeta');
insert into esiti
  select 9, 'chi non si è mai collegato resta senza minuti (né zero né inventati)', 'null',
         coalesce((select minuti_presenza::text from admin_righe where cognome = 'MaiVisto'), 'null'),
         (select minuti_presenza is null from admin_righe where cognome = 'MaiVisto');
-- la fixture non è vuota: senza righe tutte le proprietà sarebbero NULL, e un
-- NULL qui sotto è ROTTO (coalesce) — ma questa riga dice il perché.
insert into esiti
  select 10, 'la fixture ha prodotto righe in tutti e due gli export (admin 5, scuola 5)', '5/5',
         (select count(*) from admin_righe)::text || '/' || (select count(*) from scuola_righe)::text,
         (select count(*) from admin_righe) = 5 and (select count(*) from scuola_righe) = 5;

-- 4 righe in presenze_live: 4/5, 6/5, 3/5, 6/5 → media (0,8+1,2+0,6+1,2)/4 = 0,95.
-- Con il tetto sarebbe stata (0,8+1+0,6+1)/4 = 0,85: la differenza è la prova.
insert into esiti
  select 12, 'report ente · la media della copertura non ha più il tetto (95, non 85)', '95.0',
         (select copertura_media::text from aggregato),
         (select copertura_media = 95 from aggregato);

select n, cosa, atteso, trovato, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto from esiti;

rollback;
