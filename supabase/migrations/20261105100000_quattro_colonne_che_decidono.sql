-- LE QUATTRO PEGGIORI DEL CENSIMENTO DELLE COLONNE (Mario, 27/10; censimento
-- in CLAUDE.md, «Il censimento delle colonne che il client scrive», sonde in
-- `scripts/diagnostica-colonne-che-decidono.sql`, tutte morse sulla replica).
-- Una migrazione sola, prima del rovesciamento delle 41 tabelle: queste quattro
-- parlano di un TERZO o di un valore formale, le altre ingannano chi le scrive.
--
-- LA FORMA È QUELLA CHE DIVENTERÀ DI TUTTE: si toglie al client la tabella e si
-- riconcedono le sole colonne che il client scrive davvero, lette nel codice il
-- 27/10 (gli elenchi sono qui sotto, tabella per tabella, con chi le scrive).
-- ⚠️ CONSEGUENZA, scritta perché si legga: una colonna nuova di queste quattro
-- tabelle non è scrivibile dal client finché qualcuno non la aggiunge qui. È il
-- verso rumoroso: una schermata nuova che la scrive fallisce con «permission
-- denied», invece di scrivere in silenzio una cosa che decide.
-- ⚠️ E il prezzo, già scritto in «Una regola su una riga si scrive in RLS; una
-- su una colonna, nei privilegi»: i privilegi sono per ruolo, quindi valgono
-- anche per l'admin collegato dal client. Su queste quattro tabelle oggi l'admin
-- dal client non scrive nessuna delle colonne tolte [letto il 27/10: le scrivono
-- solo funzioni SECURITY DEFINER o il SQL Editor].
--
-- 1 · L'IDENTITÀ. `profiles.ruolo` si riscriveva da sé (tutto tranne admin e
-- referente), e chi non aveva una riga in `student_profiles` la inseriva già
-- `verificato`, con `verificato_da` a nome di un referente (sonde 2 e 4).
--   · Il 13/07 il ruolo era stato dichiarato «self-service di proposito»
--     (20260713110000), e due prove lo eseguivano come legittimo. Quella frase
--     parlava del SIGNUP: il ruolo si sceglie registrandosi, cioè all'insert di
--     `finalize_registration` (che NON è security definer e scrive con i
--     privilegi di chi si registra). Nessun codice del prodotto aggiorna il
--     ruolo dopo [grep del 27/10: gli unici update di `profiles` dal client sono
--     `data_nascita` (CompletaEtaForm) e `telefono` (ProfiloForm)]. Quindi l'update
--     del ruolo non era una funzione: era una porta che nessuno usava.
--   · Il 5/10 (20261005100000) la verifica era stata tolta all'UPDATE del client
--     e non all'INSERT, e il commento della tabella diceva «il client NON può
--     scrivere» lo stato: vero per metà. Qui si chiude l'altra metà, nei
--     privilegi e nella policy, così le due policy dicono la stessa cosa.
--   · Effetto collaterale voluto: `di_prova` ed `esente_cancelli` non sono più
--     scrivibili dal client, quindi il ramo di `blocca_autoflag_di_prova` che
--     rimetteva i valori in silenzio a un collegato non admin non ha più un
--     chiamante (un collegato riceve «permission denied»). Il trigger resta per
--     i valori di partenza dell'insert.
--
-- 2 · L'EVIDENZA SENZA QUOTA. `eventi.in_evidenza`/`in_evidenza_dal` si
-- scrivevano alla proposta, con una data fuori dall'anno che la quota conta
-- (sonda 5). La sola strada è `metti_in_evidenza_evento` (security definer).
--
-- 3 · L'EVENTO CHE NASCE CHIUSO. La policy di update pretendeva le colonne della
-- chiusura vuote, quella di insert no (sonda 9). La sola strada è
-- `chiudi_diretta_evento` (security definer).
--
-- 4 · IL TUTOR CHE NON HA ACCETTATO. Il referente cambiava `user_id` su una riga
-- di staff con un update (sonda 8), e scriveva `creato_da` e la delega a nome di
-- un altro all'insert (sonda 7). `crea_invito_tutor` NON è security definer:
-- inserisce con i privilegi del referente, quindi l'insert resta, con le sole
-- colonne che la funzione scrive e `creato_da = auth.uid()`. `user_id` lo scrive
-- solo `redeem_invito_staff` (security definer), cioè chi riscatta l'invito. La
-- delega la scrive il trigger `tieni_traccia_delega_permessi`, che non ha
-- bisogno di privilegi di colonna.
-- ⚠️ NON CURATO QUI: `codice_invito` resta scelto da chi inserisce. La funzione
-- lo genera, ma un referente che inserisce a mano può sceglierne uno indovinabile.
--
-- COME SI VERIFICA APPLICATA (la migrazione rilegge da sé e si ferma se non torna):
--   select has_column_privilege('authenticated','public.profiles','ruolo','UPDATE')                  → false
--   select has_column_privilege('authenticated','public.student_profiles','stato_verifica','INSERT') → false
--   select has_column_privilege('authenticated','public.eventi','in_evidenza','INSERT')              → false
--   select has_column_privilege('authenticated','public.school_staff','user_id','UPDATE')            → false
-- e come controllo, che non devono cambiare:
--   select has_column_privilege('authenticated','public.profiles','telefono','UPDATE')               → true
--   select has_column_privilege('authenticated','public.school_staff','puo_gestire_classi','UPDATE') → true

