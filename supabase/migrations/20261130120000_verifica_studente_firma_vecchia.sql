-- Lo studente rifiutato riceve il motivo (01/11, passo 3). C: via la firma a
-- due argomenti, DOPO il deploy.
--
-- Il codice nuovo chiama solo `verifica_studente(uuid, esito, motivo)`. Tenere
-- la firma di prima vorrebbe dire lasciare aperta una strada che rifiuta uno
-- studente senza motivo e senza dirglielo: la cosa che il passo 3 chiude.

drop function public.verifica_studente(uuid, public.stato_verifica_studente);

do $$
begin
  if to_regprocedure('public.verifica_studente(uuid, public.stato_verifica_studente)') is not null then
    raise exception '20261130120000: la firma a due argomenti c''è ancora';
  end if;
  if to_regprocedure('public.verifica_studente(uuid, public.stato_verifica_studente, public.motivo_rifiuto_verifica)') is null then
    raise exception '20261130120000: manca la firma a tre argomenti: applica prima 20261130110000';
  end if;
end $$;
