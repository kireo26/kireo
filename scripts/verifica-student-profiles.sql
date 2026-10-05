-- LA VERIFICA SCOLASTICA NON SI AUTODICHIARA.
--
-- Prova la migrazione 20261005100000. Gira in una transazione con ROLLBACK: si
-- incolla nel SQL Editor di Supabase senza lasciare niente.
--
-- SI ESEGUE, NON SI LEGGE. Il buco di luglio stava fra due rami di trigger
-- entrambi corretti, e si vede solo scrivendo la riga che non doveva passare:
-- in DUE statement separati il secondo viene respinto, quindi una rilettura
-- delle guardie dice che funzionano. È l'UPDATE che cambia stato e scuola
-- insieme a passare in mezzo.
--
-- LE PROPRIETÀ 8-9 SONO LE DIPENDENZE SORVEGLIATE. Il `with check` della policy
-- pretende `stato_verifica = 'dichiarato'`, e questo funziona grazie a due
-- meccanismi che vivono altrove (il secondo ramo del trigger, e il rifiuto che
-- azzera `school_code`). Se qualcuno li togliesse, la policy respingerebbe
-- un'azione legittima: quelle due proprietà esistono perché diventi rossa
-- QUELLA e non uno studente.
--
-- SU UNA REPLICA NATA SENZA la migrazione sono ROTTE le proprietà 1-3: la
-- controprova va fatta ricostruendo, perché `drop policy`/`create policy` non
-- si disfanno riapplicando un file.

\set ON_ERROR_STOP off
begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

-- ─────────────────────────────── fixture
insert into public.schools(codice_meccanografico, denominazione, provincia, tipo_istituto)
  values ('ZZ00000001', 'Liceo Dichiarato', 'Milano', 'Liceo'),
         ('ZZ00000002', 'Liceo Altrui', 'Napoli', 'Liceo');

-- la scuola attiva, con il suo referente delegato alla verifica
insert into auth.users(id, email) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'ref@prova.it');
insert into public.profiles(id, ruolo, nome, cognome)
  values ('bbbbbbbb-0000-0000-0000-00000000000b', 'referente_scuola', 'R', 'Ef');
insert into public.scuole_profili(id, scuola_id, stato)
  values ('99999999-0000-0000-0000-000000000099', 'ZZ00000001', 'attiva');
insert into public.school_staff(scuola_profilo_id, user_id, ruolo_staff, attivo,
                                puo_verificare_studenti, creato_da)
  values ('99999999-0000-0000-0000-000000000099', 'bbbbbbbb-0000-0000-0000-00000000000b',
          'referente', true, true, 'bbbbbbbb-0000-0000-0000-00000000000b');

-- UNO STUDENTE PER SONDA, invece dei ripristini: un ripristino fatto come
-- `postgres` cadrebbe comunque nel trigger, perché `auth.uid()` resta
-- impostato e `current_ruolo()` non è 'admin'.
do $$
declare i int;
begin
  for i in 1..6 loop
    insert into auth.users(id, email)
      values (('aaaaaaaa-0000-0000-0000-00000000000' || i)::uuid, 's' || i || '@prova.it');
    insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
      values (('aaaaaaaa-0000-0000-0000-00000000000' || i)::uuid, 'studente', 'S', i::text, '2006-01-01');
    insert into public.student_profiles(user_id, school_code, classe, anno_diploma)
      values (('aaaaaaaa-0000-0000-0000-00000000000' || i)::uuid, 'ZZ00000001', '5ª A', 2026);
  end loop;
end $$;

set local role authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Le tre scritture del buco
-- ═══════════════════════════════════════════════════════════════════════
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  update public.student_profiles
     set stato_verifica = 'verificato', verificato_da = auth.uid(), verificato_il = now()
   where user_id = auth.uid();
  insert into esiti values (1, 'lo studente si scrive stato_verifica=verificato',
    'RESPINTO', false, 'PASSA: stato=' ||
      (select stato_verifica::text from public.student_profiles where user_id = auth.uid()));
