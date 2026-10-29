-- Verifica di 20261115100000 (29/10): le statistiche dell'ente in quattro
-- sezioni, gli scaricamenti contati tutti, le uscite dalla newsletter.
--
-- LE CONTROPROVE (29/10, `scripts/controprova-sql.sh`, tutte RIUSCITE, rosse
-- dichiarate prima): su una replica nata senza la migrazione lo script si
-- ferma alla prima chiamata, quindi le sabotature si fanno sulla replica con
-- la migrazione. La soglia a 0 → rossa la 5; il docente contato fra gli
-- studenti (tolto il filtro sul ruolo) → la 6; il trigger delle uscite tolto →
-- la 8; `registra_download_guida` senza il contatore → la 1 e la 9.
--
-- Transazione con ROLLBACK. Ogni blocco rimette l'identità che usa.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated, service_role;

insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('SCSTAT00001', 'Liceo Prova', 'Napoli', 'Liceo'),
  ('SCSTAT00002', 'Tecnico Prova', 'Salerno', 'Tecnico');

-- Otto studenti: sei con l'area informatica (Napoli, Liceo), due con l'area
-- salute (Salerno, Tecnico). Più un docente che segue l'ente, e uno studente
-- iscritto a un evento dalla sua scuola e basta.
insert into auth.users (id, email)
  select ('44444444-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'stud-q' || i || '@test.it'
    from generate_series(1, 9) i;
insert into auth.users (id, email) values
  ('44444444-0000-0000-0000-0000000000e1', 'ente-q@test.it'),
  ('44444444-0000-0000-0000-0000000000e2', 'ente-altro-q@test.it'),
  ('44444444-0000-0000-0000-0000000000dd', 'doc-q@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita)
  select ('44444444-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'studente', 'S', 'Q' || i, '2005-01-01'
    from generate_series(1, 9) i;
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('44444444-0000-0000-0000-0000000000e1', 'istituzione', 'E', 'Q', null),
  ('44444444-0000-0000-0000-0000000000e2', 'istituzione', 'E', 'Altro', null),
  ('44444444-0000-0000-0000-0000000000dd', 'docente', 'D', 'Q', null);
insert into public.student_profiles (user_id, school_code, classe, anno_diploma)
  select ('44444444-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid,
         case when i <= 6 then 'SCSTAT00001' else 'SCSTAT00002' end, '5A', 2027
    from generate_series(1, 9) i;
insert into public.student_area_interests (user_id, area_slug)
  select ('44444444-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid,
         case when i <= 6 then 'informatica-digitale' else 'salute-professioni-sanitarie' end
    from generate_series(1, 8) i;
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('cccccccc-0000-0000-0000-0000000000e1', 'Ente Q', 'ente-q', 'universita', 'attiva'),
  ('cccccccc-0000-0000-0000-0000000000e2', 'Ente Altro Q', 'ente-altro-q', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('44444444-0000-0000-0000-0000000000e1', 'cccccccc-0000-0000-0000-0000000000e1'),
  ('44444444-0000-0000-0000-0000000000e2', 'cccccccc-0000-0000-0000-0000000000e2');

-- I gesti: gli otto studenti seguono l'ente; il docente pure.
insert into public.seguiti (student_id, istituzione_id)
  select ('44444444-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'cccccccc-0000-0000-0000-0000000000e1'
    from generate_series(1, 8) i;
insert into public.seguiti (student_id, istituzione_id) values
  ('44444444-0000-0000-0000-0000000000dd', 'cccccccc-0000-0000-0000-0000000000e1');

-- Una diretta finita (un'ora, mai chiusa: durata = la programmata) con tre
-- iscritti, due collegati (30 e 60 minuti); un evento in programma; una bozza.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'Diretta Q', 'x', 'webinar', 'cccccccc-0000-0000-0000-0000000000e1', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti'),
  ('eeeeeeee-0000-0000-0000-0000000000a2', 'Futuro Q', 'x', 'webinar', 'cccccccc-0000-0000-0000-0000000000e1', now() + interval '3 days', now() + interval '3 days 1 hour', 'approvato', 'studenti'),
  ('eeeeeeee-0000-0000-0000-0000000000a3', 'Bozza Q', 'x', 'webinar', 'cccccccc-0000-0000-0000-0000000000e1', now() + interval '3 days', now() + interval '3 days 1 hour', 'bozza', 'studenti');
insert into public.iscrizioni_eventi (evento_id, student_id, stato) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', '44444444-0000-0000-0000-000000000001', 'iscritto'),
  ('eeeeeeee-0000-0000-0000-0000000000a1', '44444444-0000-0000-0000-000000000002', 'iscritto'),
  -- lo studente 9: iscritto e basta (dalla scuola), nessun gesto suo verso l'ente
  ('eeeeeeee-0000-0000-0000-0000000000a1', '44444444-0000-0000-0000-000000000009', 'iscritto');
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', '44444444-0000-0000-0000-000000000001', 30),
  ('eeeeeeee-0000-0000-0000-0000000000a1', '44444444-0000-0000-0000-000000000002', 60);

-- Due guide: la prima, poi la seconda (che archivia la prima).
insert into public.guide_enti (id, istituzione_id, titolo, pdf_url) values
  ('99999999-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000e1', 'Guida vecchia Q', 'https://esempio.it/v.pdf');
insert into public.guide_enti (id, istituzione_id, titolo, pdf_url) values
  ('99999999-0000-0000-0000-0000000000a2', 'cccccccc-0000-0000-0000-0000000000e1', 'Guida nuova Q', 'https://esempio.it/n.pdf');

-- Newsletter: tre iscritti.
insert into public.newsletter_iscrizioni (student_id, istituzione_id)
  select ('44444444-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'cccccccc-0000-0000-0000-0000000000e1'
    from generate_series(1, 3) i;

-- 1-3. Gli scaricamenti: uno da uno studente, uno da un docente, uno senza
-- accesso (la route, con la service-role). Tre scaricamenti, uno studente.
do $$
declare v_anon boolean; v_archiviata boolean; v_tot bigint; v_stud bigint;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-000000000001', true);
  perform public.registra_download_guida('99999999-0000-0000-0000-0000000000a2');
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000dd', true);
  perform public.registra_download_guida('99999999-0000-0000-0000-0000000000a2');
  set local role service_role;
  perform set_config('request.jwt.claim.sub', '', true);
  v_anon := public.incrementa_scaricamenti_guida('99999999-0000-0000-0000-0000000000a2');
  v_archiviata := public.incrementa_scaricamenti_guida('99999999-0000-0000-0000-0000000000a1');
  reset role;
  select coalesce(sum(scaricamenti), 0) into v_tot from public.contatore_scaricamenti_guide
   where guida_id = '99999999-0000-0000-0000-0000000000a2';
  select count(*) into v_stud from public.scaricamenti_guide_enti where guida_id = '99999999-0000-0000-0000-0000000000a2';
  insert into esiti values (1, 'tre scaricamenti contati (studente, docente, senza accesso), uno studente con un nome', '3 · 1',
    format('%s · %s', v_tot, v_stud), v_tot = 3 and v_stud = 1);
  insert into esiti values (2, 'una guida archiviata non si conta', 'falso', v_archiviata::text, not v_archiviata);
  insert into esiti values (3, 'senza accesso: la route conta (true)', 'true', v_anon::text, v_anon);
end $$;

-- 4. Il client non incrementa il contatore da sé.
do $$
declare v_anon text := 'eseguita'; v_auth text := 'eseguita';
begin
  set local role anon;
  begin perform public.incrementa_scaricamenti_guida('99999999-0000-0000-0000-0000000000a2');
  exception when insufficient_privilege then v_anon := 'negata'; end;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-000000000001', true);
  begin perform public.incrementa_scaricamenti_guida('99999999-0000-0000-0000-0000000000a2');
  exception when insufficient_privilege then v_auth := 'negata'; end;
  reset role;
  insert into esiti values (4, 'anon e authenticated non incrementano il contatore', 'negata · negata',
    format('%s · %s', v_anon, v_auth), v_anon = 'negata' and v_auth = 'negata');
end $$;

-- 8 (prima, perché le sezioni la leggono). Uno studente esce dalla newsletter.
delete from public.newsletter_iscrizioni
 where student_id = '44444444-0000-0000-0000-000000000003' and istituzione_id = 'cccccccc-0000-0000-0000-0000000000e1';

-- Le sezioni, lette dall'ente.
create temp table quadro (q jsonb) on commit drop;
grant all on quadro to authenticated;
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000e1', true);
  insert into quadro select public.statistiche_ente('cccccccc-0000-0000-0000-0000000000e1');
  reset role;
end $$;

-- 5-6. Studenti: otto (il docente e lo studente iscritto dalla scuola no), la
-- soglia sulle aree.
insert into esiti
  select 5, 'per area: 6 informatica si mostra, i 2 di salute vanno in «altre»',
         'informatica-digitale=6 · altre 2',
         (select string_agg(r ->> 'chiave' || '=' || (r ->> 'n'), ',') from jsonb_array_elements(q -> 'studenti' -> 'per_area' -> 'righe') r)
           || ' · altre ' || (q -> 'studenti' -> 'per_area' ->> 'altre'),
         (q -> 'studenti' -> 'per_area' -> 'righe') = '[{"chiave":"informatica-digitale","n":6}]'::jsonb
           and (q -> 'studenti' -> 'per_area' ->> 'altre')::int = 2
    from quadro;
insert into esiti
  select 6, 'studenti: 8 (non il docente che segue, non chi è stato iscritto dalla scuola), tutti nuovi questo mese',
         '8 · 8', (q -> 'studenti' ->> 'totale') || ' · ' || (q -> 'studenti' ->> 'nuovi_mese'),
         (q -> 'studenti' ->> 'totale')::int = 8 and (q -> 'studenti' ->> 'nuovi_mese')::int = 8
    from quadro;

-- 7. Eventi: uno in programma, uno passato, la bozza fuori; 2 su 3 iscritti
-- collegati; permanenza media (30+60)/2 su 60 = 75%.
insert into esiti
  select 7, 'eventi: 1 in programma · 1 passato · 2 di 3 collegati · permanenza 75%',
         '1 · 1 · 2/3 · 75',
         format('%s · %s · %s/%s · %s', q -> 'eventi' ->> 'in_programma', q -> 'eventi' ->> 'passati',
                q -> 'eventi' ->> 'iscritti_collegati', q -> 'eventi' ->> 'iscritti_dirette_finite',
                q -> 'eventi' ->> 'permanenza_media_pct'),
         (q -> 'eventi' ->> 'in_programma')::int = 1 and (q -> 'eventi' ->> 'passati')::int = 1
           and (q -> 'eventi' ->> 'iscritti_collegati')::int = 2 and (q -> 'eventi' ->> 'iscritti_dirette_finite')::int = 3
           and (q -> 'eventi' ->> 'permanenza_media_pct')::int = 75
    from quadro;

-- 8. Newsletter: 2 iscritti, 2 nuovi questo mese (chi è uscito non c'è più
-- fra gli iscritti, e sta fra i persi), 1 perso.
insert into esiti
  select 8, 'newsletter: 2 iscritti · 2 nuovi questo mese · 1 perso',
         '2 · 2 · 1',
         format('%s · %s · %s', q -> 'newsletter' ->> 'iscritti', q -> 'newsletter' ->> 'nuovi_mese', q -> 'newsletter' ->> 'persi_mese'),
         (q -> 'newsletter' ->> 'iscritti')::int = 2 and (q -> 'newsletter' ->> 'nuovi_mese')::int = 2
           and (q -> 'newsletter' ->> 'persi_mese')::int = 1
    from quadro;

-- 9. Guide: tre scaricamenti, uno studente, e la guida archiviata nel
-- dettaglio con il suo titolo e la data di archivio.
insert into esiti
  select 9, 'guide: 3 scaricamenti · 1 studente · due guide nel dettaglio, la vecchia con la data di archivio',
         '3 · 1 · 2 · archiviata',
         format('%s · %s · %s · %s', q -> 'guide' ->> 'scaricamenti', q -> 'guide' ->> 'studenti',
                jsonb_array_length(q -> 'guide' -> 'per_guida'),
                (select case when g ->> 'archiviata_il' is not null then 'archiviata' else 'pubblica' end
                   from jsonb_array_elements(q -> 'guide' -> 'per_guida') g where g ->> 'titolo' = 'Guida vecchia Q')),
         (q -> 'guide' ->> 'scaricamenti')::int = 3 and (q -> 'guide' ->> 'studenti')::int = 1
           and jsonb_array_length(q -> 'guide' -> 'per_guida') = 2
           and exists (select 1 from jsonb_array_elements(q -> 'guide' -> 'per_guida') g
                        where g ->> 'titolo' = 'Guida vecchia Q' and g ->> 'archiviata_il' is not null)
    from quadro;

-- 10. Un altro ente non legge queste statistiche.
do $$
declare v text := 'letto';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000e2', true);
  begin perform public.statistiche_ente('cccccccc-0000-0000-0000-0000000000e1');
  exception when others then v := sqlerrm; end;
  reset role;
  insert into esiti values (10, 'un altro ente: non_autorizzato', 'non_autorizzato', v, v = 'non_autorizzato');
end $$;

-- 11. interazioni_stimate non è più nella vista.
insert into esiti
  select 11, 'stats_istituzione senza interazioni_stimate', '0', count(*)::text, count(*) = 0
    from information_schema.columns
   where table_schema = 'public' and table_name = 'stats_istituzione' and column_name = 'interazioni_stimate';

-- 12. Cancellare un ente con iscritti alla newsletter non si inceppa sul
-- contatore delle uscite.
do $$
declare v text := 'cancellato';
begin
  insert into public.newsletter_iscrizioni (student_id, istituzione_id) values
    ('44444444-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-0000000000e2');
  begin
    delete from public.institution_profiles where istituzione_id = 'cccccccc-0000-0000-0000-0000000000e2';
    delete from public.istituzioni where id = 'cccccccc-0000-0000-0000-0000000000e2';
  exception when others then v := sqlerrm; end;
  insert into esiti values (12, 'un ente con iscritti alla newsletter si cancella', 'cancellato', v, v = 'cancellato');
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
