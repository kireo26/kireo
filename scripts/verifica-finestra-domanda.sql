-- La finestra della domanda finale: le proprietà a database.
--
-- Si incolla nel SQL Editor di Supabase (o si esegue con psql contro una
-- replica): crea i propri dati finti, prova, e fa ROLLBACK — non lascia niente.
-- Da eseguire DOPO 20260929120000_finestra_domanda_consegna.sql.
--
-- LA PROPRIETÀ PER CUI QUESTO FILE ESISTE: la domanda si scrive GIORNI PRIMA
-- della diretta. Fino al 29/09 la finestra era quella della diretta — trenta
-- minuti per un evento di un quarto d'ora, quindici dei quali l'ente li passa in
-- onda a parlare — e il pezzo che regge tutto il formato dipendeva da un gesto
-- fatto nel momento in cui una persona è più occupata.
--
-- E LE DUE CHE LA TENGONO ONESTA: gli studenti la vedono ancora solo a diretta
-- conclusa (scriverla prima non vuol dire mostrarla prima), e i due rifiuti sono
-- DUE — «non ancora approvato» si risolve aspettando, «la diretta è finita» non
-- si risolve più, e un messaggio solo per due attese opposte non dice né cosa
-- fare né quando tornare.
--
-- LA CONTROPROVA, per chi vorrà rifarla: NON basta togliere la migrazione e
-- riapplicare (`create or replace` conserva quello che c'è, e una controprova su
-- uno stato sporco dà una risposta che sembra una risposta). Si ricostruisce la
-- replica da zero e si rimette sopra la guardia di ieri, cioè il corpo di
-- `imposta_domanda_consegna` che sta in 20260927120000_consegna_evento.sql.
-- Eseguito il 29/09 contro una replica ricostruita: diventano rosse le
-- proprietà 8, 10, 11, 12 e 14, tutte con lo stesso `fuori_finestra_diretta` —
-- un rifiuto solo al posto di tre risposte diverse. Le 1-7 restano verdi ed è
-- giusto: provano il predicato, non la guardia che lo usa.

begin;

-- ════════════════════════ dati finti ════════════════════════
create temporary table esiti (n int generated always as identity, proprieta text, atteso text, trovato text) on commit drop;
grant all on esiti to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'studente@prova.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'ente@prova.invalid'),
  ('44444444-4444-4444-4444-444444444444', 'admin@prova.invalid');

insert into public.profiles (id, ruolo, nome, cognome, data_nascita, di_prova) values
  ('11111111-1111-1111-1111-111111111111', 'studente', 'Prova', 'Uno', '2008-01-01', true),
  ('33333333-3333-3333-3333-333333333333', 'istituzione', 'Prova', 'Ente', null, true),
  ('44444444-4444-4444-4444-444444444444', 'admin', 'Prova', 'Admin', null, true);

insert into public.istituzioni (id, nome, slug, stato) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ente di prova', 'ente-di-prova', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000001');

-- Fra NOVE GIORNI, approvato: è il caso che prima non si poteva scrivere.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Diretta di fra nove giorni', 'webinar', now() + interval '9 days', now() + interval '9 days' + interval '1 hour', 'approvato');
-- IN CORSO: la finestra vecchia. Deve continuare a funzionare.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato) values
  ('eeeeeeee-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Diretta in corso', 'webinar', now() - interval '10 minutes', now() + interval '50 minutes', 'approvato');
-- FINITA un'ora fa: la consegna è aperta, la domanda non si cambia più.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato, domanda_consegna) values
  ('eeeeeeee-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Diretta finita', 'webinar', now() - interval '3 hours', now() - interval '1 hour', 'approvato',
   'Una domanda posta in tempo, che adesso non si tocca più.');
-- NON ANCORA APPROVATA: l'altro rifiuto, quello che si risolve aspettando.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato) values
  ('eeeeeeee-0000-0000-0000-00000000000d', 'aaaaaaaa-0000-0000-0000-000000000001',
   'In attesa di revisione', 'webinar', now() + interval '9 days', now() + interval '9 days' + interval '1 hour', 'in_approvazione');
