-- Verifica di 20261027110000_certificazione_manuale_senza_tetto.sql: il tetto
-- della durata vera e il minimo dei 20 minuti valgono per la certificazione
-- AUTOMATICA (dove KIREO è il testimone) e NON per quella della scuola (dove KIREO
-- è il registro). Decisione di Mario, 25/10.
--
-- ⚠️ DUE PROPRIETÀ E NON UNA: «il tetto si applica all'automatica» e «il tetto
-- NON si applica alla manuale» sono due affermazioni. Una guardia sola che le
-- copre entrambe resterebbe verde il giorno in cui qualcuno le fondesse di nuovo
-- in una regola sola — in tutti e due i versi.
--
-- Gira anche nel SQL Editor di Supabase: transazione con ROLLBACK, e in coda un
-- `select` invece di un silenzio. LE CONTROPROVE, fatte il 25/10: su una replica
-- NATA SENZA la migrazione diventano rosse la 3 e la 4 (0,47 e 0 invece di
-- 0,75); la 5 resta verde, ed è giusto — senza una fine il tetto non c'era
-- nemmeno prima. Nell'altro verso, togliendo il tetto anche all'automatica
-- (`ore_riconoscibili_evento` che restituisce le ore dichiarate) diventa rossa
-- la 1. La 2 la tiene il minimo dentro `chiudi_diretta_evento`, non la regola
-- delle ore.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000d1', 'ente-cm@test.it'),
  ('22222222-0000-0000-0000-0000000000d1', 'auto-cm@test.it'),
  ('22222222-0000-0000-0000-0000000000d2', 'manu-cm@test.it'),
  ('33333333-0000-0000-0000-0000000000d1', 'ref-cm@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000d1', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('22222222-0000-0000-0000-0000000000d1', 'studente', 'Au', 'To', '2008-01-01'),
  ('22222222-0000-0000-0000-0000000000d2', 'studente', 'Ma', 'Nu', '2008-01-01'),
  ('33333333-0000-0000-0000-0000000000d1', 'referente_scuola', 'Ref', 'Scuola', '1980-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'Ente CM', 'ente-cm', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1');
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto)
  values ('TESTCM01', 'Scuola CM', 'MI', 'Liceo') on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato)
  values ('dd000000-0000-0000-0000-0000000000d1', 'TESTCM01', 'attiva');
insert into public.school_staff (scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da)
  values ('dd000000-0000-0000-0000-0000000000d1', '33333333-0000-0000-0000-0000000000d1', 'referente', true, '33333333-0000-0000-0000-0000000000d1');
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica)
  values ('22222222-0000-0000-0000-0000000000d2', 'TESTCM01', '5A', 2027, 'verificato');

-- EV_L (lunga): cominciata 28 minuti fa, programmata 45, 0,75 ore dichiarate.
--   Chiusa adesso dura 28 → l'automatica emette 0,46 (28/60 = 0,4666, per
--   difetto da 20261028100000: col `round` era 0,47).
-- EV_C (corta): cominciata 16 minuti fa → chiusa adesso dura 16, sotto il minimo.
-- EV_S (senza fine): nessuna data_fine.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                           hosting_diretta, youtube_video_id, incorporamento_sonda, ore_pcto) values
  ('e0000000-0000-0000-0000-0000000000d1', 'Lunga', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   now() - interval '28 minutes 30 seconds', now() + interval '16 minutes 30 seconds', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo', 0.75),
  ('e0000000-0000-0000-0000-0000000000d2', 'Corta', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   now() - interval '16 minutes 10 seconds', now() + interval '30 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo', 0.75),
  ('e0000000-0000-0000-0000-0000000000d3', 'Senza fine', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000d1',
   now() - interval '1 hour', null, 'approvato', 'studenti', 'kireo', null, null, 3);
insert into public.eventi_aree (evento_id, area_slug) values
  ('e0000000-0000-0000-0000-0000000000d1', 'informatica-digitale'),
  ('e0000000-0000-0000-0000-0000000000d2', 'informatica-digitale'),
  ('e0000000-0000-0000-0000-0000000000d3', 'informatica-digitale');
insert into public.iscrizioni_eventi (evento_id, student_id) values
  ('e0000000-0000-0000-0000-0000000000d1', '22222222-0000-0000-0000-0000000000d1'),
  ('e0000000-0000-0000-0000-0000000000d2', '22222222-0000-0000-0000-0000000000d1');
insert into public.iscrizioni_eventi (evento_id, student_id, origine, iscritto_da) values
  ('e0000000-0000-0000-0000-0000000000d1', '22222222-0000-0000-0000-0000000000d2', 'scuola', '33333333-0000-0000-0000-0000000000d1'),
  ('e0000000-0000-0000-0000-0000000000d2', '22222222-0000-0000-0000-0000000000d2', 'scuola', '33333333-0000-0000-0000-0000000000d1'),
  ('e0000000-0000-0000-0000-0000000000d3', '22222222-0000-0000-0000-0000000000d2', 'scuola', '33333333-0000-0000-0000-0000000000d1');
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('e0000000-0000-0000-0000-0000000000d1', '22222222-0000-0000-0000-0000000000d1', 22),
  ('e0000000-0000-0000-0000-0000000000d2', '22222222-0000-0000-0000-0000000000d1', 16);

-- Le due chiusure, dalla porta dell'ente.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000d1', true);
  perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000d1');
  perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000d2');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;

