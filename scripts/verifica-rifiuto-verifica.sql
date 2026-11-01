-- LO STUDENTE RIFIUTATO RICEVE IL MOTIVO (01/11, passo 3 della scuola).
--
-- Prova 20261130100000, 20261130110000 e 20261130120000. Gira in una
-- transazione con ROLLBACK: si incolla nel SQL Editor senza lasciare niente.
--
-- SU UNA REPLICA NATA SENZA le tre migrazioni la prova non parte (il tipo del
-- motivo non c'è): la controprova vera è sulla sola C (`FERMA_PRIMA=20261130120000`,
-- rossa la 8) e sul trigger senza la pulizia (rossa la 7).

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into public.schools(codice_meccanografico, denominazione, provincia, tipo_istituto)
  values ('ZZ00000011', 'Liceo del Rifiuto', 'Milano', 'Liceo'),
         ('ZZ00000012', 'Liceo Giusto', 'Milano', 'Liceo');

insert into auth.users(id, email) values ('bbbbbbbb-0000-0000-0000-0000000000b1', 'ref-rif@prova.it');
insert into public.profiles(id, ruolo, nome, cognome)
  values ('bbbbbbbb-0000-0000-0000-0000000000b1', 'referente_scuola', 'R', 'Ef');
insert into public.scuole_profili(id, scuola_id, stato)
  values ('99999999-0000-0000-0000-0000000000a1', 'ZZ00000011', 'attiva');
insert into public.school_staff(scuola_profilo_id, user_id, ruolo_staff, attivo, puo_verificare_studenti, creato_da)
  values ('99999999-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-0000000000b1',
          'referente', true, true, 'bbbbbbbb-0000-0000-0000-0000000000b1');

do $$
declare i int;
begin
  for i in 1..3 loop
    insert into auth.users(id, email)
      values (('cccccccc-0000-0000-0000-00000000000' || i)::uuid, 'rif' || i || '@prova.it');
    insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
      values (('cccccccc-0000-0000-0000-00000000000' || i)::uuid, 'studente', 'S', i::text, '2008-01-01');
    insert into public.student_profiles(user_id, school_code, classe, anno_diploma)
      values (('cccccccc-0000-0000-0000-00000000000' || i)::uuid, 'ZZ00000011', '4ª A', 2027);
  end loop;
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-0000000000b1';

-- 1) un rifiuto senza motivo non passa
do $$ begin
  perform public.verifica_studente('cccccccc-0000-0000-0000-000000000001', 'rifiutato', null);
  insert into esiti values (1, 'un rifiuto senza motivo', 'motivo_mancante', false, 'PASSA');
exception when others then
  insert into esiti values (1, 'un rifiuto senza motivo', 'motivo_mancante', sqlerrm = 'motivo_mancante', 'respinto: ' || sqlerrm);
end $$;

-- 2) una verifica con un motivo non passa
do $$ begin
  perform public.verifica_studente('cccccccc-0000-0000-0000-000000000002', 'verificato', 'scuola_sbagliata');
  insert into esiti values (2, 'una verifica con un motivo', 'motivo_solo_per_rifiuto', false, 'PASSA');
exception when others then
  insert into esiti values (2, 'una verifica con un motivo', 'motivo_solo_per_rifiuto', sqlerrm = 'motivo_solo_per_rifiuto', 'respinto: ' || sqlerrm);
end $$;

-- 3-4) il rifiuto con il motivo: la riga e la notifica
do $$ begin
  perform public.verifica_studente('cccccccc-0000-0000-0000-000000000001', 'rifiutato', 'non_risulta_studente');
exception when others then
  insert into esiti values (3, 'il rifiuto con il motivo', 'PASSA', false, 'respinto: ' || sqlerrm);
end $$;

reset role;
insert into esiti
select 3, 'la riga dice rifiutato, il motivo e il nome della scuola copiato',
       'rifiutato / non_risulta_studente / Liceo del Rifiuto / data',
       stato_verifica = 'rifiutato' and school_code is null and rifiuto_motivo = 'non_risulta_studente'
         and rifiuto_scuola_nome = 'Liceo del Rifiuto' and rifiuto_il is not null,
       stato_verifica || ' / ' || coalesce(rifiuto_motivo::text, '(null)') || ' / '
         || coalesce(rifiuto_scuola_nome, '(null)') || ' / ' || coalesce(rifiuto_il::text, '(null)')
from public.student_profiles where user_id = 'cccccccc-0000-0000-0000-000000000001';
insert into esiti
select 4, 'lo studente riceve una notifica verifica_rifiutata che punta a sé',
       '1', count(*) = 1, count(*)::text
