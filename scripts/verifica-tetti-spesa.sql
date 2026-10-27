-- Verifica di 20261104140000 (Mario, 27/10): i tetti delle due route che
-- spendono, e le colonne dei tentativi che il client non scrive più.
--
-- CONTROPROVA: su una replica nata senza la migrazione sono rosse la 1, la 2,
-- la 3, la 4, la 6, la 7 e la 8 (la 6, la 7 e la 8 perché la tabella e il tetto non
-- esistono; la 1-4 perché il client riscriveva lo stato e la data). Il
-- controllo è la 5: il progresso del giocatore si scrive in tutti e due i
-- mondi, e se diventasse rossa la cura avrebbe rotto il gioco.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('44444444-0000-0000-0000-0000000000a1', 'tetti-a@test.it'),
  ('44444444-0000-0000-0000-0000000000a2', 'tetti-b@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('44444444-0000-0000-0000-0000000000a1', 'studente', 'Tetti', 'A', '2008-01-01'),
  ('44444444-0000-0000-0000-0000000000a2', 'studente', 'Tetti', 'B', '2008-01-01');
-- I tre test completati, scritti da postgres: il cancello delle missioni è un
-- altro discorso, e qui deve essere aperto.
insert into public.test_attempt (student_id, test_slug, stato, completed_at)
select '44444444-0000-0000-0000-0000000000a1', s, 'completata', now()
from unnest(array['da-dove-parti', 'come-ti-muovi', 'piu-a-fondo']) s;
insert into public.mission_attempt (id, student_id, mission_slug, stato, completed_at)
values ('55555555-0000-0000-0000-0000000000a1', '44444444-0000-0000-0000-0000000000a1', 'progetto-quartiere', 'completata', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000a1', true);

-- 1 · un tentativo completato non torna in corso dal client.
do $$
declare v_esito text := 'riuscito'; v_stato text;
begin
  begin
    update public.mission_attempt set stato = 'in_corso' where id = '55555555-0000-0000-0000-0000000000a1';
  exception when others then v_esito := sqlstate;
  end;
  select stato::text into v_stato from public.mission_attempt where id = '55555555-0000-0000-0000-0000000000a1';
  insert into esiti values (1, 'lo stato di un tentativo di missione non si riscrive dal client', '42501, completata',
    v_esito || ', ' || v_stato, v_esito = '42501' and v_stato = 'completata');
end $$;

-- 2 · un tentativo di test non nasce già completato dal client.
do $$
declare v_esito text := 'riuscito';
begin
  begin
    insert into public.test_attempt (student_id, test_slug, stato) values
      ('44444444-0000-0000-0000-0000000000a1', 'da-dove-parti', 'completata');
  exception when others then v_esito := sqlstate;
  end;
  insert into esiti values (2, 'un test_attempt non si inserisce già completato dal client', '42501', v_esito, v_esito = '42501');
end $$;

-- 3 · la data d'inizio non si riscrive (decide quale tentativo conta).
do $$
declare v_esito text := 'riuscito';
begin
  begin
    update public.mission_attempt set started_at = now() - interval '30 days' where id = '55555555-0000-0000-0000-0000000000a1';
  exception when others then v_esito := sqlstate;
  end;
  insert into esiti values (3, 'started_at di un tentativo non si riscrive dal client', '42501', v_esito, v_esito = '42501');
end $$;

-- 4 · nemmeno lo stato di un test.
do $$
declare v_esito text := 'riuscito';
begin
  begin
    update public.test_attempt set stato = 'in_corso' where student_id = '44444444-0000-0000-0000-0000000000a1';
  exception when others then v_esito := sqlstate;
  end;
  insert into esiti values (4, 'lo stato di un test_attempt non si riscrive dal client', '42501', v_esito, v_esito = '42501');
end $$;

-- 5 · CONTROLLO: il player scrive ancora il proprio avanzamento.
do $$
declare v_righe int;
begin
  update public.mission_attempt set stanza_corrente = 3, updated_at = now(), revisore_esito = 'letto'
  where id = '55555555-0000-0000-0000-0000000000a1';
  get diagnostics v_righe = row_count;
  insert into esiti values (5, 'il client scrive ancora stanza, ora e revisore_esito', '1 riga', v_righe || ' righe', v_righe = 1);
end $$;

-- 6 · il sesto tentativo di missione del giorno si ferma (il primo c'è già: è quello completato).
do $$
declare v_esito text := 'aperto'; v_aperti int := 0;
  slugs text[] := array['m-uno', 'm-due', 'm-tre', 'm-quattro', 'm-cinque'];
  s text;
begin
  foreach s in array slugs loop
    begin
      insert into public.mission_attempt (student_id, mission_slug) values ('44444444-0000-0000-0000-0000000000a1', s);
      v_aperti := v_aperti + 1;
    exception when others then v_esito := sqlerrm; exit;
    end;
  end loop;
  insert into esiti values (6, 'oltre cinque tentativi al giorno la missione non si apre', '4 aperti, poi troppi_tentativi_missione_oggi',
    v_aperti || ' aperti, poi ' || v_esito, v_aperti = 4 and v_esito = 'troppi_tentativi_missione_oggi');
end $$;

-- 7 · la trentunesima richiesta all'assistente si ferma, e non chiede niente al client.
do $$
declare v_esito text := 'passata'; v_n int := 0;
begin
  for i in 1..31 loop
    begin
      insert into public.assistente_richieste (student_id) values ('44444444-0000-0000-0000-0000000000a1');
      v_n := v_n + 1;
    exception when others then v_esito := sqlerrm; exit;
    end;
  end loop;
  insert into esiti values (7, 'oltre 30 richieste al giorno l''assistente si ferma', '30, poi troppe_richieste_assistente_oggi',
    v_n || ', poi ' || v_esito, v_n = 30 and v_esito = 'troppe_richieste_assistente_oggi');
end $$;

-- 8 · CONTROLLO: una richiesta non si scrive a nome di un altro, né con una data scelta.
do $$
declare v_altro text := 'passata'; v_data text := 'passata';
begin
  begin
    insert into public.assistente_richieste (student_id) values ('44444444-0000-0000-0000-0000000000a2');
  exception when others then v_altro := sqlstate;
  end;
  begin
    insert into public.assistente_richieste (student_id, created_at) values ('44444444-0000-0000-0000-0000000000a1', now() - interval '2 days');
  exception when others then v_data := sqlstate;
  end;
  insert into esiti values (8, 'una richiesta non si scrive per un altro, né con una data scelta', '42501 e 42501',
    v_altro || ' e ' || v_data, v_altro = '42501' and v_data = '42501');
end $$;

set local role postgres;
select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
