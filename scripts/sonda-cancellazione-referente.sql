-- SONDA (solo replica, transazione con ROLLBACK): cosa impedisce oggi a un
-- referente di cancellare il proprio account (passo 5.4, misurato il 01/11).
-- Quattro referenti, ognuno con la sua scuola (una scuola ha un solo referente
-- attivo: school_staff_un_referente_attivo_idx), ognuno con un gesto diverso.
-- Il risultato del 01/11: 1 si cancella e la scuola resta con zero righe di staff;
-- 2, 3 e 4 sono bloccati dalle chiavi di responsabilità (creato_da, verificato_da,
-- mittente_user), con l'errore grezzo della chiave.
begin;
set local role postgres;
create temp table casi (caso text, esito text) on commit drop;
grant all on casi to authenticated;
insert into public.scuole_profili (id, scuola_id, stato) select ('bbbbbbbb-0000-0000-0000-0000000000d' || n)::uuid, codice_meccanografico, 'attiva' from (select codice_meccanografico, row_number() over () n from public.schools limit 4) x;
create function pg_temp.referente(n int) returns uuid language plpgsql as $$
declare u uuid := ('99999999-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid; begin
  insert into auth.users (id, email) values (u, 'r' || n || '@x');
  insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values (u, 'referente_scuola', 'R', n::text, '1980-01-01');
  insert into public.school_staff (user_id, scuola_profilo_id, ruolo_staff, attivo, creato_da) values (u, ('bbbbbbbb-0000-0000-0000-0000000000d' || n)::uuid, 'referente', true, u);
  return u; end $$;
create function pg_temp.cancella(u uuid, caso text) returns void language plpgsql as $$
declare r text := 'si cancella'; begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
  begin perform public.delete_own_account(coalesce((public.stato_cancellazione_mio_account() ->> 'resta_il_nome')::boolean, false)); exception when others then r := 'BLOCCATO: ' || sqlerrm; end;
  reset role;
  insert into casi values (caso, r); end $$;
-- 1 solo la propria riga
select pg_temp.cancella(pg_temp.referente(1), '1 · ha solo la propria riga di staff');
-- 2 ha invitato un tutor
do $$ declare u uuid := pg_temp.referente(2); begin
  insert into public.school_staff (scuola_profilo_id, ruolo_staff, codice_invito, nome_invitato, creato_da) values ('bbbbbbbb-0000-0000-0000-0000000000d2','tutor','TUTOR-AAAA-BBBB-CCCC-DDDD','T',u);
  perform pg_temp.cancella(u, '2 · ha invitato un tutor'); end $$;
-- 3 ha verificato uno studente
do $$ declare u uuid := pg_temp.referente(3); s uuid := '99999999-0000-0000-0000-0000000000f3'; begin
  insert into auth.users (id,email) values (s,'s3@x');
  insert into public.profiles (id,ruolo,nome,cognome,data_nascita) values (s,'studente','S','3','2008-01-01');
  insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica, verificato_da, verificato_il)
    select s, scuola_id, '4', 2028, 'verificato', u, now() from public.scuole_profili where id='bbbbbbbb-0000-0000-0000-0000000000d3';
  perform pg_temp.cancella(u, '3 · ha verificato uno studente'); end $$;
-- 4 ha scritto un messaggio alla scuola
do $$ declare u uuid := pg_temp.referente(4); begin
  insert into public.messaggi_scuola (scuola_profilo_id, mittente_user, destinatari, oggetto, corpo, canale)
    values ('bbbbbbbb-0000-0000-0000-0000000000d4', u, 'tutta_scuola', 'O', 'C', 'interno');
  perform pg_temp.cancella(u, '4 · ha scritto un messaggio agli studenti'); end $$;
select * from casi;
select 'scuola 1 dopo: righe di staff', count(*) from public.school_staff where scuola_profilo_id='bbbbbbbb-0000-0000-0000-0000000000d1';
rollback;
