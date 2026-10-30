-- Verifica di 20261026100000_durata_vera_ore_riconosciute.sql: la durata vera
-- viene dalla chiusura, sotto i 20 minuti non si certifica nessuno, e le ore
-- si EMETTONO una volta e non si ricalcolano.
--
-- Gira anche nel SQL Editor di Supabase: transazione con ROLLBACK, e in coda un
-- `select` invece di un silenzio.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA la riga sabotata: drop +
-- create di funzione ricreano lo stato, quindi riapplicare un file sabotato
-- sulla stessa replica dà una risposta che SEMBRA una risposta.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'ente@test.it'),
  ('22222222-0000-0000-0000-000000000001', 's1@test.it'),
  ('22222222-0000-0000-0000-000000000002', 's2@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-000000000001', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('22222222-0000-0000-0000-000000000001', 'studente', 'Pri', 'Mo', '2008-01-01'),
  ('22222222-0000-0000-0000-000000000002', 'studente', 'Sec', 'Ondo', '2008-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ente Uno', 'ente-uno', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');

-- EV_L (lunga): programmata 45 minuti, cominciata 28 minuti fa → chiusa adesso
--   dura 28. Dichiarate 0,75 ore → riconosciute 0,46 (28/60 = 0,4666, PER DIFETTO
--   da 20261028100000: col `round` era 0,47). Soglia 0,75 × 28
--   = 21 ping: s1 ne ha 22 (sopra), s2 ne ha 18 (sotto). Sulla durata
--   PROGRAMMATA ne servirebbero 34, e s1 resterebbe fuori.
-- EV_C (corta): cominciata 16 minuti fa → chiusa adesso dura 16, sotto il minimo.
-- EV_F (futura): non ancora cominciata.
-- EV_P (passata): finita un'ora fa, non chiusa — ramo (b): durata programmata.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                           hosting_diretta, youtube_video_id, incorporamento_sonda, ore_pcto) values
  ('e0000000-0000-0000-0000-00000000000a', 'Lunga', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '28 minutes 30 seconds', now() + interval '16 minutes 30 seconds', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo', 0.75),
  ('e0000000-0000-0000-0000-00000000000c', 'Corta', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '16 minutes 10 seconds', now() + interval '30 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo', 0.75),
  ('e0000000-0000-0000-0000-00000000000f', 'Futura', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() + interval '1 hour', now() + interval '2 hours', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo', 1),
  ('e0000000-0000-0000-0000-00000000000b', 'Passata', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '2 hours', now() - interval '1 hour', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo', 2);
insert into public.eventi_aree (evento_id, area_slug) values
  ('e0000000-0000-0000-0000-00000000000a', 'informatica-digitale'),
  ('e0000000-0000-0000-0000-00000000000c', 'informatica-digitale');
insert into public.iscrizioni_eventi (evento_id, student_id) values
  ('e0000000-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-00000000000c', '22222222-0000-0000-0000-000000000001');
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('e0000000-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000001', 22),
  ('e0000000-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000002', 18),
  ('e0000000-0000-0000-0000-00000000000c', '22222222-0000-0000-0000-000000000001', 16);

-- 1) Ramo (b): un evento non chiuso ha la durata programmata.
do $$
declare v numeric;
begin
  v := public.durata_vera_minuti('e0000000-0000-0000-0000-00000000000b');
  insert into esiti values (1, 'non chiusa: durata vera = programmata (60)', '60', coalesce(v::text, 'null'), round(v) = 60);
end $$;

-- 2) Prima dell'inizio non si chiude.
do $$
declare v_msg text := 'nessun errore';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  begin
    perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-00000000000f');
  exception when others then v_msg := sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (2, 'prima dell''inizio: rifiutata', 'evento_non_iniziato', v_msg, v_msg = 'evento_non_iniziato');
end $$;

-- 3) Chiusura anticipata: si può, e la durata è quella vera (28, non 45).
do $$
declare v_pres integer; v_cert integer; v_gia timestamptz; v_dur integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  select presenti, certificati, gia_chiusa_il, durata_minuti into v_pres, v_cert, v_gia, v_dur
    from public.chiudi_diretta_evento('e0000000-0000-0000-0000-00000000000a');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (3, 'chiusa in anticipo: 2 presenti, 1 certificato, durata 28',
    '2/1/null/28', format('%s/%s/%s/%s', v_pres, v_cert, coalesce(v_gia::text,'null'), v_dur),
    v_pres = 2 and v_cert = 1 and v_gia is null and v_dur = 28);
end $$;

-- 4) La soglia è calcolata sulla durata vera: s1 (22 su 28) dentro, s2 (18) fuori.
do $$
declare v1 text; v2 text;
begin
  select stato::text into v1 from public.iscrizioni_eventi where evento_id = 'e0000000-0000-0000-0000-00000000000a' and student_id = '22222222-0000-0000-0000-000000000001';
  select stato::text into v2 from public.iscrizioni_eventi where evento_id = 'e0000000-0000-0000-0000-00000000000a' and student_id = '22222222-0000-0000-0000-000000000002';
  insert into esiti values (4, 'soglia sulla durata vera: 22/28 certificato, 18/28 no', 'partecipato/iscritto', v1 || '/' || v2, v1 = 'partecipato' and v2 = 'iscritto');
end $$;

-- 5) Le ore emesse non superano la durata vera: 0,75 dichiarate, 28 minuti → 0,47.
do $$
declare v numeric;
begin
  select ore_riconosciute into v from public.iscrizioni_eventi where evento_id = 'e0000000-0000-0000-0000-00000000000a' and student_id = '22222222-0000-0000-0000-000000000001';
  insert into esiti values (5, 'ore riconosciute = min(0,75, 28/60), per difetto', '0.46', coalesce(v::text, 'null'), v = 0.46);
