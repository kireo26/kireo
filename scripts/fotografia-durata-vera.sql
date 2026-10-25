-- LA FOTOGRAFIA DI `20261026100000_durata_vera_ore_riconosciute.sql`
-- (Mario, 26/10). Quella migrazione è la prima del capitolo che TRASFORMA DATI
-- invece di sostituire funzioni, e una riga cambiata non ha impronta: ha un
-- valore prima e uno dopo. Quindi si fotografa quello che sta per cambiare.
--
-- COME SI USA: si lancia nel SQL Editor PRIMA della migrazione, si salva il
-- risultato, si applica la migrazione, si rilancia. È di sola lettura, e gira
-- uguale prima e dopo: le due colonne nuove si leggono con `to_jsonb(riga) ->>`,
-- che restituisce null quando la colonna non esiste ancora invece di fallire.
--
-- COSA DEVE TORNARE:
--   A, B, C, D            identici prima e dopo (sono fatti, non cambiano);
--   E                     null prima, uguale a D dopo — ⚠️ È IL NUMERO CHE
--                         CONTA: distingue «ho copiato il valore» da «l'ho
--                         ricalcolato e per caso somigliava»;
--   F                     0 dopo (righe singole che divergono: più forte di una
--                         somma, che può tornare per compensazione);
--   G                     uguale a A dopo; H e I uguali a 0 dopo;
--   J, K                  identici fra loro dopo (le ore delle statistiche
--                         scuola, prima lette dall'evento, dopo da quelle emesse).
-- B è la riga da leggere per la decisione: le dirette già chiuse sotto i 20
-- minuti, che da domani non certificano più ore a una certificazione nuova (le
-- certificazioni già emesse restano come sono).

with chiuse as (
  select
    e.id,
    floor(extract(epoch from (least(e.diretta_chiusa_il, e.data_fine) - e.data_inizio)) / 60)::integer as durata_calcolata,
    (to_jsonb(e) ->> 'diretta_durata_minuti')::integer as durata_scritta
  from public.eventi e
  where e.diretta_chiusa_il is not null
),
part as (
  select
    ie.student_id,
    coalesce(e.ore_pcto, 0) as ore_oggi,
    (to_jsonb(ie) ->> 'ore_riconosciute')::numeric as ore_emesse
  from public.iscrizioni_eventi ie
  join public.eventi e on e.id = ie.evento_id
  where ie.stato = 'partecipato'
),
scuola as (
  select p.*
  from part p
  join public.student_profiles s on s.user_id = p.student_id and s.stato_verifica = 'verificato'
  join public.scuole_profili sp on sp.scuola_id = s.school_code
)
select 'A · dirette chiuse' as voce, count(*)::text as valore from chiuse
union all select 'B · …di cui sotto i 20 minuti', count(*) filter (where durata_calcolata < 20)::text from chiuse
union all select 'C · partecipazioni certificate', count(*)::text from part
union all select 'D · somma ore come le legge oggi il contatore (eventi.ore_pcto)', sum(ore_oggi)::text from part
union all select 'E · somma ore_riconosciute (null prima della migrazione)', sum(ore_emesse)::text from part
union all select 'F · partecipazioni con ore_riconosciute ≠ ore di oggi', count(*) filter (where ore_emesse is distinct from ore_oggi)::text from part
union all select 'G · dirette chiuse con la durata scritta', count(durata_scritta)::text from chiuse
union all select 'H · dirette chiuse con durata scritta ≠ calcolata', count(*) filter (where durata_scritta is distinct from durata_calcolata)::text from chiuse
union all select 'I · partecipazioni con le ore ancora nulle', count(*) filter (where ore_emesse is null)::text from part
union all select 'J · ore statistiche scuola, lette dall''evento', sum(ore_oggi)::text from scuola
union all select 'K · ore statistiche scuola, emesse', sum(ore_emesse)::text from scuola;
