-- Verifica di 20261004130000_presenza_dentro_la_diretta.sql: la presenza si
-- conta sulla DIRETTA, non sulla finestra in cui la pagina della diretta è
-- viva.
--
-- Gira anche nel SQL Editor di Supabase: tutto dentro una transazione che
-- finisce con ROLLBACK, e in coda un `select` invece di un silenzio — un file
-- che non stampa niente non si distingue da un file che non è stato eseguito.
--
-- LA CONTROPROVA, e va fatta su una replica NATA SENZA il fix (un
-- `create or replace` conserva privilegi e stato: riapplicare sulla stessa
-- replica dà una risposta che sembra una risposta):
--   - rimettendo `evento_in_finestra_diretta` dentro `ping_presenza_live`
--     diventano rosse la 5, la 7 e la 8 — e la 7 è quella che conta, perché
--     riproduce la serata del 4/10: quattro ping nel pre-roll certificano una
--     presenza a una diretta mai vista;
--   - facendo partire `evento_in_diretta` da `data_inizio - interval '15
--     minutes'` diventano rosse la 1 e la 5: è la finestra sbagliata scritta
--     nella funzione giusta;
--   - la 11 (i permessi) NON si controprova togliendo il `revoke` da
--     20261004130000: lì resta VERDE, ed è giusto — `create or replace`
--     conserva i privilegi, quindi la revoca di
--     20260926110000_chiudi_definer_scrittura.sql regge da sé e quella nel
--     file nuovo è una ripetizione esplicita, non la cosa che protegge
--     (provato: senza la mia, 13 proprietà verdi). Per farla diventare rossa
--     servono i due file insieme — saltando la migrazione di settembre E
--     togliendo la revoca da quella di ottobre: allora dice «sono arrivato
--     alla guardia (non_autenticato): il permesso ha ceduto», che è
--     esattamente la distinzione fra la prima porta e la seconda.

begin;

set local role postgres;

create temporary table esiti (n int, nome text, esito text) on commit drop;
-- Il registro degli esiti si scrive anche da dentro i blocchi che cambiano
-- ruolo: senza questo grant la riga non entra e il rosso che si legge è del
-- banco, non del prodotto.
grant all on esiti to anon, authenticated;

-- ---------------------------------------------------------------- dati
insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'ente@test.it'),
  ('44444444-4444-4444-4444-444444444444', 'studente@test.it'),
  ('55555555-5555-5555-5555-555555555555', 'studente2@test.it');

insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('22222222-2222-2222-2222-222222222222', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('44444444-4444-4444-4444-444444444444', 'studente', 'St', 'Udente', '2008-01-01'),
  ('55555555-5555-5555-5555-555555555555', 'studente', 'Se', 'Condo', '2008-01-01');

insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ente Uno', 'ente-uno', 'universita', 'attiva');

insert into public.institution_profiles (user_id, istituzione_id) values
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001');

-- EV1 — la diretta di stasera, ancora da cominciare: inizia fra 7 minuti e
-- dura 5, esattamente la forma dell'evento del 4/10 (19:08 → evento 19:15-19:20).
-- EV2 — una diretta IN CORSO adesso, cominciata 3 minuti fa e lunga 5.
-- EV3 — una diretta GIÀ FINITA.
-- EV4 — come EV1 ma non approvata.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                           hosting_diretta, youtube_video_id, incorporamento_sonda) values
  ('e0000000-0000-0000-0000-00000000000a', 'Fra sette minuti', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() + interval '7 minutes', now() + interval '12 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo'),
  ('e0000000-0000-0000-0000-00000000000b', 'In corso adesso', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '3 minutes', now() + interval '2 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo'),
  ('e0000000-0000-0000-0000-00000000000c', 'Già finita', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '1 hour', now() - interval '55 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo'),
  ('e0000000-0000-0000-0000-00000000000d', 'Non approvata', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() + interval '7 minutes', now() + interval '12 minutes', 'in_approvazione', 'studenti', 'kireo', 'abcdefghijk', 'attivo');

insert into public.eventi_aree (evento_id, area_slug) values
  ('e0000000-0000-0000-0000-00000000000a', 'informatica-digitale'),
  ('e0000000-0000-0000-0000-00000000000b', 'informatica-digitale'),
  ('e0000000-0000-0000-0000-00000000000c', 'informatica-digitale');

