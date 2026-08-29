-- KIREO — correzione del trigger che protegge `profiles.di_prova`.
--
-- IL DIFETTO. La prima stesura bloccava così:
--
--   if new.di_prova is distinct from old.di_prova
--      and public.current_ruolo() is distinct from 'admin' then
--     new.di_prova := old.di_prova;
--   end if;
--
-- `current_ruolo()` legge `profiles` per `auth.uid()`. Da una connessione
-- diretta — SQL Editor, service_role, psql — `auth.uid()` è NULL, quindi la
-- select non torna niente, `NULL is distinct from 'admin'` è VERO, e il
-- trigger ripristina il valore vecchio. Risultato: il flag non si poteva
-- mettere da nessuna parte, e in particolare **non dalla strada che il
-- commento della migration precedente prescriveva**. La proprietà che il
-- commento dichiarava e il comportamento del codice erano due cose diverse.
--
-- E HA FALLITO IN SILENZIO: l'`update` riporta successo, perché un trigger
-- BEFORE che riscrive NEW non è un errore. Senza un `returning` che
-- rileggesse il valore, l'account sarebbe risultato marcato senza esserlo, e
-- il robot avrebbe scritto venticinque workshop di righe non marcate — che
-- sono l'unica cosa di tutta questa architettura che dopo non si aggiusta.
--
-- LA CORREZIONE. La discriminante è `auth.uid()`, non il ruolo trovato:
--   · c'è un utente e NON è admin  → si blocca (è uno studente che si marca);
--   · c'è un utente e È admin      → passa;
--   · non c'è nessun utente        → passa (connessione privilegiata).
--
-- L'ultimo ramo non apre niente di nuovo, e la ragione è nella RLS, non qui:
-- `profiles_update_own` è `to authenticated` con `using (id = auth.uid())`,
-- quindi un anonimo non arriva nemmeno al trigger. Chi ci arriva con
-- `auth.uid()` NULL è service_role o una connessione superuser, che la RLS la
-- scavalcano per progetto.
--
-- PERCHÉ NON `current_user`. Questa funzione è SECURITY DEFINER: al suo
-- interno `current_user` è il PROPRIETARIO della funzione, non chi la chiama.
-- Una condizione come `current_user in ('postgres','service_role')`
-- risulterebbe vera per tutti — una falla scritta credendo di chiudere un
-- buco, e in silenzio come quella che stiamo correggendo.
--
-- Il ramo `is distinct from` resta: `current_ruolo()` è NULL per un utente
-- autenticato che non ha ancora un profilo, e con `<>` il confronto darebbe
-- NULL invece di TRUE — cioè il blocco non scatterebbe. Con `auth.uid()` non
-- nullo e ruolo NULL si blocca, che è il verso giusto.

create or replace function public.blocca_autoflag_di_prova()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.di_prova is distinct from old.di_prova
     and auth.uid() is not null
     and public.current_ruolo() is distinct from 'admin' then
    new.di_prova := old.di_prova;
  end if;
  return new;
end;
$$;

comment on function public.blocca_autoflag_di_prova() is
  'Impedisce a uno STUDENTE di marcarsi da solo come profilo di prova. Un admin e una connessione privilegiata (service_role, SQL Editor) possono: lì auth.uid() è NULL, e per arrivarci bisogna già aver scavalcato la RLS. Verificabile con scripts/verifica-flag-di-prova.sql.';
