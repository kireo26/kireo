-- UNA «COMUNICAZIONE MIRATA» NON SI PUÒ PIÙ SCRIVERE (28/10, Mario).
--
-- 20261108100000 l'ha tolta da cinque schermate, e questo la rendeva invisibile,
-- non impossibile: la policy `comunicazioni_insert_propria` non guarda il tipo, e
-- il client ha ancora il privilegio sulla colonna `tipo` (20261106100000), quindi
-- un insert diretto poteva scrivere `tipo = 'comunicazione_kireo'` e mettere una
-- riga nella coda dell'admin, dove nessuno si aspetta più di vederla. *Togliere
-- una cosa dalle schermate la rende invisibile, non impossibile: e proprio per
-- questo nessuno la sorveglia più.*
--
-- Il valore dell'enum RESTA: un tipo con una storia non perde una parola.
-- Si rende impossibile scriverne di nuove.
--
-- Perché un CHECK e non una clausola nella policy: la policy vale per chi passa
-- dal client, il vincolo per tutti, admin e SQL Editor compresi. Le righe di quel
-- tipo in produzione sono 0 (misurato da Mario il 28/10), quindi il vincolo
-- nasce validato e senza arretrato. ⚠️ Se un giorno ce ne fosse una, questa
-- migrazione fallisce a voce alta sull'`add constraint`: è il verso giusto, una
-- riga vecchia di quel tipo va guardata prima, non scavalcata con `not valid`.
--
-- Il giorno in cui le comunicazioni mirate tornassero (con un invio vero), si
-- toglie questo vincolo in una migrazione che lo dice.

alter table public.comunicazioni
  add constraint comunicazioni_solo_newsletter check (tipo = 'newsletter');

comment on constraint comunicazioni_solo_newsletter on public.comunicazioni is
  'Dal 28/10 (20261108110000) una comunicazione è solo una newsletter: le «comunicazioni mirate» erano una funzione che non esisteva. Il valore comunicazione_kireo resta nell''enum per la storia, ma non si scrive.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'comunicazioni_solo_newsletter'
       and conrelid = 'public.comunicazioni'::regclass
       and convalidated
  ) then
    raise exception 'il vincolo comunicazioni_solo_newsletter non è atterrato validato';
  end if;
end $$;
