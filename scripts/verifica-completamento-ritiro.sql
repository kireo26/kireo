-- ═══════════════════════════════════════════════════════════════════════════
-- Il ruolo non è esclusivo, e un'iscrizione può finire.
--
-- PERCHÉ ESISTE. Fino al 2026-08-30 due cose sbagliate convivevano: un ruolo
-- poteva farlo un solo studente al mondo (un vincolo che nessuno aveva deciso,
-- e che teneva la piattaforma a venticinque studenti), e nessuna iscrizione
-- usciva mai da 'attivo' — nemmeno finendo il progetto. Le migrazioni
-- 20260830120000 e 20260830130000 tolgono la prima e aggiungono le strade
-- della seconda; queste tredici proprietà verificano che facciano quello che
-- dicono.
--
-- OGNI SCRITTURA VIENE RILETTA. È la lezione del trigger di `di_prova`, che
-- falliva in silenzio: un update riporta successo anche quando non ha
-- cambiato niente.
--
-- COME SI USA. Incolla tutto nel SQL Editor di Supabase e premi Run.
-- Non lascia niente dietro di sé: crea un workshop finto, tre studenti finti,
-- li usa e alla fine fa ROLLBACK. Il workshop è finto apposta — usarne uno
-- vero legherebbe l'esito a quello che stanno facendo studenti in carne e ossa.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000e0001';
  b uuid := '00000000-0000-0000-0000-0000000e0002';
  c uuid := '00000000-0000-0000-0000-0000000e0003';
  v_ws uuid; v_r1 uuid; v_r2 uuid; v_ia uuid; v_msg text; v_stato text; v_n int;
