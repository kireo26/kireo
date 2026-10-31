-- PERCHÉ UN EVENTO CON UN VIDEO NON È STATO SONDATO (31/10). Sola lettura,
-- un'istruzione sola, nel SQL Editor così com'è.
--
-- La sonda (lib/eventi/sondaRegistrazione.ts) legge gli eventi con quattro
-- filtri nel database — webinar, approvato, già cominciato, mai sondato (o non
-- controllato) — e li conta in «letti». SOLO DOPO toglie quelli finiti da meno
-- di due ore (una diretta senza fine dura 3 ore, come `fineDiretta`). Quindi un evento con un video che non è nemmeno fra i «letti» è
-- stato tenuto fuori da uno dei filtri del database, non dalle due ore.
-- Questa query dice, per ogni evento con un video, quale filtro lo tiene fuori.
select e.id, e.titolo, e.youtube_video_id, e.tipo, e.stato, e.data_inizio, e.data_fine, e.diretta_chiusa_il,
       e.registrazione_esito, e.registrazione_sondata_il,
       case
         when e.tipo <> 'webinar' then 'fuori: non è un webinar'
         when e.stato <> 'approvato' then 'fuori: non è approvato (' || e.stato || ')'
         when e.data_inizio >= now() then 'fuori: non è ancora cominciato'
         when e.registrazione_esito is not null and e.registrazione_esito <> 'non_controllato' then 'già sondato: ' || e.registrazione_esito
         when least(coalesce(e.data_fine, e.data_inizio + interval '3 hours'), coalesce(e.diretta_chiusa_il, 'infinity'::timestamptz)) > now() - interval '2 hours'
           then 'letto, non sondato: finito da meno di due ore'
         else 'da sondare al prossimo giro'
       end as perche
from public.eventi e
where e.youtube_video_id is not null
order by e.data_inizio desc;
