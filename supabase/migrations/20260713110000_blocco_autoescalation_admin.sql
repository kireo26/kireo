-- Aggiorna i vincoli anti-auto-elevazione di profiles (introdotti in
-- 20260710180300_row_level_security.sql) per includere anche il nuovo
-- ruolo "admin" (aggiunto in 20260713100000, per questo va in una
-- migration separata successiva): un utente non deve mai potersi
-- assegnare da solo referente_scuola O admin. "istituzione" resta invece
-- self-service: il signup di un ente crea comunque un profilo con quel
-- ruolo, solo l'attivazione (istituzioni.stato) è manuale.
drop policy profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and ruolo not in ('referente_scuola', 'admin'));

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and ruolo not in ('referente_scuola', 'admin'));
