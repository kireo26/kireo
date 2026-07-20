-- SEED DEMO (facoltativa): una scuola attiva con una classe pronta, per
-- vedere subito la struttura in /admin e (dopo un accesso reale) in
-- /scuola. NON è schema, nessun'altra migration ne dipende.
--
-- Limiti onesti di questo seed (stesso principio già documentato in
-- 20260713180000_seed_istituzioni_demo.sql per gli enti): non è possibile
-- fabbricare in sicurezza via solo SQL un referente demo, degli studenti
-- demo verificati, o un'iscrizione di classe a un evento — tutte queste
-- cose richiedono righe reali in auth.users (con password funzionante),
-- non creabili da una migration senza una chiave service-role. Per una
-- demo completa: registra un referente vero dal form su /per-le-scuole
-- (con l'email dell'istituto scelto sotto, MITD004015, così si aggancia a
-- questa stessa scuola_profili invece di crearne una nuova), poi registra
-- 2-3 studenti veri con quella stessa scuola, verificali e assegnali alla
-- classe 5ªB dalla dashboard /scuola — tutto reale, si popola da solo.
--
-- Scuola scelta: MITD004015, "I. T. ECONOMICO - C. CATTANEO", Milano (una
-- scuola reale del dataset MIM, non una scuola di fantasia — a differenza
-- dell'ente demo "Accademia del Gusto", qui non serve inventarne una: il
-- profilo scuola non è mai pubblico, quindi non c'è rischio di violare la
-- regola sulla trust strip).
insert into public.scuole_profili (id, scuola_id, stato, convenzione_firmata_il)
values ('d0000000-0000-4000-8000-000000000001', 'MITD004015', 'attiva', current_date - interval '30 days')
on conflict (scuola_id) do nothing;

insert into public.classi (id, scuola_profilo_id, anno, sezione, nome_visualizzato)
values ('d0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 5, 'B', '5ªB')
on conflict (scuola_profilo_id, anno, sezione) do nothing;