begin
  insert into auth.users (id, email) values
    (a, 'prova-a@esempio.invalid'), (b, 'prova-b@esempio.invalid'), (c, 'prova-c@esempio.invalid');
  insert into public.profiles (id, nome, cognome, data_nascita, ruolo) values
    (a, 'Prova', 'Uno', '2007-01-01', 'studente'),
    (b, 'Prova', 'Due', '2007-01-01', 'studente'),
    (c, 'Prova', 'Tre', '2007-01-01', 'studente');

  insert into public.workshop (slug, titolo, attivo)
  values ('prova-banco-ritiro', 'Workshop finto per il controllo', true)
  returning id into v_ws;
  insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
  values (v_ws, 'primo', 'Primo ruolo', 'ristorazione-turismo') returning id into v_r1;
  insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
  values (v_ws, 'secondo', 'Secondo ruolo', 'economia-management') returning id into v_r2;

  -- ── 1. ci si iscrive dalla porta ────────────────────────────────────────
  -- La stessa insert che fa IscrizioneRuolo, sotto la stessa RLS.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', a::text, true);
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id)
  values (v_ws, a, v_r1) returning id into v_ia;
  raise notice '  ok   1. A si iscrive';

  -- ── 2. LA PROPRIETÀ NUOVA: lo stesso ruolo lo fanno in tre ──────────────
  -- Prima del 2026-08-30 questa insert falliva, e con lei l'idea che ogni
  -- studente possa fare il workshop indipendentemente dagli altri.
  perform set_config('request.jwt.claim.sub', b::text, true);
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (v_ws, b, v_r1);
  perform set_config('request.jwt.claim.sub', c::text, true);
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (v_ws, c, v_r1);
  -- Il conteggio va fatto fuori dalla RLS: ogni studente vede solo la propria
  -- riga (workshop_iscrizioni_select_own), quindi da dentro una sessione
  -- studente il conto direbbe sempre 1 e la proprietà non si vedrebbe.
  reset role;
  select count(*) into v_n from public.workshop_iscrizioni where ruolo_id = v_r1 and stato = 'attivo';
  set local role authenticated;
  if v_n <> 3 then raise exception 'ROTTO 2: sullo stesso ruolo risultano % iscrizioni attive invece di 3.', v_n; end if;
  raise notice '  ok   2. lo stesso ruolo lo fanno in tre insieme';

  -- ── 3. quello che il vincolo deve davvero impedire ──────────────────────
  -- Una seconda iscrizione attiva DELLO STESSO studente nello stesso
  -- workshop: è la doppia richiesta, la guardia che il vecchio commento
  -- diceva di volere.
  perform set_config('request.jwt.claim.sub', a::text, true);
  begin
    insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (v_ws, a, v_r2);
    raise exception 'ROTTO 3: lo stesso studente ha due iscrizioni attive nello stesso workshop.';
  exception when unique_violation then
    raise notice '  ok   3. lo stesso studente non si iscrive due volte allo stesso workshop';
  end;

  -- Il lavoro di A. Se una delle due strade lo cancellasse, sparirebbe qui.
  insert into public.workshop_elaborati (iscrizione_id, contenuto, fase_corrente)
  values (v_ia, '{"s":"il lavoro di A"}'::jsonb, 'prima');

  -- ── 4. il ritiro è mio e di nessun altro ────────────────────────────────
  perform set_config('request.jwt.claim.sub', c::text, true);
  begin
    perform public.ritira_iscrizione_workshop(v_ia);
    raise exception 'ROTTO 4: uno studente ha ritirato l''iscrizione di un altro.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'non_autorizzato' then raise; end if;
    raise notice '  ok   4. un altro studente non ritira la mia iscrizione';
  end;

  -- ── 5. il ritiro ────────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.ritira_iscrizione_workshop(v_ia);
  select stato into v_stato from public.workshop_iscrizioni where id = v_ia;
  if v_stato <> 'ritirato' then raise exception 'ROTTO 5: dopo il ritiro lo stato è «%».', v_stato; end if;
  raise notice '  ok   5. A lascia il workshop';

  select count(*) into v_n from public.workshop_elaborati where iscrizione_id = v_ia;
  if v_n <> 1 then raise exception 'ROTTO 5b: il ritiro ha portato via il lavoro.'; end if;
  raise notice '  ok   5b. il lavoro resta, e si legge anche dopo aver lasciato';

  -- ── 6. lasciare serve a cambiare ruolo ──────────────────────────────────
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (v_ws, a, v_r2);
  raise notice '  ok   6. dopo aver lasciato si può prendere un altro ruolo';

  -- ── 7. e allora non si può «riprendere» il primo ────────────────────────
  begin
    perform public.riprendi_iscrizione_workshop(v_ia);
    raise exception 'ROTTO 7: due iscrizioni attive nello stesso workshop.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'iscrizione_gia_attiva' then
      raise exception 'ROTTO 7: il motivo è «%» invece di iscrizione_gia_attiva: al client arriverebbe l''errore grezzo dell''indice.', v_msg;
    end if;
    raise notice '  ok   7. non si riprende un ruolo avendone già uno attivo (motivo leggibile)';
  end;

  -- ── 8. tornare indietro, con il lavoro dov'era ──────────────────────────
  perform public.ritira_iscrizione_workshop(
    (select id from public.workshop_iscrizioni where student_id = a and ruolo_id = v_r2));
  perform public.riprendi_iscrizione_workshop(v_ia);
  select stato into v_stato from public.workshop_iscrizioni where id = v_ia;
  if v_stato <> 'attivo' then raise exception 'ROTTO 8: dopo il riprendi lo stato è «%».', v_stato; end if;
  select count(*) into v_n from public.workshop_elaborati where iscrizione_id = v_ia and contenuto->>'s' = 'il lavoro di A';
  if v_n <> 1 then raise exception 'ROTTO 8: il lavoro non è tornato con l''iscrizione.'; end if;
  raise notice '  ok   8. si torna sullo stesso ruolo, con il lavoro dov''era';

  -- ── 9. lasciare due volte non è un errore ───────────────────────────────
  perform public.ritira_iscrizione_workshop(v_ia);
  perform public.ritira_iscrizione_workshop(v_ia);
  select stato into v_stato from public.workshop_iscrizioni where id = v_ia;
  if v_stato <> 'ritirato' then raise exception 'ROTTO 9: il secondo ritiro ha cambiato qualcosa.'; end if;
  perform public.riprendi_iscrizione_workshop(v_ia);
  raise notice '  ok   9. lasciare due volte non è un errore';

  -- ── 10. il progetto che si chiude completa l'iscrizione ─────────────────
  -- È LA PROPRIETÀ PER CUI ESISTE 20260830130000. Con la versione precedente
  -- di avanza_fase_workshop questa riga fallisce dicendo «attivo».
  reset role;
  insert into public.workshop_fasi_stato (iscrizione_id, fase_id, stato, aperta_at, consegnata_at)
  values (v_ia, 'ultima', 'consegnata', now(), now());
  set local role service_role;
  perform public.avanza_fase_workshop(
    v_ia, 'ultima', null, '{"x":1}'::jsonb, 'reazione', 20, true, 'ristorazione-turismo', '{"y":1}'::jsonb);
  reset role;
  select stato into v_stato from public.workshop_iscrizioni where id = v_ia;
  if v_stato <> 'completato' then
    raise exception 'ROTTO 10: a progetto chiuso l''iscrizione è ancora «%»: continuerebbe a dire «ci sto lavorando».', v_stato;
  end if;
  raise notice '  ok  10. il progetto chiuso completa l''iscrizione';

  -- ── 11. e chi ha finito può iscriversi a un altro ruolo ─────────────────
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', a::text, true);
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (v_ws, a, v_r2);
  raise notice '  ok  11. chi ha finito un ruolo può prenderne un altro';

  -- ── 12. un progetto finito non si lascia ────────────────────────────────
  perform public.ritira_iscrizione_workshop(v_ia);
  select stato into v_stato from public.workshop_iscrizioni where id = v_ia;
  if v_stato <> 'completato' then raise exception 'ROTTO 12: il ritiro ha cancellato un completamento.'; end if;
  raise notice '  ok  12. il ritiro non tocca un progetto già completato';

  -- ── 13. il lavoro di chi ha finito resta leggibile ──────────────────────
  select count(*) into v_n from public.workshop_elaborati where iscrizione_id = v_ia;
  if v_n <> 1 then raise exception 'ROTTO 13: dopo il completamento il proprietario non legge più il suo elaborato.'; end if;
  raise notice '  ok  13. dopo il completamento il progetto resta leggibile al suo autore';

  reset role;
end $$;

-- Il SQL Editor non mostra i `raise notice`: se il blocco qui sopra fosse
-- saltato, ci sarebbe un errore rosso al posto di questa riga. Vederla
-- comparire è la conferma.
select 'Tredici proprietà verificate: il ruolo non è esclusivo, e un''iscrizione può finire.' as esito;

rollback;