-- APPROVATA E SENZA AREE: il rifiuto detto a chi può ancora rimediare, e da oggi
-- detto giorni prima invece che durante la diretta.
insert into public.eventi (id, organizzatore_id, titolo, tipo, data_inizio, data_fine, stato) values
  ('eeeeeeee-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Nove giorni, zero aree', 'webinar', now() + interval '9 days', now() + interval '9 days' + interval '1 hour', 'approvato');

insert into public.eventi_aree (evento_id, area_slug) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'salute-professioni-sanitarie'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'salute-professioni-sanitarie'),
  ('eeeeeeee-0000-0000-0000-00000000000c', 'salute-professioni-sanitarie'),
  ('eeeeeeee-0000-0000-0000-00000000000d', 'salute-professioni-sanitarie');

-- ════════════════════════ 1. la finestra ════════════════════════
insert into esiti (proprieta, atteso, trovato) values
  ('fra nove giorni, approvato: la domanda si può scrivere', 'true',
   public.domanda_consegna_modificabile('eeeeeeee-0000-0000-0000-00000000000a')::text),
  ('durante la diretta: si può ancora cambiare', 'true',
   public.domanda_consegna_modificabile('eeeeeeee-0000-0000-0000-00000000000b')::text),
  ('a diretta finita: no', 'false',
   public.domanda_consegna_modificabile('eeeeeeee-0000-0000-0000-00000000000c')::text),
  ('non ancora approvato: no', 'false',
   public.domanda_consegna_modificabile('eeeeeeee-0000-0000-0000-00000000000d')::text);

-- ════════════════════════ 2. le due finestre non si sovrappongono ════════════
-- La promessa della migrazione precedente — una domanda non cambia MAI sotto a
-- chi sta già rispondendo — regge solo se le due finestre sono disgiunte. Non si
-- afferma: si conta.
insert into esiti (proprieta, atteso, trovato)
select 'nessun evento ha domanda e consegna aperte insieme', '0', count(*)::text
from public.eventi e
where public.domanda_consegna_modificabile(e.id) and public.consegna_evento_aperta(e.id);

insert into esiti (proprieta, atteso, trovato) values
  ('…e a diretta finita è aperta l''altra: la consegna', 'true',
   public.consegna_evento_aperta('eeeeeeee-0000-0000-0000-00000000000c')::text);

-- ⚠️ SCRIVERLA PRIMA NON VUOL DIRE MOSTRARLA PRIMA: la domanda posta oggi per
-- una diretta fra nove giorni non apre niente agli studenti.
update public.eventi set domanda_consegna = 'Posta con nove giorni di anticipo.'
where id = 'eeeeeeee-0000-0000-0000-00000000000a';
insert into esiti (proprieta, atteso, trovato) values
  ('una domanda posta in anticipo non apre la consegna', 'false',
   public.consegna_evento_aperta('eeeeeeee-0000-0000-0000-00000000000a')::text);
update public.eventi set domanda_consegna = null where id = 'eeeeeeee-0000-0000-0000-00000000000a';

