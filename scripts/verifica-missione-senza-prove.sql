-- ═══════════════════════════════════════════════════════════════════════════
-- Una missione senza prove non si completa, e non svuota quello che c'era.
--
-- PERCHÉ ESISTE. È la gemella di `verifica-test-senza-prove.sql`: lo stesso
-- buco che il robot ha trovato sui test viveva anche in `registra_evidence`
-- (missioni Escape). La migrazione 20260919140000 aggiunge le stesse due
-- righe di guardia; queste sei proprietà verificano che facciano quello che
-- dicono, con la STESSA forma dell'altra — se un giorno le due funzioni
-- divergeranno, divergeranno anche i due file, e si vedrà.
--
-- LA DIFFERENZA CHE QUESTO FILE NON PUÒ PROVARE, e che va saputa lo stesso:
-- sulle missioni non ci va nessun ritentativo automatico. Rifinalizzare un
-- test non costa niente, rifinalizzare una missione costa fino a tre chiamate
-- AI. Un tentativo che resta aperto lo riapre una persona — e quella regola
-- vive nella route (app/api/escape/finalizza) e nel testo che lo studente
-- legge, non in una proprietà SQL.
--
-- COME SI USA. Incolla tutto nel SQL Editor di Supabase e premi Run. Non
-- lascia niente dietro di sé: crea uno studente finto, due tentativi finti, li
-- usa e alla fine fa ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  s uuid := '00000000-0000-0000-0000-00000000fd01'::uuid;
  altro uuid := '00000000-0000-0000-0000-00000000fd02'::uuid;
  m1 uuid := '00000000-0000-0000-0000-00000000fb01'::uuid;
  m2 uuid := '00000000-0000-0000-0000-00000000fb02'::uuid;
  prova jsonb := '[{"area_slug":"salute-professioni-sanitarie","categoria":"area","dimensione":"interest","valore":0.9,"peso":1.2,"motivazione":"verifica","step_id":"s1_mandato"}]'::jsonb;
  v_n int; v_stato text; v_msg text;
begin
  insert into auth.users (id, email) values (s, 'verifica-missione@kireo.invalid');
  insert into public.profiles (id, ruolo, nome, cognome, data_nascita)
    values (s, 'studente', 'Verifica', 'Missione', '2008-01-01');
  insert into public.mission_attempt (id, student_id, mission_slug) values (m1, s, 'sportello-insieme');
  insert into public.mission_attempt (id, student_id, mission_slug) values (m2, s, 'progetto-quartiere');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', s::text, true);

  -- ── 1. con prove vere la funzione fa il suo mestiere ────────────────────
  perform public.registra_evidence(m1, prova);
  select count(*) into v_n from public.evidence where attempt_id = m1;
  if v_n <> 1 then raise exception 'ROTTO 1: con prove vere non ha inserito niente (righe: %).', v_n; end if;
  select stato::text into v_stato from public.mission_attempt where id = m1;
  if v_stato <> 'completata' then raise exception 'ROTTO 1: con prove vere la missione non si completa (stato: %).', v_stato; end if;
  raise notice '  ok  1. con prove vere: prove inserite e missione completata';

  -- ── 2. l'array vuoto viene respinto, con un nome intercettabile ─────────
  begin
    perform public.registra_evidence(m2, '[]'::jsonb);
    raise exception 'ROTTO 2: l''array vuoto è stato accettato.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'nessuna_prova' then raise; end if;
  end;
  raise notice '  ok  2. array vuoto respinto con «nessuna_prova»';

  -- ── 3. e NON svuota le prove che c'erano ────────────────────────────────
  --     È la metà che Mario ha chiesto di estendere per prima: «non cancellare
  --     quello che c'è quando non c'è niente da mettere al suo posto».
  begin
    perform public.registra_evidence(m1, '[]'::jsonb);
  exception when others then null;
  end;
  select count(*) into v_n from public.evidence where attempt_id = m1;
  if v_n <> 1 then raise exception 'ROTTO 3: una seconda finalizzazione a vuoto ha svuotato il profilo (righe rimaste: %).', v_n; end if;
  raise notice '  ok  3. una seconda finalizzazione a vuoto non cancella le prove buone';

  -- ── 4. il tentativo senza prove resta aperto ────────────────────────────
  select stato::text into v_stato from public.mission_attempt where id = m2;
  if v_stato <> 'in_corso' then raise exception 'ROTTO 4: una missione senza prove risulta %.', v_stato; end if;
  raise notice '  ok  4. il tentativo senza prove resta in_corso: lo riapre una persona, non un retry';

  -- ── 5. null e non-array: respinti anche loro (la trappola NULL) ─────────
  begin
    perform public.registra_evidence(m2, null);
    raise exception 'ROTTO 5: NULL accettato — la guardia cade sulla trappola NULL.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'nessuna_prova' then raise; end if;
  end;
  begin
    perform public.registra_evidence(m2, '{}'::jsonb);
    raise exception 'ROTTO 5: un oggetto (non array) è stato accettato.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'nessuna_prova' then raise; end if;
  end;
  raise notice '  ok  5. null e non-array respinti con lo stesso nome, non con un errore di sistema';

  -- ── 6. l'ownership regge ancora: la guardia nuova non l'ha scavalcata ───
  perform set_config('request.jwt.claim.sub', altro::text, true);
  begin
    perform public.registra_evidence(m2, prova);
    raise exception 'ROTTO 6: un estraneo ha scritto le prove di un altro.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'non_autorizzato' then raise; end if;
  end;
  raise notice '  ok  6. un estraneo resta respinto con «non_autorizzato»';

  reset role;
end $$;

-- Il SQL Editor non mostra i `raise notice`: se il blocco qui sopra fosse
-- saltato, ci sarebbe un errore rosso al posto di questa riga.
select 'Sei proprietà verificate: una missione senza prove non si completa, e non svuota quello che c''era.' as esito;

rollback;
