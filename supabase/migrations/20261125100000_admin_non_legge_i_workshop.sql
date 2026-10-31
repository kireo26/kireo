-- 20261125100000 — L'ADMIN NON LEGGE QUELLO CHE UNO STUDENTE SCRIVE IN UN WORKSHOP (31/10).
--
-- La linea di Mario, per la scuola e per l'admin: «tutto quello che ha fatto in
-- numeri, e mai il contenuto» — mai le risposte ai test, il diario, le
-- riflessioni dei workshop. Per i test, il diario e le missioni era già vero
-- per costruzione: l'admin non ha una policy di lettura. Per i workshop no:
-- sei policy davano all'admin collegato la lettura di quello che lo studente
-- scrive (l'elaborato, le tappe con la revisione, la chat con il cliente, le
-- consegne, i messaggi fra studenti, le domande al tutor).
--
-- LA MISURA, prima di toglierle (31/10): nessuna schermata, nessuna route e
-- nessuna funzione legge queste tabelle con la sessione di un admin. Le
-- leggono lo studente (le sue righe), il cron e il banco (con la service role,
-- che la RLS non tocca), e l'export dello studente. Nessuna delle sei
-- migrazioni che le ha create scrive perché servissero. Quindi il primo dei
-- tre esiti di Mario: nessuno la usa, e la policy esce.
-- *Un permesso che nessuno sa di avere è un permesso che nessuno difende.*
--
-- ⚠️ Fuori da qui, e non è dimenticato: messaggi_enti_admin_tutto. Quella ha
-- una ragione scritta (20260727160000: una conversazione «bloccata e
-- segnalata» resta visibile all'admin per l'ispezione), ma nessuna schermata
-- la usa. È la decisione di Mario fra il secondo e il terzo esito.
--
-- Il giorno in cui servisse leggere uno di questi contenuti (moderare,
-- certificare), non si rimette la policy: si scrive l'eccezione nel prodotto,
-- e lo studente deve sapere che quella cosa, e solo quella, un admin la legge.

drop policy if exists workshop_elaborati_admin_select on public.workshop_elaborati;
drop policy if exists workshop_fasi_stato_admin_select on public.workshop_fasi_stato;
drop policy if exists workshop_chat_cliente_admin_select on public.workshop_chat_cliente;
drop policy if exists workshop_consegne_admin_select on public.workshop_consegne;
drop policy if exists workshop_messaggi_admin_select on public.workshop_messaggi;
drop policy if exists workshop_tutor_log_admin_select on public.workshop_tutor_log;

-- ============ si rilegge ============
do $$
declare
  v_restano text;
begin
  select string_agg(tablename || '.' || policyname, ', ') into v_restano
  from pg_policies
  where schemaname = 'public'
    and tablename in ('workshop_elaborati', 'workshop_fasi_stato', 'workshop_chat_cliente',
                      'workshop_consegne', 'workshop_messaggi', 'workshop_tutor_log')
    and (qual ilike '%admin%' or with_check ilike '%admin%');
  if v_restano is not null then
    raise exception '20261125100000: restano policy dell''admin sui contenuti dei workshop: %', v_restano;
  end if;
end;
$$;