insert into public.iscrizioni_eventi (evento_id, student_id, iscritto_da) values
  ('e0000000-0000-0000-0000-00000000000a', '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444'),
  ('e0000000-0000-0000-0000-00000000000b', '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444'),
  ('e0000000-0000-0000-0000-00000000000c', '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444'),
  ('e0000000-0000-0000-0000-00000000000c', '55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555');

-- =================================================================
-- §1 — LE DUE FINESTRE SONO DUE
-- =================================================================

-- 1) Sette minuti prima dell'inizio: la PAGINA è viva (la finestra larga la
--    accetta, apposta: chi arriva prima deve vedere il player comparire da
--    sé) e la DIRETTA non sta andando.
do $$
declare v_larga boolean; v_stretta boolean;
begin
  v_larga := public.evento_in_finestra_diretta('e0000000-0000-0000-0000-00000000000a');
  v_stretta := public.evento_in_diretta('e0000000-0000-0000-0000-00000000000a');
  if v_larga and not v_stretta then
    insert into esiti values (1, 'pre-roll: pagina viva, diretta no', 'OK');
  else
    insert into esiti values (1, 'pre-roll: pagina viva, diretta no',
      'ROTTO — larga=' || v_larga || ' stretta=' || v_stretta);
  end if;
end $$;

-- 2) Durante: tutte e due vere.
do $$
declare v_larga boolean; v_stretta boolean;
begin
  v_larga := public.evento_in_finestra_diretta('e0000000-0000-0000-0000-00000000000b');
  v_stretta := public.evento_in_diretta('e0000000-0000-0000-0000-00000000000b');
  if v_larga and v_stretta then
    insert into esiti values (2, 'durante: entrambe vere', 'OK');
  else
    insert into esiti values (2, 'durante: entrambe vere',
      'ROTTO — larga=' || v_larga || ' stretta=' || v_stretta);
  end if;
end $$;

-- 3) Dopo la fine: tutte e due false. Le due finestre chiudono sullo stesso
--    istante, e questo è il pezzo che non deve divergere.
do $$
declare v_larga boolean; v_stretta boolean;
begin
  v_larga := public.evento_in_finestra_diretta('e0000000-0000-0000-0000-00000000000c');
  v_stretta := public.evento_in_diretta('e0000000-0000-0000-0000-00000000000c');
  if not v_larga and not v_stretta then
    insert into esiti values (3, 'dopo la fine: entrambe false', 'OK');
  else
    insert into esiti values (3, 'dopo la fine: entrambe false',
      'ROTTO — larga=' || v_larga || ' stretta=' || v_stretta);
  end if;
end $$;

-- 4) Un evento non approvato non è in diretta nemmeno all'ora giusta.
do $$
begin
  if not public.evento_in_diretta('e0000000-0000-0000-0000-00000000000d') then
    insert into esiti values (4, 'evento non approvato: non in diretta', 'OK');
  else
    insert into esiti values (4, 'evento non approvato: non in diretta', 'ROTTO — risponde vero');
  end if;
end $$;

-- =================================================================
-- §2 — IL BATTITO
-- =================================================================

set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

-- 5) Il ping nel pre-roll viene RESPINTO: non si scrive quello che non si
--    conterà. È la riga che il 4/10 mancava.
do $$
begin
  perform public.ping_presenza_live('e0000000-0000-0000-0000-00000000000a');
  insert into esiti values (5, 'ping nel pre-roll: respinto', 'ROTTO — accettato');
exception
  when sqlstate '42501' then
    insert into esiti values (5, 'ping nel pre-roll: respinto', 'ROTTO — permesso negato, non sono arrivato alla guardia');
  when others then
    if sqlerrm = 'evento_non_in_corso' then
      insert into esiti values (5, 'ping nel pre-roll: respinto', 'OK');
    else
      insert into esiti values (5, 'ping nel pre-roll: respinto', 'ROTTO — ' || sqlerrm);
    end if;
end $$;

-- 6) Il ping durante la diretta passa, e crea la riga.
do $$
declare v_n integer;
begin
  perform public.ping_presenza_live('e0000000-0000-0000-0000-00000000000b');
  select count(*) into v_n from public.presenze_live
    where evento_id = 'e0000000-0000-0000-0000-00000000000b' and user_id = '44444444-4444-4444-4444-444444444444';
  if v_n = 1 then
    insert into esiti values (6, 'ping durante la diretta: accettato', 'OK');
  else
    insert into esiti values (6, 'ping durante la diretta: accettato', 'ROTTO — righe=' || v_n);
  end if;
