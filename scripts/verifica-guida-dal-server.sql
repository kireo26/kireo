-- Verifica di 20261114100000 (29/10): la guida di un ente, una pubblica e le
-- altre in archivio, e lo scaricamento registrato dal server.
--
-- LE CONTROPROVE (29/10, `scripts/controprova-sql.sh`, tutte RIUSCITE):
--   - su una replica nata senza la migrazione lo script si ferma alla 1
--     (`registra_download_guida` non esiste): non dice niente, e per questo le
--     sabotature si fanno sulla replica con la migrazione;
--   - la policy del recinto rimessa com'era (`student_id = auth.uid()`) e il
--     trigger di sostituzione tolto: rosse esattamente 5, 6, 8, 9, 10 — la
--     tabella dei soggetti (7-11) è verde sullo studente e sull'anonimo anche
--     prima, e il docente, l'ente e l'admin passavano;
--   - la funzione che registra chiunque abbia fatto l'accesso (senza il
--     ruolo): rosse 4, 6, 14. ⚠️ Avevo previsto la sola 4: il docente che
--     scrive conta anche fra chi ha scaricato la vecchia guida (6) e nelle
--     statistiche (14). Sono effetti veri della stessa sabotatura.

-- Transazione con ROLLBACK. Ogni blocco rimette l'identità che usa.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('33333333-0000-0000-0000-0000000000e1', 'ente-guida@test.it'),
  ('33333333-0000-0000-0000-0000000000e2', 'ente-altro@test.it'),
  ('33333333-0000-0000-0000-0000000000a1', 'admin-guida@test.it'),
  ('33333333-0000-0000-0000-0000000000c1', 'stud-guida@test.it'),
  ('33333333-0000-0000-0000-0000000000dd', 'doc-guida@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('33333333-0000-0000-0000-0000000000e1', 'istituzione', 'E', 'Guida', null),
  ('33333333-0000-0000-0000-0000000000e2', 'istituzione', 'E', 'Altro', null),
  ('33333333-0000-0000-0000-0000000000a1', 'admin', 'A', 'Dmin', null),
  ('33333333-0000-0000-0000-0000000000c1', 'studente', 'S', 'Tudente', '2008-01-01'),
  ('33333333-0000-0000-0000-0000000000dd', 'docente', 'D', 'Ocente', null);
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'Ente Guida', 'ente-guida', 'universita', 'attiva'),
  ('bbbbbbbb-0000-0000-0000-0000000000e2', 'Ente Altro', 'ente-altro', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('33333333-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-0000000000e1'),
  ('33333333-0000-0000-0000-0000000000e2', 'bbbbbbbb-0000-0000-0000-0000000000e2');

-- La prima guida dell'ente, scritta da postgres.
insert into public.guide_enti (id, istituzione_id, titolo, pdf_url) values
  ('99999999-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000e1', 'Guida uno', 'https://esempio.it/uno.pdf');

-- 1-2. Lo studente collegato scarica: il server scrive recinto e scaricamento,
-- prima di rispondere con il file. La seconda volta non duplica niente.
do $$
declare v jsonb; v_rec int; v_sca int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000c1', true);
  v := public.registra_download_guida('99999999-0000-0000-0000-000000000001');
  perform public.registra_download_guida('99999999-0000-0000-0000-000000000001');
  reset role;
  select count(*) into v_rec from public.recinto_enti
   where student_id = '33333333-0000-0000-0000-0000000000c1' and origine = 'guida';
  select count(*) into v_sca from public.scaricamenti_guide_enti
   where student_id = '33333333-0000-0000-0000-0000000000c1';
  insert into esiti values (1, 'lo studente collegato: il file, e il server registra', 'ok · https://esempio.it/uno.pdf · true',
    format('%s · %s · %s', v ->> 'stato', v ->> 'pdf_url', v ->> 'registrato'),
    v ->> 'stato' = 'ok' and v ->> 'pdf_url' = 'https://esempio.it/uno.pdf' and (v ->> 'registrato')::boolean);
  insert into esiti values (2, 'una riga di recinto e una di scaricamento, anche scaricando due volte', '1 · 1',
    format('%s · %s', v_rec, v_sca), v_rec = 1 and v_sca = 1);
end $$;

-- 3-4. L'anonimo non esegue la funzione (la route gli legge la guida con la
-- lettura pubblica); il docente riceve il file e non lascia righe.
do $$
declare v_anon text := 'eseguita'; v_pdf text; v_doc jsonb; v_righe int;
begin
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.registra_download_guida('99999999-0000-0000-0000-000000000001');
  exception when insufficient_privilege then v_anon := 'negata';
  end;
  select pdf_url into v_pdf from public.guide_enti where id = '99999999-0000-0000-0000-000000000001';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000dd', true);
  v_doc := public.registra_download_guida('99999999-0000-0000-0000-000000000001');
  reset role;
  select count(*) into v_righe from public.scaricamenti_guide_enti
   where student_id = '33333333-0000-0000-0000-0000000000dd';
  insert into esiti values (3, 'senza accesso: la funzione no, la guida pubblica sì (dalla lettura normale)', 'negata · https://esempio.it/uno.pdf',
    format('%s · %s', v_anon, coalesce(v_pdf, 'nessuna')),
    v_anon = 'negata' and v_pdf = 'https://esempio.it/uno.pdf');
  insert into esiti values (4, 'un docente collegato: il file sì, nessuna riga (non è uno studente)', 'ok · false · 0',
    format('%s · %s · %s', v_doc ->> 'stato', v_doc ->> 'registrato', v_righe),
    v_doc ->> 'stato' = 'ok' and not (v_doc ->> 'registrato')::boolean and v_righe = 0);
