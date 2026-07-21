-- La scheda studente (/scuola/studenti/[id]) mostra chi ha certificato
-- ogni partecipazione (iscrizioni_eventi.certificata_da_user): quando non
-- è lo stesso utente che sta guardando la pagina, serve poter leggere
-- nome/cognome di un COLLEGA (referente/tutor) della stessa scuola —
-- profiles_select_own copre solo il proprio profilo, e
-- profiles_select_scuola_studenti (dalla migration precedente) copre solo
-- i profili con ruolo='studente'. school_staff non contiene nome/cognome
-- (solo il collegamento a profiles), quindi senza questa policy l'embed
-- risulterebbe silenziosamente vuoto per chiunque non abbia certificato di
-- persona. Stesso pattern di profiles_select_scuola_studenti, ristretto a
-- chi è staff attivo (referente o tutor) della stessa scuola invece che a
-- ruolo='studente'. La policy permette la lettura dell'intera riga
-- profiles per costruzione RLS, ma le query applicative selezionano
-- sempre e solo nome/cognome per questo scopo (stesso pattern già in uso
-- altrove nel progetto).
create policy profiles_select_scuola_staff
  on public.profiles for select
  to authenticated
  using (
    public.current_ruolo_staff() is not null
    and public.current_ruolo_staff() in ('referente', 'tutor')
    and exists (
      select 1 from public.school_staff ss
      where ss.user_id = profiles.id
        and ss.attivo = true
        and ss.scuola_profilo_id = public.current_scuola_profilo_id()
    )
  );
