-- Bonifica: 2 dei 3 utenti orfani creati dai tentativi falliti di
-- registrazione ente del 12/7 (auth.users creato dal signup, ma profiles
-- mai scritto per via del bug RLS corretto in 20260713190000). Rende le loro
-- email di nuovo registrabili, cancellando solo la riga in auth.users.
--
-- Il terzo utente orfano dello stesso batch, consulente.izzo@gmail.com, è
-- stato riparato a mano il 13/7 (ha già profilo ruolo istituzione e
-- collegamento a Accademia del Gusto) e NON va toccato — infatti non compare
-- in questa lista.
--
-- Non esiste alcuna riga collegata in profiles per le due email sotto (la
-- scrittura non è mai arrivata a completarsi), quindi non c'è nient'altro da
-- ripulire: nessuna cascata su istituzioni/institution_profiles da temere.
-- La condizione "not exists profiles" resta comunque una sicurezza in più:
-- se nel frattempo uno di questi utenti fosse stato completato regolarmente
-- con un'altra procedura, la delete su quella riga specifica viene saltata
-- invece di cancellare un account funzionante.
delete from auth.users
where email in ('annamontefuscoboutique@gmail.com', 'afterapplep@gmail.com')
  and not exists (select 1 from public.profiles where profiles.id = auth.users.id);
