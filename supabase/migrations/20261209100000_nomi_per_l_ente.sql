-- 20261209100000 — L'ENTE LEGGE SOLO NOME E COGNOME DI CHI GLI SCRIVE E DI CHI SI ISCRIVE (Mario, 04/11)
--
-- Le ultime due regole che davano a un terzo l'INTERA riga di `profiles`:
--   · `profiles_select_ente_conversazione` (20260727190000): lo studente con cui
--     l'ente ha una conversazione;
--   · `profiles_select_organizzatore_docenti_iscritti` (20260722120000): il
--     docente iscritto a un evento per docenti dell'ente.
-- Le pagine leggevano nome e cognome; la policy lasciava leggere dall'API anche
-- data di nascita, telefono, consenso alle comunicazioni, `di_prova`. Stessa
-- cura delle altre due (20261128100000, 20261208100000): una lettura stretta al
-- posto del permesso, e le policy escono. Nome e cognome sì, il resto mai.
--
-- TABELLA DEI SOGGETTI, prima di togliere (replica, 04/11): chi legge `profiles`
-- passando da queste due regole sono tre file, tutti dell'ente:
-- `app/ente/(dashboard)/messaggi/page.tsx` e `…/messaggi/[id]/page.tsx`
-- (`profiles!student_id` su `conversazioni_enti`) e
-- `components/ente/PlanciaEnteEvento.tsx` (`profiles!student_id` su
-- `iscrizioni_eventi`, solo eventi per docenti). Nessuna funzione non definer e
-- nessuna vista ci passa (le viste girano come proprietario). La pagina
-- dell'ente nell'admin legge lo stesso embed, ma con `profiles_select_admin`,
-- che resta.
--
-- Le stesse condizioni delle due policy, nelle due funzioni:
--   · nomi_degli_studenti_in_conversazione(): una conversazione con l'ente di
--     chi chiama, qualunque stato (anche chiusa o con l'account cancellato: lì
--     il nome è già quello anonimo, e l'ente lo legge come prima);
--   · nomi_dei_docenti_iscritti(evento): un evento per docenti organizzato
--     dall'ente di chi chiama, e un profilo con ruolo `docente`.
-- Da applicare PRIMA del deploy: le tre letture nuove le chiamano. Con la
-- migrazione applicata il codice di prima perde i nomi (diventano «Studente»,
-- «Docente»), quindi il deploy va subito dopo.

drop policy if exists profiles_select_ente_conversazione on public.profiles;
drop policy if exists profiles_select_organizzatore_docenti_iscritti on public.profiles;

create or replace function public.nomi_degli_studenti_in_conversazione()
returns table (conversazione_id uuid, student_id uuid, nome text, cognome text)
language sql stable security definer set search_path = public as $$
  select c.id, p.id, p.nome, p.cognome
    from public.conversazioni_enti c
    join public.profiles p on p.id = c.student_id
   where public.current_istituzione_id() is not null
     and c.istituzione_id = public.current_istituzione_id()
$$;
revoke all on function public.nomi_degli_studenti_in_conversazione() from public, anon;
grant execute on function public.nomi_degli_studenti_in_conversazione() to authenticated, service_role;
comment on function public.nomi_degli_studenti_in_conversazione() is
  '20261209100000: nome e cognome degli studenti in conversazione con l''ente di chi chiama. Mai altri campi del profilo.';

create or replace function public.nomi_dei_docenti_iscritti(p_evento uuid)
returns table (user_id uuid, nome text, cognome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.cognome
    from public.iscrizioni_eventi ie
    join public.eventi e on e.id = ie.evento_id
    join public.profiles p on p.id = ie.student_id
   where ie.evento_id = p_evento
     and e.pubblico = 'docenti'
     and p.ruolo = 'docente'
     and public.current_istituzione_id() is not null
     and e.organizzatore_id = public.current_istituzione_id()
$$;
revoke all on function public.nomi_dei_docenti_iscritti(uuid) from public, anon;
grant execute on function public.nomi_dei_docenti_iscritti(uuid) to authenticated, service_role;
comment on function public.nomi_dei_docenti_iscritti(uuid) is
  '20261209100000: nome e cognome dei docenti iscritti a un evento per docenti dell''ente di chi chiama. Mai altri campi del profilo.';

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
              and policyname in ('profiles_select_ente_conversazione', 'profiles_select_organizzatore_docenti_iscritti')) then
    raise exception '20261209100000: una delle due policy dell''ente sui profili è ancora lì';
  end if;
  if to_regprocedure('public.nomi_degli_studenti_in_conversazione()') is null
     or to_regprocedure('public.nomi_dei_docenti_iscritti(uuid)') is null then
    raise exception '20261209100000: manca una delle due funzioni';
  end if;
  if has_function_privilege('anon', 'public.nomi_degli_studenti_in_conversazione()', 'execute')
     or has_function_privilege('anon', 'public.nomi_dei_docenti_iscritti(uuid)', 'execute') then
    raise exception '20261209100000: anon le esegue';
  end if;
end $$;
