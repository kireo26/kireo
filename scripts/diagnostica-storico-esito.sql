-- DIAGNOSTICA, SOLA LETTURA (26/10): perché lo storico di test7 non dice
-- «L'incontro è finito ma non è ancora stato chiuso…» per «test 25 ottobre
-- registrazione». Il codice (`getStoricoAttivita` → `testoEsitoStorico`), eseguito
-- con i dati attesi, la frase la produce (`npm run test:durata`, §4quater-bis):
-- quindi a decidere è un valore in produzione, e questa query li stampa tutti.
--
-- Si lancia nel SQL Editor così com'è. Niente viene scritto: l'ultimo blocco
-- cambia ruolo dentro una transazione che finisce con ROLLBACK.
--
-- COME SI LEGGE la colonna `ramo_atteso` (la stessa sequenza di testoEsitoStorico):
--   non_diretta   → tipo ≠ 'webinar': lo storico tace (è un incontro, non una diretta)
--   non_finita    → la fine effettiva è nel futuro: lo storico tace
--   finita_aperta → deve comparire la frase su chi deve chiudere
--   chiusa        → decide la durata e i minuti (altra frase, o nessuna)
-- Se il ramo è `finita_aperta` e la pagina tace ancora, il dato è giusto e il
-- difetto è altrove (la lettura come test7, qui sotto, o il deploy).

-- 1) Ogni evento «test 25 ottobre…» a cui test7 è iscritto: ce ne può essere più d'uno.
select
  e.id,
  e.titolo,
  e.tipo,
  e.pubblico,
  e.stato as stato_evento,
  e.data_inizio,
  e.data_fine,
  e.diretta_chiusa_il,
  e.diretta_durata_minuti,
  i.stato as stato_iscrizione,
  i.ore_riconosciute,
  pl.ping_totali,
  case
    when e.tipo::text <> 'webinar' then 'non_diretta'
    when least(coalesce(e.data_fine, e.data_inizio + interval '3 hours'), coalesce(e.diretta_chiusa_il, 'infinity'::timestamptz)) > now() then 'non_finita'
    when e.diretta_chiusa_il is null then 'finita_aperta'
    else 'chiusa'
  end as ramo_atteso
from public.iscrizioni_eventi i
join public.eventi e on e.id = i.evento_id
join auth.users u on u.id = i.student_id
left join public.presenze_live pl on pl.evento_id = e.id and pl.user_id = i.student_id
where u.email ilike '%test7%'
  and e.titolo ilike 'test 25 ottobre%'
order by e.data_inizio;

-- ⚠️ La durata di ripiego (`interval '3 hours'`) qui sopra è un'approssimazione di
-- DURATA_DEFAULT_MS in lib/live.ts, e conta solo se data_fine è nulla: in quel
-- caso il ramo va riletto a mano.

-- 2) La stessa lettura che fa la pagina, COME test7 (RLS attiva): se l'evento
-- qui non torna, o torna con colonne nulle, lo storico riceve meno di quello
-- che c'è nella tabella.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email ilike '%test7%' limit 1), 'role', 'authenticated')::text,
  true
);
-- Tutte e due le forme: Supabase legge l'una o l'altra a seconda della
-- versione, la replica locale solo `request.jwt.claim.sub`.
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email ilike '%test7%' limit 1), true);
set local role authenticated;
select i.stato, i.ore_riconosciute, e.titolo, e.tipo, e.data_fine, e.diretta_chiusa_il, e.diretta_durata_minuti
from public.iscrizioni_eventi i
left join public.eventi e on e.id = i.evento_id
where i.student_id = auth.uid();
rollback;
