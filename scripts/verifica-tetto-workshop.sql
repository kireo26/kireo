-- ═══════════════════════════════════════════════════════════════════════════
-- Il tetto dei workshop: uno attivo per volta, tre in tutto.
--
-- PERCHÉ IL TEST PARLA AL DATABASE E NON ALLA PAGINA. Le iscrizioni si creano
-- dal client, quindi un controllo in pagina è un consiglio con un bottone in
-- meno: si aggira con una richiesta a mano. Queste proprietà chiamano
-- l'`insert` e le funzioni direttamente, sotto la sessione dello studente.
--
-- LE DUE CHE SI DIMENTICANO sono la 7 e la 10: RIPRENDERE un'iscrizione
-- lasciata porta una riga a «attivo» SENZA passare da nessun insert, quindi il
-- tetto scritto solo nel `with check` della policy — come chiedeva la spec alla
-- lettera — si aggirerebbe in tre gesti (comincia A, lascia A, comincia B,
-- riprendi A → due attivi). L'unica guardia che c'era è l'indice unico parziale
-- su (student_id, workshop_id), che è PER WORKSHOP e non vede due workshop
-- diversi.
--
-- E LA 3 E LA 4 sono il verso opposto: il tetto non deve rendere caro
-- fermarsi. Un ritiro non consuma un posto, e il cambio di ruolo dentro lo
-- stesso workshop nemmeno — altrimenti avremmo chiuso con questa migrazione la
-- strada che ne abbiamo aperta il 2026-08-30.
--
-- COME SI USA. Incolla tutto nel SQL Editor di Supabase e premi Run. Non
-- lascia niente dietro di sé: crea i propri studenti finti, li usa e alla fine
-- fa ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  uno    uuid := '00000000-0000-0000-0000-00000000fe01'::uuid;
  pieno  uuid := '00000000-0000-0000-0000-00000000fe02'::uuid;
  robot  uuid := '00000000-0000-0000-0000-00000000fe03'::uuid;
  vicino uuid := '00000000-0000-0000-0000-00000000fe04'::uuid;
  w1 uuid; w2 uuid; w3 uuid; w4 uuid;
  r1a uuid; r1b uuid; r2 uuid; r3 uuid; r4 uuid;
  isc_uno uuid; isc_lasciata uuid; isc_attiva_uno uuid;
  v_msg text; v_n int; v_ok boolean; v_slug text; v_ruolo text;