exception when others then
  insert into esiti values (1, 'lo studente si scrive stato_verifica=verificato',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- LA MOSSA CHE ATTRAVERSA I DUE RAMI: stato e scuola nella stessa UPDATE.
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
do $$ begin
  update public.student_profiles
     set school_code = 'ZZ00000002', classe = '5ª Z',
         stato_verifica = 'verificato', verificato_da = auth.uid(), verificato_il = now()
   where user_id = auth.uid();
  insert into esiti values (2, 'si verifica a una scuola MAI dichiarata, stessa UPDATE',
    'RESPINTO', false, 'PASSA: ' ||
      (select school_code || ' / ' || stato_verifica::text
         from public.student_profiles where user_id = auth.uid()));
exception when others then
  insert into esiti values (2, 'si verifica a una scuola MAI dichiarata, stessa UPDATE',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- L'attribuzione falsa da sola: nessuno stato cambiato, solo chi e quando.
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
do $$ begin
  update public.student_profiles
     set verificato_da = 'bbbbbbbb-0000-0000-0000-00000000000b', verificato_il = '2020-01-01'
   where user_id = auth.uid();
  insert into esiti values (3, 'verificato_da/verificato_il scritti a piacere',
    'RESPINTO', false, 'PASSA: verificato_il=' ||
      (select verificato_il::date::text from public.student_profiles where user_id = auth.uid()));
exception when others then
  insert into esiti values (3, 'verificato_da/verificato_il scritti a piacere',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- Le vie legittime, che la cura non deve toccare
-- ═══════════════════════════════════════════════════════════════════════
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000004';
do $$
declare v text;
begin
  update public.student_profiles set school_code = 'ZZ00000002', classe = '5ª B'
   where user_id = auth.uid();
  select school_code || ' / ' || classe || ' / ' || stato_verifica into v
    from public.student_profiles where user_id = auth.uid();
  insert into esiti values (4, 'ProfiloForm: school_code + classe',
    'PASSA', v = 'ZZ00000002 / 5ª B / dichiarato', 'esito: ' || v);
exception when others then
  insert into esiti values (4, 'ProfiloForm: school_code + classe',
    'PASSA', false, 'respinto: ' || sqlerrm);
end $$;

-- La SOLA classe, scuola invariata: il caso stretto, perché qui il secondo ramo
-- del trigger non scatta (la scuola non cambia) e lo stato resta quello che era.
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000005';
do $$
declare v text;
begin
  update public.student_profiles set classe = '5ª C' where user_id = auth.uid();
  select classe into v from public.student_profiles where user_id = auth.uid();
  insert into esiti values (5, 'la sola classe, scuola invariata',
    'PASSA', v = '5ª C', 'esito: ' || v);
exception when others then
  insert into esiti values (5, 'la sola classe, scuola invariata',
    'PASSA', false, 'respinto: ' || sqlerrm);
end $$;

-- ═══ LA METÀ CHE LA CURA POTEVA ROMPERE
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000000b';
do $$
declare v text;
begin
  perform public.verifica_studente('aaaaaaaa-0000-0000-0000-000000000006', 'verificato');
  select stato_verifica::text into v from public.student_profiles
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000006';
  insert into esiti values (6, 'verifica_studente funziona ancora',
    'verificato', v = 'verificato', 'esito: ' || coalesce(v, '(nessuna riga)'));
exception when others then
  insert into esiti values (6, 'verifica_studente funziona ancora',
    'verificato', false, 'respinto: ' || sqlerrm);
end $$;

-- Un verificato non cambia classe: il primo ramo del trigger, invariato.
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000006';
do $$ begin
  update public.student_profiles set classe = '5ª Z' where user_id = auth.uid();
  insert into esiti values (7, 'un verificato cambia classe', 'RESPINTO', false, 'PASSA');
exception when others then
  insert into esiti values (7, 'un verificato cambia classe', 'RESPINTO', true,
    'respinto: ' || sqlerrm);
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 8-9) LE DUE DIPENDENZE SORVEGLIATE
-- Il `with check` pretende `stato_verifica = 'dichiarato'`, e queste due sono
-- le ragioni per cui quella pretesa non respinge nessuno. Se diventano rosse,
-- la policy va riaperta a `<> 'verificato'` — non va tolta la proprietà.
-- ═══════════════════════════════════════════════════════════════════════
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000000b';
do $$
declare v text;
begin
  perform public.verifica_studente('aaaaaaaa-0000-0000-0000-000000000001', 'rifiutato');
  -- Si scrive con l'identità del referente e si RILEGGE senza: la sua policy di
  -- select pretende `school_code = current_scuola_id()`, e il rifiuto l'ha
  -- azzerato — una rilettura come lui tornerebbe vuota e si leggerebbe come
  -- «non è successo niente».
  reset role;
  select stato_verifica || ' / ' || coalesce(school_code, '(null)') into v
    from public.student_profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  set local role authenticated;
  insert into esiti values (8, 'DIPENDENZA (b): il rifiuto azzera school_code',
    'rifiutato / (null)', v = 'rifiutato / (null)', 'esito: ' || coalesce(v, '(nessuna riga)'));
exception when others then
  insert into esiti values (8, 'DIPENDENZA (b): il rifiuto azzera school_code',
    'rifiutato / (null)', false, 'respinto: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$
declare v text;
begin
  update public.student_profiles set school_code = 'ZZ00000002', classe = '4ª A'
   where user_id = auth.uid();
  select stato_verifica || ' / ' || school_code into v
    from public.student_profiles where user_id = auth.uid();
  insert into esiti values (9, 'DIPENDENZA (a): il trigger riporta a dichiarato chi cambia scuola',
    'dichiarato / ZZ00000002', v = 'dichiarato / ZZ00000002', 'esito: ' || v);
exception when others then
  insert into esiti values (9, 'DIPENDENZA (a): il trigger riporta a dichiarato chi cambia scuola',
    'dichiarato / ZZ00000002', false, 'respinto: ' || sqlerrm);
end $$;

reset role;

select n, proprieta, atteso,
       case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate'
         as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
