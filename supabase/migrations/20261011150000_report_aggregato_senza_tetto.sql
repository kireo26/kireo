-- IL TETTO SULLA COPERTURA ESCE ANCHE DALLA MEDIA DEL REPORT DELL'ENTE.
--
-- Decisione di Mario, 11/10/2026, alla domanda «è un posto che mostra o un
-- posto che misura?»: una media è SEMPRE un posto che misura.
--
--   «Il tetto si mette dove un numero finisce, non dove continua. Una media è un
--    posto in cui il numero continua: una volta che un 150% è entrato in una
--    media come 100, nessun lettore può più sapere che c'era, e il difetto esce
--    dall'altra parte travestito da normalità.»
--
-- E la ragione per cui questo caso l'abbiamo trovato: il tetto non protegge
-- l'utente dalla confusione, protegge NOI dal vedere il guasto — il 120% di
-- `[TEST] certificazione` era l'unica cosa che diceva che il conteggio non
-- tornava (vedi `20261011140000`, che lo ha tolto dalle due funzioni di export).
--
-- Quando la media supera il 100 il report lo SPIEGA invece di nasconderlo: la
-- frase è di Mario e sta in `components/ente/ReportEventoButton.tsx`, dove il
-- numero arriva a una persona.
--
-- `create or replace`, firma e tipo di ritorno invariati, UNA espressione
-- cambiata. Corpo ripreso VERBATIM da `20260726120000`, che è la definizione
-- viva (nessuna migrazione successiva l'ha sostituita) e che — applicata in
-- produzione dal 26/07 — non si riscrive in place.

create or replace function public.report_evento_aggregato(p_evento_id uuid)
returns table (totale_iscritti integer, totale_presenti integer, copertura_media numeric, numero_domande integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizzatore_id uuid;
  v_ping_attesi numeric;
begin
  select organizzatore_id into v_organizzatore_id from public.eventi where id = p_evento_id;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);

  return query
    select
      (select count(*)::integer from public.iscrizioni_eventi where evento_id = p_evento_id),
      (select count(*)::integer from public.presenze_live where evento_id = p_evento_id),
      (
        -- ⚠️ NESSUN TETTO: una media è un posto dove il numero CONTINUA, non
        -- dove finisce (vedi la testa del file).
        select round(avg(pl.ping_totali::numeric / v_ping_attesi) * 100, 1)
        from public.presenze_live pl
        where pl.evento_id = p_evento_id and v_ping_attesi is not null
      ),
      (select count(*)::integer from public.domande_live where evento_id = p_evento_id);
end;
$$;

grant execute on function public.report_evento_aggregato(uuid) to authenticated;
