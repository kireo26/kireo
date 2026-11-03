-- Verifica di 20261203100000 (Mario, 03/11): la lapide tiene l'indirizzo, la
-- registrazione lo rifiuta, e prima del clic si conta. Cancella per davvero,
-- due volte: una persona CON una firma e una SENZA.
--
-- Le firme le conta il database dal catalogo: la 7 confronta la lunghezza
-- dell'elenco con `pg_constraint`, non con un numero scritto qui.
--
-- CONTROPROVA: su una replica nata senza 20261203100000 la funzione a un
-- argomento e la tabella non esistono, e l'indirizzo della lapide si
-- registra di nuovo.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('55555555-0000-0000-0000-0000000000b1', 'Firma-Lapide@Test.it'),
  ('55555555-0000-0000-0000-0000000000b2', 'senza-firme@test.it'),
  ('55555555-0000-0000-0000-0000000000b3', 'stud-lapide@test.it'),
  ('55555555-0000-0000-0000-0000000000b4', 'ref-lapide@test.it'),
  ('55555555-0000-0000-0000-0000000000b5', 'cambia@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('55555555-0000-0000-0000-0000000000b1', 'tutor_scuola', 'Giulia', 'Firma', '1980-01-01'),
  ('55555555-0000-0000-0000-0000000000b2', 'docente', 'Rita', 'Senza', '1975-01-01'),
  ('55555555-0000-0000-0000-0000000000b3', 'studente', 'Anco', 'Stu', '2008-01-01'),
  ('55555555-0000-0000-0000-0000000000b4', 'referente_scuola', 'Rosa', 'Ref', '1980-01-01'),
  ('55555555-0000-0000-0000-0000000000b5', 'tutor_scuola', 'Cora', 'Cambia', '1980-01-01');
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('TESTLAP1', 'Scuola Lapide', 'MI', 'Liceo') on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato) values ('dd000000-0000-0000-0000-0000000000e1', 'TESTLAP1', 'attiva');
insert into public.school_staff (id, scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da) values
  ('ee000000-0000-0000-0000-0000000000e4', 'dd000000-0000-0000-0000-0000000000e1', '55555555-0000-0000-0000-0000000000b4', 'referente', true, '55555555-0000-0000-0000-0000000000b4'),
  ('ee000000-0000-0000-0000-0000000000e1', 'dd000000-0000-0000-0000-0000000000e1', '55555555-0000-0000-0000-0000000000b1', 'tutor', true, '55555555-0000-0000-0000-0000000000b4'),
  ('ee000000-0000-0000-0000-0000000000e5', 'dd000000-0000-0000-0000-0000000000e1', '55555555-0000-0000-0000-0000000000b5', 'tutor', true, '55555555-0000-0000-0000-0000000000b4');
-- Giulia verifica lo studente: una firma.
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica, verificato_da, verificato_il)
  values ('55555555-0000-0000-0000-0000000000b3', 'TESTLAP1', '4A', 2028, 'verificato', '55555555-0000-0000-0000-0000000000b1', now());

create function pg_temp.come(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true); end $$;
create function pg_temp.stato(u uuid) returns jsonb language plpgsql as $$
begin
  perform pg_temp.come(u);
  begin return public.stato_cancellazione_mio_account();
  exception when others then return jsonb_build_object('errore', sqlerrm); end;
end $$;
create function pg_temp.cancella(u uuid, visto boolean) returns text language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.come(u);
  begin r := public.delete_own_account(visto); return coalesce(r ->> 'esito', 'null');
  exception when others then return 'rifiutato: ' || sqlerrm; end;
end $$;
create function pg_temp.registra(u uuid, email text) returns text language plpgsql as $$
begin
  begin insert into auth.users (id, email) values (u, email); return 'registrato';
  exception when others then return 'rifiutato: ' || sqlerrm; end;
end $$;

-- Le letture di ciò che solo la migrazione crea passano da qui: nel mondo di
-- prima la tabella e la funzione non ci sono, e la prova deve dirlo invece di
-- abortire la transazione (il modo 2-ter).
create function pg_temp.indirizzo_di(u uuid) returns text language plpgsql as $$
declare r text;
begin
  if to_regclass('public.indirizzi_delle_lapidi') is null then return null; end if;
  execute 'select email from public.indirizzi_delle_lapidi where profile_id = $1' into r using u;
  return r;
