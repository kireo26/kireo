-- Le ore riconoscibili si arrotondano PER DIFETTO (Mario, 26/10).
--
-- `20261026100000` (applicata il 25/10) scriveva il tetto della chiusura
-- automatica con `round(least(ore_pcto, durata/60), 2)`. Una diretta di un'ora
-- chiusa dopo 25 minuti riconosceva così 0,42 ore, mentre 25 minuti sono
-- 0,4166: un arrotondamento per eccesso, cioè un pezzo di incontro (diciotto
-- secondi) attribuito a uno studente senza che ci sia stato, su un documento
-- che una scuola conserva. Non conta la dimensione, conta la direzione: è la
-- stessa regola per cui il tetto esiste.
--
-- QUELLO CHE CAMBIA: solo `round` → `floor(... * 100) / 100` nel ramo del
-- tetto. I due rami prima (durata ignota → ore dichiarate; sotto il minimo → 0)
-- sono parola per parola quelli di `20261026100000`.
--
-- QUELLO CHE NON CAMBIA: le ore già emesse in `iscrizioni_eventi.ore_riconosciute`.
-- Si emettono una volta e sono un fatto; questa migrazione non le tocca, e non
-- c'è nessun aggiornamento di dati qui dentro.
--
-- PERCHÉ DA SOLA (Mario): una correzione messa nel lotto di una novità prende i
-- tempi della novità, e una verifica che prova due cose insieme non dice quale
-- delle due ha funzionato.
--
-- COME SI VERIFICA APPLICATA: l'oggetto che solo questa migrazione lascia è il
-- commento sulla funzione (`obj_description`, in fondo), e l'impronta canonica
-- del corpo (`scripts/impronta-funzione.sql`) cambia. La tabella dei casi è in
-- `scripts/verifica-ore-per-difetto.sql`.

create or replace function public.ore_riconoscibili_evento(p_evento_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.durata_vera_minuti(e.id) is null then coalesce(e.ore_pcto, 0)
    when public.durata_vera_minuti(e.id) < public.minuti_minimi_certificazione() then 0
    else floor(least(coalesce(e.ore_pcto, 0), public.durata_vera_minuti(e.id) / 60.0) * 100) / 100
  end
  from public.eventi e
  where e.id = p_evento_id;
$$;
revoke all on function public.ore_riconoscibili_evento(uuid) from public, anon;
grant execute on function public.ore_riconoscibili_evento(uuid) to authenticated;

comment on function public.ore_riconoscibili_evento(uuid) is
  'Tetto delle ore della chiusura automatica: min(ore dichiarate, durata vera), arrotondato PER DIFETTO a due decimali (20261028100000); 0 sotto minuti_minimi_certificazione(); le ore dichiarate se la durata è ignota.';
