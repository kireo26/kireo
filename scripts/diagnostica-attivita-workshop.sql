-- LE RIGHE «WORKSHOP» DI activity_log E COSA LASCIANO I PROFILI DI PROVA
-- (08/11, sola lettura, un'istruzione: il SQL Editor mostra solo l'ultima).
--
-- La domanda di Mario: nel file di test7 ci sono 52 righe `workshop_pcto`
-- (peso 25, 16 aree) e nessuna iscrizione a un workshop. Chi le ha scritte,
-- e cosa altro resta sotto i profili di prova.
--
-- Cosa dice il codice, prima della misura [letto]:
--   · fino al 29/09 `workshop_pcto` lo scrivevano TRE strade (la chiusura di un
--     progetto workshop, la presenza certificata su un evento di tipo workshop,
--     il vecchio caricamento v1): vedi 20260929100000;
--   · la prima strada scrive solo con un'iscrizione (`from workshop_iscrizioni`),
--     una riga per area e per giorno UTC (l'indice del tetto giornaliero);
--   · `npm run banco azzera-percorsi` cancella le iscrizioni dei profili di prova
--     e, di proposito, NON tocca activity_log.
-- Questa query misura, e non decide fra le strade: lo fanno le colonne.
--
-- SEZIONE «righe»: una riga per (studente, tipo, giorno UTC), con il numero
-- delle righe e delle aree, l'ora della prima e dell'ultima, se lo studente è
-- di prova, se ha oggi un'iscrizione a un workshop, e se quel giorno ha una
-- presenza certificata su un evento di tipo workshop (la seconda strada).
--
-- SEZIONE «resta»: per ogni profilo di prova, ogni tabella che punta a lui in
-- cascata con almeno una riga. L'elenco delle tabelle si legge da pg_constraint,
-- quindi una tabella nata dopo questa query entra da sola. Solo il primo livello:
-- le tabelle che dipendono da un'iscrizione o da un tentativo spariscono con loro.
with righe as (
  select a.student_id, a.tipo_attivita::text as tipo,
         (a.created_at at time zone 'utc')::date as giorno,
         count(*) as n, count(distinct a.area_slug) as aree,
         min(a.created_at) as prima, max(a.created_at) as ultima
  from public.activity_log a
  where a.tipo_attivita::text in ('workshop_pcto', 'workshop_progetto')
  group by 1, 2, 3
),
cascate as (
  select c.conrelid::regclass as tabella, att.attname as colonna
  from pg_constraint c
  join pg_attribute att on att.attrelid = c.conrelid and att.attnum = c.conkey[1]
  where c.contype = 'f' and c.confdeltype = 'c'
    and c.confrelid = 'public.profiles'::regclass
    and array_length(c.conkey, 1) = 1
),
prova as (
  select id, nome, cognome from public.profiles where di_prova
),
resta as (
  select p.id as student_id, p.nome, p.cognome, k.tabella::text as tabella,
         (xpath('/row/n/text()', query_to_xml(
            format('select count(*) as n from %s where %I = %L', k.tabella, k.colonna, p.id),
            false, true, '')))[1]::text::bigint as n
  from prova p cross join cascate k
)
select 'righe' as sezione,
       r.student_id::text as studente,
       pr.nome || ' ' || coalesce(pr.cognome, '') as nome,
       pr.di_prova::text as di_prova,
       r.tipo || ' del ' || r.giorno as cosa,
       r.n as righe,
       'aree ' || r.aree
         || ' · dalle ' || to_char(r.prima at time zone 'utc', 'HH24:MI')
         || ' alle ' || to_char(r.ultima at time zone 'utc', 'HH24:MI') || ' UTC'
         || ' · iscrizioni a workshop oggi: '
         || (select count(*) from public.workshop_iscrizioni wi where wi.student_id = r.student_id)
         || ' · presenze certificate su eventi workshop quel giorno: '
         || (select count(*) from public.iscrizioni_eventi ie
             join public.eventi e on e.id = ie.evento_id
             where ie.student_id = r.student_id and e.tipo::text = 'workshop'
               and ie.stato::text = 'partecipato'
               and (coalesce(ie.certificata_il, ie.created_at) at time zone 'utc')::date = r.giorno) as dettaglio
from righe r
join public.profiles pr on pr.id = r.student_id
union all
select 'resta', s.student_id::text, s.nome || ' ' || coalesce(s.cognome, ''), 'true',
       s.tabella, s.n, null
from resta s
where s.n > 0
order by 1, 2, 5;