end $$;
create function pg_temp.indirizzi_con(e text) returns int language plpgsql as $$
declare r int;
begin
  if to_regclass('public.indirizzi_delle_lapidi') is null then return null; end if;
  execute 'select count(*) from public.indirizzi_delle_lapidi where email = $1' into r using e;
  return r;
end $$;
create function pg_temp.controllo(e text) returns boolean language plpgsql as $$
begin
  return public.indirizzo_di_un_account_cancellato(e);
exception when others then return null;
end $$;
create function pg_temp.privilegio(ruolo text, oggetto text, tipo text) returns text language plpgsql as $$
begin
  if tipo = 'tabella' then
    if to_regclass(oggetto) is null then return 'manca'; end if;
    return has_table_privilege(ruolo, oggetto, 'SELECT')::text;
  end if;
  if to_regprocedure(oggetto) is null then return 'manca'; end if;
  return has_function_privilege(ruolo, oggetto, 'execute')::text;
end $$;

-- 1 · prima del clic si conta: Giulia ha una verifica, e lo stato lo dice col numero.
do $$ declare s jsonb := pg_temp.stato('55555555-0000-0000-0000-0000000000b1'); v bigint; begin
  select (f ->> 'n')::bigint into v from jsonb_array_elements(s -> 'firme') f
    where f ->> 'tabella' = 'student_profiles' and f ->> 'colonna' = 'verificato_da';
  insert into esiti values (1, 'lo stato conta le firme colonna per colonna', 'resta_il_nome, 1 verifica',
    coalesce(s ->> 'resta_il_nome', 'null') || ', ' || coalesce(v::text, 'nessuna riga') || coalesce(' ' || (s ->> 'errore'), ''),
    (s ->> 'resta_il_nome')::boolean and v = 1);
end $$;

-- 2 · Giulia si cancella: resta la lapide, con il nome e l'indirizzo, e niente accesso.
do $$ declare e text := pg_temp.cancella('55555555-0000-0000-0000-0000000000b1', true); p record; i text; begin
  select nome, cancellato_il into p from public.profiles where id = '55555555-0000-0000-0000-0000000000b1';
  i := pg_temp.indirizzo_di('55555555-0000-0000-0000-0000000000b1');
  insert into esiti values (2, 'chi ha firmato lascia la lapide con l''indirizzo, in minuscolo',
    'cancellato_resta_il_nome, Giulia, firma-lapide@test.it, utente sparito',
    e || ', ' || coalesce(p.nome, 'nessun profilo') || ', ' || coalesce(i, 'nessun indirizzo'),
    e = 'cancellato_resta_il_nome' and p.nome = 'Giulia' and p.cancellato_il is not null and i = 'firma-lapide@test.it'
      and not exists (select 1 from auth.users where id = '55555555-0000-0000-0000-0000000000b1'));
end $$;

-- 3 · la firma si risolve ancora al suo nome.
insert into esiti select 3, 'la verifica si risolve ancora al nome della lapide', 'Giulia Firma',
  coalesce((select p.nome || ' ' || p.cognome from public.student_profiles s join public.profiles p on p.id = s.verificato_da
    where s.user_id = '55555555-0000-0000-0000-0000000000b3'), 'nessuno'),
  (select p.nome || ' ' || p.cognome from public.student_profiles s join public.profiles p on p.id = s.verificato_da
    where s.user_id = '55555555-0000-0000-0000-0000000000b3') = 'Giulia Firma';

-- 4 · l'indirizzo della lapide non si registra più, nemmeno scritto in un'altra forma.
do $$ declare a text := pg_temp.registra('55555555-0000-0000-0000-0000000000c1', 'firma-lapide@test.it');
             b text := pg_temp.registra('55555555-0000-0000-0000-0000000000c2', ' FIRMA-lapide@test.it '); begin
  insert into esiti values (4, 'la registrazione con l''indirizzo di una lapide è rifiutata', 'rifiutato ×2',
    a || ' | ' || b,
    a like 'rifiutato: indirizzo_di_un_account_cancellato%' and b like 'rifiutato: indirizzo_di_un_account_cancellato%');
end $$;