from public.notifiche_studenti
where student_id = 'cccccccc-0000-0000-0000-000000000001' and tipo = 'verifica_rifiutata'
  and riferimento_id = 'cccccccc-0000-0000-0000-000000000001';

-- 5) lo studente legge il proprio motivo
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
do $$
declare v text;
begin
  select rifiuto_motivo::text || ' / ' || rifiuto_scuola_nome into v from public.student_profiles where user_id = auth.uid();
  insert into esiti values (5, 'lo studente legge il proprio motivo', 'non_risulta_studente / Liceo del Rifiuto',
    v = 'non_risulta_studente / Liceo del Rifiuto', coalesce(v, '(nessuna riga)'));
exception when others then
  insert into esiti values (5, 'lo studente legge il proprio motivo', 'leggibile', false, 'respinto: ' || sqlerrm);
end $$;

-- 6) e non lo cancella da sé
do $$ begin
  update public.student_profiles set rifiuto_motivo = null, rifiuto_scuola_nome = null, rifiuto_il = null where user_id = auth.uid();
  insert into esiti values (6, 'lo studente si cancella il rifiuto da sé', 'RESPINTO', false, 'PASSA');
exception when others then
  insert into esiti values (6, 'lo studente si cancella il rifiuto da sé', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- 7) dichiarando di nuovo una scuola il rifiuto sparisce
do $$
declare v text;
begin
  update public.student_profiles set school_code = 'ZZ00000012', classe = '4ª B' where user_id = auth.uid();
  select stato_verifica || ' / ' || coalesce(rifiuto_motivo::text, '(null)') || ' / ' || coalesce(rifiuto_scuola_nome, '(null)')
    into v from public.student_profiles where user_id = auth.uid();
  insert into esiti values (7, 'dichiarando di nuovo una scuola il rifiuto sparisce', 'dichiarato / (null) / (null)',
    v = 'dichiarato / (null) / (null)', v);
exception when others then
  insert into esiti values (7, 'dichiarando di nuovo una scuola il rifiuto sparisce', 'dichiarato / (null) / (null)', false, 'respinto: ' || sqlerrm);
end $$;

reset role;

-- 8) la firma a due argomenti non c'è più (C)
insert into esiti
select 8, 'la firma a due argomenti è uscita', 'assente',
       to_regprocedure('public.verifica_studente(uuid, public.stato_verifica_studente)') is null,
       coalesce(to_regprocedure('public.verifica_studente(uuid, public.stato_verifica_studente)')::text, 'assente');

-- 9) un visitatore non esegue la funzione
insert into esiti
select 9, 'un visitatore non esegue verifica_studente', 'false',
       not has_function_privilege('anon', 'public.verifica_studente(uuid, public.stato_verifica_studente, public.motivo_rifiuto_verifica)', 'execute'),
       has_function_privilege('anon', 'public.verifica_studente(uuid, public.stato_verifica_studente, public.motivo_rifiuto_verifica)', 'execute')::text;

-- 10) tutte e tre o nessuna, anche dal SQL Editor
do $$ begin
  update public.student_profiles set rifiuto_motivo = 'scuola_sbagliata' where user_id = 'cccccccc-0000-0000-0000-000000000003';
  insert into esiti values (10, 'un motivo senza scuola né data', 'RESPINTO (23514)', false, 'PASSA');
exception when check_violation then
  insert into esiti values (10, 'un motivo senza scuola né data', 'RESPINTO (23514)', true, 'respinto: ' || sqlerrm);
when others then
  insert into esiti values (10, 'un motivo senza scuola né data', 'RESPINTO (23514)', false, 'altro errore: ' || sqlerrm);
end $$;

-- 11) una verifica non scrive un motivo e non manda notifiche
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-0000000000b1';
do $$ begin
  perform public.verifica_studente('cccccccc-0000-0000-0000-000000000002', 'verificato', null);
exception when others then
  insert into esiti values (11, 'la verifica', 'PASSA', false, 'respinto: ' || sqlerrm);
end $$;
reset role;
insert into esiti
select 11, 'una verifica non scrive un motivo e non manda notifiche', 'verificato / (null) / 0',
       sp.stato_verifica = 'verificato' and sp.rifiuto_motivo is null
         and (select count(*) from public.notifiche_studenti n where n.student_id = sp.user_id) = 0,
       sp.stato_verifica || ' / ' || coalesce(sp.rifiuto_motivo::text, '(null)') || ' / '
         || (select count(*) from public.notifiche_studenti n where n.student_id = sp.user_id)::text
from public.student_profiles sp where sp.user_id = 'cccccccc-0000-0000-0000-000000000002';

select n, proprieta, atteso,
       case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
