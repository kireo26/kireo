-- Statistiche di scuola: SOLO aggregati, mai un campo che identifichi lo
-- studente né alcun dato di profilazione individuale (nessuno score,
-- nessun radar, nessun dettaglio attività — vedi CLAUDE.md, "la scuola
-- vede i propri studenti ma mai la profilazione"). Stesso principio già
-- usato da stats_istituzione: niente security_invoker (deve contare righe
-- di studenti che appartengono ad altri utenti, con RLS "solo proprie
-- righe"), filtro finale nella WHERE su chi può vedere quale scuola.
create view public.stats_scuola as
select
  sp.id as scuola_profilo_id,
  (
    select count(*) from public.student_profiles s
    where s.school_code = sp.scuola_id and s.stato_verifica = 'verificato'
  ) as studenti_verificati,
  (
    select count(*)
    from public.iscrizioni_eventi ie
    join public.student_profiles s on s.user_id = ie.student_id
    where s.school_code = sp.scuola_id and s.stato_verifica = 'verificato' and ie.stato = 'partecipato'
  ) as partecipazioni_totali,
  (
    select coalesce(sum(e.ore_pcto), 0)
    from public.iscrizioni_eventi ie
    join public.eventi e on e.id = ie.evento_id
    join public.student_profiles s on s.user_id = ie.student_id
    where s.school_code = sp.scuola_id and s.stato_verifica = 'verificato' and ie.stato = 'partecipato'
  ) as ore_pcto_totali
from public.scuole_profili sp
where sp.id = public.current_scuola_profilo_id() or public.current_ruolo() = 'admin';

comment on view public.stats_scuola is
  'Aggregati per scuola (mai righe individuali di studenti, mai dati di profilazione). Distribuzione per area in stats_scuola_aree.';

create view public.stats_scuola_aree as
select
  sp.id as scuola_profilo_id,
  ea.area_slug,
  count(*) as partecipazioni
from public.scuole_profili sp
join public.student_profiles s on s.school_code = sp.scuola_id and s.stato_verifica = 'verificato'
join public.iscrizioni_eventi ie on ie.student_id = s.user_id and ie.stato = 'partecipato'
join public.eventi_aree ea on ea.evento_id = ie.evento_id
where sp.id = public.current_scuola_profilo_id() or public.current_ruolo() = 'admin'
group by sp.id, ea.area_slug;

comment on view public.stats_scuola_aree is
  'Distribuzione delle partecipazioni certificate per area tematica, aggregata per scuola. Nessun riferimento allo studente.';
