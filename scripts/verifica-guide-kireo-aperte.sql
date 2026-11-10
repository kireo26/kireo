-- verifica-guide-kireo-aperte.sql — un registro di attività non è un titolo di
-- accesso (20261211100000, 20261211110000). Solo replica: `npm run sql:tutti`.
--
-- Le guide aperte le scrive solo il server; il browser scrive activity_log solo
-- con quattro tipi e il peso deciso dal database; e il client non inserisce più
-- in activity_log. Controlli: la scrittura del server e quella del browser
-- funzionano ancora.
begin;
create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values
  ('f3000000-0000-0000-0000-0000000000a1', 'ente-ga@prova.invalid'),
  ('f3000000-0000-0000-0000-0000000000a2', 'stud-ga@prova.invalid'),
  ('f3000000-0000-0000-0000-0000000000a3', 'stud2-ga@prova.invalid');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita) values
  ('f3000000-0000-0000-0000-0000000000a1', 'istituzione', 'E', 'Ga', null),
  ('f3000000-0000-0000-0000-0000000000a2', 'studente', 'S', 'Ga', '2008-01-01'),
  ('f3000000-0000-0000-0000-0000000000a3', 'studente', 'T', 'Ga', '2008-01-01');
insert into public.istituzioni(id, nome, slug, tipo, stato, piano_id) values
  ('e3000000-0000-0000-0000-0000000000a1', 'Ente Ga', 'ente-ga', 'its', 'attiva', (select id from public.piani where nome = 'free'));
insert into public.eventi(id, titolo, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico)
values ('ad000000-0000-0000-0000-0000000000a1', 'Incontro Ga', 'altro', 'e3000000-0000-0000-0000-0000000000a1',
        now() + interval '3 days', now() + interval '3 days 1 hour', 'approvato', 'studenti');
insert into public.eventi_aree(evento_id, area_slug) values ('ad000000-0000-0000-0000-0000000000a1', 'informatica-digitale');
insert into public.iscrizioni_eventi(evento_id, student_id) values ('ad000000-0000-0000-0000-0000000000a1', 'f3000000-0000-0000-0000-0000000000a2');

-- 1. Il client non inserisce in activity_log (né lo studente, né anon).
do $$
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-0000-0000-0000000000a2', true);
  set local role authenticated;
  insert into public.activity_log(student_id, area_slug, tipo_attivita, peso, livello)
  values ('f3000000-0000-0000-0000-0000000000a2', 'informatica-digitale', 'download_guida', 5, 3);
  reset role;
  insert into esiti values (1, 'lo studente non si scrive un download_guida di livello 3', '42501', false, '*** PASSA ***');
exception when insufficient_privilege then
  reset role;
  insert into esiti values (1, 'lo studente non si scrive un download_guida di livello 3', '42501', true, '42501');
when others then
  reset role;
  insert into esiti values (1, 'lo studente non si scrive un download_guida di livello 3', '42501', false, sqlstate || ' ' || sqlerrm);
end $$;

-- 2. Il client non scrive guide_kireo_aperte.
do $$
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-0000-0000-0000000000a2', true);
  set local role authenticated;
  insert into public.guide_kireo_aperte(student_id, area_slug, livello)
  values ('f3000000-0000-0000-0000-0000000000a2', 'informatica-digitale', 3);
  reset role;
  insert into esiti values (2, 'lo studente non si apre una guida da sé', '42501', false, '*** PASSA ***');
exception when insufficient_privilege then
  reset role;
  insert into esiti values (2, 'lo studente non si apre una guida da sé', '42501', true, '42501');
when others then
  reset role;
  insert into esiti values (2, 'lo studente non si apre una guida da sé', '42501', false, sqlstate || ' ' || sqlerrm);
end $$;

-- 3. Il client non esegue la scrittura del server.
insert into esiti select 3, 'registra_apertura_guida_kireo la esegue solo la service role', 'f · f · t',
  not has_function_privilege('authenticated', 'public.registra_apertura_guida_kireo(uuid, text, integer)', 'execute')
  and not has_function_privilege('anon', 'public.registra_apertura_guida_kireo(uuid, text, integer)', 'execute')
  and has_function_privilege('service_role', 'public.registra_apertura_guida_kireo(uuid, text, integer)', 'execute'),
  has_function_privilege('authenticated', 'public.registra_apertura_guida_kireo(uuid, text, integer)', 'execute')::text || ' · '
  || has_function_privilege('anon', 'public.registra_apertura_guida_kireo(uuid, text, integer)', 'execute')::text || ' · '
  || has_function_privilege('service_role', 'public.registra_apertura_guida_kireo(uuid, text, integer)', 'execute')::text;

