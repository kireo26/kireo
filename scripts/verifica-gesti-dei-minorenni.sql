-- CONDIVIDERE IL PROFILO E SCRIVERE A UN ENTE: APERTI DAI 14 ANNI, NON DAI 18.
--
-- Prova le migrazioni 20261109100000 (i gesti aperti dai 14 anni) e
-- 20261109110000 (solo a uno studente con una data di nascita). Gira in una
-- transazione con ROLLBACK, e nel SQL Editor di Supabase così com'è: niente
-- meta-comandi di psql (`npm run test:sqleditor`).
-- Le rosse attese:
--   - su una replica nata senza 20261109100000: 1, 2 e 3 (i tre gesti di un
--     sedicenne), più 8-12 se manca anche la seconda;
--   - su una replica nata senza la sola 20261109110000: 8-12 (lo studente
--     senza data, il docente e l'ente che contattano un ente).
-- Verdi nei due mondi: 4 (un sì alle comunicazioni di KIREO resta rifiutato a
-- un minorenne: è la promessa dell'informativa), 5 (un maggiorenne condivide),
-- 6 (sotto i 14 anni un profilo non nasce), 7 (non si condivide a nome di un
-- altro).

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values
  ('a1a1a1a1-0000-0000-0000-0000000000a1', 'adulto@prova.it'),
  ('b2b2b2b2-0000-0000-0000-0000000000b2', 'sedicenne@prova.it'),
  ('d4d4d4d4-0000-0000-0000-0000000000d4', 'tredicenne@prova.it'),
  ('c5c5c5c5-0000-0000-0000-0000000000c5', 'senzadata@prova.it'),
  ('c6c6c6c6-0000-0000-0000-0000000000c6', 'docente@prova.it'),
  ('c7c7c7c7-0000-0000-0000-0000000000c7', 'ente@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita) values
  ('a1a1a1a1-0000-0000-0000-0000000000a1', 'studente', 'A', 'Dulto', current_date - interval '19 years'),
  ('b2b2b2b2-0000-0000-0000-0000000000b2', 'studente', 'S', 'Edici', current_date - interval '16 years'),
  ('c5c5c5c5-0000-0000-0000-0000000000c5', 'studente', 'S', 'Enzadata', null),
  ('c6c6c6c6-0000-0000-0000-0000000000c6', 'docente', 'D', 'Ocente', null),
  ('c7c7c7c7-0000-0000-0000-0000000000c7', 'istituzione', 'E', 'Nte', null);
insert into public.istituzioni(id, nome, slug, tipo, stato)
  values ('f5f5f5f5-0000-0000-0000-0000000000f5', 'Ente Prova', 'ente-prova-minorenni', 'its', 'attiva');

-- ─────────────── 6) sotto i 14 anni il profilo non nasce (il minimo vero)
do $$ begin
  insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
    values ('d4d4d4d4-0000-0000-0000-0000000000d4', 'studente', 'T', 'Redici', current_date - interval '13 years');
  insert into esiti values (6, 'un profilo di 13 anni non nasce (profiles_eta_minima)', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (6, 'un profilo di 13 anni non nasce (profiles_eta_minima)', 'RESPINTO', sqlstate = '23514', 'respinto: ' || sqlerrm);
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'b2b2b2b2-0000-0000-0000-0000000000b2';

-- ─────────────── 1) il sedicenne condivide il profilo
do $$ begin
  insert into public.manifestazioni_interesse(student_id, istituzione_id)
    values ('b2b2b2b2-0000-0000-0000-0000000000b2', 'f5f5f5f5-0000-0000-0000-0000000000f5');
  insert into esiti values (1, 'un sedicenne condivide il profilo con un ente', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (1, 'un sedicenne condivide il profilo con un ente', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

-- ─────────────── 2-3) il sedicenne apre una conversazione e scrive ancora
do $$
declare v_id uuid;
begin
  begin
    v_id := public.apri_conversazione_ente('f5f5f5f5-0000-0000-0000-0000000000f5', 'Buongiorno, vorrei sapere dei corsi.');
    insert into esiti values (2, 'un sedicenne apre una conversazione con un ente', 'riuscito', v_id is not null, coalesce(v_id::text, 'null'));
  exception when others then
    insert into esiti values (2, 'un sedicenne apre una conversazione con un ente', 'riuscito', false, 'respinto: ' || sqlerrm);
  end;
  begin
    if v_id is null then
      insert into esiti values (3, 'un sedicenne scrive un secondo messaggio', 'riuscito', false, 'nessuna conversazione da cui partire');
    else
      perform public.invia_messaggio_ente(v_id, 'E delle date di inizio?');
      insert into esiti select 3, 'un sedicenne scrive un secondo messaggio', '2 messaggi',
        count(*) = 2, count(*) || ' messaggi' from public.messaggi_enti where conversazione_id = v_id;
    end if;
  exception when others then
    insert into esiti values (3, 'un sedicenne scrive un secondo messaggio', 'riuscito', false, 'respinto: ' || sqlerrm);
  end;
end $$;

-- ─────────────── 4) controllo: il sì alle comunicazioni di KIREO resta ai maggiorenni
do $$ begin
  perform public.imposta_comunicazioni_kireo(true, 'profilo');
  insert into esiti values (4, 'il sedicenne dice sì alle comunicazioni di KIREO', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (4, 'il sedicenne dice sì alle comunicazioni di KIREO', 'RESPINTO', sqlerrm like '%consenso_solo_maggiorenni%', 'respinto: ' || sqlerrm);
end $$;

-- ─────────────── 7) controllo: non si condivide a nome di un altro
do $$ begin
  insert into public.manifestazioni_interesse(student_id, istituzione_id)
    values ('a1a1a1a1-0000-0000-0000-0000000000a1', 'f5f5f5f5-0000-0000-0000-0000000000f5');
  insert into esiti values (7, 'il sedicenne condivide il profilo di un altro', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (7, 'il sedicenne condivide il profilo di un altro', 'RESPINTO', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;

-- ─────────────── 5) controllo: il maggiorenne condivide, come prima
set local request.jwt.claim.sub = 'a1a1a1a1-0000-0000-0000-0000000000a1';
do $$ begin
  insert into public.manifestazioni_interesse(student_id, istituzione_id)
    values ('a1a1a1a1-0000-0000-0000-0000000000a1', 'f5f5f5f5-0000-0000-0000-0000000000f5');
  insert into esiti values (5, 'un maggiorenne condivide il profilo', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (5, 'un maggiorenne condivide il profilo', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

-- ─────────────── 8-12) chi contatta un ente: uno studente con una data
set local request.jwt.claim.sub = 'c5c5c5c5-0000-0000-0000-0000000000c5';
do $$ begin
  insert into public.manifestazioni_interesse(student_id, istituzione_id)
    values ('c5c5c5c5-0000-0000-0000-0000000000c5', 'f5f5f5f5-0000-0000-0000-0000000000f5');
  insert into esiti values (8, 'uno studente senza data di nascita condivide il profilo', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (8, 'uno studente senza data di nascita condivide il profilo', 'RESPINTO', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;
do $$ begin
  perform public.apri_conversazione_ente('f5f5f5f5-0000-0000-0000-0000000000f5', 'Buongiorno.');
  insert into esiti values (9, 'uno studente senza data di nascita scrive a un ente', 'data_nascita_mancante', false, '*** PASSA ***');
exception when others then
  insert into esiti values (9, 'uno studente senza data di nascita scrive a un ente', 'data_nascita_mancante', sqlerrm like '%data_nascita_mancante%', 'respinto: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = 'c6c6c6c6-0000-0000-0000-0000000000c6';
do $$ begin
  insert into public.manifestazioni_interesse(student_id, istituzione_id)
    values ('c6c6c6c6-0000-0000-0000-0000000000c6', 'f5f5f5f5-0000-0000-0000-0000000000f5');
  insert into esiti values (10, 'un docente «condivide il profilo» con un ente', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (10, 'un docente «condivide il profilo» con un ente', 'RESPINTO', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;
do $$ begin
  perform public.apri_conversazione_ente('f5f5f5f5-0000-0000-0000-0000000000f5', 'Buongiorno.');
  insert into esiti values (11, 'un docente apre una conversazione da studente', 'solo_studenti', false, '*** PASSA ***');
exception when others then
  insert into esiti values (11, 'un docente apre una conversazione da studente', 'solo_studenti', sqlerrm like '%solo_studenti%', 'respinto: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = 'c7c7c7c7-0000-0000-0000-0000000000c7';
do $$ begin
  perform public.apri_conversazione_ente('f5f5f5f5-0000-0000-0000-0000000000f5', 'Buongiorno.');
  insert into esiti values (12, 'un account d''ente apre una conversazione da studente', 'solo_studenti', false, '*** PASSA ***');
exception when others then
  insert into esiti values (12, 'un account d''ente apre una conversazione da studente', 'solo_studenti', sqlerrm like '%solo_studenti%', 'respinto: ' || sqlerrm);
end $$;
reset role;

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
