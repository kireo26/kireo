-- Statistiche per istituzione: SOLO aggregati, mai un campo che identifichi
-- lo studente. A differenza di score_aree (Fase area studente), qui NON
-- uso security_invoker: la vista deve poter contare righe di
-- newsletter_iscrizioni/recinto_enti/iscrizioni_eventi che appartengono ad
-- ALTRI utenti (gli studenti), quindi gira volutamente con i privilegi del
-- proprietario (comportamento di default di una vista, senza
-- security_invoker), bypassando le RLS "solo proprie righe" di quelle
-- tabelle SOLO per calcolare il conteggio — mai per restituire le righe
-- stesse. La WHERE finale filtra invece quali istituzioni sono visibili a
-- chi interroga: la propria per un'istituzione, tutte per un admin. Nessun
-- studente può interrogare direttamente questa vista in modo utile: non ha
-- un'istituzione_id propria da filtrare.

create view public.stats_istituzione as
select
  i.id as istituzione_id,
  (select count(*) from public.recinto_enti r where r.istituzione_id = i.id) as studenti_nel_recinto,
  (select count(*) from public.newsletter_iscrizioni n where n.istituzione_id = i.id) as iscritti_newsletter,
  (select count(*) from public.guide_enti g where g.istituzione_id = i.id) as guide_pubblicate,
  (
    select count(*) from public.recinto_enti r where r.istituzione_id = i.id and r.origine = 'guida'
  ) as download_guida,
  (
    select count(*)
    from public.activity_log al
    where al.student_id in (select r.student_id from public.recinto_enti r where r.istituzione_id = i.id)
      and al.area_slug in (select ea.area_slug from public.eventi e join public.eventi_aree ea on ea.evento_id = e.id where e.organizzatore_id = i.id)
  ) as interazioni_stimate
from public.istituzioni i
where i.id = public.current_istituzione_id() or public.current_ruolo() = 'admin';

comment on view public.stats_istituzione is
  'Aggregati per istituzione (mai righe individuali di studenti). interazioni_stimate è una stima best-effort (attività in activity_log per studenti nel recinto, sulle aree tematiche degli eventi dell''ente) — non un conteggio esatto di interazioni dirette con l''ente.';

-- Dettaglio per evento (iscritti/partecipati), stessa logica di sicurezza
-- della vista sopra: niente security_invoker, filtro finale per proprietà.
create view public.stats_eventi_istituzione as
select
  e.organizzatore_id as istituzione_id,
  e.id as evento_id,
  e.titolo,
  e.data_inizio,
  count(*) filter (where ie.stato = 'iscritto') as iscritti,
  count(*) filter (where ie.stato = 'partecipato') as partecipati
from public.eventi e
left join public.iscrizioni_eventi ie on ie.evento_id = e.id
where e.organizzatore_id = public.current_istituzione_id() or public.current_ruolo() = 'admin'
group by e.organizzatore_id, e.id, e.titolo, e.data_inizio;

comment on view public.stats_eventi_istituzione is 'Iscritti/partecipati per evento, solo per l''istituzione organizzatrice (o admin). Nessun elenco di studenti.';
