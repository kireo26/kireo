-- ═══════════════════════════════════════════════════════════════════════════
-- Un test che non produce nessuna prova non è un test completato.
--
-- PERCHÉ ESISTE. Il 19/09 il robot del banco ha salvato le risposte di T1 in
-- una forma che la route non sa leggere: zero prove. La route ha chiamato
-- `registra_evidenze_test` con un array vuoto, la funzione non ha trovato
-- niente da fare, e in fondo ha marcato comunque il tentativo `completata`.
-- Nessun errore da nessuna parte — e il primo ad accorgersene è stato T3, due
-- test più tardi, dicendo che le aree candidate erano meno di tre.
--
-- LA SECONDA METÀ, che è peggio della prima e non era stata prevista: la
-- funzione CANCELLA le prove esistenti prima di reinserirle. Una seconda
-- finalizzazione con l'array vuoto non lasciava il profilo com'era, glielo
-- SVUOTAVA. Verificato con la controprova (proprietà 3 sotto rimettendo la
-- funzione di prima: le prove buone sparivano), non dedotto.
--
-- La migrazione 20260919130000 aggiunge due `if` in testa alla funzione, prima
-- del delete; queste sei proprietà verificano che facciano quello che dicono.
--
-- COME SI USA. Incolla tutto nel SQL Editor di Supabase e premi Run. Non
-- lascia niente dietro di sé: crea uno studente finto, due tentativi finti, li
-- usa e alla fine fa ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  s uuid := '00000000-0000-0000-0000-00000000fe01'::uuid;
  altro uuid := '00000000-0000-0000-0000-00000000fe02'::uuid;
  a1 uuid := '00000000-0000-0000-0000-00000000fa01'::uuid;
  a2 uuid := '00000000-0000-0000-0000-00000000fa02'::uuid;
  prova jsonb := '[{"area_slug":"salute-professioni-sanitarie","dimensione":"interest","valore":0.9,"peso":0.35,"motivazione":"verifica","item_id":"i2"}]'::jsonb;
  v_n int; v_stato text; v_msg text;
begin
  insert into auth.users (id, email) values (s, 'verifica-prove@kireo.invalid');
  insert into public.profiles (id, ruolo, nome, cognome, data_nascita)
    values (s, 'studente', 'Verifica', 'Prove', '2008-01-01');
  insert into public.test_attempt (id, student_id, test_slug) values (a1, s, 'da-dove-parti');
  insert into public.test_attempt (id, student_id, test_slug) values (a2, s, 'come-ti-muovi');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', s::text, true);

  -- ── 1. con prove vere la funzione fa il suo mestiere ────────────────────
  perform public.registra_evidenze_test(a1, prova);
  select count(*) into v_n from public.evidence where test_attempt_id = a1;
  if v_n <> 1 then raise exception 'ROTTO 1: con prove vere non ha inserito niente (righe: %).', v_n; end if;
  select stato::text into v_stato from public.test_attempt where id = a1;
  if v_stato <> 'completata' then raise exception 'ROTTO 1: con prove vere il tentativo non si completa (stato: %).', v_stato; end if;
  raise notice '  ok  1. con prove vere: prove inserite e tentativo completato';

  -- ── 2. l'array vuoto viene respinto, con un nome intercettabile ─────────
  begin
    perform public.registra_evidenze_test(a2, '[]'::jsonb);
    raise exception 'ROTTO 2: l''array vuoto è stato accettato.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'nessuna_prova' then raise; end if;
  end;
  raise notice '  ok  2. array vuoto respinto con «nessuna_prova»';

  -- ── 3. e NON svuota le prove che c'erano ────────────────────────────────
  begin
    perform public.registra_evidenze_test(a1, '[]'::jsonb);
  exception when others then null;
  end;
  select count(*) into v_n from public.evidence where test_attempt_id = a1;
  if v_n <> 1 then raise exception 'ROTTO 3: una seconda finalizzazione a vuoto ha svuotato il profilo (righe rimaste: %).', v_n; end if;
  raise notice '  ok  3. una seconda finalizzazione a vuoto non cancella le prove buone';

  -- ── 4. il tentativo senza prove resta aperto ────────────────────────────
  select stato::text into v_stato from public.test_attempt where id = a2;
  if v_stato <> 'in_corso' then raise exception 'ROTTO 4: un test senza prove risulta %.', v_stato; end if;
  raise notice '  ok  4. il tentativo senza prove resta in_corso: si può riprendere';

  -- ── 5. null e non-array: respinti anche loro (la trappola NULL) ─────────
  begin
    perform public.registra_evidenze_test(a2, null);
    raise exception 'ROTTO 5: NULL accettato — la guardia cade sulla trappola NULL.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'nessuna_prova' then raise; end if;
  end;
  begin
    perform public.registra_evidenze_test(a2, '{}'::jsonb);
    raise exception 'ROTTO 5: un oggetto (non array) è stato accettato.';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'nessuna_prova' then raise; end if;
  end;
  raise notice '  ok  5. null e non-array respinti con lo stesso nome, non con un errore di sistema';

  -- ── 6. l'ownership regge ancora: la guardia nuova non l'ha scavalcata ───
  perform set_config('request.jwt.claim.sub', altro::text, true);
  begin
    perform public.registra_evidenze_test(a2, prova);
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
select 'Sei proprietà verificate: un test senza prove non si completa, e non svuota quello che c''era.' as esito;

rollback;
