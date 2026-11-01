-- Verifica di 20261128100000 (Mario, 01/11): la scuola legge i suoi studenti da
-- `studenti_della_scuola()`, e le tre cose che dipendevano dalle policy tolte
-- (le iscrizioni, i messaggi, le classi) funzionano ancora.
--
-- È anche la TABELLA DEI SOGGETTI della migrazione: chi passava dalle due policy
-- prima di toglierle, e cosa succede dopo.
--
-- CONTROPROVA: su una replica nata senza la migrazione sono rosse la 1 e la 2
-- (la scuola legge data di nascita e telefono), la 3, la 4, la 5, la 11 e la 12
-- (la funzione non c'è, o il client inserisce da sé), la 13 e la 14. Verdi nei
-- due mondi: la 6 (lo studente legge i propri dati, il motivo per cui non
-- bastava stringere le colonne), la 7, la 8, la 9 e la 10 (le tre strade che
-- la cura doveva non rompere).
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('33333333-0000-0000-0000-0000000000c1', 'ref-sld@test.it'),
  ('22222222-0000-0000-0000-0000000000c1', 'ver-sld@test.it'),
  ('22222222-0000-0000-0000-0000000000c2', 'dic-sld@test.it'),
  ('22222222-0000-0000-0000-0000000000c3', 'altra-sld@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita, telefono) values
  ('33333333-0000-0000-0000-0000000000c1', 'referente_scuola', 'Ref', 'Sld', '1980-01-01', null),
  ('22222222-0000-0000-0000-0000000000c1', 'studente', 'Vera', 'Verificata', '2008-01-01', '333000001'),
  ('22222222-0000-0000-0000-0000000000c2', 'studente', 'Dino', 'Dichiarato', '2008-02-02', '333000002'),
  ('22222222-0000-0000-0000-0000000000c3', 'studente', 'Alba', 'Altrove', '2008-03-03', '333000003');
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('TESTSLD1', 'Scuola Sld', 'MI', 'Liceo'), ('TESTSLD2', 'Altra Sld', 'MI', 'Liceo') on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato)
  values ('dd000000-0000-0000-0000-0000000000c1', 'TESTSLD1', 'attiva');
insert into public.school_staff (scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da,
                                 puo_verificare_studenti, puo_gestire_classi, puo_certificare_presenze, puo_inviare_comunicazioni)
  values ('dd000000-0000-0000-0000-0000000000c1', '33333333-0000-0000-0000-0000000000c1', 'referente', true,
          '33333333-0000-0000-0000-0000000000c1', true, true, true, true);
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica) values
  ('22222222-0000-0000-0000-0000000000c1', 'TESTSLD1', '5A', 2027, 'verificato'),
  ('22222222-0000-0000-0000-0000000000c2', 'TESTSLD1', '5B', 2027, 'dichiarato'),
  ('22222222-0000-0000-0000-0000000000c3', 'TESTSLD2', '5A', 2027, 'verificato');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'Ente Sld', 'ente-sld', 'its', 'attiva');
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico) values
  ('e0000000-0000-0000-0000-0000000000c1', 'Evento Sld', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000c1',
   now() + interval '3 days', now() + interval '3 days 2 hours', 'approvato', 'studenti');
insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine) values
  ('22222222-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 'iscritto', 'scuola');
insert into public.classi (id, scuola_profilo_id, anno, sezione) values
  ('cc000000-0000-0000-0000-0000000000c1', 'dd000000-0000-0000-0000-0000000000c1', 5, 'A');

-- 1-2 · il referente non legge più le tabelle dei profili
do $$
declare v_sp int; v_p int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000c1', true);
  select count(*) into v_sp from public.student_profiles where school_code = 'TESTSLD1';
  select count(*) into v_p from public.profiles where id in ('22222222-0000-0000-0000-0000000000c1', '22222222-0000-0000-0000-0000000000c2') and data_nascita is not null;
  reset role;
  insert into esiti values (1, 'il referente non legge student_profiles dei suoi studenti', '0', v_sp::text, v_sp = 0);
  insert into esiti values (2, 'il referente non legge data di nascita e telefono dei suoi studenti', '0', v_p::text, v_p = 0);
end $$;

-- 3-5 · la funzione: chi, e quali colonne
do $$
declare v_n int; v_dic text; v_altra int; v_risultato text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000c1', true);
  begin
    execute $q$select count(*) from public.studenti_della_scuola()$q$ into v_n;
    execute $q$select email from public.studenti_della_scuola() where stato_verifica = 'dichiarato'$q$ into v_dic;
    execute $q$select count(*) from public.studenti_della_scuola() where user_id = '22222222-0000-0000-0000-0000000000c3'$q$ into v_altra;
  exception when others then v_n := null; v_dic := 'errore: ' || sqlerrm;
  end;
  reset role;
  select pg_get_function_result(to_regprocedure('public.studenti_della_scuola()')) into v_risultato;
  insert into esiti values (3, 'la funzione dà il dichiarato e il verificato della scuola, non quello di un''altra', '2 · altra 0',
    coalesce(v_n::text, 'null') || ' · altra ' || coalesce(v_altra::text, 'null'), v_n = 2 and v_altra = 0);
  insert into esiti values (4, 'il dichiarato ha l''email, per la verifica', 'dic-sld@test.it', coalesce(v_dic, 'null'), v_dic = 'dic-sld@test.it');
  insert into esiti values (5, 'la funzione non restituisce data di nascita, telefono, consenso, di_prova, anno_diploma', 'nessuna',
    coalesce(v_risultato, 'null'),
    v_risultato is not null and v_risultato !~* '(data_nascita|telefono|comunicazioni|di_prova|anno_diploma|verificato_da)');
end $$;

-- 6 · lo studente legge ancora i propri dati (la ragione per cui non bastavano i privilegi di colonna)
do $$
declare v text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-0000000000c2', true);
  select data_nascita::text into v from public.profiles where id = '22222222-0000-0000-0000-0000000000c2';
  reset role;
  insert into esiti values (6, 'lo studente legge la propria data di nascita', '2008-02-02', coalesce(v, 'null'), v = '2008-02-02');
end $$;

-- 7 · le iscrizioni dei verificati restano leggibili dalla scuola (il registro presenze)
do $$
declare v int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000c1', true);
  select count(*) into v from public.iscrizioni_eventi where evento_id = 'e0000000-0000-0000-0000-0000000000c1';
  reset role;
  insert into esiti values (7, 'il referente vede l''iscrizione del suo verificato', '1', v::text, v = 1);
end $$;

-- 8 · un messaggio a tutta la scuola arriva al verificato, e solo a lui
do $$
declare v int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000c1', true);
  perform public.invia_messaggio_scuola('tutta_scuola', 'Oggetto', 'Corpo', null, null, null);
  reset role;
  select count(*) into v from public.messaggi_scuola_destinatari d join public.messaggi_scuola m on m.id = d.messaggio_id
  where m.scuola_profilo_id = 'dd000000-0000-0000-0000-0000000000c1';
  insert into esiti values (8, 'un messaggio a tutta la scuola arriva al solo verificato', '1', v::text, v = 1);
end $$;

-- 9-10 · le classi: il verificato entra, il dichiarato no
do $$
declare v_ok text; v_no text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000c1', true);
  begin
    insert into public.classi_studenti (classe_id, student_id) values ('cc000000-0000-0000-0000-0000000000c1', '22222222-0000-0000-0000-0000000000c1');
    v_ok := 'entrato';
  exception when others then v_ok := 'errore: ' || sqlerrm;
  end;
  begin
    insert into public.classi_studenti (classe_id, student_id) values ('cc000000-0000-0000-0000-0000000000c1', '22222222-0000-0000-0000-0000000000c2');
    v_no := 'entrato';
  exception when others then v_no := sqlerrm;
  end;
  reset role;
  insert into esiti values (9, 'il referente mette il verificato in una classe', 'entrato', v_ok, v_ok = 'entrato');
  insert into esiti values (10, 'il dichiarato non entra in una classe', 'studente_non_verificato_o_scuola_diversa', v_no, v_no = 'studente_non_verificato_o_scuola_diversa');
end $$;

-- 11 · il client non consegna un messaggio da sé
do $$
declare v text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000c1', true);
  begin
    insert into public.messaggi_scuola_destinatari (messaggio_id, student_id)
    select id, '22222222-0000-0000-0000-0000000000c2' from public.messaggi_scuola limit 1;
    v := 'riuscito';
  exception when others then v := 'respinto: ' || sqlerrm;
  end;
  reset role;
  insert into esiti values (11, 'il referente non inserisce un destinatario a mano', 'respinto', v, v like 'respinto%');
end $$;

-- 12-13 · chi non è dello staff, e chi non ha fatto l'accesso
do $$
declare v int; v_anon boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-0000000000c1', true);
  begin
    execute $q$select count(*) from public.studenti_della_scuola()$q$ into v;
  exception when others then v := null;
  end;
  reset role;
  v_anon := coalesce(has_function_privilege('anon', to_regprocedure('public.studenti_della_scuola()'), 'execute'), true);
  insert into esiti values (12, 'uno studente che chiama la funzione non riceve niente', '0', coalesce(v::text, 'null'), v = 0);
  insert into esiti values (13, 'un visitatore non esegue la funzione', 'false', v_anon::text, not v_anon);
end $$;

-- 14 · la funzione dell'email di prima non c'è più
insert into esiti
  select 14, 'email_studenti_scuola è uscita', 'assente',
         case when to_regprocedure('public.email_studenti_scuola(uuid[])') is null then 'assente' else 'presente' end,
         to_regprocedure('public.email_studenti_scuola(uuid[])') is null;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where not coalesce(ok, false)) || ' ROTTE su ' || count(*) as riepilogo from esiti;

rollback;