exception when others then
  insert into esiti values (6, 'ping durante la diretta: accettato', 'ROTTO — ' || sqlerrm);
end $$;

-- 7) LA SERATA DEL 4/10, RIPRODOTTA. Quattro ping nel pre-roll di un evento
--    di cinque minuti sono esattamente la soglia (ping attesi 5, soglia 0,75
--    → 3,75 → 4). Con la finestra larga bastavano a certificare una presenza
--    a una diretta che non si era ancora vista. Adesso nessuno dei quattro
--    entra, quindi non c'è niente da certificare.
do $$
declare v_righe integer;
begin
  for i in 1..4 loop
    begin
      perform public.ping_presenza_live('e0000000-0000-0000-0000-00000000000a');
    exception when others then
      null; -- atteso: evento_non_in_corso
    end;
  end loop;
  select count(*) into v_righe from public.presenze_live
    where evento_id = 'e0000000-0000-0000-0000-00000000000a';
  if v_righe = 0 then
    insert into esiti values (7, 'quattro ping nel pre-roll: zero presenze registrate', 'OK');
  else
    insert into esiti values (7, 'quattro ping nel pre-roll: zero presenze registrate',
      'ROTTO — righe=' || v_righe || ' (la soglia di quell''evento sono 4 ping)');
  end if;
end $$;

-- 8) E il conto che lo rendeva possibile, detto per intero: `ping_attesi` è
--    la durata PROGRAMMATA in minuti, quindi per EV1 sono 5 e la soglia del
--    75% cade a 4 ping. Il numero si legge, non si assume.
do $$
declare v_attesi numeric; v_soglia numeric;
begin
  v_attesi := public.ping_attesi_evento('e0000000-0000-0000-0000-00000000000a');
  v_soglia := ceil(v_attesi * 0.75);
  if v_attesi = 5 and v_soglia = 4 then
    insert into esiti values (8, 'ping attesi 5, soglia 4 ping', 'OK');
  else
    insert into esiti values (8, 'ping attesi 5, soglia 4 ping',
      'ROTTO — attesi=' || v_attesi || ' soglia=' || v_soglia);
  end if;
end $$;

-- 9) Il ping su una diretta già finita resta respinto (non è una regressione
--    della finestra stretta: era già così, e deve restarlo).
do $$
begin
  perform public.ping_presenza_live('e0000000-0000-0000-0000-00000000000c');
  insert into esiti values (9, 'ping su diretta finita: respinto', 'ROTTO — accettato');
exception when others then
  if sqlerrm = 'evento_non_in_corso' then
    insert into esiti values (9, 'ping su diretta finita: respinto', 'OK');
  else
    insert into esiti values (9, 'ping su diretta finita: respinto', 'ROTTO — ' || sqlerrm);
  end if;
end $$;

-- 10) LA FINESTRA LARGA NON SI È MOSSA, e il modo di provarlo è il suo altro
--     chiamante vivo: una domanda scritta nel pre-roll resta legittima. Se
--     questa diventa rossa, la cura ha stretto anche una cosa che nessuno
--     aveva chiesto di stringere.
do $$
declare v_n integer;
begin
  insert into public.domande_live (evento_id, user_id, testo)
  values ('e0000000-0000-0000-0000-00000000000a', '44444444-4444-4444-4444-444444444444', 'Una domanda in anticipo');
  select count(*) into v_n from public.domande_live where evento_id = 'e0000000-0000-0000-0000-00000000000a';
  if v_n = 1 then
    insert into esiti values (10, 'domanda nel pre-roll: ancora permessa', 'OK');
  else
    insert into esiti values (10, 'domanda nel pre-roll: ancora permessa', 'ROTTO — righe=' || v_n);
  end if;
exception when others then
  insert into esiti values (10, 'domanda nel pre-roll: ancora permessa', 'ROTTO — ' || sqlerrm);
end $$;

-- 11) `anon` non arriva alla funzione. Deve essere il PERMESSO a fermarlo
--     (42501), non la guardia interna: sono due porte, e vale sapere quale
--     ha risposto.
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
do $$
begin
  perform public.ping_presenza_live('e0000000-0000-0000-0000-00000000000b');
  insert into esiti values (11, 'anon: nessun permesso di chiamare', 'ROTTO — eseguita');