end $$;

-- 6) La ricevuta porta la durata.
do $$
declare v integer;
begin
  select diretta_durata_minuti into v from public.eventi where id = 'e0000000-0000-0000-0000-00000000000a';
  insert into esiti values (6, 'la ricevuta porta la durata', '28', coalesce(v::text,'null'), v = 28);
end $$;

-- 7) Le ore emesse sono un FATTO: correggere eventi.ore_pcto dopo non le tocca.
do $$
declare v numeric;
begin
  update public.eventi set ore_pcto = 3 where id = 'e0000000-0000-0000-0000-00000000000a';
  select ore_riconosciute into v from public.iscrizioni_eventi where evento_id = 'e0000000-0000-0000-0000-00000000000a' and student_id = '22222222-0000-0000-0000-000000000001';
  insert into esiti values (7, 'ore emesse non ricalcolate quando cambia ore_pcto', '0.46', coalesce(v::text,'null'), v = 0.46);
end $$;

-- 8) Dopo la chiusura i battiti sono respinti, col motivo che la pagina dice.
do $$
declare v_msg text := 'nessun errore';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-000000000002', true);
  begin
    perform public.ping_presenza_live('e0000000-0000-0000-0000-00000000000a');
  exception when others then v_msg := sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (8, 'battito dopo la chiusura: respinto', 'diretta_chiusa', v_msg, v_msg = 'diretta_chiusa');
end $$;

-- 9) Seconda pressione: «già chiusa», con la durata della prima.
do $$
declare v_gia timestamptz; v_dur integer; v_cert integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  select gia_chiusa_il, durata_minuti, certificati into v_gia, v_dur, v_cert from public.chiudi_diretta_evento('e0000000-0000-0000-0000-00000000000a');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (9, 'seconda pressione: già chiusa, durata 28', 'non null/28/0', format('%s/%s/%s', coalesce(v_gia::text,'null'), v_dur, v_cert), v_gia is not null and v_dur = 28 and v_cert = 0);
end $$;

-- 10) Sotto il minimo: nessuno certificato, anche sopra soglia (16 ping su 16).
do $$
declare v_cert integer; v_dur integer; v_stato text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  select certificati, durata_minuti into v_cert, v_dur from public.chiudi_diretta_evento('e0000000-0000-0000-0000-00000000000c');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  select stato::text into v_stato from public.iscrizioni_eventi where evento_id = 'e0000000-0000-0000-0000-00000000000c';
  insert into esiti values (10, 'durata 16 < 20: nessuno certificato', '0/16/iscritto', format('%s/%s/%s', v_cert, v_dur, v_stato), v_cert = 0 and v_dur = 16 and v_stato = 'iscritto');
end $$;

-- 11) Il client non si scrive delle ore: un'iscrizione «iscritto» con ore viola il vincolo.
do $$
declare v_msg text := 'nessun errore';
begin
  begin
    insert into public.iscrizioni_eventi (evento_id, student_id, ore_riconosciute) values ('e0000000-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-000000000001', 9);
  exception when others then v_msg := sqlerrm;
  end;
  insert into esiti values (11, 'ore senza partecipazione: rifiutate dal vincolo', 'iscrizioni_ore_riconosciute_con_partecipazione', v_msg, v_msg like '%iscrizioni_ore_riconosciute_con_partecipazione%');
end $$;

-- 12) …e una partecipazione senza ore pure: un writer che le dimentica fallisce a voce alta.
do $$
declare v_msg text := 'nessun errore';
begin
  begin
    update public.iscrizioni_eventi set stato = 'partecipato' where evento_id = 'e0000000-0000-0000-0000-00000000000c';
  exception when others then v_msg := sqlerrm;
  end;
  insert into esiti values (12, 'partecipazione senza ore: rifiutata', 'iscrizioni_ore_riconosciute_con_partecipazione', v_msg, v_msg like '%iscrizioni_ore_riconosciute_con_partecipazione%');
end $$;

-- 13) Il ramo (a) legge la durata scritta, non la ricalcola.
do $$
declare v numeric;
begin
  v := public.durata_vera_minuti('e0000000-0000-0000-0000-00000000000a');
  insert into esiti values (13, 'chiusa: durata vera = quella della ricevuta', '28', coalesce(v::text,'null'), v = 28);
end $$;

-- 14) Chi non è collegato non chiama le funzioni nuove.
do $$
declare v_msg text := 'eseguita';
begin
  set local role anon;
  begin
    perform public.ore_riconoscibili_evento('e0000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then v_msg := 'permesso negato';
  end;
  reset role;
  insert into esiti values (14, 'anon non esegue ore_riconoscibili_evento', 'permesso negato', v_msg, v_msg = 'permesso negato');
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte from esiti;
rollback;