end $$;

-- 5-6. L'ente carica una seconda guida: la prima va in archivio, non sparisce.
do $$
declare v_vecchia jsonb; v_pubbliche int; v_righe_vecchie int; v_archiviata timestamptz;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000e1', true);
  insert into public.guide_enti (istituzione_id, titolo, pdf_url)
    values ('bbbbbbbb-0000-0000-0000-0000000000e1', 'Guida due', 'https://esempio.it/due.pdf');
  -- (l'id lo sceglie il database: il client non scrive `id`)
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  select count(*) into v_pubbliche from public.guide_enti where istituzione_id = 'bbbbbbbb-0000-0000-0000-0000000000e1';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000c1', true);
  v_vecchia := public.registra_download_guida('99999999-0000-0000-0000-000000000001');
  reset role;
  select archiviata_il into v_archiviata from public.guide_enti where id = '99999999-0000-0000-0000-000000000001';
  select count(*) into v_righe_vecchie from public.scaricamenti_guide_enti
   where guida_id = '99999999-0000-0000-0000-000000000001';
  insert into esiti values (5, 'una guida nuova archivia la vecchia: il pubblico ne legge una', '1 · archiviata',
    format('%s · %s', v_pubbliche, case when v_archiviata is null then 'pubblica' else 'archiviata' end),
    v_pubbliche = 1 and v_archiviata is not null);
  insert into esiti values (6, 'la vecchia non si scarica più, ma lo slug riporta alla pagina, e chi l''ha presa resta legato a lei',
    'non_pubblica · ente-guida · 1', format('%s · %s · %s', v_vecchia ->> 'stato', v_vecchia ->> 'slug', v_righe_vecchie),
    v_vecchia ->> 'stato' = 'non_pubblica' and v_vecchia ->> 'slug' = 'ente-guida' and v_righe_vecchie = 1);
end $$;

-- 7-11. La tabella dei soggetti della policy di insert del recinto.
create temp table soggetti (n int, chi text, sub text, ruolo text, deve boolean) on commit drop;
grant all on soggetti to anon, authenticated;
insert into soggetti values
  (7, 'lo studente', '33333333-0000-0000-0000-0000000000c1', 'authenticated', true),
  (8, 'il docente', '33333333-0000-0000-0000-0000000000dd', 'authenticated', false),
  (9, 'l''ente', '33333333-0000-0000-0000-0000000000e1', 'authenticated', false),
  (10, 'l''admin', '33333333-0000-0000-0000-0000000000a1', 'authenticated', false),
  (11, 'l''anonimo', '', 'anon', false);

do $$
declare r record; v_passa boolean;
begin
  for r in select * from soggetti order by n loop
    begin
      execute format('set local role %I', r.ruolo);
      perform set_config('request.jwt.claim.sub', r.sub, true);
      insert into public.recinto_enti (student_id, istituzione_id, origine)
        values (nullif(r.sub, '')::uuid, 'bbbbbbbb-0000-0000-0000-0000000000e2', 'newsletter');
      v_passa := true;
      raise exception 'passa_e_si_annulla';
    exception when others then
      if sqlerrm <> 'passa_e_si_annulla' then v_passa := false; end if;
    end;
    reset role;
    insert into esiti values (r.n, format('%s scrive la propria riga nel recinto', r.chi),
      case when r.deve then 'passa' else 'respinto' end,
      case when v_passa then 'passa' else 'respinto' end, v_passa = r.deve);
  end loop;
end $$;

-- 12-13. La guida pubblica la sceglie l'ente, una volta; un altro ente no.
do $$
declare v_altro text := 'nessun errore'; v_vecchia timestamptz; v_nuove int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000e2', true);
  begin
    perform public.scegli_guida_pubblica('99999999-0000-0000-0000-000000000001');
  exception when others then v_altro := sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000e1', true);
  perform public.scegli_guida_pubblica('99999999-0000-0000-0000-000000000001');
  reset role;
  select archiviata_il into v_vecchia from public.guide_enti where id = '99999999-0000-0000-0000-000000000001';
  select count(*) into v_nuove from public.guide_enti
   where istituzione_id = 'bbbbbbbb-0000-0000-0000-0000000000e1' and archiviata_il is null;
  insert into esiti values (12, 'un altro ente non sceglie la guida pubblica di questo', 'non_autorizzato', v_altro, v_altro = 'non_autorizzato');
  insert into esiti values (13, 'l''ente rimette pubblica la prima: una sola pubblica, nessuna cancellata', 'pubblica · 1',
    format('%s · %s', case when v_vecchia is null then 'pubblica' else 'archiviata' end, v_nuove),
    v_vecchia is null and v_nuove = 1);
end $$;

-- 14. Le statistiche contano gli scaricamenti, da zero.
do $$
declare v_download bigint; v_guide bigint;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000e1', true);
  select download_guida, guide_pubblicate into v_download, v_guide from public.stats_istituzione;
  reset role;
  insert into esiti values (14, 'download guida = studenti che hanno scaricato; guide pubblicate = le non archiviate', '1 · 1',
    format('%s · %s', v_download, v_guide), v_download = 1 and v_guide = 1);
end $$;

-- 15. Il client non scrive l'archivio né gli scaricamenti.
do $$
declare v_upd boolean := false; v_ins boolean := false;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000e1', true);
  begin
    update public.guide_enti set archiviata_il = null where istituzione_id = 'bbbbbbbb-0000-0000-0000-0000000000e1';
    v_upd := true;
  exception when others then null;
  end;
  -- Una guida che lo studente NON ha scaricato: un rifiuto per chiave doppia
  -- sarebbe un verde per la ragione sbagliata.
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000c1', true);
  begin
    insert into public.scaricamenti_guide_enti (guida_id, student_id, istituzione_id)
      select id, '33333333-0000-0000-0000-0000000000c1', istituzione_id from public.guide_enti
       where istituzione_id = 'bbbbbbbb-0000-0000-0000-0000000000e1' and titolo = 'Guida due';
    v_ins := true;
  exception when others then null;
  end;
  reset role;
  insert into esiti values (15, 'dal client: l''archivio e gli scaricamenti non si scrivono', 'respinto · respinto',
    format('%s · %s', case when v_upd then 'passa' else 'respinto' end, case when v_ins then 'passa' else 'respinto' end),
    not v_upd and not v_ins);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
