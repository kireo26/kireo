-- Verifica di 20261204110000 (03/11): conservare tutto, togliere il nome.
--
-- Cancella per davvero uno studente CON attività (gesti verso un ente, una
-- diretta seguita e certificata, un'iscrizione futura, domande, la domanda
-- finale, una conversazione con l'ente, un workshop, il diario, una missione,
-- la classe, una notifica, la newsletter) e un docente con un attestato. Poi
-- guarda le quattro cose di Mario: i fatti restano, il testo esce, i rapporti
-- si chiudono, le ore restano col nome. E la guardia che ha chiesto: le
-- statistiche dell'ente e della scuola NON cambiano, «Studenti raggiunti
-- dall'inizio» compresi.
--
-- ⚠️ La newsletter dell'ente cambia, e deve: chi la riceverà scende di uno e
-- le uscite del mese salgono di uno. Una cancellazione è un'uscita vera.
-- La 1 confronta le altre tre sezioni e dice a parte cosa fa la newsletter.
--
-- Transazione con ROLLBACK. Ogni blocco rimette l'identità che usa.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated, service_role;
create temp table prima (chiave text primary key, valore jsonb) on commit drop;

-- Sei studenti della stessa scuola e della stessa area, perché i gruppi delle
-- statistiche dell'ente superino la soglia di 5 e si vedano. Lo studente 1 è
-- quello che si cancella.
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('SCCONS00001', 'Liceo Conserva', 'Napoli', 'Liceo') on conflict do nothing;
insert into auth.users (id, email)
  select ('66666666-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'cons' || i || '@test.it' from generate_series(1, 6) i;
insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-0000000000e1', 'ente-cons@test.it'),
  ('66666666-0000-0000-0000-0000000000f1', 'ref-cons@test.it'),
  ('66666666-0000-0000-0000-0000000000d1', 'doc-cons@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita, telefono)
  select ('66666666-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'studente', 'Carla', 'Conserva' || i, '2005-01-01', '3330000' || i
    from generate_series(1, 6) i;
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('66666666-0000-0000-0000-0000000000e1', 'istituzione', 'Ente', 'Cons', null),
  ('66666666-0000-0000-0000-0000000000f1', 'referente_scuola', 'Ref', 'Cons', '1980-01-01'),
  ('66666666-0000-0000-0000-0000000000d1', 'docente', 'Dora', 'Docente', '1980-01-01');
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica)
  select ('66666666-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'SCCONS00001', '5A', 2027, 'verificato' from generate_series(1, 6) i;
insert into public.student_area_interests (user_id, area_slug)
  select ('66666666-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'informatica-digitale' from generate_series(1, 6) i;
insert into public.scuole_profili (id, scuola_id, stato) values ('dd000000-0000-0000-0000-0000000000f1', 'SCCONS00001', 'attiva');
insert into public.school_staff (scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da,
                                 puo_verificare_studenti, puo_gestire_classi, puo_certificare_presenze, puo_inviare_comunicazioni)
  values ('dd000000-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-0000000000f1', 'referente', true,
          '66666666-0000-0000-0000-0000000000f1', true, true, true, true);
insert into public.classi (id, scuola_profilo_id, anno, sezione) values ('cc000000-0000-0000-0000-0000000000f1', 'dd000000-0000-0000-0000-0000000000f1', 5, 'A');
insert into public.classi_studenti (classe_id, student_id) values ('cc000000-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000001');
insert into public.istituzioni (id, nome, slug, tipo, stato) values ('cccccccc-0000-0000-0000-0000000000f1', 'Ente Conserva', 'ente-conserva', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values ('66666666-0000-0000-0000-0000000000e1', 'cccccccc-0000-0000-0000-0000000000f1');

-- I gesti verso l'ente, scelti perché «raggiunti» senta ogni rapporto chiuso:
-- l'1 SOLO segue (più la newsletter, che «raggiunti» non conta), il 2 SOLO ha
-- condiviso il profilo, gli altri seguono e passano dal recinto. Si cancellano
-- l'1 e il 2: se la chiusura cancellasse la riga di `seguiti`, o se
-- «raggiunti» guardasse la revoca, il numero scenderebbe.
insert into public.seguiti (student_id, istituzione_id)
  select ('66666666-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'cccccccc-0000-0000-0000-0000000000f1' from generate_series(1, 6) i where i <> 2;
insert into public.recinto_enti (student_id, istituzione_id, origine)
  select ('66666666-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'cccccccc-0000-0000-0000-0000000000f1', 'evento' from generate_series(3, 6) i;
insert into public.manifestazioni_interesse (student_id, istituzione_id) values
  ('66666666-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-0000000000f1');
insert into public.newsletter_iscrizioni (student_id, istituzione_id) values ('66666666-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000f1');

-- Una diretta passata (certificata dalla scuola, un'ora) e una futura.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', 'Diretta Conserva', 'x', 'webinar', 'cccccccc-0000-0000-0000-0000000000f1', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti'),
  ('eeeeeeee-0000-0000-0000-0000000000f2', 'Futuro Conserva', 'x', 'webinar', 'cccccccc-0000-0000-0000-0000000000f1', now() + interval '3 days', now() + interval '3 days 1 hour', 'approvato', 'studenti');
insert into public.iscrizioni_eventi (evento_id, student_id, stato, origine, certificata_da_tipo, certificata_da_user, certificata_il, ore_riconosciute) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000001', 'partecipato', 'scuola', 'scuola', '66666666-0000-0000-0000-0000000000f1', now(), 1.00),
  ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000002', 'iscritto', 'studente', null, null, null, null);
insert into public.iscrizioni_eventi (evento_id, student_id, stato) values ('eeeeeeee-0000-0000-0000-0000000000f2', '66666666-0000-0000-0000-000000000001', 'iscritto');
insert into public.presenze_live (evento_id, user_id, ping_totali) values ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000001', 55);
insert into public.domande_live (evento_id, user_id, testo) values ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000001', 'Una domanda di Carla');
insert into public.consegne_evento (evento_id, student_id, testo) values ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000001', repeat('Risposta di Carla. ', 15));

-- La conversazione con l'ente: una metà sua, una dell'ente.
insert into public.conversazioni_enti (id, student_id, istituzione_id) values ('ab000000-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000f1');
insert into public.messaggi_enti (conversazione_id, mittente, corpo) values
  ('ab000000-0000-0000-0000-0000000000f1', 'studente', 'Ciao, sono Carla'),
  ('ab000000-0000-0000-0000-0000000000f1', 'ente', 'Ciao Carla, ti rispondiamo');

-- Il diario, una missione con una risposta aperta e una scelta, una prova con la sua frase.
insert into public.mission_attempt (id, student_id, mission_slug, stato) values ('ad000000-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000001', 'missione-prova', 'completata');
insert into public.step_response (attempt_id, stanza, step_id, tipo, payload) values
  ('ad000000-0000-0000-0000-0000000000f1', 5, 's5_riflessione', 'riflessione', '{"testo": "Ho capito che mi piace", "scelta": "a"}');
insert into public.journal_entry (student_id, attempt_id, testo) values ('66666666-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-0000000000f1', 'Il mio diario');
insert into public.evidence (student_id, attempt_id, area_slug, dimensione, valore, peso, fonte, motivazione, categoria) values
  ('66666666-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-0000000000f1', 'informatica-digitale', 'interest', 0.8, 1, 'mission', 'Carla ha scritto di amare il codice', 'area');

-- Un workshop: un'iscrizione attiva, l'elaborato, una tappa revisionata e una consegnata, la chat col cliente.
insert into public.workshop_iscrizioni (id, workshop_id, student_id, ruolo_id, stato)
  select 'af000000-0000-0000-0000-0000000000f1', r.workshop_id, '66666666-0000-0000-0000-000000000001', r.id, 'attivo' from public.workshop_ruoli r order by r.id limit 1;
insert into public.workshop_elaborati (iscrizione_id, contenuto, feedback_ai) values
  ('af000000-0000-0000-0000-0000000000f1', '{"sezione": "Il mio progetto"}', '{"punteggio_area": 74, "commento": "Carla ha lavorato bene"}');
insert into public.workshop_fasi_stato (iscrizione_id, fase_id, stato, revisione, reazione_cliente) values
  ('af000000-0000-0000-0000-0000000000f1', 'fase1', 'revisionata', '{"punteggio_fiducia": 18, "cosa_regge": "la tabella di Carla"}', 'Bene, Carla'),
  ('af000000-0000-0000-0000-0000000000f1', 'fase2', 'consegnata', null, null);
insert into public.workshop_chat_cliente (iscrizione_id, mittente, contenuto) values
  ('af000000-0000-0000-0000-0000000000f1', 'studente', 'Domanda al cliente'),
  ('af000000-0000-0000-0000-0000000000f1', 'cliente', 'Risposta del cliente a Carla');
insert into public.notifiche_studenti (student_id, tipo, riferimento_id) values ('66666666-0000-0000-0000-000000000001', 'nuovo_post', gen_random_uuid());

-- Il docente: un attestato, nessuna firma.
insert into public.attestati (user_id, evento_id) values ('66666666-0000-0000-0000-0000000000d1', 'eeeeeeee-0000-0000-0000-0000000000f1');

-- Le fotografie di prima: le statistiche dell'ente (da ente) e della scuola (da admin).
do $$ begin
  perform set_config('request.jwt.claim.sub', '66666666-0000-0000-0000-0000000000e1', true);
  insert into prima values ('ente', public.statistiche_ente('cccccccc-0000-0000-0000-0000000000f1'));
  insert into prima values ('follower', to_jsonb(public.conteggio_follower('cccccccc-0000-0000-0000-0000000000f1')));
  perform set_config('request.jwt.claim.sub', '66666666-0000-0000-0000-0000000000f1', true);
  insert into prima select 'scuola', to_jsonb(s) - 'scuola_profilo_id' from public.stats_scuola s where s.scuola_profilo_id = 'dd000000-0000-0000-0000-0000000000f1';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- La cancellazione, come la chiama la pagina.
do $$ declare e1 jsonb; e2 jsonb; begin
  e1 := public.cancella_account('66666666-0000-0000-0000-000000000001', false);
  e2 := public.cancella_account('66666666-0000-0000-0000-0000000000d1', false);
  perform public.cancella_account('66666666-0000-0000-0000-000000000002', false);
  insert into prima values ('esito_studente', e1), ('esito_docente', e2);
end $$;

-- 1 · le statistiche dell'ente non cambiano su quello che è successo: gli
--     eventi passati, gli studenti (raggiunti compresi), le guide. Cambia, e
--     deve, quello che deve ancora succedere: l'iscrizione all'evento futuro
--     se ne va (un rapporto), e la newsletter perde uno che la riceveva.
create temp table passato_ente (k text, v jsonb) on commit drop;
create or replace function pg_temp.passato(s jsonb) returns jsonb language sql as $f$
  select jsonb_build_object(
    'lista_passati', (select jsonb_agg(x order by x ->> 'evento_id') from jsonb_array_elements(s -> 'eventi' -> 'lista') x where (x ->> 'passato')::boolean),
    'passati', s -> 'eventi' -> 'passati', 'collegati', s -> 'eventi' -> 'collegati', 'certificate', s -> 'eventi' -> 'certificate',
    'permanenza', s -> 'eventi' -> 'permanenza_media_pct', 'iscritti_dirette_finite', s -> 'eventi' -> 'iscritti_dirette_finite',
    'studenti', s -> 'studenti', 'guide', s -> 'guide');
$f$;
do $$ declare d jsonb; p jsonb := (select valore from prima where chiave = 'ente'); f_p int; f_d int; begin
  perform set_config('request.jwt.claim.sub', '66666666-0000-0000-0000-0000000000e1', true);
  d := public.statistiche_ente('cccccccc-0000-0000-0000-0000000000f1');
  perform set_config('request.jwt.claim.sub', '', true);
  select (x ->> 'iscritti')::int into f_p from jsonb_array_elements(p -> 'eventi' -> 'lista') x where not (x ->> 'passato')::boolean;
  select (x ->> 'iscritti')::int into f_d from jsonb_array_elements(d -> 'eventi' -> 'lista') x where not (x ->> 'passato')::boolean;
  insert into esiti values (1, 'le statistiche dell''ente non cambiano sul passato (eventi passati, studenti raggiunti, guide); il futuro perde la sua iscrizione',
    'passato uguale, raggiunti 6 → 6, futuro 1 → 0',
    case when pg_temp.passato(d) = pg_temp.passato(p) then 'passato uguale' else 'PASSATO DIVERSO' end
      || ', raggiunti ' || coalesce(p -> 'studenti' ->> 'totale', '?') || ' → ' || coalesce(d -> 'studenti' ->> 'totale', '?')
      || ', futuro ' || coalesce(f_p::text, '?') || ' → ' || coalesce(f_d::text, '?'),
    pg_temp.passato(d) = pg_temp.passato(p) and (d -> 'studenti' ->> 'totale')::int = 6 and (p -> 'studenti' ->> 'totale')::int = 6
      and f_p = 1 and f_d = 0);
end $$;

-- 2 · le statistiche della scuola non cambiano: verificati, partecipazioni, ore.
do $$ declare d jsonb; p jsonb := (select valore from prima where chiave = 'scuola'); begin
  perform set_config('request.jwt.claim.sub', '66666666-0000-0000-0000-0000000000f1', true);
  select to_jsonb(s) - 'scuola_profilo_id' into d from public.stats_scuola s where s.scuola_profilo_id = 'dd000000-0000-0000-0000-0000000000f1';
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (2, 'le statistiche della scuola non cambiano', coalesce(p::text, 'null'), coalesce(d::text, 'null'), d is not null and d = p);
end $$;

-- 3 · il nome esce: «Studente #N», niente data di nascita né telefono, niente accesso.
insert into esiti select 3, 'lo studente diventa anonimo, l''utente sparisce', 'anonimizzato, Studente #N, utente 0',
  (select valore ->> 'esito' from prima where chiave = 'esito_studente') || ', '
    || coalesce((select nome || ' ' || cognome from public.profiles where id = '66666666-0000-0000-0000-000000000001'), 'nessun profilo')
    || ', utente ' || (select count(*) from auth.users where id = '66666666-0000-0000-0000-000000000001'),
  (select valore ->> 'esito' from prima where chiave = 'esito_studente') = 'anonimizzato'
    and exists (select 1 from public.profiles where id = '66666666-0000-0000-0000-000000000001'
                and nome = 'Studente' and cognome = '#' || numero_anonimo and data_nascita is null and telefono is null and cancellato_il is not null)
    and not exists (select 1 from auth.users where id = '66666666-0000-0000-0000-000000000001')
    and not exists (select 1 from public.indirizzi_delle_lapidi where profile_id = '66666666-0000-0000-0000-000000000001');

-- 4 · il testo suo esce, le righe restano.
insert into esiti select 4, 'il suo testo esce, le righe restano (diario, domanda, consegna, messaggio, chat, elaborato, risposta aperta)',
  '7 svuotati, 7 righe',
  (select count(*) from public.journal_entry where student_id = '66666666-0000-0000-0000-000000000001' and testo is null and testo_rimosso_il is not null)
  + (select count(*) from public.domande_live where user_id = '66666666-0000-0000-0000-000000000001' and testo is null)
  + (select count(*) from public.consegne_evento where student_id = '66666666-0000-0000-0000-000000000001' and testo is null)
  + (select count(*) from public.messaggi_enti where conversazione_id = 'ab000000-0000-0000-0000-0000000000f1' and mittente = 'studente' and corpo is null)
  + (select count(*) from public.workshop_chat_cliente where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1' and mittente = 'studente' and contenuto is null)
  + (select count(*) from public.workshop_elaborati where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1' and contenuto = '{}'::jsonb)
  + (select count(*) from public.step_response where attempt_id = 'ad000000-0000-0000-0000-0000000000f1' and not payload ? 'testo' and payload ->> 'scelta' = 'a')
  || ' svuotati',
  (select count(*) from public.journal_entry where student_id = '66666666-0000-0000-0000-000000000001' and testo is null and testo_rimosso_il is not null) = 1
  and (select count(*) from public.domande_live where user_id = '66666666-0000-0000-0000-000000000001' and testo is null) = 1
  and (select count(*) from public.consegne_evento where student_id = '66666666-0000-0000-0000-000000000001' and testo is null) = 1
  and (select count(*) from public.messaggi_enti where conversazione_id = 'ab000000-0000-0000-0000-0000000000f1' and mittente = 'studente' and corpo is null) = 1
  and (select count(*) from public.workshop_chat_cliente where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1' and mittente = 'studente' and contenuto is null) = 1
  and (select count(*) from public.workshop_elaborati where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1' and contenuto = '{}'::jsonb) = 1
  and (select count(*) from public.step_response where attempt_id = 'ad000000-0000-0000-0000-0000000000f1' and not payload ? 'testo' and payload ->> 'scelta' = 'a') = 1;

-- 5 · la metà dell'ente resta; il testo nostro su di lui esce e i numeri restano.
insert into esiti select 5, 'la metà dell''ente resta; dei giudizi su di lui restano i numeri',
  'ente intatto, 74, 18, motivazione e reazione vuote, cliente vuoto',
  coalesce((select corpo from public.messaggi_enti where conversazione_id = 'ab000000-0000-0000-0000-0000000000f1' and mittente = 'ente'), 'null') || ', '
    || coalesce((select feedback_ai::text from public.workshop_elaborati where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1'), 'null') || ', '
    || coalesce((select revisione::text from public.workshop_fasi_stato where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1' and fase_id = 'fase1'), 'null'),
  (select corpo from public.messaggi_enti where conversazione_id = 'ab000000-0000-0000-0000-0000000000f1' and mittente = 'ente') = 'Ciao Carla, ti rispondiamo'
  and (select feedback_ai from public.workshop_elaborati where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1') = '{"punteggio_area": 74}'::jsonb
  and (select revisione from public.workshop_fasi_stato where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1' and fase_id = 'fase1') = '{"punteggio_fiducia": 18}'::jsonb
  and (select reazione_cliente from public.workshop_fasi_stato where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1' and fase_id = 'fase1') is null
  and (select motivazione from public.evidence where student_id = '66666666-0000-0000-0000-000000000001') is null
  and (select contenuto from public.workshop_chat_cliente where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1' and mittente = 'cliente') is null;

-- 6 · i fatti restano: presenza, prova col suo valore, tentativo, iscrizione passata, aree, verifica.
insert into esiti select 6, 'i fatti restano', 'presenza 55, prova 0.8, tentativo, iscrizione passata, area, verificato',
  coalesce((select ping_totali::text from public.presenze_live where user_id = '66666666-0000-0000-0000-000000000001'), 'null') || ', '
    || coalesce((select valore::text from public.evidence where student_id = '66666666-0000-0000-0000-000000000001'), 'null'),
  (select ping_totali from public.presenze_live where user_id = '66666666-0000-0000-0000-000000000001') = 55
  and (select valore from public.evidence where student_id = '66666666-0000-0000-0000-000000000001') = 0.8
  and exists (select 1 from public.mission_attempt where id = 'ad000000-0000-0000-0000-0000000000f1')
  and exists (select 1 from public.iscrizioni_eventi where student_id = '66666666-0000-0000-0000-000000000001' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1')
  and exists (select 1 from public.student_area_interests where user_id = '66666666-0000-0000-0000-000000000001')
  and exists (select 1 from public.student_profiles where user_id = '66666666-0000-0000-0000-000000000001' and stato_verifica = 'verificato');

-- 7 · le ore certificate restano col nome vero, copiato sulla riga.
insert into esiti select 7, 'le ore certificate restano con il nome vero', 'Carla Conserva1, 1.00',
  coalesce((select nome_alla_cancellazione || ' ' || cognome_alla_cancellazione || ', ' || ore_riconosciute from public.iscrizioni_eventi
            where student_id = '66666666-0000-0000-0000-000000000001' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'null'),
  (select nome_alla_cancellazione = 'Carla' and cognome_alla_cancellazione = 'Conserva1' and ore_riconosciute = 1.00 from public.iscrizioni_eventi
    where student_id = '66666666-0000-0000-0000-000000000001' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1');

-- 8 · i rapporti si chiudono: seguire marcato (la riga resta), profilo condiviso
--     revocato, conversazione chiusa con la sua parola, workshop ritirato e la
--     tappa consegnata non in coda; newsletter, classe, notifiche, iscrizione futura via.
insert into esiti select 8, 'i rapporti si chiudono',
  'seguito chiuso, revocato, account_cancellato, ritirato, tappa aperta, 0 0 0 0',
  coalesce((select case when chiuso_il is not null then 'seguito chiuso' else 'seguito aperto' end from public.seguiti where student_id = '66666666-0000-0000-0000-000000000001'), 'seguito sparito') || ', '
    || coalesce((select stato::text from public.conversazioni_enti where id = 'ab000000-0000-0000-0000-0000000000f1'), 'null') || ', '
    || coalesce((select stato::text from public.workshop_iscrizioni where id = 'af000000-0000-0000-0000-0000000000f1'), 'null') || ', '
    || (select count(*) from public.newsletter_iscrizioni where student_id = '66666666-0000-0000-0000-000000000001') || ' '
    || (select count(*) from public.classi_studenti where student_id = '66666666-0000-0000-0000-000000000001') || ' '
    || (select count(*) from public.notifiche_studenti where student_id = '66666666-0000-0000-0000-000000000001') || ' '
    || (select count(*) from public.iscrizioni_eventi where student_id = '66666666-0000-0000-0000-000000000001' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f2'),
  exists (select 1 from public.seguiti where student_id = '66666666-0000-0000-0000-000000000001' and chiuso_il is not null)
  and exists (select 1 from public.manifestazioni_interesse where student_id = '66666666-0000-0000-0000-000000000002' and revocata_il is not null)
  and (select stato::text from public.conversazioni_enti where id = 'ab000000-0000-0000-0000-0000000000f1') = 'account_cancellato'
  and (select stato::text from public.workshop_iscrizioni where id = 'af000000-0000-0000-0000-0000000000f1') = 'ritirato'
  and (select stato from public.workshop_fasi_stato where iscrizione_id = 'af000000-0000-0000-0000-0000000000f1' and fase_id = 'fase2') = 'aperta'
  and not exists (select 1 from public.newsletter_iscrizioni where student_id = '66666666-0000-0000-0000-000000000001')
  and not exists (select 1 from public.classi_studenti where student_id = '66666666-0000-0000-0000-000000000001')
  and not exists (select 1 from public.notifiche_studenti where student_id = '66666666-0000-0000-0000-000000000001')
  and not exists (select 1 from public.iscrizioni_eventi where student_id = '66666666-0000-0000-0000-000000000001' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f2');

-- 9 · una persona con cui si può fare qualcosa non compare: fra gli studenti
--     della scuola, fra i follower dell'ente, fra gli interessati.
do $$ declare v_scuola int; v_fol int; v_int int; p int := (select (valore #>> '{}')::int from prima where chiave = 'follower'); begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '66666666-0000-0000-0000-0000000000f1', true);
  select count(*) into v_scuola from public.studenti_della_scuola() where user_id = '66666666-0000-0000-0000-000000000001';
  reset role;
  v_fol := public.conteggio_follower('cccccccc-0000-0000-0000-0000000000f1');
  select count(*) into v_int from public.manifestazioni_interesse
   where istituzione_id = 'cccccccc-0000-0000-0000-0000000000f1' and revocata_il is null;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (9, 'non compare fra gli studenti della scuola, i follower di adesso, gli interessati',
    '0, 5 → 4, 0', v_scuola || ', ' || p || ' → ' || v_fol || ', ' || v_int, v_scuola = 0 and v_fol = p - 1 and v_int = 0);
end $$;

-- 10 · il docente: anonimo, e l'attestato tiene il nome (anche alla verifica pubblica).
insert into esiti select 10, 'il docente senza firme diventa anonimo, l''attestato tiene il nome', 'anonimizzato, Docente #N, Dora Docente',
  (select valore ->> 'esito' from prima where chiave = 'esito_docente') || ', '
    || coalesce((select nome || ' ' || cognome from public.profiles where id = '66666666-0000-0000-0000-0000000000d1'), 'null') || ', '
    || coalesce((select v.nome_completo from public.attestati a, public.verifica_attestato(a.codice_verifica) v where a.user_id = '66666666-0000-0000-0000-0000000000d1'), 'null'),
  (select valore ->> 'esito' from prima where chiave = 'esito_docente') = 'anonimizzato'
  and exists (select 1 from public.profiles where id = '66666666-0000-0000-0000-0000000000d1' and nome = 'Docente' and numero_anonimo is not null)
  and (select v.nome_completo from public.attestati a, public.verifica_attestato(a.codice_verifica) v where a.user_id = '66666666-0000-0000-0000-0000000000d1') = 'Dora Docente';

-- 11 · il tetto della registrazione: 10 domande in un'ora per rete, poi no; chiuso al client.
do $$ declare r jsonb; i int; begin
  for i in 1..10 loop r := public.controlla_indirizzo_registrazione('nessuno@test.it', 'rete-di-prova'); end loop;
  insert into esiti values (11, 'il tetto: la decima risponde, l''undicesima no, e il client non la chiama',
    'libero, troppi_tentativi, f f', (r ->> 'esito') || ', ' || (public.controlla_indirizzo_registrazione('nessuno@test.it', 'rete-di-prova') ->> 'esito') || ', '
      || has_function_privilege('anon', 'public.controlla_indirizzo_registrazione(text, text)', 'execute') || ' '
      || has_function_privilege('authenticated', 'public.controlla_indirizzo_registrazione(text, text)', 'execute'),
    r ->> 'esito' = 'libero'
      and public.controlla_indirizzo_registrazione('nessuno@test.it', 'rete-di-prova') ->> 'esito' = 'troppi_tentativi'
      and public.controlla_indirizzo_registrazione('nessuno@test.it', 'altra-rete') ->> 'esito' = 'libero'
      and not has_function_privilege('anon', 'public.controlla_indirizzo_registrazione(text, text)', 'execute')
      and not has_function_privilege('authenticated', 'public.controlla_indirizzo_registrazione(text, text)', 'execute'));
end $$;

-- 12 · il client non scrive un testo vuoto: senza la data di rimozione, che non gli è concessa, un NULL è respinto.
do $$ declare e text; begin
  begin
    insert into public.domande_live (evento_id, user_id, testo) values ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000002', null);
    e := 'accettata';
  exception when others then e := 'respinta: ' || sqlstate;
  end;
  insert into esiti values (12, 'una domanda senza testo e senza data di rimozione è respinta', 'respinta: 23514', e, e = 'respinta: 23514');
end $$;

-- 13 · una presenza passata NON certificata non riceve niente: né il nome vero
--      né l'etichetta. «Nome alla cancellazione» porta un nome o niente (20261205100000).
insert into esiti select 13, 'la riga non certificata non porta l''etichetta', 'null null',
  coalesce((select coalesce(nome_alla_cancellazione, 'null') || ' ' || coalesce(cognome_alla_cancellazione, 'null') from public.iscrizioni_eventi
            where student_id = '66666666-0000-0000-0000-000000000002' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'riga sparita'),
  (select nome_alla_cancellazione is null and cognome_alla_cancellazione is null from public.iscrizioni_eventi
    where student_id = '66666666-0000-0000-0000-000000000002' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1');

-- 14 · l'admin non sovrascrive «account cancellato» con «chiusa da KIREO».
insert into auth.users (id, email) values ('66666666-0000-0000-0000-0000000000a1', 'admin-cons@test.it');
insert into public.profiles (id, ruolo, nome, cognome) values ('66666666-0000-0000-0000-0000000000a1', 'admin', 'Adm', 'Cons');
do $$ declare e text; begin
  perform set_config('request.jwt.claim.sub', '66666666-0000-0000-0000-0000000000a1', true);
  begin
    perform public.chiudi_conversazione_admin('ab000000-0000-0000-0000-0000000000f1');
    e := 'chiusa';
  exception when others then e := 'respinta: ' || sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (14, 'l''admin non chiude una conversazione di un account cancellato',
    'respinta: conversazione_account_cancellato, account_cancellato',
    e || ', ' || coalesce((select stato::text from public.conversazioni_enti where id = 'ab000000-0000-0000-0000-0000000000f1'), 'null'),
    e = 'respinta: conversazione_account_cancellato'
      and (select stato from public.conversazioni_enti where id = 'ab000000-0000-0000-0000-0000000000f1') = 'account_cancellato');
end $$;

-- 15 · prima del clic si contano le presenze che nessuno certificherà più (20261206100000):
--      lo studente 4 ha una presenza passata iscritta dalla scuola, lo studente 3 nessuna.
insert into public.iscrizioni_eventi (evento_id, student_id, stato, origine) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000004', 'iscritto', 'scuola'),
  ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000005', 'iscritto', 'studente');
insert into esiti select 15, 'prima del clic si dicono le presenze in sospeso', '4: 1, 3: 0',
  '4: ' || coalesce(public.stato_cancellazione_account('66666666-0000-0000-0000-000000000004') ->> 'presenze_in_sospeso', 'null')
    || ', 3: ' || coalesce(public.stato_cancellazione_account('66666666-0000-0000-0000-000000000003') ->> 'presenze_in_sospeso', 'null'),
  (public.stato_cancellazione_account('66666666-0000-0000-0000-000000000004') ->> 'presenze_in_sospeso')::int = 1
  and (public.stato_cancellazione_account('66666666-0000-0000-0000-000000000003') ->> 'presenze_in_sospeso')::int = 0;

-- 16 · dopo la cancellazione la scuola non certifica più quella presenza.
do $$ declare e text; begin
  perform public.cancella_account('66666666-0000-0000-0000-000000000004', false);
  perform set_config('request.jwt.claim.sub', '66666666-0000-0000-0000-0000000000f1', true);
  begin
    perform public.certifica_presenza('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000004');
    e := 'certificata';
  exception when others then e := 'respinta: ' || sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (16, 'la scuola non certifica la presenza di un account cancellato',
    'respinta: account_cancellato, iscritto',
    e || ', ' || coalesce((select stato::text from public.iscrizioni_eventi where student_id = '66666666-0000-0000-0000-000000000004' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'null'),
    e = 'respinta: account_cancellato'
      and (select stato from public.iscrizioni_eventi where student_id = '66666666-0000-0000-0000-000000000004' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1') = 'iscritto');
end $$;

-- 17 · la chiusura della diretta certifica chi c'era, e salta chi si è cancellato.
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000004', 60),
  ('eeeeeeee-0000-0000-0000-0000000000f1', '66666666-0000-0000-0000-000000000005', 60);
do $$ begin
  perform set_config('request.jwt.claim.sub', '66666666-0000-0000-0000-0000000000e1', true);
  perform public.chiudi_diretta_evento('eeeeeeee-0000-0000-0000-0000000000f1');
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
insert into esiti select 17, 'la chiusura salta l''account cancellato', 'cancellato iscritto, l''altro partecipato',
  'cancellato ' || coalesce((select stato::text from public.iscrizioni_eventi where student_id = '66666666-0000-0000-0000-000000000004' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'null')
    || ', l''altro ' || coalesce((select stato::text from public.iscrizioni_eventi where student_id = '66666666-0000-0000-0000-000000000005' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'null'),
  (select stato from public.iscrizioni_eventi where student_id = '66666666-0000-0000-0000-000000000004' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1') = 'iscritto'
  and (select stato from public.iscrizioni_eventi where student_id = '66666666-0000-0000-0000-000000000005' and evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1') = 'partecipato';

select n, case when ok then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where not ok) || ' ROTTE su ' || count(*) as riassunto from esiti;

rollback;
