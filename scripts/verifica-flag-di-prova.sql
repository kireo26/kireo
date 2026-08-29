-- ═══════════════════════════════════════════════════════════════════════════
-- Il flag `profiles.di_prova`, messo per la via prescritta, RESTA MESSO.
--
-- PERCHÉ ESISTE. La prima stesura del trigger `blocca_autoflag_di_prova`
-- bloccava anche la connessione diretta — SQL Editor, service_role — cioè
-- esattamente la strada che il commento della migration prescriveva. E ha
-- fallito IN SILENZIO: un trigger BEFORE che riscrive NEW non è un errore,
-- quindi l'`update` riportava successo mentre il valore restava com'era.
-- Senza un `returning` che rileggesse, l'account sarebbe risultato marcato
-- senza esserlo, e il robot avrebbe scritto venticinque workshop di righe
-- indistinguibili da quelle degli studenti veri.
--
-- QUINDI QUESTO CONTROLLO RILEGGE, sempre, dopo ogni scrittura. Non si fida
-- dell'esito dell'update: è precisamente ciò che ci ha ingannati.
--
-- COME SI USA. Incolla tutto nel SQL Editor di Supabase e premi Run.
-- Non lascia niente dietro di sé: crea due profili finti, li prova, e alla
-- fine fa ROLLBACK. Se qualcosa non torna, si ferma con un messaggio che dice
-- QUALE proprietà è saltata.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  v_studente uuid := '00000000-0000-0000-0000-0000000f0001';
  v_admin    uuid := '00000000-0000-0000-0000-0000000f0002';
  v_letto    boolean;
begin
  -- Due profili finti. Passano da auth.users perché `profiles.id` ha la
  -- foreign key; l'autenticazione vera non serve, `auth.uid()` si simula con
  -- la claim, che è quello che la funzione legge davvero.
  insert into auth.users (id, email) values
    (v_studente, 'prova-robot@esempio.invalid'),
    (v_admin,    'prova-admin@esempio.invalid');

  insert into public.profiles (id, nome, cognome, data_nascita, ruolo, di_prova)
  values (v_studente, 'Prova', 'Robot', '2008-01-01', 'studente', false),
         (v_admin,    'Prova', 'Admin', '1980-01-01', 'admin',    false);

  -- ── 1. La via prescritta: connessione diretta, nessuna sessione. ────────
  -- È il caso che prima falliva in silenzio, ed è quello che serve per
  -- marcare l'account del robot.
  perform set_config('request.jwt.claim.sub', '', true);
  update public.profiles set di_prova = true where id = v_studente;

  select di_prova into v_letto from public.profiles where id = v_studente;
  if v_letto is not true then
    raise exception 'ROTTO: da una connessione diretta il flag non si riesce a mettere. È il difetto del 2026-08-30: il trigger scambia «nessuna sessione» per «non admin».';
  end if;
  raise notice '  ok  connessione diretta: il flag si mette (ed è la via prescritta)';

  -- ── 2. Lo studente NON si marca da solo. ────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_studente::text, true);
  update public.profiles set di_prova = false where id = v_studente;

  select di_prova into v_letto from public.profiles where id = v_studente;
  if v_letto is not true then
    raise exception 'ROTTO: uno studente è riuscito a togliersi il flag da solo. Il trigger non sta più proteggendo niente.';
  end if;
  raise notice '  ok  lo studente non si marca (né si smarca) da solo';

  -- ── 3. Un admin sì. ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  update public.profiles set di_prova = false where id = v_studente;

  select di_prova into v_letto from public.profiles where id = v_studente;
  if v_letto is not false then
    raise exception 'ROTTO: un admin non riesce a cambiare il flag. Il trigger sta bloccando anche chi deve poter passare.';
  end if;
  raise notice '  ok  un admin può cambiarlo';

  -- ── 4. Un autenticato SENZA profilo: fail closed. ───────────────────────
  -- `current_ruolo()` torna NULL, e con `<>` il confronto darebbe NULL invece
  -- di TRUE: è la trappola già pagata più volte in questo progetto.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000f0009', true);
  update public.profiles set di_prova = true where id = v_studente;

  select di_prova into v_letto from public.profiles where id = v_studente;
  if v_letto is not false then
    raise exception 'ROTTO: un utente autenticato senza profilo è riuscito a marcare qualcuno. Il confronto NULL non sta fallendo chiuso.';
  end if;
  raise notice '  ok  un autenticato senza profilo è bloccato (fail closed)';

end $$;

-- Il SQL Editor non mostra i `raise notice`: senza questa riga il successo si
-- deduceva dall'assenza di un errore, che è il modo peggiore di sapere una
-- cosa. Se una delle quattro proprietà fosse saltata, qui ci sarebbe un
-- messaggio rosso invece di questa riga.
select 'Quattro proprietà verificate: il flag si mette dalla via prescritta, e nessuno se lo mette da solo.' as esito;

rollback;

-- ═══════════════════════════════════════════════════════════════════════════
-- E QUESTO È IL COMANDO VERO, quello che marca l'account del robot.
-- Il `returning` non è un vezzo: è l'unica cosa che distingue «marcato» da
-- «l'update è riuscito». Se la colonna torna `false`, il trigger ha morso e
-- la migration 20260830110000 non è applicata.
--
--   update public.profiles p
--   set di_prova = true
--   from auth.users u
--   where u.id = p.id and u.email = 'INDIRIZZO-DEL-ROBOT'
--   returning p.id, u.email, p.di_prova;
-- ═══════════════════════════════════════════════════════════════════════════