begin
  insert into auth.users (id, email) values
    (uno, 'uno@kireo.invalid'), (pieno, 'pieno@kireo.invalid'),
    (robot, 'robot@kireo.invalid'), (vicino, 'vicino@kireo.invalid');
  insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
    (uno,    'studente', 'Uno', 'A', '2008-01-01'),
    (pieno,  'studente', 'Pieno', 'B', '2008-01-01'),
    (robot,  'studente', 'Robot', 'C', '2008-01-01'),
    (vicino, 'studente', 'Vicino', 'D', '2008-01-01');
  -- Il robot del banco è riconoscibile, non invisibile.
  update public.profiles set di_prova = true where id = robot;

  -- Quattro workshop finti: usarne di veri legherebbe l'esito a quello che
  -- stanno facendo studenti in carne e ossa.
  insert into public.workshop (slug, titolo, descrizione, attivo)
    values ('tetto-finto-1', 'Primo di prova', 'solo per questa verifica', true) returning id into w1;
  insert into public.workshop (slug, titolo, descrizione, attivo)
    values ('tetto-finto-2', 'Secondo di prova', 'solo per questa verifica', true) returning id into w2;
  insert into public.workshop (slug, titolo, descrizione, attivo)
    values ('tetto-finto-3', 'Terzo di prova', 'solo per questa verifica', true) returning id into w3;
  insert into public.workshop (slug, titolo, descrizione, attivo)
    values ('tetto-finto-4', 'Quarto di prova', 'solo per questa verifica', true) returning id into w4;
  insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
    values (w1, 'alfa', 'Ruolo alfa', 'salute-professioni-sanitarie') returning id into r1a;
  insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
    values (w1, 'beta', 'Ruolo beta', 'economia-management') returning id into r1b;
  insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
    values (w2, 'alfa', 'Ruolo alfa', 'informatica-digitale') returning id into r2;
  insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
    values (w3, 'alfa', 'Ruolo alfa', 'comunicazione-media') returning id into r3;
  insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
    values (w4, 'alfa', 'Ruolo alfa', 'scienze-ricerca') returning id into r4;

  -- Lo stato di partenza si semina come postgres, non come studente: un insert
  -- privilegiato scavalca anche il tetto, quindi va usato SOLO per costruire la
  -- situazione da cui il test parte, mai per provare una proprietà.
  -- (E dà a ciascuno `e_gia_entrato_in_un_workshop()`, così il cancello del
  -- percorso — un'altra cosa, provata altrove — non entra in mezzo.)
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id)
    values (w1, uno, r1a) returning id into isc_uno;

  -- ── 1. uno alla volta: un altro workshop è respinto DAL DATABASE ─────────
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', uno::text, true);
  begin
    insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (w2, uno, r2);
    raise exception 'ROTTO 1: con un workshop attivo ne è partito un secondo.';
  exception when insufficient_privilege or check_violation then null;
    when others then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%row-level security%' then raise; end if;
  end;
  raise notice '  ok  1. con un workshop attivo il secondo è respinto dal database';

  -- ── 2. una attiva conta uno ─────────────────────────────────────────────
  select public.iscrizioni_workshop_contate() into v_n;
  if v_n <> 1 then raise exception 'ROTTO 2: contate = % invece di 1.', v_n; end if;
  raise notice '  ok  2. un''iscrizione attiva conta verso il tetto';

  -- ── 3. IL RITIRO NON CONSUMA UN POSTO ───────────────────────────────────
  --     Se contasse, fermarsi costerebbe — l'opposto di quello a cui serve la
  --     via d'uscita — e un ritiro non ha scritto niente in activity_log,
  --     quindi non ha diluito nessun profilo.
  perform public.ritira_iscrizione_workshop(isc_uno);
  select public.iscrizioni_workshop_contate() into v_n;
  if v_n <> 0 then raise exception 'ROTTO 3: dopo un ritiro contate = % invece di 0.', v_n; end if;
  raise notice '  ok  3. un''iscrizione ritirata non consuma un posto';

  -- ── 4. IL CAMBIO RUOLO nello stesso workshop passa ──────────────────────
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id)
    values (w1, uno, r1b) returning id into isc_attiva_uno;
  select public.iscrizioni_workshop_contate() into v_n;
  if v_n <> 1 then raise exception 'ROTTO 4: il cambio ruolo ha portato contate a %.', v_n; end if;
  raise notice '  ok  4. il cambio ruolo passa e costa un posto solo, non due';

  -- ── 5. il no sa dire DOVE si va ─────────────────────────────────────────
  --     È la riga che rende il rifiuto utilizzabile: senza il nome del
  --     workshop attivo, «ne hai già uno» non dice dove andare a lasciarlo, e
  --     il bottone per lasciarlo sta sulla pagina di quel workshop.
  select attivo_slug, attivo_ruolo into v_slug, v_ruolo from public.stato_tetto_workshop();
  if v_slug is distinct from 'tetto-finto-1' or v_ruolo is distinct from 'Ruolo beta' then
    raise exception 'ROTTO 5: lo stato non nomina il workshop attivo (% / %).', v_slug, v_ruolo;
  end if;
  raise notice '  ok  5. lo stato del tetto nomina il workshop attivo e il suo ruolo';

  -- ── 6. lasciato quello, un altro workshop parte ─────────────────────────
  perform public.ritira_iscrizione_workshop(isc_attiva_uno);
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (w2, uno, r2);
  raise notice '  ok  6. lasciato il workshop attivo, un altro parte';

  -- ── 7. RIPRENDERE NON È LA VIA D'USCITA DAL TETTO ───────────────────────
  --     Qui `uno` ha w2 attivo e due iscrizioni lasciate su w1: riprenderne
  --     una gli darebbe due workshop attivi senza passare da nessun insert.
  begin
    perform public.riprendi_iscrizione_workshop(isc_attiva_uno);
    raise exception 'ROTTO 7: riprendere ha aggirato «uno alla volta».';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'workshop_gia_attivo' then raise; end if;
  end;
  select count(*) into v_n from public.workshop_iscrizioni where student_id = uno and stato = 'attivo';
  if v_n <> 1 then raise exception 'ROTTO 7: risultano % iscrizioni attive.', v_n; end if;
  raise notice '  ok  7. riprendere rispetta «uno alla volta» (workshop_gia_attivo)';

  -- ── 8. il tetto: tre usate, e lo stato lo dice ──────────────────────────
  reset role;
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id, stato) values
    (w1, pieno, r1a, 'completato'),
    (w2, pieno, r2,  'completato'),
    (w3, pieno, r3,  'completato');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', pieno::text, true);
  select usate, puo, attivo_slug into v_n, v_ok, v_slug from public.stato_tetto_workshop();
  if v_n <> 3 then raise exception 'ROTTO 8: usate = % invece di 3.', v_n; end if;
  if v_ok then raise exception 'ROTTO 8: con tre usate risulta ancora possibile cominciarne un altro.'; end if;
  if v_slug is not null then raise exception 'ROTTO 8: nessuna attiva, ma lo stato ne nomina una (%).', v_slug; end if;
  raise notice '  ok  8. tre completate riempiono il tetto, e nessuna risulta attiva';

  -- ── 9. il quarto workshop è respinto DAL DATABASE ───────────────────────
  begin
    insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (w4, pieno, r4);
    raise exception 'ROTTO 9: il quarto workshop è partito.';
  exception when insufficient_privilege or check_violation then null;
    when others then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%row-level security%' then raise; end if;
  end;
  raise notice '  ok  9. con il tetto pieno il quarto workshop è respinto';

  -- ── 10. e non si aggira nemmeno riprendendo ─────────────────────────────
  reset role;
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id, stato)
    values (w4, pieno, r4, 'ritirato') returning id into isc_lasciata;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', pieno::text, true);
  begin
    perform public.riprendi_iscrizione_workshop(isc_lasciata);
    raise exception 'ROTTO 10: riprendere ha aggirato il tetto.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'tetto_workshop_raggiunto' then raise; end if;
  end;
  raise notice '  ok  10. riprendere rispetta il tetto (tetto_workshop_raggiunto)';

  -- ── 11. il profilo di prova è esente ────────────────────────────────────
  --     Senza, una passata del robot produrrebbe 22 «fermato da un cancello»
  --     su 25 ruoli, e un solo guasto di rete ne bloccherebbe a cascata tutti
  --     i successivi.
  reset role;
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id, stato) values
    (w1, robot, r1a, 'completato'),
    (w2, robot, r2,  'completato'),
    (w3, robot, r3,  'completato'),
    (w1, robot, r1b, 'attivo');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', robot::text, true);
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (w4, robot, r4);
  raise notice '  ok  11. il profilo di prova passa il tetto (e anche «uno alla volta»)';

  -- ── 12. i predicati rispondono solo su chi li chiama ────────────────────
  perform set_config('request.jwt.claim.sub', vicino::text, true);
  select public.iscrizioni_workshop_contate() into v_n;
  if v_n <> 0 then raise exception 'ROTTO 12: il contatore risponde sulle iscrizioni di un altro (%).', v_n; end if;
  select public.ha_un_workshop_attivo() into v_ok;
  if v_ok then raise exception 'ROTTO 12: risulta attivo il workshop di un altro.'; end if;
  select public.puo_iscriversi_a_un_workshop() into v_ok;
  if not v_ok then raise exception 'ROTTO 12: chi non ha niente non può cominciare.'; end if;
  raise notice '  ok  12. i predicati rispondono solo su chi li chiama';

  -- ── 13b. anon non può nemmeno CHIAMARE la via d'uscita ──────────────────
  --     La 7 e la 10 provano che riprendere rispetta il tetto per chi è
  --     collegato. Questa prova il permesso: dal 2026-08-30
  --     `riprendi_iscrizione_workshop` era eseguibile anche da `anon`, perché i
  --     default privileges di Supabase la fanno nascere così e un
  --     `create or replace` non tocca i privilegi. Fallisce chiuso comunque
  --     (`where student_id = auth.uid()` non trova niente), ma il permesso è la
  --     prima porta e va chiusa lì.
  --     DUE ESITI DA DISTINGUERE, e la prima stesura non li distingueva: senza
  --     il revoke, `anon` ENTRA nella funzione e viene fermato dalla guardia
  --     interna con `non_autorizzato` — cioè fallisce chiuso, ed è per questo
  --     che non era un buco. Ma un `exception when insufficient_privilege` da
  --     solo non cattura `non_autorizzato`: la transazione abortiva su «ERROR:
  --     non_autorizzato», un rosso che non dice cosa è rotto. Adesso «sono
  --     arrivato alla guardia» è il caso ROTTO, e lo dice.
  reset role;
  set local role anon;
  v_ok := false;
  begin
    perform public.riprendi_iscrizione_workshop(isc_lasciata);
    v_msg := 'la chiamata è perfino riuscita';
  exception
    when insufficient_privilege then v_ok := true;          -- atteso: il permesso non c'è
    when others then get stacked diagnostics v_msg = message_text;
  end;
  reset role;
  if not v_ok then
    raise exception 'ROTTO 13b: anon ha potuto CHIAMARE riprendi_iscrizione_workshop — è arrivato alla guardia interna («%»). Manca il revoke: la guardia fallisce chiuso, ma il permesso è la prima porta.', v_msg;
  end if;
  raise notice '  ok  13b. anon non ha il permesso di chiamare riprendi_iscrizione_workshop';

  -- ── 13. senza sessione: chiuso, non aperto ──────────────────────────────
  reset role;
  set local role authenticated;
  --     Il caso che va guardato, perché il conteggio da solo direbbe sì: zero
  --     iscrizioni, nessuna attiva, 0 < 3. Lo chiude `auth.uid() is not null`.
  perform set_config('request.jwt.claim.sub', '', true);
  select public.puo_iscriversi_a_un_workshop() into v_ok;
  if v_ok is not false then raise exception 'ROTTO 13: senza sessione il predicato non dice no (%).', v_ok; end if;
  raise notice '  ok  13. senza sessione il predicato fallisce CHIUSO';

  reset role;
end $$;

-- Il SQL Editor non mostra i `raise notice`: se il blocco qui sopra fosse
-- saltato, ci sarebbe un errore rosso al posto di questa riga.
select 'Quattordici proprietà verificate: il tetto tiene da tutte e due le strade, fermarsi non costa un posto, e anon non ha nemmeno il permesso di provarci.' as esito;

rollback;
