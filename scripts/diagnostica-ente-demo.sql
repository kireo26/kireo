-- DIAGNOSTICA, sola lettura: Accademia del Gusto, l'ente del seed demo del
-- 12/07 (20260712160000), attivo in produzione senza tipo e senza piano.
-- Un'istruzione sola, perché il SQL Editor mostra solo il risultato
-- dell'ultima. Risponde a due domande prima di decidere cosa farne:
--   1. dove lo vede uno studente (slug = pagina pubblica; aree, eventi, post);
--   2. chi l'ha toccato (gesti di studenti: quelli restano veri anche se
--      l'ente è finto, e prima si guardano, poi si decide).
-- ⚠️ In Esplora e in «Enti di quest'area» oggi NON compare, e per caso:
-- cercaEnti filtra .neq("tipo", "formazione_docenti"), e un tipo vuoto non
-- passa un confronto. Dare un tipo all'ente lo fa comparire lì.
with e as (select id from public.istituzioni where id = 'a0000000-0000-4000-8000-000000000001')
select
  (select nome from public.istituzioni where id = (select id from e))                       as nome,
  (select stato from public.istituzioni where id = (select id from e))                      as stato,
  (select slug from public.istituzioni where id = (select id from e))                       as slug_pagina_pubblica,
  (select string_agg(u.email || case when p.di_prova then ' (di prova)' else '' end, ', ')
     from public.institution_profiles ip
     join public.profiles p on p.id = ip.user_id
     join auth.users u on u.id = ip.user_id
    where ip.istituzione_id = (select id from e))                                           as account,
  (select count(*) from public.istituzioni_aree where istituzione_id = (select id from e) and stato = 'approvata') as aree_approvate,
  (select count(*) from public.eventi where organizzatore_id = (select id from e))          as eventi_tutti,
  (select count(*) from public.eventi where organizzatore_id = (select id from e) and stato = 'approvato') as eventi_approvati,
  (select count(*) from public.post_enti where istituzione_id = (select id from e))         as post,
  (select count(*) from public.guide_enti where istituzione_id = (select id from e))        as guide,
  (select count(*) from public.newsletter_enti where istituzione_id = (select id from e))   as newsletter,
  (select count(*) from public.seguiti s join public.profiles p on p.id = s.student_id
    where s.istituzione_id = (select id from e) and not p.di_prova)                         as seguono_non_di_prova,
  (select count(*) from public.seguiti where istituzione_id = (select id from e))           as seguono_tutti,
  (select count(*) from public.iscrizioni_eventi ie join public.eventi ev on ev.id = ie.evento_id
    where ev.organizzatore_id = (select id from e))                                         as iscrizioni_eventi,
  (select count(*) from public.manifestazioni_interesse where istituzione_id = (select id from e)) as profili_condivisi,
  (select count(*) from public.newsletter_iscrizioni where istituzione_id = (select id from e))    as iscritti_newsletter,
  (select count(*) from public.recinto_enti where istituzione_id = (select id from e))      as recinto,
  (select count(*) from public.conversazioni_enti where istituzione_id = (select id from e)) as conversazioni,
  (select count(*) from public.post_salvati where istituzione_id = (select id from e))      as post_salvati,
  (select count(*) from public.registrazioni_salvate where istituzione_id = (select id from e)) as registrazioni_salvate;