-- 5 · Rita, senza firme: nessuna riga, nessuna lapide, e l'indirizzo è di nuovo libero.
do $$ declare s jsonb := pg_temp.stato('55555555-0000-0000-0000-0000000000b2'); e text; r text; begin
  e := pg_temp.cancella('55555555-0000-0000-0000-0000000000b2', false);
  r := pg_temp.registra('55555555-0000-0000-0000-0000000000c3', 'senza-firme@test.it');
  insert into esiti values (5, 'chi non ha firmato sparisce per intero, e l''indirizzo si registra di nuovo',
    'resta_il_nome false, cancellato, 0 profili, 0 indirizzi, registrato',
    coalesce(s ->> 'resta_il_nome', 'null') || ', ' || e || ', '
      || (select count(*) from public.profiles where id = '55555555-0000-0000-0000-0000000000b2') || ' profili, '
      || coalesce(pg_temp.indirizzi_con('senza-firme@test.it')::text, 'nessuna tabella') || ' indirizzi, ' || r,
    not (s ->> 'resta_il_nome')::boolean and e = 'cancellato' and r = 'registrato'
      and not exists (select 1 from public.profiles where id = '55555555-0000-0000-0000-0000000000b2')
      and pg_temp.indirizzi_con('senza-firme@test.it') = 0);
end $$;

-- 6 · chi ha letto «non resterà niente» e nel frattempo ha firmato: rifiutato, niente si tocca.
do $$ declare s jsonb := pg_temp.stato('55555555-0000-0000-0000-0000000000b5'); e text; begin
  update public.student_profiles set verificato_da = '55555555-0000-0000-0000-0000000000b5'
    where user_id = '55555555-0000-0000-0000-0000000000b3';
  e := pg_temp.cancella('55555555-0000-0000-0000-0000000000b5', false);
  insert into esiti values (6, 'una firma comparsa fra la lettura e il clic: la cancellazione rifiuta',
    'letto false, rifiutato: stato_cambiato, utente c''è',
    coalesce(s ->> 'resta_il_nome', 'null') || ', ' || e,
    not (s ->> 'resta_il_nome')::boolean and e like 'rifiutato: stato_cambiato%'
      and exists (select 1 from auth.users where id = '55555555-0000-0000-0000-0000000000b5'));
end $$;

-- 7 · l'elenco delle firme è il catalogo, non un numero scritto a mano.
do $$ declare s jsonb := pg_temp.stato('55555555-0000-0000-0000-0000000000b5'); catalogo int; begin
  select count(*) into catalogo from pg_constraint c
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and c.confdeltype in ('a', 'r') and array_length(c.conkey, 1) = 1;
  insert into esiti values (7, 'le firme contate sono tutte le chiavi che bloccano, lette dal catalogo',
    catalogo || ' colonne (almeno 15)', coalesce(jsonb_array_length(s -> 'firme')::text, 'nessun elenco'),
    jsonb_array_length(s -> 'firme') = catalogo and catalogo >= 15);
end $$;

-- 8 · l'indirizzo della lapide non lo legge il client, e il controllo non lo esegue.
insert into esiti select 8, 'indirizzi e controllo chiusi al client, la cancellazione a un argomento chiusa ad anon', 'false ×4',
  concat_ws(' ', pg_temp.privilegio('authenticated', 'public.indirizzi_delle_lapidi', 'tabella'),
    pg_temp.privilegio('anon', 'public.indirizzi_delle_lapidi', 'tabella'),
    pg_temp.privilegio('anon', 'public.indirizzo_di_un_account_cancellato(text)', 'funzione'),
    pg_temp.privilegio('anon', 'public.delete_own_account(boolean)', 'funzione')),
  concat_ws(' ', pg_temp.privilegio('authenticated', 'public.indirizzi_delle_lapidi', 'tabella'),
    pg_temp.privilegio('anon', 'public.indirizzi_delle_lapidi', 'tabella'),
    pg_temp.privilegio('anon', 'public.indirizzo_di_un_account_cancellato(text)', 'funzione'),
    pg_temp.privilegio('anon', 'public.delete_own_account(boolean)', 'funzione')) = 'false false false false';

-- 9 · la funzione del controllo risponde per la route (service role).
insert into esiti select 9, 'il controllo dice sì all''indirizzo della lapide e no a un altro', 'true false',
  coalesce(pg_temp.controllo('Firma-Lapide@test.it')::text, 'manca') || ' ' || coalesce(pg_temp.controllo('nessuno@test.it')::text, 'manca'),
  coalesce(pg_temp.controllo('Firma-Lapide@test.it'), false) and pg_temp.controllo('nessuno@test.it') = false;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where not coalesce(ok, false)) || ' ROTTE su ' || count(*) as riepilogo from esiti;

rollback;
