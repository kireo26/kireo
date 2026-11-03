-- Esce `delete_own_account()` senza argomenti (20261203100000 l'aveva lasciata
-- per il codice in produzione fino al deploy). Da qui in poi una cancellazione
-- dice sempre cosa la persona ha letto prima del clic.
--
-- DA APPLICARE DOPO IL DEPLOY: il codice di prima la chiama.

drop function if exists public.delete_own_account();

do $$
begin
  if to_regprocedure('public.delete_own_account()') is not null then
    raise exception 'delete_own_account() c''è ancora';
  end if;
  if to_regprocedure('public.delete_own_account(boolean)') is null then
    raise exception 'manca delete_own_account(boolean)';
  end if;
end $$;