-- 4. Il browser non registra download_guida né un tipo di workshop.
do $$
declare v_tipi text := '';
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-0000-0000-0000000000a2', true);
  set local role authenticated;
  begin
    perform public.registra_attivita('informatica-digitale', 'download_guida');
    v_tipi := v_tipi || 'download_guida ';
  exception when others then null; end;
  begin
    perform public.registra_attivita('informatica-digitale', 'workshop_pcto');
    v_tipi := v_tipi || 'workshop_pcto ';
  exception when others then null; end;
  reset role;
  insert into esiti values (4, 'registra_attivita rifiuta download_guida e workshop_pcto', 'nessuno', v_tipi = '', coalesce(nullif(v_tipi, ''), 'nessuno'));
end $$;

-- 5. Controllo: il browser registra una visita, con il peso del database.
do $$
declare v_esito text; v_peso int;
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-0000-0000-0000000000a2', true);
  set local role authenticated;
  v_esito := public.registra_attivita('informatica-digitale', 'visita_area');
  reset role;
  select peso into v_peso from public.activity_log
   where student_id = 'f3000000-0000-0000-0000-0000000000a2' and tipo_attivita = 'visita_area';
  insert into esiti values (5, 'una visita si registra, con peso 1', 'registrata · 1', v_esito = 'registrata' and v_peso = 1, v_esito || ' · ' || coalesce(v_peso::text, 'nessuna riga'));
exception when others then
  reset role;
  insert into esiti values (5, 'una visita si registra, con peso 1', 'registrata · 1', false, sqlstate || ' ' || sqlerrm);
end $$;

-- 6. L'iscrizione a un webinar conta solo con un'iscrizione a un evento dell'area.
do $$
declare v_con text; v_senza text;
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-0000-0000-0000000000a2', true);
  set local role authenticated;
  v_con := public.registra_attivita('informatica-digitale', 'iscrizione_webinar');
  v_senza := public.registra_attivita('musica-spettacolo', 'iscrizione_webinar');
  reset role;
  insert into esiti values (6, 'iscrizione_webinar: sì nell''area dell''evento, no fuori', 'registrata · senza_iscrizione',
    v_con = 'registrata' and v_senza = 'senza_iscrizione', v_con || ' · ' || v_senza);
exception when others then
  reset role;
  insert into esiti values (6, 'iscrizione_webinar', 'registrata · senza_iscrizione', false, sqlstate || ' ' || sqlerrm);
end $$;

-- 7. Controllo: il server scrive l'apertura e il conteggio con il peso del livello.
do $$
declare v_nuova boolean; v_ancora boolean; v_righe int; v_peso int;
begin
  set local role service_role;
  v_nuova := public.registra_apertura_guida_kireo('f3000000-0000-0000-0000-0000000000a2', 'informatica-digitale', 3);
  v_ancora := public.registra_apertura_guida_kireo('f3000000-0000-0000-0000-0000000000a2', 'informatica-digitale', 3);
  reset role;
  select count(*) into v_righe from public.guide_kireo_aperte
   where student_id = 'f3000000-0000-0000-0000-0000000000a2' and area_slug = 'informatica-digitale' and livello = 3;
  select peso into v_peso from public.activity_log
   where student_id = 'f3000000-0000-0000-0000-0000000000a2' and tipo_attivita = 'download_guida' and livello = 3;
  insert into esiti values (7, 'il server apre la guida 3 una volta, e il conteggio pesa 5', 'true · false · 1 · 5',
    v_nuova and not v_ancora and v_righe = 1 and v_peso = 5, v_nuova || ' · ' || v_ancora || ' · ' || v_righe || ' · ' || coalesce(v_peso::text, '-'));
exception when others then
  reset role;
  insert into esiti values (7, 'il server apre la guida 3', 'true · false · 1 · 5', false, sqlstate || ' ' || sqlerrm);
end $$;

-- 8. Lo studente legge le proprie aperture, non quelle dell'altro, e non la nota del riempimento.
insert into public.guide_kireo_aperte(student_id, area_slug, livello) values ('f3000000-0000-0000-0000-0000000000a3', 'informatica-digitale', 2);
do $$
declare v int;
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-0000-0000-0000000000a2', true);
  set local role authenticated;
  select count(*) into v from public.guide_kireo_aperte;
  reset role;
  insert into esiti values (8, 'lo studente legge la sua apertura e non quella dell''altro', '1', v = 1, v::text);
exception when others then
  reset role;
  insert into esiti values (8, 'lo studente legge le sue aperture', '1', false, sqlstate || ' ' || sqlerrm);
end $$;
insert into esiti select 9, 'da_activity_log non lo legge il client', 'false',
  not has_column_privilege('authenticated', 'public.guide_kireo_aperte', 'da_activity_log', 'SELECT'),
  has_column_privilege('authenticated', 'public.guide_kireo_aperte', 'da_activity_log', 'SELECT')::text;

-- 10. Nessuna policy di insert resta su activity_log.
insert into esiti select 10, 'nessuna policy di insert su activity_log', '0',
  count(*) = 0, count(*)::text from pg_policies where tablename = 'activity_log' and cmd = 'INSERT';

select n, proprieta, atteso, osservato, case when ok then '✓' else '✗ ROTTA' end from esiti order by n;
select count(*) filter (where not ok) || ' ROTTE' from esiti;
rollback;
