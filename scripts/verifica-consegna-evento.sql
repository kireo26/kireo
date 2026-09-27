-- La consegna di una diretta: le proprietà a database.
--
-- Si incolla nel SQL Editor di Supabase (o si esegue con psql contro una
-- replica): crea i propri dati finti, prova, e fa ROLLBACK — non lascia niente.
-- Da eseguire DOPO 20260927110000_evento_fonte_enum.sql e
-- 20260927120000_consegna_evento.sql.
--
-- LA PROPRIETÀ CHE CONTA, e per cui questo file esiste: una consegna produce una
-- prova d'AREA, o non produce niente e lo dice. Le altre due che vale la pena
-- guardare: la guardia sull'array vuoto sta PRIMA del delete (sulle gemelle, il
-- 19/09, una seconda finalizzazione a vuoto svuotava il profilo invece di
-- lasciarlo com'era), e l'aritmetica su cui poggia la scelta del peso — quattro
-- consegne sulla stessa area per arrivare a confidence 0,40 — è un fatto, non
-- un'affermazione nei commenti.

begin;

-- ════════════════════════ dati finti ════════════════════════
create temporary table esiti (n int generated always as identity, proprieta text, atteso text, trovato text) on commit drop;
-- La tabella degli esiti la scrivono anche i blocchi che girano come
-- authenticated/anon: senza questo grant il primo `set local role` farebbe
-- abortire la transazione su un permesso, non su una proprietà.
grant all on esiti to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'studente@prova.invalid'),
  ('22222222-2222-2222-2222-222222222222', 'altro@prova.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'ente@prova.invalid');

insert into public.profiles (id, ruolo, nome, cognome, data_nascita, di_prova) values
  ('11111111-1111-1111-1111-111111111111', 'studente', 'Prova', 'Uno', '2008-01-01', true),
  ('22222222-2222-2222-2222-222222222222', 'studente', 'Prova', 'Due', '2008-01-01', true),
  ('33333333-3333-3333-3333-333333333333', 'istituzione', 'Prova', 'Ente', null, true);

insert into public.istituzioni (id, nome, slug, stato) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ente di prova', 'ente-di-prova', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000001');

-- L'evento con la consegna APERTA: finito un'ora fa, quindi dentro le 48 ore.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato, domanda_consegna) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Il presidio che non c''è', 'webinar', now() - interval '3 hours', now() - interval '1 hour', 'approvato',
   'Cosa manca al tuo quartiere, e cosa cambierebbe se ci fosse?');
insert into public.eventi_aree (evento_id, area_slug) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'salute-professioni-sanitarie'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'scienze-educazione');

-- Lo stesso evento SENZA aree: la porta deve restare chiusa.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato, domanda_consegna) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Incontro senza aree', 'webinar', now() - interval '3 hours', now() - interval '1 hour', 'approvato',
   'Una domanda che non potrà portare niente.');

-- Un evento ANCORA IN CORSO (per imposta_domanda_consegna e per la finestra).
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato) values
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Diretta in corso', 'webinar', now() - interval '10 minutes', now() + interval '1 hour', 'approvato');
insert into public.eventi_aree (evento_id, area_slug) values
  ('eeeeeeee-0000-0000-0000-000000000003', 'salute-professioni-sanitarie');

-- Un evento IN CORSO e SENZA AREE: serve a provare che imposta_domanda_consegna
-- rifiuta al punto più a monte. Creato così invece di spostare le date di un
-- altro: un `update` su `eventi` fatto dentro il ruolo dell'ente passa dalla RLS
-- (`eventi_update_propria_non_revisionato` si ferma sugli approvati) e tocca ZERO
-- righe in silenzio — la prima stesura di questo file ci è caduta, e la proprietà
-- risultava rossa per il motivo sbagliato.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato) values
  ('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
   'In corso e senza aree', 'webinar', now() - interval '10 minutes', now() + interval '1 hour', 'approvato');

-- Un evento finito DA TRE GIORNI: finestra scaduta.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato, domanda_consegna) values
  ('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Diretta vecchia', 'webinar', now() - interval '4 days', now() - interval '3 days', 'approvato', 'Troppo tardi.');
