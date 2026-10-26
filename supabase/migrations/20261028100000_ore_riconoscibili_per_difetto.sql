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

-- ⚠️⚠️ IL RAMO «DURATA IGNOTA → ORE DICHIARATE» NON È MORTO, E NON HA TETTO
-- (nota aggiunta il 26/10, dopo l'applicazione: è un commento fuori dal corpo
-- della funzione, quindi non tocca `prosrc` né quello che il database esegue —
-- il cricchetto lo ignora per costruzione; dentro il `$$` avrebbe cambiato
-- l'impronta grezza in produzione).
-- Da `20261029100000` la fine è obbligatoria per ogni evento NUOVO, quindi un
-- evento creato da quel giorno non arriva mai qui: `durata_vera_minuti` è
-- null solo per un evento senza `data_fine` e mai chiuso. Il ramo resta in
-- piedi per gli eventi VECCHI, creati prima del 26/10 senza fine, con le ore
-- scritte a mano dall'ente — e per quelli è senza tetto, perché non c'è una
-- durata con cui limitarle. Fra sei mesi sembrerà un ramo morto.
-- ⚠️ MISURATO, NON DEDOTTO (replica, 26/10): togliendolo oggi il numero
-- RESTEREBBE LO STESSO, ma per due accidenti e non per una scelta — `null < 20`
-- non è vero, quindi si cadrebbe nel ramo del tetto, e `least()` in Postgres
-- IGNORA i null (`least(3.00, null)` = 3.00; lo standard SQL darebbe null).
-- Il ramo è quindi l'unico posto in cui la decisione «senza durata valgono le
-- ore dichiarate» è SCRITTA: senza, sarebbe una protezione che nessuno ha
-- scelto, e cadrebbe al primo che riscrive il tetto con un'espressione che
-- tratta il null in un altro modo. Si toglie solo il giorno in cui una query
-- in produzione dice che eventi senza fine non ce ne sono più, o che nessuno
-- di loro può ancora essere certificato.
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
