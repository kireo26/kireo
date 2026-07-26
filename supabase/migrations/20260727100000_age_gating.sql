-- Livello social (1/8): fondazione age-gating. Principio architetturale
-- (Mario): la piattaforma è completa per i maggiorenni; i minorenni hanno
-- BLOCCHI nei punti critici (manifestazione di interesse, messaggi con gli
-- enti) — nessun dato individuale dello studente arriva agli enti se non
-- per azione esplicita di uno studente maggiorenne.
--
-- Nessuna nuova colonna: profiles.data_nascita esiste già (nullable, CHECK
-- >=14 anni da 20260711140000_auth_registration.sql) ed è già raccolta
-- obbligatoriamente in RegistrazioneForm per i nuovi studenti — qui si
-- aggiunge solo l'helper condiviso SQL/TS che ogni gate 18+ userà, più il
-- percorso di completamento per chi si è registrato prima che il campo
-- fosse obbligatorio (vedi CompletaEtaForm lato app).

-- NULL-safe per costruzione: una data di nascita mancante restituisce
-- false (minorenne), mai true — guardia conservativa esplicitamente
-- richiesta. Specchiata lato client in lib/eta.ts (isMaggiorenne), usata
-- SOLO per l'esperienza utente: il vero gate resta sempre qui o in
-- current_e_maggiorenne().
create or replace function public.is_maggiorenne(p_data_nascita date)
returns boolean
language sql
immutable
as $$
  select p_data_nascita is not null and p_data_nascita <= (current_date - interval '18 years');
$$;

-- coalesce(...,false): se auth.uid() non ha ancora un profilo la select
-- interna non ritorna righe e il valore sarebbe NULL, non false — stesso
-- principio già consolidato in current_ha_permesso_staff (mai un valore
-- NULL che possa sfuggire a un confronto positivo "= true" a valle).
create or replace function public.current_e_maggiorenne()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select public.is_maggiorenne(data_nascita) from public.profiles where id = auth.uid()), false);
$$;

comment on function public.current_e_maggiorenne() is
  'Usata da ogni RLS/funzione che deve verificare la maggiore età dell''utente corrente (manifestazioni_interesse, conversazioni_enti). Mai NULL per costruzione (coalesce a false): un profilo mancante o senza data di nascita è sempre trattato come minorenne.';