-- ════════════════════════ 3. l'ente pone la domanda ════════════════════════
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  -- NOVE GIORNI PRIMA: è la riga per cui esiste tutta questa migrazione.
  begin
    perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-00000000000a', 'Con quali soldi lo tenete aperto il secondo anno?');
    insert into esiti (proprieta, atteso, trovato) values ('l''ente pone la domanda nove giorni prima', 'riuscito', 'riuscito');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('l''ente pone la domanda nove giorni prima', 'riuscito', sqlerrm);
  end;

  -- …e la cambia durante la diretta, perché una diretta prende una piega che
  -- nessuno aveva previsto.
  begin
    perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-00000000000b', 'Cambiata in corsa, su quello che è successo davvero.');
    insert into esiti (proprieta, atteso, trovato) values ('…e la cambia durante la diretta', 'riuscito', 'riuscito');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('…e la cambia durante la diretta', 'riuscito', sqlerrm);
  end;

  -- A DIRETTA FINITA NO: la consegna è aperta, e cambiarla sotto a chi sta
  -- scrivendo è peggio che non averla posta.
  begin
    perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-00000000000c', 'Cambiata sotto a chi sta scrivendo.');
    insert into esiti (proprieta, atteso, trovato) values ('…e non più a diretta finita', 'domanda_non_piu_modificabile', 'NON HA SOLLEVATO');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('…e non più a diretta finita', 'domanda_non_piu_modificabile', sqlerrm);
  end;

  -- L'ALTRO RIFIUTO, e deve essere un altro: questo si risolve aspettando.
  begin
    perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-00000000000d', 'Su un evento non ancora approvato.');
    insert into esiti (proprieta, atteso, trovato) values ('un evento non approvato ha il SUO rifiuto', 'evento_non_approvato', 'NON HA SOLLEVATO');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('un evento non approvato ha il SUO rifiuto', 'evento_non_approvato', sqlerrm);
  end;

  -- Le aree mancanti si dicono a chi può rimediare, e adesso giorni prima.
  begin
    perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-00000000000e', 'Su un evento senza aree.');
    insert into esiti (proprieta, atteso, trovato) values ('senza aree: detto nove giorni prima, non durante', 'evento_senza_aree', 'NON HA SOLLEVATO');
  exception when others then
    insert into esiti (proprieta, atteso, trovato) values ('senza aree: detto nove giorni prima, non durante', 'evento_senza_aree', sqlerrm);
  end;
end $$;

-- uno studente non è l'organizzatore di niente
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-00000000000a', 'Una domanda posta da chi non può.');
  insert into esiti (proprieta, atteso, trovato) values ('uno studente non pone la domanda', 'non_autorizzato', 'NON HA SOLLEVATO');
exception when others then
  insert into esiti (proprieta, atteso, trovato) values ('uno studente non pone la domanda', 'non_autorizzato', sqlerrm);
end $$;

-- l'admin sì, su un evento di chiunque
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$
begin
  perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-00000000000a', 'Riscritta da KIREO, con calma, prima della diretta.');
  insert into esiti (proprieta, atteso, trovato) values ('l''admin può aiutare l''ente a scriverla', 'riuscito', 'riuscito');
exception when others then
  insert into esiti (proprieta, atteso, trovato) values ('l''admin può aiutare l''ente a scriverla', 'riuscito', sqlerrm);
end $$;
reset role;

-- ════════════════════════ 4. i permessi ════════════════════════
-- `anon` deve fermarsi alla PORTA, non alla guardia: se entrasse, il rifiuto
-- sarebbe `non_autorizzato` e vorrebbe dire che il permesso non è stato
-- revocato. I default privileges di Supabase concedono EXECUTE a tutti.
set local role anon;
set local request.jwt.claim.sub = '';
do $$
begin
  perform public.imposta_domanda_consegna('eeeeeeee-0000-0000-0000-00000000000a', 'Da un anonimo.');
  insert into esiti (proprieta, atteso, trovato) values ('un anonimo non arriva nemmeno alla guardia', 'permesso negato', 'SONO ARRIVATO ALLA GUARDIA');
exception
  when insufficient_privilege then
    insert into esiti (proprieta, atteso, trovato) values ('un anonimo non arriva nemmeno alla guardia', 'permesso negato', 'permesso negato');
  when others then
    insert into esiti (proprieta, atteso, trovato) values ('un anonimo non arriva nemmeno alla guardia', 'permesso negato', 'sono arrivato alla guardia: ' || sqlerrm);
end $$;
do $$
begin
  perform public.domanda_consegna_modificabile('eeeeeeee-0000-0000-0000-00000000000a');
  insert into esiti (proprieta, atteso, trovato) values ('…né legge la finestra', 'permesso negato', 'HO LETTO');
exception
  when insufficient_privilege then
    insert into esiti (proprieta, atteso, trovato) values ('…né legge la finestra', 'permesso negato', 'permesso negato');
  when others then
    insert into esiti (proprieta, atteso, trovato) values ('…né legge la finestra', 'permesso negato', 'ho letto: ' || sqlerrm);
end $$;
reset role;

-- ════════════════════════ esito ════════════════════════
select n, proprieta, atteso, trovato,
       case when trovato like '%' || atteso || '%' then 'OK' else '>>> ROTTO' end as esito
from esiti order by n;

rollback;
