-- 20261210100000 — e_profilo_di_prova la esegue solo il server (04/11)
--
-- PERCHÉ. È la quarta porta della stessa famiglia: una funzione SECURITY
-- DEFINER che dice una cosa di un profilo qualunque, nata eseguibile da chi non
-- ha fatto l'accesso. `20260830100000` aveva scritto `revoke all … from public`
-- e `grant … to authenticated, service_role`: su Supabase una funzione nasce
-- concessa anche ad `anon` direttamente (privilegi predefiniti), quindi il solo
-- `from public` la lasciava aperta a un visitatore. Il danno è piccolo (un bit
-- nostro, su un id che non si indovina), la forma no: la prossima funzione nata
-- aperta passa nello stesso modo.
--
-- CHI LA CHIAMA, misurato prima di chiudere (04/11, replica con tutte le
-- migrazioni e grep su app/, lib/, components/, scripts/):
--   · il cron `workshop-motore`, con il client service-role;
--   · `segnala_player_live`, che è SECURITY DEFINER e la chiama come proprietario
--     (il permesso di chi chiama la definer non conta);
--   · tre diagnostiche SQL lanciate a mano dal SQL Editor, cioè come `postgres`.
-- Nessun chiamante con la sessione di un utente, collegato o no: per questo esce
-- anche `authenticated`, e resta `service_role`. Nessuna policy e nessuna vista
-- la nomina.
--
-- SE SI ROMPE: un chiamante nuovo con la sessione di un utente riceve
-- «permission denied for function e_profilo_di_prova» (42501), a voce alta.

revoke all on function public.e_profilo_di_prova(uuid) from public, anon, authenticated;
grant execute on function public.e_profilo_di_prova(uuid) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.e_profilo_di_prova(uuid)', 'execute') then
    raise exception '20261210100000: anon esegue ancora e_profilo_di_prova';
  end if;
  if has_function_privilege('authenticated', 'public.e_profilo_di_prova(uuid)', 'execute') then
    raise exception '20261210100000: authenticated esegue ancora e_profilo_di_prova';
  end if;
  if not has_function_privilege('service_role', 'public.e_profilo_di_prova(uuid)', 'execute') then
    raise exception '20261210100000: service_role non esegue più e_profilo_di_prova';
  end if;
end $$;

comment on function public.e_profilo_di_prova(uuid) is
  '20261210100000: eseguibile solo da service_role (e dalle definer che la chiamano come proprietario). Chiamanti: cron workshop-motore, segnala_player_live, diagnostiche SQL.';
