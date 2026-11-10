-- 20261211110000 — il client non inserisce più in activity_log (10/11)
--
-- DA APPLICARE DOPO IL DEPLOY: il codice di prima inserisce direttamente
-- (registraAttivita, la route dell'assistente, la route della Panoramica), e
-- prima del deploy quelle scritture fallirebbero. Il codice nuovo passa da
-- `registra_attivita` (il browser, quattro tipi, il peso deciso dal database) e
-- da `registra_apertura_guida_kireo` (il server, le guide), tutte e due in
-- 20261211100000.
--
-- PERCHÉ (misurato l'08/11): il client inseriva in activity_log tipo e peso a
-- scelta — un `workshop_pcto` da 1000, un `download_guida` di livello 3 — e la
-- policy guardava solo `student_id = auth.uid()`. Il cancello delle guide non
-- legge più activity_log (20261211100000): questa è la seconda serratura, e
-- chiude anche le affermazioni senza causa nello storico e nel radar.
--
-- IL RIEMPIMENTO SI RIPETE: un'apertura di guida scritta dal codice di prima fra
-- 20261211100000 e il deploy sta solo in activity_log. Qui la si copia, con lo
-- stesso buco nella conoscenza dichiarato in 20261211100000.

revoke insert, update on public.activity_log from anon, authenticated;
drop policy if exists activity_log_insert_own on public.activity_log;

insert into public.guide_kireo_aperte (student_id, area_slug, livello, aperta_il, da_activity_log)
select a.student_id, a.area_slug, coalesce(a.livello, 1)::smallint, min(a.created_at), true
from public.activity_log a
where a.tipo_attivita::text = 'download_guida'
  and coalesce(a.livello, 1) between 1 and 3
group by a.student_id, a.area_slug, coalesce(a.livello, 1)
on conflict do nothing;

do $$
begin
  if has_table_privilege('authenticated', 'public.activity_log', 'INSERT')
     or has_any_column_privilege('authenticated', 'public.activity_log', 'INSERT')
     or has_any_column_privilege('anon', 'public.activity_log', 'INSERT') then
    raise exception '20261211110000: il client inserisce ancora in activity_log';
  end if;
  if exists (select 1 from pg_policies where tablename = 'activity_log' and cmd = 'INSERT') then
    raise exception '20261211110000: resta una policy di insert su activity_log';
  end if;
  if not has_function_privilege('authenticated', 'public.registra_attivita(text, text)', 'execute') then
    raise exception '20261211110000: manca 20261211100000 (registra_attivita)';
  end if;
end $$;
