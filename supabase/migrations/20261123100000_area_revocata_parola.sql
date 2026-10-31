-- LA PAROLA DELLA REVOCA DI UN'AREA (31/10): la notifica all'ente quando KIREO
-- gli toglie un'area. Da sola, perché un valore nuovo di un enum non si usa
-- nella transazione che lo aggiunge (la migrazione dopo, 20261123110000).
alter type public.notifica_tipo add value if not exists 'area_revocata';
