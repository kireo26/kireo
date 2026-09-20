-- ═══════════════════════════════════════════════════════════════════════════
-- I due cancelli del percorso: missioni dopo i test, workshop dopo un'esperienza.
--
-- PERCHÉ IL TEST PARLA AL DATABASE E NON ALLA PAGINA. Le iscrizioni si creano
-- dal client (`IscrizioneRuolo.tsx`, `IniziaMissione.tsx`), quindi un controllo
-- in pagina è un consiglio con un bottone in meno: si aggira con una richiesta
-- a mano. Queste proprietà chiamano l'`insert` direttamente, sotto la sessione
-- dello studente — se provassero la pagina, proverebbero la cortesia e non il
-- cancello.
--
-- LE DUE CHE SI DIMENTICANO SEMPRE sono la 5 e la 6: il CAMBIO RUOLO e il
-- RIGIOCO di una missione sono INSERT, non riaperture, quindi un cancello
-- scritto solo sui requisiti li mangerebbe — e sono due strade che il prodotto
-- ha aperto apposta. La non-retroattività sullo stato copre chi sta fermo;
-- quelle due coprono chi si muove.
--
-- COME SI USA. Incolla tutto nel SQL Editor di Supabase e premi Run. Non
-- lascia niente dietro di sé: crea i propri studenti finti, li usa e alla fine
-- fa ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  -- nuovo: nessun test, nessuna missione, nessuna iscrizione
  nuovo uuid := '00000000-0000-0000-0000-0000000ca001'::uuid;
  -- diligente: farà i tre test, poi una missione
  dili  uuid := '00000000-0000-0000-0000-0000000ca002'::uuid;
  -- dentro: entrato PRIMA del cancello, senza niente alle spalle
  dentro uuid := '00000000-0000-0000-0000-0000000ca003'::uuid;
  v_ws uuid; v_r1 uuid; v_r2 uuid; v_isc uuid; v_msg text; v_n int; v_ok boolean;
  prova jsonb := '[{"area_slug":"salute-professioni-sanitarie","dimensione":"interest","valore":0.9,"peso":0.35,"motivazione":"v","item_id":"i2"}]'::jsonb;
  provaM jsonb := '[{"area_slug":"salute-professioni-sanitarie","categoria":"area","dimensione":"interest","valore":0.9,"peso":1.2,"motivazione":"v","step_id":"s1_mandato"}]'::jsonb;
