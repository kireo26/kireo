-- I PROFILI SENZA DATA DI NASCITA, E COSA HANNO FATTO VERSO GLI ENTI (28/10).
--
-- Sola lettura. Si incolla nel SQL Editor di Supabase così com'è: niente
-- meta-comandi di psql, e una sola istruzione, perché il SQL Editor mostra solo
-- il risultato dell'ultima.
--
-- Perché serve: `profiles_eta_minima` rifiuta chi dichiara meno di 14 anni e
-- lascia passare chi non dichiara niente. Fra il 27/07 e il 28/10 il cancello
-- dei 18 anni fermava per caso anche chi non aveva una data; il 28/10
-- 20261109100000 l'ha tolto, e fino a 20261109110000 chiunque fosse collegato
-- (studente senza data, docente, account d'ente) poteva «condividere il
-- profilo» con un ente e aprirgli una conversazione da studente.
--
-- Come si legge, una riga per ruolo:
--   senza_data          quanti profili di quel ruolo non hanno una data;
--   di_prova            di questi, quanti sono marcati di prova (nostri);
--   condivisioni        righe in manifestazioni_interesse scritte da loro,
--                       e fra parentesi quelle ancora attive;
--   conversazioni       conversazioni con un ente aperte da loro;
--   iscritti_newsletter righe in newsletter_iscrizioni a loro nome.
-- Una riga con condivisioni o conversazioni diverse da zero e un ruolo che
-- non è «studente» è la falla che ha lasciato una traccia: si guarda per id
-- prima di decidere cosa farne. Righe con tutto a zero dicono solo quanti
-- account la data non ce l'hanno.
select
  p.ruolo,
  count(*)                                                         as senza_data,
  count(*) filter (where p.di_prova)                               as di_prova,
  (select count(*) from public.manifestazioni_interesse m
     join public.profiles q on q.id = m.student_id
    where q.data_nascita is null and q.ruolo = p.ruolo)
  || ' (' ||
  (select count(*) from public.manifestazioni_interesse m
     join public.profiles q on q.id = m.student_id
    where q.data_nascita is null and q.ruolo = p.ruolo and m.revocata_il is null)
  || ' attive)'                                                    as condivisioni,
  (select count(*) from public.conversazioni_enti c
     join public.profiles q on q.id = c.student_id
    where q.data_nascita is null and q.ruolo = p.ruolo)            as conversazioni,
  (select count(*) from public.newsletter_iscrizioni n
     join public.profiles q on q.id = n.student_id
    where q.data_nascita is null and q.ruolo = p.ruolo)            as iscritti_newsletter
from public.profiles p
where p.data_nascita is null
group by p.ruolo
order by p.ruolo;
