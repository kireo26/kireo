-- Le parole del lotto della newsletter (30/10), da sole e prima: un valore
-- nuovo di un enum non si usa nella transazione che lo aggiunge.
--
-- Due avvisi all'ente sulla decisione di KIREO (un evento, una newsletter), e
-- la newsletter che arriva allo studente dentro KIREO.

alter type public.notifica_tipo add value if not exists 'evento_approvato';
alter type public.notifica_tipo add value if not exists 'evento_rifiutato';
alter type public.notifica_tipo add value if not exists 'newsletter_approvata';
alter type public.notifica_tipo add value if not exists 'newsletter_rifiutata';
alter type public.notifica_tipo add value if not exists 'newsletter_ente';
