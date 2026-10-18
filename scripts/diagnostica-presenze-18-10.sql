-- LA DIRETTA DEL 18/10: i battiti si sono accumulati mentre il video non si
-- vedeva? (Mario, punto 3). SOLA LETTURA — si incolla nel SQL Editor.
--
-- Come leggerla. La finestra dell'evento è quella ATTUALE (spostata due volte a
-- mano quella sera: 17:00→17:45, poi 17:20→18:05): le ore stampate qui sono
-- quelle di Roma.
--   • `primo`/`ultimo` dicono quando questa persona ha mandato il primo e
--     l'ultimo battito; `ping_totali` quanti in tutto (uno al minuto, solo a
--     scheda visibile, solo DENTRO la diretta dal 4/10).
--   • ⚠️ La pagina smette di mandare battiti SOLO quando il player solleva un
--     errore (incorporamento spento → «La diretta non si vede qui»). Un player
--     che resta fermo senza errore — nero, in caricamento, in pausa — NON ferma
--     niente: la riga «presenza in rilevamento» resta accesa e i battiti
--     continuano. Quindi: se per quei venti minuti di player fermo ci sono
--     battiti, la risposta alla domanda del blocco 2 è SÌ — certifichiamo anche
--     chi non ha potuto vedere niente, purché il suo player non abbia
--     sollevato un errore. Se ci sono buchi negli stessi minuti, l'errore è
--     arrivato e la guardia ha funzionato.
--   • `ping_totali` non dice QUANDO sono arrivati i battiti in mezzo: solo il
--     primo e l'ultimo. Un buco si legge come `minuti_fra_primo_e_ultimo`
--     molto più grande di `ping_totali`.
select
  e.titolo,
  e.data_inizio at time zone 'Europe/Rome' as inizio,
  e.data_fine at time zone 'Europe/Rome' as fine,
  pr.nome || ' ' || pr.cognome as chi,
  pr.di_prova,
  p.primo_ping at time zone 'Europe/Rome' as primo,
  p.ultimo_ping at time zone 'Europe/Rome' as ultimo,
  p.ping_totali,
  round(extract(epoch from (p.ultimo_ping - p.primo_ping)) / 60.0, 1) as minuti_fra_primo_e_ultimo,
  round(extract(epoch from (e.data_fine - e.data_inizio)) / 60.0, 1) as minuti_della_finestra,
  ie.stato as iscrizione,
  ie.certificata_da_tipo
from public.eventi e
join public.presenze_live p on p.evento_id = e.id
left join public.profiles pr on pr.id = p.user_id
left join public.iscrizioni_eventi ie on ie.evento_id = e.id and ie.student_id = p.user_id
where e.youtube_video_id = 'ABfkEeZD7sQ'
order by e.data_inizio, p.primo_ping;
