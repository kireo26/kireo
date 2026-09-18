-- KIREO Workshop 2.0 v2 — una resa lascia scritto COSA si è arreso.
--
-- IL GUASTO, dalla passata del 18/09: `scuola-musica-napoli > spazio` è arrivato
-- in fondo, il progetto si è chiuso, e `workshop_elaborati.feedback_ai` è vuoto —
-- lo studente apre la pagina finale e non c'è niente. La riga della tappa, però,
-- dice `revisione_esito = 'riuscita'`: la query dei guasti
-- (`revisione_esito is not null and revisione_esito <> 'riuscita'`) non la vede,
-- e formalmente non è successo niente.
--
-- LA CAUSA, ed è di forma, non di fortuna: il cron genera DUE cose sull'ultima
-- tappa — la revisione e il feedback finale — e la resa le guarda tutte e due
-- (`esitoPeggiore`), ma la marcatura ne scriveva UNA sola. Quando a fallire è il
-- finale, l'unica cosa che finisce sulla riga è l'esito della revisione, che è
-- andata benissimo. Non è un caso raro: è quello che succede OGNI VOLTA che si
-- arrende il finale invece della revisione.
--
-- Perché una colonna NUOVA e non un valore in più su `revisione_esito`: una
-- colonna che si chiama `revisione_esito` e contiene un fatto sul feedback
-- finale è la stessa malattia di casa — un nome che dichiara una cosa e ne
-- tiene un'altra. E i due guasti si riparano in modi diversi: una revisione
-- mancante è una tappa da rigiocare, un finale mancante è la pagina di chiusura
-- dell'intero progetto.
--
-- NULL qui non è «riuscito» e non è «fallito»: è NON DOVUTO. Il feedback finale
-- si genera solo sull'ultima tappa, quindi su tutte le altre non c'era niente
-- che potesse fallire — e scrivere 'riuscita' lì sarebbe la stessa bugia in
-- piccolo. Stesso principio già applicato a `revisione_esito` (NULL = mai
-- tentata) e ai punteggi nullable di area_signal.

alter table public.workshop_fasi_stato
  add column finale_esito text
    check (finale_esito in ('riuscita', 'non_riuscita', 'forma_non_valida'));

comment on column public.workshop_fasi_stato.finale_esito is
  'Esito della generazione del FEEDBACK FINALE del progetto (non della revisione di tappa): riuscita | non_riuscita | forma_non_valida. NULL = non dovuto, cioè la tappa non era l''ultima. Scritto dal cron (service-role) nella stessa UPDATE che marca revisione_esito.';

-- La query dei guasti, da qui in poi, è questa — ed è quella che l'alert
-- giornaliero riporta per esteso nell'email (app/api/cron/workshop-motore):
--
--   select iscrizione_id, fase_id, tentativi_revisione, revisione_esito, finale_esito
--   from public.workshop_fasi_stato
--   where (revisione_esito is not null and revisione_esito <> 'riuscita')
--      or (finale_esito   is not null and finale_esito   <> 'riuscita');
--
-- Le righe ANTECEDENTI a questa migrazione restano con finale_esito NULL anche
-- dove il finale era dovuto ed era fallito: non c'è modo di ricostruirlo a
-- posteriori (l'unica traccia viveva nei log di Vercel, che li ha già scartati).
-- Quelle si trovano dall'altro capo, guardando i progetti chiusi senza feedback:
--
--   select e.iscrizione_id
--   from public.workshop_elaborati e
--   where e.stato = 'consegnato' and e.feedback_ai is null;
