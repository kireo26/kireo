-- 20261208100000 — I DATI DEI COLLEGHI SI CHIUDONO, E CHI HA VERIFICATO SI MOSTRA (Mario, 04/11)
--
-- a) `profiles_select_scuola_staff` (20260721110000) lasciava a un referente e a
-- un tutor leggere l'INTERA riga del profilo di un collega: data di nascita,
-- telefono, consenso alle comunicazioni. Le pagine leggevano solo nome e
-- cognome, ma una policy non guarda le colonne. È la forma chiusa per gli
-- studenti il 01/11 (20261128100000): una lettura stretta al posto del
-- permesso, e la policy esce. Decisione di Mario: un collega vede nome,
-- cognome, ruolo e deleghe (ruolo e deleghe stanno in `school_staff`, che lo
-- staff legge già per la propria scuola).
--
-- ⚠️ E LA POLICY AVEVA UN DIFETTO VICINO: copriva solo lo staff ATTIVO. La
-- pagina Staff elenca anche i tutor disattivati, e per loro il nome usciva come
-- «undefined undefined». `nomi_dello_staff()` dà il nome di ogni riga di staff
-- della scuola, attiva o no.
--
-- TABELLA DEI SOGGETTI, prima di togliere (replica, 04/11): le funzioni non
-- definer che leggono `profiles` sono `finalize_registration` e i tre trigger
-- `check_ruolo_*`, e leggono tutti il profilo di chi scrive, non di un collega;
-- le viste `stats_scuola*` girano come proprietario. L'unico lettore era la
-- pagina Staff.
--
-- b) Chi ha verificato uno studente: accanto a «Verificato il …» il nome, con le
-- regole di `nomi_dei_certificatori` (solo nome e cognome, solo a referente e
-- tutor, solo di chi ha toccato uno studente della LORO scuola, anche dopo una
-- disattivazione o una cancellazione: la lapide tiene il nome). È una porta a
-- parte perché la pagina ha uno studente in mano, non l'id di chi ha verificato,
-- e `studenti_della_scuola` resta senza `verificato_da` di proposito.
--
-- Da applicare PRIMA del deploy: la pagina Staff e la scheda le chiamano.

drop policy if exists profiles_select_scuola_staff on public.profiles;

create or replace function public.nomi_dello_staff()
returns table (user_id uuid, nome text, cognome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.cognome
    from public.school_staff ss
    join public.profiles p on p.id = ss.user_id
   where public.current_ruolo_staff() in ('referente', 'tutor')
     and public.current_scuola_profilo_id() is not null
     and ss.scuola_profilo_id = public.current_scuola_profilo_id()
$$;
revoke all on function public.nomi_dello_staff() from public, anon;
grant execute on function public.nomi_dello_staff() to authenticated, service_role;
comment on function public.nomi_dello_staff() is
  '20261208100000: nome e cognome dello staff della scuola di chi chiama, attivo o disattivato. Solo a referente e tutor. Mai altri campi del profilo.';

create or replace function public.verificatore_dello_studente(p_student uuid)
returns table (user_id uuid, nome text, cognome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.cognome
    from public.student_profiles sp
    join public.profiles p on p.id = sp.verificato_da
   where sp.user_id = p_student
     and sp.stato_verifica = 'verificato'
     and public.current_ruolo_staff() in ('referente', 'tutor')
     and public.current_scuola_id() is not null
     and sp.school_code = public.current_scuola_id()
$$;
revoke all on function public.verificatore_dello_studente(uuid) from public, anon;
grant execute on function public.verificatore_dello_studente(uuid) to authenticated, service_role;
comment on function public.verificatore_dello_studente(uuid) is
  '20261208100000: nome e cognome di chi ha verificato uno studente della scuola di chi chiama. Solo a referente e tutor. Nessuna riga se lo studente non è verificato, non è della scuola, o la verifica non ha un autore.';

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_scuola_staff') then
    raise exception '20261208100000: la policy sui profili dei colleghi è ancora lì';
  end if;
  if to_regprocedure('public.nomi_dello_staff()') is null or to_regprocedure('public.verificatore_dello_studente(uuid)') is null then
    raise exception '20261208100000: manca una delle due funzioni';
  end if;
  if has_function_privilege('anon', 'public.nomi_dello_staff()', 'execute')
     or has_function_privilege('anon', 'public.verificatore_dello_studente(uuid)', 'execute') then
    raise exception '20261208100000: anon le esegue';
  end if;
end $$;