-- ── 1 · profiles ─────────────────────────────────────────────────────────────
-- insert: finalize_registration (id, ruolo, nome, cognome, data_nascita)
-- update: CompletaEtaForm (data_nascita), ProfiloForm (telefono)
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, ruolo, nome, cognome, data_nascita) on public.profiles to authenticated;
grant update (data_nascita, telefono) on public.profiles to authenticated;

-- ── 1 · student_profiles ─────────────────────────────────────────────────────
-- insert: finalize_registration (user_id, school_code, classe, anno_diploma)
-- update: ProfiloForm (school_code, classe)
-- la verifica: solo verifica_studente (security definer)
revoke insert, update on public.student_profiles from anon, authenticated;
grant insert (user_id, school_code, classe, anno_diploma) on public.student_profiles to authenticated;
grant update (school_code, classe) on public.student_profiles to authenticated;

drop policy if exists student_profiles_insert_own on public.student_profiles;
create policy student_profiles_insert_own
  on public.student_profiles for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and stato_verifica = 'dichiarato'
    and verificato_da is null
    and verificato_il is null
  );

comment on table public.student_profiles is
  'Profilo studente: la scuola dichiarata (school_code/classe, self-service di '
  'proposito) e l''esito della verifica della scuola (stato_verifica/'
  'verificato_da/verificato_il), che il client non puo'' scrivere ne'' '
  'all''update (dal 5/10, 20261005100000) ne'' all''insert (dal 27/10, '
  '20261105100000): li scrive solo verifica_studente, SECURITY DEFINER. Fino '
  'al 27/10 questo commento diceva che il client non poteva scriverli, ed era '
  'vero solo per l''update.';

-- ── 2 e 3 · eventi ───────────────────────────────────────────────────────────
-- Le colonne di eventi sono già concesse una per una (20261029100000 per
-- l'update, 20261029110000 per l'insert): qui se ne tolgono otto.
revoke insert (in_evidenza, in_evidenza_dal,
               diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_da_user,
               diretta_chiusa_presenti, diretta_chiusa_certificati, diretta_durata_minuti)
  on public.eventi from anon, authenticated;
revoke update (in_evidenza, in_evidenza_dal,
               diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_da_user,
               diretta_chiusa_presenti, diretta_chiusa_certificati, diretta_durata_minuti)
  on public.eventi from anon, authenticated;

-- ── 4 · school_staff ─────────────────────────────────────────────────────────
-- insert: crea_invito_tutor (scuola_profilo_id, ruolo_staff, user_id, codice_invito,
--         nome_invitato, email_invitato, creato_da)
-- update: TogglePermessiTutor (le quattro deleghe), DisattivaStaffButton (attivo)
revoke insert, update on public.school_staff from anon, authenticated;
grant insert (scuola_profilo_id, ruolo_staff, user_id, codice_invito, nome_invitato, email_invitato, creato_da)
  on public.school_staff to authenticated;
grant update (attivo, puo_verificare_studenti, puo_gestire_classi, puo_certificare_presenze, puo_inviare_comunicazioni)
  on public.school_staff to authenticated;

drop policy if exists school_staff_insert_invito_referente on public.school_staff;
create policy school_staff_insert_invito_referente
  on public.school_staff for insert
  to authenticated
  with check (
    public.current_ruolo_staff() = 'referente'
    and scuola_profilo_id = public.current_scuola_profilo_id()
    and ruolo_staff = 'tutor'
    and user_id is null
    and creato_da = auth.uid()
  );

-- ── la rilettura ─────────────────────────────────────────────────────────────
do $$
declare v_sbagliati text;
begin
  select string_agg(t || '.' || c || ' ' || p || ' = ' || atteso::text, ', ')
    into v_sbagliati
  from (values
    ('profiles', 'ruolo', 'UPDATE', false),
    ('profiles', 'di_prova', 'UPDATE', false),
    ('profiles', 'di_prova', 'INSERT', false),
    ('profiles', 'esente_cancelli', 'INSERT', false),
    ('profiles', 'ruolo', 'INSERT', true),
    ('profiles', 'telefono', 'UPDATE', true),
    ('profiles', 'data_nascita', 'UPDATE', true),
    ('student_profiles', 'stato_verifica', 'INSERT', false),
    ('student_profiles', 'verificato_da', 'INSERT', false),
    ('student_profiles', 'stato_verifica', 'UPDATE', false),
    ('student_profiles', 'school_code', 'INSERT', true),
    ('student_profiles', 'classe', 'UPDATE', true),
    ('eventi', 'in_evidenza', 'INSERT', false),
    ('eventi', 'in_evidenza_dal', 'UPDATE', false),
    ('eventi', 'diretta_chiusa_il', 'INSERT', false),
    ('eventi', 'diretta_durata_minuti', 'UPDATE', false),
    ('eventi', 'titolo', 'INSERT', true),
    ('eventi', 'youtube_video_id', 'UPDATE', true),
    ('school_staff', 'user_id', 'UPDATE', false),
    ('school_staff', 'creato_da', 'UPDATE', false),
    ('school_staff', 'delega_aggiornata_da', 'INSERT', false),
    ('school_staff', 'puo_gestire_classi', 'INSERT', false),
    ('school_staff', 'codice_invito', 'INSERT', true),
    ('school_staff', 'puo_gestire_classi', 'UPDATE', true),
    ('school_staff', 'attivo', 'UPDATE', true)
  ) as v(t, c, p, atteso)
  where has_column_privilege('authenticated', 'public.' || t, c, p) is distinct from atteso;

  if v_sbagliati is not null then
    raise exception 'privilegi diversi da quelli scritti (atteso): %', v_sbagliati;
  end if;
end $$;