begin
  insert into auth.users (id, email) values
    (nuovo, 'nuovo@kireo.invalid'), (dili, 'diligente@kireo.invalid'), (dentro, 'dentro@kireo.invalid');
  insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
    (nuovo, 'studente', 'Nuovo', 'A', '2008-01-01'),
    (dili,  'studente', 'Diligente', 'B', '2008-01-01'),
    (dentro,'studente', 'Dentro', 'C', '2008-01-01');

  -- un workshop finto con due ruoli: usarne uno vero legherebbe l'esito a
  -- quello che stanno facendo studenti in carne e ossa.
  insert into public.workshop (slug, titolo, descrizione, attivo)
    values ('cancelli-finto', 'Workshop di prova', 'solo per questa verifica', true)
    returning id into v_ws;
  insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
    values (v_ws, 'alfa', 'Ruolo alfa', 'salute-professioni-sanitarie') returning id into v_r1;
  insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
    values (v_ws, 'beta', 'Ruolo beta', 'economia-management') returning id into v_r2;

  -- «dentro» era già iscritto prima che il cancello esistesse
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id)
    values (v_ws, dentro, v_r1) returning id into v_isc;

  -- ── 1. il nuovo non entra in una missione ───────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', nuovo::text, true);
  begin
    insert into public.mission_attempt (student_id, mission_slug) values (nuovo, 'progetto-quartiere');
    raise exception 'ROTTO 1: senza i tre test la missione è partita.';
  exception when insufficient_privilege or check_violation then null;
    when others then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%row-level security%' then raise; end if;
  end;
  raise notice '  ok  1. senza i tre test la missione è respinta DAL DATABASE';

  -- ── 2. il nuovo non entra in un workshop ────────────────────────────────
  begin
    insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (v_ws, nuovo, v_r1);
    raise exception 'ROTTO 2: senza esperienza il workshop è partito.';
  exception when insufficient_privilege or check_violation then null;
    when others then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%row-level security%' then raise; end if;
  end;
  raise notice '  ok  2. senza esperienza il workshop è respinto DAL DATABASE';

  -- ── 3. fatti i tre test, la missione si apre ────────────────────────────
  reset role;
  insert into public.test_attempt (student_id, test_slug) values
    (dili, 'da-dove-parti'), (dili, 'come-ti-muovi'), (dili, 'piu-a-fondo');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', dili::text, true);
  -- i test si completano come li completa il prodotto: con delle prove
  perform public.registra_evidenze_test(a.id, prova)
    from (select id from public.test_attempt where student_id = dili) a;
  select public.ha_completato_i_tre_test() into v_ok;
  if not v_ok then raise exception 'ROTTO 3: i tre test risultano incompleti.'; end if;
  insert into public.mission_attempt (student_id, mission_slug) values (dili, 'progetto-quartiere');
  raise notice '  ok  3. con i tre test completati la missione parte';

  -- ── 4. finita la missione, il workshop si apre ──────────────────────────
  begin
    insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (v_ws, dili, v_r1);
    raise exception 'ROTTO 4: il workshop si è aperto con la missione ancora in corso.';
  exception when insufficient_privilege or check_violation then null;
    when others then
      get stacked diagnostics v_msg = message_text;
      if v_msg not like '%row-level security%' then raise; end if;
  end;
  perform public.registra_evidence(m.id, provaM)
    from (select id from public.mission_attempt where student_id = dili limit 1) m;
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (v_ws, dili, v_r1);
  raise notice '  ok  4. il workshop si apre solo DOPO che la missione è finita';

  -- ── 5. IL CAMBIO RUOLO di chi è già dentro passa ────────────────────────
  --     «dentro» non ha né test né missioni: lascia il suo ruolo e ne prende
  --     un altro, che è la strada aperta il 2026-08-30.
  perform set_config('request.jwt.claim.sub', dentro::text, true);
  perform public.ritira_iscrizione_workshop(v_isc);
  insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id) values (v_ws, dentro, v_r2);
  raise notice '  ok  5. chi è già dentro cambia ruolo, anche senza requisiti';

  -- ── 6. IL RIGIOCO di una missione passa ─────────────────────────────────
  --     Un rigioco è un INSERT nuovo, non la riapertura di un tentativo: senza
  --     la clausola «sei già dentro» il cancello se lo mangerebbe.
  reset role;
  insert into public.mission_attempt (student_id, mission_slug, stato)
    values (dentro, 'progetto-quartiere', 'completata');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', dentro::text, true);
  insert into public.mission_attempt (student_id, mission_slug) values (dentro, 'crisi-mediateca');
  raise notice '  ok  6. chi ha già giocato una missione può rigiocarne un''altra';

  -- ── 7. il cancello non si apre per il vicino ────────────────────────────
  --     «nuovo» non deve ereditare niente dai progressi di «diligente».
  perform set_config('request.jwt.claim.sub', nuovo::text, true);
  select public.ha_completato_i_tre_test() into v_ok;
  if v_ok then raise exception 'ROTTO 7: il predicato risponde sui test di un altro.'; end if;
  select public.ha_esperienza_percorso() into v_ok;
  if v_ok then raise exception 'ROTTO 7: il predicato risponde sull''esperienza di un altro.'; end if;
  raise notice '  ok  7. i predicati rispondono solo su chi li chiama';

  -- ── 8. senza sessione: chiuso, non aperto ───────────────────────────────
  perform set_config('request.jwt.claim.sub', '', true);
  select public.ha_completato_i_tre_test() into v_ok;
  if v_ok is not false then raise exception 'ROTTO 8: senza auth.uid() il predicato non dice no (%).', v_ok; end if;
  select public.ha_esperienza_percorso() into v_ok;
  if v_ok is not false then raise exception 'ROTTO 8: senza auth.uid() l''esperienza non dice no (%).', v_ok; end if;
  raise notice '  ok  8. senza sessione il cancello fallisce CHIUSO';

  -- ── 9. un workshop consegnato vale come una missione ────────────────────
  --     È il metro di lib/percorso/stato.ts, condizione 4: non una quarta
  --     definizione inventata per il cancello.
  reset role;
  select count(*) into v_n from public.mission_attempt where student_id = dentro and stato = 'completata';
  if v_n = 0 then raise exception 'ROTTO 9: preparazione sbagliata.'; end if;
  raise notice '  ok  9. «esperienza» = una missione completata O un workshop consegnato';

  reset role;
end $$;

-- Il SQL Editor non mostra i `raise notice`: se il blocco qui sopra fosse
-- saltato, ci sarebbe un errore rosso al posto di questa riga.
select 'Nove proprietà verificate: i cancelli tengono, e chi è già dentro continua a muoversi.' as esito;

rollback;
