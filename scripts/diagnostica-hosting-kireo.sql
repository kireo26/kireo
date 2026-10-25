-- GLI EVENTI CHE HANNO SCELTO LA VIA «OSPITATA DA KIREO» (26/10, sola lettura).
--
-- Dal 26/10 quella via non si può più scegliere (`lib/eventi/hosting.ts`), ma
-- gli eventi creati prima restano lì, e uno vero non deve restare in uno stato
-- che nessuno sistemerà. Si guardano SOLO i webinar: il form scrive
-- `hosting_diretta = 'kireo'` anche su un evento in presenza (è il default
-- della colonna), e lì non vuol dire niente.
--
-- Come si legge: `chiave` dice se KIREO l'ha preparata; `futuro` se qualcuno
-- può ancora aprirlo. Se sono tutti di prova (`ente` è il nostro, o il titolo
-- lo dice) si chiude lì; se ce n'è uno vero e futuro, va spostato al canale
-- proprio prima che l'ente lo apra.
select e.id,
       e.titolo,
       i.nome                                   as ente,
       e.stato,
       e.data_inizio,
       e.data_inizio > now()                    as futuro,
       e.diretta_chiusa_il is not null          as chiusa,
       e.youtube_video_id is not null           as video,
       (c.evento_id is not null)                as chiave,
       c.server is not null                     as server
from public.eventi e
left join public.istituzioni i on i.id = e.organizzatore_id
left join public.chiavi_trasmissione c on c.evento_id = e.id
where e.tipo = 'webinar' and e.hosting_diretta = 'kireo'
order by e.data_inizio desc;
