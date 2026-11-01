-- 20261201110000 — VIA LE DUE PORTE DI PRIMA DEL CODICE D'INVITO (C: DOPO il deploy)
--
-- `verifica_invito_tutor` (eseguibile da chiunque, anche senza account, senza
-- tetto, e diceva il nome della scuola a ogni codice giusto) e
-- `redeem_invito_staff` (un account senza profilo la chiamava quante volte
-- voleva). Le sostituiscono `controlla_codice_invito` e `riscatta_invito_tutor`
-- (20261201100000). Il codice di prima le chiama: per questo stanno qui, dopo.
drop function if exists public.verifica_invito_tutor(text);
drop function if exists public.redeem_invito_staff(text, text, text);

do $$
begin
  if to_regprocedure('public.verifica_invito_tutor(text)') is not null
     or to_regprocedure('public.redeem_invito_staff(text, text, text)') is not null then
    raise exception 'una delle due porte di prima c''è ancora';
  end if;
end $$;