-- Le tre certificazioni manuali, dalla porta della scuola.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000d1', true);
  perform public.certifica_presenza('e0000000-0000-0000-0000-0000000000d1', '22222222-0000-0000-0000-0000000000d2');
  perform public.certifica_presenza('e0000000-0000-0000-0000-0000000000d2', '22222222-0000-0000-0000-0000000000d2');
  perform public.certifica_presenza('e0000000-0000-0000-0000-0000000000d3', '22222222-0000-0000-0000-0000000000d2');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;

-- 1) AUTOMATICA: il tetto si applica. 0,75 dichiarate su 28 minuti → 0,46.
insert into esiti select 1, 'automatica: il tetto della durata vera si applica', 'partecipato/sistema/0.46',
  format('%s/%s/%s', stato, certificata_da_tipo, ore_riconosciute),
  stato = 'partecipato' and certificata_da_tipo = 'sistema' and ore_riconosciute = 0.46
  from public.iscrizioni_eventi
  where evento_id = 'e0000000-0000-0000-0000-0000000000d1' and student_id = '22222222-0000-0000-0000-0000000000d1';

-- 2) AUTOMATICA: il minimo si applica. 16 minuti → nessuno certificato.
insert into esiti select 2, 'automatica: sotto i 20 minuti non certifica', 'iscritto',
  stato::text, stato = 'iscritto'
  from public.iscrizioni_eventi
  where evento_id = 'e0000000-0000-0000-0000-0000000000d2' and student_id = '22222222-0000-0000-0000-0000000000d1';

-- 3) MANUALE: il tetto NON si applica. Stesso evento di 28 minuti → 0,75 dichiarate.
insert into esiti select 3, 'manuale: il tetto della durata vera NON si applica', 'partecipato/scuola/0.75',
  format('%s/%s/%s', stato, certificata_da_tipo, ore_riconosciute),
  stato = 'partecipato' and certificata_da_tipo = 'scuola' and ore_riconosciute = 0.75
  from public.iscrizioni_eventi
  where evento_id = 'e0000000-0000-0000-0000-0000000000d1' and student_id = '22222222-0000-0000-0000-0000000000d2';

-- 4) MANUALE: il minimo NON si applica. 16 minuti → 0,75, non 0.
insert into esiti select 4, 'manuale: il minimo dei 20 minuti NON si applica', '0.75',
  coalesce(ore_riconosciute::text, 'null'), ore_riconosciute = 0.75
  from public.iscrizioni_eventi
  where evento_id = 'e0000000-0000-0000-0000-0000000000d2' and student_id = '22222222-0000-0000-0000-0000000000d2';

-- 5) MANUALE: il limite che resta sono le ore DICHIARATE — né più né meno.
insert into esiti select 5, 'manuale: le ore sono esattamente quelle dichiarate (anche senza fine)', '3.00 = 3',
  format('%s = %s', ie.ore_riconosciute, e.ore_pcto), ie.ore_riconosciute = e.ore_pcto
  from public.iscrizioni_eventi ie join public.eventi e on e.id = ie.evento_id
  where ie.evento_id = 'e0000000-0000-0000-0000-0000000000d3' and ie.student_id = '22222222-0000-0000-0000-0000000000d2';

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
