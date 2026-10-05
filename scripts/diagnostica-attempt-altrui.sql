-- DIAGNOSTICA — esistono già righe di diario o portfolio appese al tentativo di
-- un ALTRO studente? Sola lettura, si incolla nel SQL Editor di Supabase.
--
-- PERCHÉ. In `journal_entry` e `portfolio_item` l'`attempt_id` non è vincolato:
-- le policy di insert verificano `student_id = auth.uid()` — DI CHI è la riga —
-- e non a quale tentativo punta (falla del 5/10, in quarantena). Oggi non ha
-- conseguenze perché quelle tabelle non le legge nessuno; ne avrà il giorno in
-- cui si costruisce il portfolio leggendo per `attempt_id`.
--
-- La cura è una riga nel `with check` e arriva col passaggio unico. Questa
-- query risponde a una domanda diversa, che il codice non può rispondere:
-- quante di quelle righe ESISTONO GIÀ.
--
-- ⚠️ NON LEGGE NESSUN TESTO. `journal_entry.testo` è la riflessione di uno
-- studente e `portfolio_item.contenuto` la sua proposta: qui si contano le
-- righe e si stampano id e date, mai il contenuto — il risultato di questa
-- query viene incollato in chat.
--
-- ⚠️ I PROFILI DI PROVA SI MARCANO, NON SI ESCLUDONO (principio di casa): una
-- riga piantata dal banco è comunque una riga, ma non è la prova che l'abbia
-- fatto uno studente vero. La colonna `di_prova` serve a distinguerle.
--
-- NOTA SU UN FALSO NEGATIVO POSSIBILE: `attempt_id` ha `on delete set null`, e
-- `mission_attempt` cascata da `profiles`. Una riga appesa al tentativo di uno
-- studente poi cancellato ha `attempt_id` a null, quindi non compare qui. È il
-- verso giusto in cui sbagliare: quella riga non punta più a nessuno.

-- ═══ 1) il conteggio, che è la risposta alla domanda ═══
select 'journal_entry' as tabella,
       count(*) as righe_appese_a_un_altro,
       count(*) filter (where coalesce(p.di_prova, false)) as di_cui_profili_di_prova
  from public.journal_entry j
  join public.mission_attempt a on a.id = j.attempt_id
  left join public.profiles p on p.id = j.student_id
 where j.attempt_id is not null
   and a.student_id is distinct from j.student_id
union all
select 'portfolio_item',
       count(*),
       count(*) filter (where coalesce(p.di_prova, false))
  from public.portfolio_item i
  join public.mission_attempt a on a.id = i.attempt_id
  left join public.profiles p on p.id = i.student_id
 where i.attempt_id is not null
   and a.student_id is distinct from i.student_id;

-- ═══ 2) il dettaglio, se il conteggio non è zero ═══
-- Chi ha scritto, su quale tentativo, di chi è quel tentativo, quando. Nessun
-- testo.
select 'journal_entry' as tabella,
       j.id as riga,
       j.student_id as scritta_da,
       coalesce(p.di_prova, false) as scrittore_di_prova,
       j.attempt_id,
       a.student_id as il_tentativo_e_di,
       a.mission_slug,
       j.created_at
  from public.journal_entry j
  join public.mission_attempt a on a.id = j.attempt_id
  left join public.profiles p on p.id = j.student_id
 where j.attempt_id is not null
   and a.student_id is distinct from j.student_id
union all
select 'portfolio_item',
       i.id,
       i.student_id,
       coalesce(p.di_prova, false),
       i.attempt_id,
       a.student_id,
       a.mission_slug,
       i.created_at
  from public.portfolio_item i
  join public.mission_attempt a on a.id = i.attempt_id
  left join public.profiles p on p.id = i.student_id
 where i.attempt_id is not null
   and a.student_id is distinct from i.student_id
 order by created_at;

-- ═══ 3) LA LINEA DI BASE, che è quello che rende leggibile uno zero ═══
-- «Zero righe appese» e «zero righe in tutto» sono due risposte diverse, e la
-- prima si legge come buona notizia solo se la seconda non è zero.
select 'journal_entry' as tabella, count(*) as righe_totali,
       count(*) filter (where attempt_id is not null) as con_un_attempt
  from public.journal_entry
union all
select 'portfolio_item', count(*),
       count(*) filter (where attempt_id is not null)
  from public.portfolio_item;