insert into public.eventi_aree (evento_id, area_slug) values
  ('eeeeeeee-0000-0000-0000-000000000004', 'salute-professioni-sanitarie');

-- Iscrizioni: lo studente 1 è iscritto a tutto e ha un ping sul primo; lo
-- studente 2 è iscritto al primo ma NON ha mai aperto la pagina.
insert into public.iscrizioni_eventi (student_id, evento_id) values
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000002'),
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000004'),
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-0000-0000-0000-000000000001');
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 40),
  ('eeeeeeee-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 40),
  ('eeeeeeee-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 40);

-- ════════════════════════ 1. la finestra ════════════════════════
insert into esiti (proprieta, atteso, trovato) values
  ('la finestra è aperta su un evento finito un''ora fa', 'true',
   public.consegna_evento_aperta('eeeeeeee-0000-0000-0000-000000000001')::text),
  ('…chiusa su una diretta ancora in corso', 'false',
   public.consegna_evento_aperta('eeeeeeee-0000-0000-0000-000000000003')::text),
  ('…chiusa su una diretta finita da tre giorni', 'false',
   public.consegna_evento_aperta('eeeeeeee-0000-0000-0000-000000000004')::text);

-- Senza domanda la finestra non si apre, anche se il tempo torna.
update public.eventi set domanda_consegna = null where id = 'eeeeeeee-0000-0000-0000-000000000001';
insert into esiti (proprieta, atteso, trovato) values
  ('…e chiusa se nessuna domanda è stata posta', 'false',
   public.consegna_evento_aperta('eeeeeeee-0000-0000-0000-000000000001')::text);
update public.eventi set domanda_consegna = 'Cosa manca al tuo quartiere, e cosa cambierebbe se ci fosse?'
  where id = 'eeeeeeee-0000-0000-0000-000000000001';

-- ════════════════════════ 2. la porta ════════════════════════
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into esiti (proprieta, atteso, trovato) values
  ('iscritto + un ping + aree: la porta è aperta', 'true',
   public.puo_consegnare_evento('eeeeeeee-0000-0000-0000-000000000001')::text),
  ('un evento senza aree resta chiuso (una prova senza area non serve a nessuno)', 'false',
   public.puo_consegnare_evento('eeeeeeee-0000-0000-0000-000000000002')::text);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into esiti (proprieta, atteso, trovato) values
  ('iscritto ma senza nessun ping: chiuso (la domanda è per chi ha seguito)', 'false',
   public.puo_consegnare_evento('eeeeeeee-0000-0000-0000-000000000001')::text);

-- UN ANONIMO NON ARRIVA NEMMENO AL PREDICATO: la migrazione gli revoca
-- l'EXECUTE, quindi il permesso è la prima porta e la guardia la seconda. Vale la
-- pena provarle separate — un `permission denied` e un `false` sono due risposte
-- diverse, e confonderle nasconderebbe la perdita di una delle due.
set local role anon;
set local request.jwt.claim.sub = '';
do $$
begin
  perform public.puo_consegnare_evento('eeeeeeee-0000-0000-0000-000000000001');
  insert into esiti (proprieta, atteso, trovato) values ('un anonimo non arriva nemmeno al predicato', 'permesso negato', 'SONO ARRIVATO AL PREDICATO');
exception
  when insufficient_privilege then
    insert into esiti (proprieta, atteso, trovato) values ('un anonimo non arriva nemmeno al predicato', 'permesso negato', 'permesso negato');
  when others then
    insert into esiti (proprieta, atteso, trovato) values ('un anonimo non arriva nemmeno al predicato', 'permesso negato', 'SONO ARRIVATO AL PREDICATO: ' || sqlerrm);
end $$;
reset role;

-- E LA GUARDIA, provata dove si può: una sessione collegata SENZA un uid (un
-- token scaduto, un ruolo senza soggetto). Un predicato che si chiama «può» non
-- deve rispondere sì a chi non può, nemmeno per caso.
set local role authenticated;
set local request.jwt.claim.sub = '';
insert into esiti (proprieta, atteso, trovato) values
  ('collegato ma senza un uid: chiuso', 'false',
   public.puo_consegnare_evento('eeeeeeee-0000-0000-0000-000000000001')::text);
reset role;

-- ════════════════════════ 3. il testo ════════════════════════
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.consegne_evento (evento_id, student_id, testo) values
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   repeat('Nel mio quartiere l''ambulatorio apre due giorni a settimana, e chi non ha la macchina non ci arriva. ', 3));
insert into esiti (proprieta, atteso, trovato)
  select 'lo studente con la porta aperta salva il testo', '1', count(*)::text
  from public.consegne_evento where evento_id = 'eeeeeeee-0000-0000-0000-000000000001';

-- Lo studente 2 (nessun ping) viene fermato dalla policy, non da un controllo
-- applicativo: è la porta vera.
do $$
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  begin
    insert into public.consegne_evento (evento_id, student_id, testo) values
      ('eeeeeeee-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', repeat('x ', 120));
    insert into esiti (proprieta, atteso, trovato) values ('senza ping la policy rifiuta il testo', 'rifiutato', 'ACCETTATO');
  exception when insufficient_privilege then
    insert into esiti (proprieta, atteso, trovato) values ('senza ping la policy rifiuta il testo', 'rifiutato', 'rifiutato');
  end;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
end $$;

-- ════════════════════════ 4. le prove ════════════════════════
select public.registra_evidenze_consegna_evento(
  'eeeeeeee-0000-0000-0000-000000000001',
  '[{"area_slug":"salute-professioni-sanitarie","dimensione":"performance","valore":0.8,"peso":1.0,"motivazione":"Hai nominato un vincolo concreto."}]'::jsonb);

insert into esiti (proprieta, atteso, trovato)
  select 'la consegna scrive una prova d''area con fonte ''evento'' e peso 1,0', '1|evento|1.00|area|performance',
         count(*)::text || '|' || min(fonte::text) || '|' || min(peso)::text || '|' || min(categoria::text) || '|' || min(dimensione::text)
  from public.evidence where evento_id = 'eeeeeeee-0000-0000-0000-000000000001';

insert into esiti (proprieta, atteso, trovato)
  select '…e area_signal viene ricalcolata (interesse assente, bravura sì)', '80|0.10',
         coalesce(performance_score::text, 'NULL') || '|' || confidence::text
  from public.area_signal
  where student_id = '11111111-1111-1111-1111-111111111111' and area_slug = 'salute-professioni-sanitarie';

insert into esiti (proprieta, atteso, trovato)
  select 'la consegna risulta valutata', 'true', (valutata_il is not null)::text
  from public.consegne_evento where evento_id = 'eeeeeeee-0000-0000-0000-000000000001';

-- ════════════════════════ 5. le tre guardie che sollevano ════════════════════════
do $$
declare v_prove integer;
begin
  -- array vuoto: solleva E NON CANCELLA le prove che c'erano
  begin
    perform public.registra_evidenze_consegna_evento('eeeeeeee-0000-0000-0000-000000000001', '[]'::jsonb);
    insert into esiti (proprieta, atteso, trovato) values ('un array vuoto solleva «nessuna_prova»', 'nessuna_prova', 'NON HA SOLLEVATO');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('un array vuoto solleva «nessuna_prova»', 'nessuna_prova', sqlerrm);
  end;
  select count(*) into v_prove from public.evidence where evento_id = 'eeeeeeee-0000-0000-0000-000000000001';
  insert into esiti (proprieta, atteso, trovato) values
    ('…e le prove che c''erano sono ancora lì (una guardia assente le svuoterebbe: è LA proprietà)', '1', v_prove::text);

  -- un'area che l'evento non ha: solleva invece di scartare in silenzio
  begin
    perform public.registra_evidenze_consegna_evento('eeeeeeee-0000-0000-0000-000000000001',
      '[{"area_slug":"informatica-digitale","dimensione":"performance","valore":0.9,"peso":1.0,"motivazione":"x"}]'::jsonb);
    insert into esiti (proprieta, atteso, trovato) values ('un''area di un altro evento solleva', 'prova_fuori_aree', 'NON HA SOLLEVATO');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('un''area di un altro evento solleva', 'prova_fuori_aree', split_part(sqlerrm, ':', 1));
  end;

  -- una prova SENZA area: la riga che non serve a nessuno
  begin
    perform public.registra_evidenze_consegna_evento('eeeeeeee-0000-0000-0000-000000000001',
      '[{"dimensione":"performance","valore":0.9,"peso":1.0,"motivazione":"x"}]'::jsonb);
    insert into esiti (proprieta, atteso, trovato) values ('una prova senza area solleva', 'prova_fuori_aree', 'NON HA SOLLEVATO');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('una prova senza area solleva', 'prova_fuori_aree', split_part(sqlerrm, ':', 1));
  end;

  -- nessuna consegna salvata per il chiamante: non autorizzato
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  begin
    perform public.registra_evidenze_consegna_evento('eeeeeeee-0000-0000-0000-000000000001',
      '[{"area_slug":"salute-professioni-sanitarie","dimensione":"performance","valore":1,"peso":1.0,"motivazione":"x"}]'::jsonb);
    insert into esiti (proprieta, atteso, trovato) values ('senza una propria consegna: non autorizzato', 'non_autorizzato', 'NON HA SOLLEVATO');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('senza una propria consegna: non autorizzato', 'non_autorizzato', sqlerrm);
  end;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
end $$;

insert into esiti (proprieta, atteso, trovato)
  select 'uno studente non vede la consegna di un altro (RLS)', '0', count(*)::text
  from public.consegne_evento where student_id = '22222222-2222-2222-2222-222222222222';
reset role;

-- ════════════════════════ 6. l'ente pone la domanda ════════════════════════
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  -- durante la diretta: riesce
  begin
    perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-000000000003', 'Cosa cambieresti domani, con i soldi che ci sono?');
    insert into esiti (proprieta, atteso, trovato) values ('l''organizzatore pone la domanda durante la diretta', 'riuscito', 'riuscito');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('l''organizzatore pone la domanda durante la diretta', 'riuscito', sqlerrm);
  end;

  -- a diretta finita: la consegna è già aperta, la domanda non si cambia
  begin
    perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-000000000001', 'Una domanda cambiata sotto a chi sta scrivendo.');
    insert into esiti (proprieta, atteso, trovato) values ('…e non la cambia più a consegna aperta', 'fuori_finestra_diretta', 'NON HA SOLLEVATO');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('…e non la cambia più a consegna aperta', 'fuori_finestra_diretta', sqlerrm);
  end;

  -- un evento senza aree: lo sa subito chi può rimediare
  begin
    perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-000000000005', 'Una domanda su un evento senza aree.');
    insert into esiti (proprieta, atteso, trovato) values ('un evento senza aree: rifiutato al punto più a monte', 'evento_senza_aree', 'NON HA SOLLEVATO');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('un evento senza aree: rifiutato al punto più a monte', 'evento_senza_aree', sqlerrm);
  end;
end $$;

-- uno studente non è l'organizzatore di niente
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-000000000003', 'Una domanda posta da chi non può.');
  insert into esiti (proprieta, atteso, trovato) values ('uno studente non pone la domanda', 'non_autorizzato', 'NON HA SOLLEVATO');
exception when others then
  insert into esiti (proprieta, atteso, trovato) values ('uno studente non pone la domanda', 'non_autorizzato', sqlerrm);
end $$;
reset role;

-- ════════════════════════ 7. i permessi ════════════════════════
set local role anon;
set local request.jwt.claim.sub = '';
do $$
begin
  perform public.registra_evidenze_consegna_evento('eeeeeeee-0000-0000-0000-000000000001', '[]'::jsonb);
  insert into esiti (proprieta, atteso, trovato) values ('un anonimo non arriva nemmeno alla guardia', 'permesso negato', 'SONO ARRIVATO ALLA GUARDIA');
exception
  when insufficient_privilege then
    insert into esiti (proprieta, atteso, trovato) values ('un anonimo non arriva nemmeno alla guardia', 'permesso negato', 'permesso negato');
  when others then
    insert into esiti (proprieta, atteso, trovato) values ('un anonimo non arriva nemmeno alla guardia', 'permesso negato', 'SONO ARRIVATO ALLA GUARDIA: ' || sqlerrm);
end $$;
do $$
begin
  perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-000000000003', 'x');
  insert into esiti (proprieta, atteso, trovato) values ('…né a porre una domanda', 'permesso negato', 'SONO ARRIVATO ALLA GUARDIA');
exception
  when insufficient_privilege then
    insert into esiti (proprieta, atteso, trovato) values ('…né a porre una domanda', 'permesso negato', 'permesso negato');
  when others then
    insert into esiti (proprieta, atteso, trovato) values ('…né a porre una domanda', 'permesso negato', 'SONO ARRIVATO ALLA GUARDIA: ' || sqlerrm);
end $$;
reset role;

-- ════════════════════════ 8. l'aritmetica del peso ════════════════════════
-- QUATTRO consegne sulla stessa area arrivano a confidence 0,40, cioè alla barra
-- delle affinità. È il fatto su cui poggia la scelta del peso (1,0) e la
-- decisione che la PRESENZA non produce un segnale d'area: se la presenza valesse
-- lo stesso, quattro schede aperte creerebbero un'affinità.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato, domanda_consegna)
select ('eeeeeeee-0000-0000-0000-00000000001' || n)::uuid, 'aaaaaaaa-0000-0000-0000-000000000001',
       'Incontro ' || n, 'webinar', now() - interval '3 hours', now() - interval '1 hour', 'approvato', 'Cosa ti resta in mente di questo incontro numero ' || n || '?'
from generate_series(1, 3) n;
insert into public.eventi_aree (evento_id, area_slug)
select ('eeeeeeee-0000-0000-0000-00000000001' || n)::uuid, 'salute-professioni-sanitarie' from generate_series(1, 3) n;
insert into public.iscrizioni_eventi (student_id, evento_id)
select '11111111-1111-1111-1111-111111111111', ('eeeeeeee-0000-0000-0000-00000000001' || n)::uuid from generate_series(1, 3) n;
insert into public.presenze_live (evento_id, user_id, ping_totali)
select ('eeeeeeee-0000-0000-0000-00000000001' || n)::uuid, '11111111-1111-1111-1111-111111111111', 40 from generate_series(1, 3) n;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.consegne_evento (evento_id, student_id, testo)
select ('eeeeeeee-0000-0000-0000-00000000001' || n)::uuid, '11111111-1111-1111-1111-111111111111', repeat('Una risposta di prova. ', 12)
from generate_series(1, 3) n;
do $$
declare n integer;
begin
  for n in 1..3 loop
    perform public.registra_evidenze_consegna_evento(
      ('eeeeeeee-0000-0000-0000-00000000001' || n)::uuid,
      '[{"area_slug":"salute-professioni-sanitarie","dimensione":"performance","valore":0.7,"peso":1.0,"motivazione":"x"}]'::jsonb);
  end loop;
end $$;
reset role;

insert into esiti (proprieta, atteso, trovato)
  select 'quattro consegne sulla stessa area: Σpeso 4, confidence 0,40 — la barra delle affinità', '4.00|0.40',
         sum(e.peso)::text || '|' || min(a.confidence)::text
  from public.evidence e
  join public.area_signal a
    on a.student_id = e.student_id and a.area_slug = e.area_slug
  where e.student_id = '11111111-1111-1111-1111-111111111111'
    and e.area_slug = 'salute-professioni-sanitarie' and e.fonte = 'evento';

-- ════════════════════════ esito ════════════════════════
select n,
       case when trovato like '%' || atteso || '%' then '✓' else '✗' end as ok,
       proprieta, atteso, trovato
from esiti order by n;

select case when count(*) = 0 then '✅ tutto verde'
            else '❌ ' || count(*)::text || ' proprietà rosse' end as esito
from esiti where trovato not like '%' || atteso || '%';

rollback;
