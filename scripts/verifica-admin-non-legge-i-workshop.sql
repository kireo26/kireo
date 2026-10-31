-- L'ADMIN NON LEGGE QUELLO CHE UNO STUDENTE SCRIVE IN UN WORKSHOP (20261125100000).
--
-- Gira in una transazione con ROLLBACK, nel SQL Editor così com'è.
--
-- La linea di Mario: mai le riflessioni dei workshop. Sei tabelle, una riga
-- scritta da postgres in ognuna; poi lo studente legge le sue, e l'admin
-- collegato dal client non ne legge nessuna.
--
-- Rosse attese su una replica nata senza 20261125100000: 2-7 (l'admin legge
-- una riga per tabella). Verdi nei due mondi: 1 (lo studente legge le sue) e
-- 8 (postgres, cioè il cron e il banco con la service role, le legge ancora).

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values
  ('f3000000-0000-0000-0000-0000000000a1', 'stud-wsa@prova.it'),
  ('f3000000-0000-0000-0000-0000000000a2', 'stud2-wsa@prova.it'),
  ('f3000000-0000-0000-0000-0000000000a3', 'admin-wsa@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita) values
  ('f3000000-0000-0000-0000-0000000000a1', 'studente', 'S', 'Wsa', '2006-03-01'),
  ('f3000000-0000-0000-0000-0000000000a2', 'studente', 'T', 'Wsa', '2006-03-01'),
  ('f3000000-0000-0000-0000-0000000000a3', 'admin', 'A', 'Wsa', '1980-01-01');
insert into public.workshop (id, slug, titolo, descrizione, attivo)
  values ('c3000000-0000-0000-0000-0000000000c1', 'prova-admin-workshop', 'Prova', 'd', true);
insert into public.workshop_ruoli (id, workshop_id, slug, titolo, area_slug)
  values ('d3000000-0000-0000-0000-0000000000d1', 'c3000000-0000-0000-0000-0000000000c1', 'uno', 'Uno', 'informatica-digitale');
insert into public.workshop_iscrizioni (id, student_id, workshop_id, ruolo_id, stato)
  values ('e3000000-0000-0000-0000-0000000000e1', 'f3000000-0000-0000-0000-0000000000a1',
          'c3000000-0000-0000-0000-0000000000c1', 'd3000000-0000-0000-0000-0000000000d1', 'attivo');

-- Una riga in ognuna delle sei tabelle, scritta da postgres.
insert into public.workshop_elaborati (iscrizione_id) values ('e3000000-0000-0000-0000-0000000000e1');
insert into public.workshop_fasi_stato (iscrizione_id, fase_id) values ('e3000000-0000-0000-0000-0000000000e1', 'prova');
insert into public.workshop_chat_cliente (iscrizione_id, mittente, contenuto)
  values ('e3000000-0000-0000-0000-0000000000e1', 'studente', 'Una domanda dello studente');
insert into public.workshop_consegne (iscrizione_id, file_nome, file_percorso, file_tipo, file_dimensione)
  values ('e3000000-0000-0000-0000-0000000000e1', 'f.png', 'x/f.png', 'image/png', 10);
insert into public.workshop_messaggi (workshop_id, mittente_id, destinatario_id, contenuto)
  values ('c3000000-0000-0000-0000-0000000000c1', 'f3000000-0000-0000-0000-0000000000a1',
          'f3000000-0000-0000-0000-0000000000a2', 'Un messaggio fra due studenti');
insert into public.workshop_tutor_log (iscrizione_id, sezione_id, modo)
  values ('e3000000-0000-0000-0000-0000000000e1', 'sezione', 'aiuto');

-- Conta quante righe dei sei vede chi è collegato adesso.
create or replace function pg_temp.conta(t text) returns int language plpgsql as $f$
declare n int;
begin
  execute format('select count(*) from public.%I', t) into n;
  return n;
exception when others then
  return -1;
end $f$;
grant execute on function pg_temp.conta(text) to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'f3000000-0000-0000-0000-0000000000a1';
do $$ begin
  insert into esiti values (1, 'lo studente legge il suo elaborato e la sua chat (la via legittima)', '1 · 1',
    pg_temp.conta('workshop_elaborati') = 1 and pg_temp.conta('workshop_chat_cliente') = 1,
    pg_temp.conta('workshop_elaborati') || ' · ' || pg_temp.conta('workshop_chat_cliente'));
end $$;

set local request.jwt.claim.sub = 'f3000000-0000-0000-0000-0000000000a3';
do $$ declare t text; i int := 2; n int; begin
  foreach t in array array['workshop_elaborati','workshop_fasi_stato','workshop_chat_cliente',
                           'workshop_consegne','workshop_messaggi','workshop_tutor_log'] loop
    n := pg_temp.conta(t);
    insert into esiti values (i, 'l''admin collegato non legge ' || t, '0', n = 0, n::text);
    i := i + 1;
  end loop;
end $$;

reset role;
do $$ begin
  insert into esiti values (8, 'postgres (il cron, il banco) le legge ancora', '1 · 1',
    (select count(*) from public.workshop_elaborati where iscrizione_id = 'e3000000-0000-0000-0000-0000000000e1') = 1
    and (select count(*) from public.workshop_messaggi where workshop_id = 'c3000000-0000-0000-0000-0000000000c1') = 1, 'letto');
end $$;

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
