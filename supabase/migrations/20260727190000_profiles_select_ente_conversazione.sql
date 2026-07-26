-- L'ente deve poter leggere nome/cognome di uno studente con cui ha una
-- conversazione (per mostrarlo nell'inbox /ente/messaggi) — nessuna policy
-- esistente lo copriva. Stesso pattern già in uso per i docenti iscritti a
-- un webinar (profiles_select_organizzatore_docenti_iscritti,
-- 20260722120000): solo nome/cognome sono in profiles, nessun dato di
-- contatto lì (email vive in auth.users, mai esposta qui).
create policy profiles_select_ente_conversazione
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.conversazioni_enti c
      where c.student_id = profiles.id and c.istituzione_id = public.current_istituzione_id()
    )
  );

-- Nessuna policy admin generale su profiles esisteva ancora (ogni pagina
-- admin precedente evitava di leggerla direttamente, o passava da una
-- funzione SECURITY DEFINER dedicata): la vista di ispezione completa
-- delle conversazioni_enti richiesta dal compito ne ha bisogno per
-- mostrare nome/cognome dello studente in ogni riga.
create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using (public.current_ruolo() = 'admin');