exception
  when sqlstate '42501' then
    insert into esiti values (11, 'anon: nessun permesso di chiamare', 'OK');
  when others then
    insert into esiti values (11, 'anon: nessun permesso di chiamare',
      'ROTTO — sono arrivato alla guardia (' || sqlerrm || '): il permesso ha ceduto');
end $$;

-- =================================================================
-- §3 — LA CHIUSURA, CON I PING GIUSTI
-- =================================================================

reset role;
set local role postgres;

-- Due studenti su EV3 (già finita): a uno si danno 4 ping (sopra la soglia di
-- 5 minuti → 3,75), all'altro 2 (sotto). Il primo si certifica, il secondo no.
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('e0000000-0000-0000-0000-00000000000c', '44444444-4444-4444-4444-444444444444', 4),
  ('e0000000-0000-0000-0000-00000000000c', '55555555-5555-5555-5555-555555555555', 2);

-- La chiusura la chiama l'ENTE organizzatore, con la sua identità: la
-- funzione è SECURITY DEFINER ma la guardia è esplicita, e chiamarla da
-- `postgres` senza identità risponde `non_autorizzato` — cioè si proverebbe
-- la guardia invece della chiusura.
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- 12) La chiusura certifica chi è sopra soglia e non chi è sotto.
-- ⚠️ LA RILETTURA NON SI FA CON L'IDENTITÀ DI CHI HA SCRITTO. L'ente chiama
-- la chiusura, ma la RLS di `iscrizioni_eventi` non gli fa vedere nessuna
-- riga: una rilettura da lì torna vuota e si legge come «non è successo
-- niente» — il rosso sarebbe del banco, non del prodotto. Si scrive con
-- l'identità giusta e si rilegge senza.
do $$
declare v_presenti integer; v_cert integer; v_stato1 text; v_stato2 text;
begin
  select presenti, certificati into v_presenti, v_cert
    from public.chiudi_diretta_evento('e0000000-0000-0000-0000-00000000000c');
  set local role postgres;
  select stato into v_stato1 from public.iscrizioni_eventi
    where evento_id = 'e0000000-0000-0000-0000-00000000000c' and student_id = '44444444-4444-4444-4444-444444444444';
  select stato into v_stato2 from public.iscrizioni_eventi
    where evento_id = 'e0000000-0000-0000-0000-00000000000c' and student_id = '55555555-5555-5555-5555-555555555555';
  if v_presenti = 2 and v_cert = 1 and v_stato1 = 'partecipato' and v_stato2 = 'iscritto' then
    insert into esiti values (12, 'chiusura: certifica solo chi è sopra soglia', 'OK');
  else
    insert into esiti values (12, 'chiusura: certifica solo chi è sopra soglia',
      'ROTTO — presenti=' || coalesce(v_presenti::text,'null') || ' cert=' || coalesce(v_cert::text,'null')
      || ' s1=' || coalesce(v_stato1,'null') || ' s2=' || coalesce(v_stato2,'null'));
  end if;
end $$;

-- 13) Premerlo due volte non fa niente. Lo diceva già il commento della
--     funzione di luglio; qui lo si esegue, perché il 4/10 la domanda è stata
--     fatta («non so cosa succede, e il fatto che non si possa sapere è il
--     punto»).
do $$
declare v_presenti integer; v_cert integer; v_righe integer;
begin
  set local role authenticated;
  select presenti, certificati into v_presenti, v_cert
    from public.chiudi_diretta_evento('e0000000-0000-0000-0000-00000000000c');
  set local role postgres;
  select count(*) into v_righe from public.activity_log
    where student_id = '44444444-4444-4444-4444-444444444444' and tipo_attivita = 'partecipazione_webinar';
  if v_cert = 0 and v_presenti = 2 and v_righe = 1 then
    insert into esiti values (13, 'seconda chiusura: idempotente', 'OK');
  else
    insert into esiti values (13, 'seconda chiusura: idempotente',
      'ROTTO — cert=' || v_cert || ' presenti=' || v_presenti || ' righe activity_log=' || v_righe);
  end if;
end $$;

-- ---------------------------------------------------------------- esito
select n, nome, esito from esiti order by n;

select case when count(*) = 0 then 'TUTTO VERDE — ' || (select count(*) from esiti) || ' proprietà'
            else count(*) || ' ROTTE' end as riepilogo
from esiti where esito <> 'OK';

rollback;
