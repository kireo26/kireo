-- SOLA LETTURA (28/10). Le misure che vengono prima del lotto dell'ente: cosa c'è
-- in produzione che il lotto toccherebbe. Non cambia niente.
--
-- 1 · Le «comunicazioni mirate» (tipo comunicazione_kireo), per stato. Se ce ne
--     sono, si decide cosa farne PRIMA di togliere la voce dal form.
-- 2 · Le iscrizioni alle newsletter degli enti, e quante di studenti di prova.
-- 3 · La casella «Voglio ricevere aggiornamenti sulle attività di orientamento»
--     della registrazione: finisce in auth.users.raw_user_meta_data->>'newsletter'
--     e nessun codice la legge. Quanti l'hanno spuntata, e quanti no.

select 'comunicazioni' as misura, c.tipo::text as tipo, c.stato::text as stato, count(*) as righe,
       min(c.created_at) as prima, max(c.created_at) as ultima
from public.comunicazioni c
group by c.tipo, c.stato
order by 2, 3;

select 'newsletter_iscrizioni' as misura,
       count(*) as righe,
       count(*) filter (where p.di_prova) as di_prova,
       count(distinct n.istituzione_id) as enti
from public.newsletter_iscrizioni n
left join public.profiles p on p.id = n.student_id;

select 'consenso alla registrazione' as misura,
       coalesce(u.raw_user_meta_data->>'newsletter', '(assente)') as valore,
       count(*) as account,
       count(*) filter (where p.di_prova) as di_prova
from auth.users u
left join public.profiles p on p.id = u.id
where coalesce(p.ruolo::text, u.raw_user_meta_data->>'ruolo') = 'studente'
group by 2
order by 2;
