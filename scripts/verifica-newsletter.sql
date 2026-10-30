-- Verifica di 20261117110000 (30/10): la newsletter degli enti — i posti, la
-- quota, l'approvazione, l'avviso all'ente, la coda dello studente, la
-- scadenza, il cancello dell'età, l'uscita dalla posta.
--
-- Le proprietà che la cura può rompere stanno accanto: un evento approvato
-- resta approvato e in più avvisa l'ente (14), il client legge le sue
-- newsletter (12).
--
-- Le date: tutte nell'anno accademico che comincia il 1° settembre
-- dell'anno prossimo, così sono sempre nel futuro e sempre nello stesso anno.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;
create temp table g (chiave text primary key, giorno date) on commit drop;
grant all on g to anon, authenticated;
insert into g values
  ('ott', make_date(extract(year from public.oggi_in_italia())::int + 1, 10, 10)),
  ('ott2', make_date(extract(year from public.oggi_in_italia())::int + 1, 10, 20)),
  ('ott15', make_date(extract(year from public.oggi_in_italia())::int + 1, 10, 15)),
  ('nov', make_date(extract(year from public.oggi_in_italia())::int + 1, 11, 10)),
  ('dic', make_date(extract(year from public.oggi_in_italia())::int + 1, 12, 10)),
  ('gen', make_date(extract(year from public.oggi_in_italia())::int + 2, 1, 10)),
  ('feb', make_date(extract(year from public.oggi_in_italia())::int + 2, 2, 10));

-- Sette enti (sei premium, uno free), un admin, quattro studenti.
insert into auth.users (id, email)
select ('55555555-0000-0000-0000-0000000000e' || k)::uuid, 'ente' || k || '@nl.test' from generate_series(1, 7) k;
insert into auth.users (id, email) values
  ('55555555-0000-0000-0000-0000000000ad', 'admin@nl.test'),
  ('55555555-0000-0000-0000-0000000000c1', 'magg@nl.test'),
  ('55555555-0000-0000-0000-0000000000c2', 'mino@nl.test'),
  ('55555555-0000-0000-0000-0000000000c3', 'senzadata@nl.test'),
  ('55555555-0000-0000-0000-0000000000c4', 'esce@nl.test');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita)
select ('55555555-0000-0000-0000-0000000000e' || k)::uuid, 'istituzione', 'E', 'Nl' || k, null from generate_series(1, 7) k;
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('55555555-0000-0000-0000-0000000000ad', 'admin', 'A', 'Nl', null),
  ('55555555-0000-0000-0000-0000000000c1', 'studente', 'Magg', 'Uno', '2000-01-01'),
  ('55555555-0000-0000-0000-0000000000c2', 'studente', 'Mino', 'Due', public.oggi_in_italia() - interval '16 years'),
  ('55555555-0000-0000-0000-0000000000c3', 'studente', 'Senza', 'Data', null),
  ('55555555-0000-0000-0000-0000000000c4', 'studente', 'Esce', 'Quattro', '2000-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato, piano_id)
select ('dddddddd-0000-0000-0000-00000000000' || k)::uuid, 'Ente Nl ' || k, 'ente-nl-' || k, 'universita', 'attiva',
       (select id from public.piani where nome = (case when k = 7 then 'free' else 'premium' end)::public.piano_nome)
  from generate_series(1, 7) k;
insert into public.institution_profiles (user_id, istituzione_id)
select ('55555555-0000-0000-0000-0000000000e' || k)::uuid, ('dddddddd-0000-0000-0000-00000000000' || k)::uuid from generate_series(1, 7) k;
insert into public.newsletter_iscrizioni (student_id, istituzione_id) values
  ('55555555-0000-0000-0000-0000000000c1', 'dddddddd-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-0000000000c2', 'dddddddd-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-0000000000c3', 'dddddddd-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-0000000000c1', 'dddddddd-0000-0000-0000-000000000002'),
  ('55555555-0000-0000-0000-0000000000c4', 'dddddddd-0000-0000-0000-000000000003');

-- Un modo breve di salvare come un ente: restituisce l'id, o il messaggio
-- dell'errore preceduto da «!».
create function pg_temp.salva(p_ente int, p_id uuid, p_oggetto text, p_giorno date, p_manda boolean)
returns text language plpgsql as $$
declare v jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '55555555-0000-0000-0000-0000000000e' || p_ente, true);
  begin
    v := public.salva_newsletter(p_id, p_oggetto, 'Un corpo di newsletter lungo abbastanza da passare.', p_giorno, null, p_manda);
  exception when others then
    reset role;
    return '!' || sqlerrm;
  end;
  reset role;
  return v ->> 'id';
end $$;

create function pg_temp.decidi(p_id uuid, p_approva boolean, p_nota text)
returns text language plpgsql as $$
declare v jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '55555555-0000-0000-0000-0000000000ad', true);
  begin
    v := public.decidi_newsletter(p_id, p_approva, p_nota);
  exception when others then
    reset role;
    return '!' || sqlerrm;
  end;
  reset role;
  return v ->> 'stato';
end $$;

create temp table nl (chiave text primary key, id uuid) on commit drop;
grant all on nl to anon, authenticated;

-- 1. I piani sono due, e il free ne ha tre.
insert into esiti select 1, 'i piani: free 3, premium 12, nient''altro', 'free 3 · premium 12',
  string_agg(nome || ' ' || quota_newsletter, ' · ' order by nome), string_agg(nome || ' ' || quota_newsletter, ' · ' order by nome) = 'free 3 · premium 12'
  from public.piani;

-- 2. Una bozza non prende posto.
do $$
declare v text;
begin
  v := pg_temp.salva(6, null, 'Bozza di Nl6', (select giorno from g where chiave = 'ott'), false);
  insert into nl values ('bozza6', v::uuid);
  insert into esiti select 2, 'una bozza è una bozza', 'bozza', stato, stato = 'bozza' from public.newsletter_enti where id = v::uuid;
end $$;

-- 3-4. Cinque enti prendono il giorno; il sesto legge «completo».
do $$
declare k int; v text;
begin
  for k in 1..5 loop
    v := pg_temp.salva(k, null, 'Newsletter ' || k, (select giorno from g where chiave = 'ott'), true);
    insert into nl values ('n' || k, case when v like '!%' then null else v::uuid end);
  end loop;
  insert into esiti select 3, 'cinque in approvazione sullo stesso giorno', '5',
    count(*)::text, count(*) = 5 from public.newsletter_enti where id in (select id from nl where chiave like 'n_') and stato = 'in_approvazione';
  v := pg_temp.salva(6, (select id from nl where chiave = 'bozza6'), 'Bozza di Nl6', (select giorno from g where chiave = 'ott'), true);
  insert into esiti values (4, 'il sesto ente sullo stesso giorno', '!giorno_completo', v, v = '!giorno_completo');
end $$;

-- 22. Il giorno pieno si legge prima del clic.
insert into esiti select 22, 'i giorni pieni: il 10 ottobre, con 5', '5',
  coalesce((select occupati::text from public.giorni_newsletter_pieni((select giorno from g where chiave = 'ott') - 1, (select giorno from g where chiave = 'ott') + 1)), 'nessuno'),
  (select occupati from public.giorni_newsletter_pieni((select giorno from g where chiave = 'ott') - 1, (select giorno from g where chiave = 'ott') + 1)) = 5;


-- 5. Lo stesso ente, una seconda nello stesso mese.
do $$
declare v text;
begin
  v := pg_temp.salva(1, null, 'Seconda di ottobre', (select giorno from g where chiave = 'ott2'), true);
  insert into esiti values (5, 'una al mese', '!una_al_mese', v, v = '!una_al_mese');
end $$;

-- 6. Il piano free: tre in un anno accademico, la quarta no.
do $$
declare v text; risultati text := '';
begin
  foreach v in array array['nov', 'dic', 'gen', 'feb'] loop
    risultati := risultati || coalesce(left(pg_temp.salva(7, null, 'Free ' || v, (select giorno from g where chiave = v), true), 1), '?');
  end loop;
  -- Tre id (la prima lettera di un uuid) e poi un errore.
  v := pg_temp.salva(7, null, 'Free ancora', (select giorno from g where chiave = 'feb'), true);
  insert into esiti values (6, 'free: la quarta dell''anno', '!quota_piano (dopo tre accettate)', v || ' (' || risultati || ')',
    v = '!quota_piano' and risultati !~ '!.*!.*!' and right(risultati, 1) = '!');
end $$;

-- 7-8. Il rifiuto pretende un motivo, e libera il giorno.
do $$
declare v text; v2 text;
begin
  v := pg_temp.decidi((select id from nl where chiave = 'n5'), false, '   ');
  insert into esiti values (7, 'rifiutare senza motivo', '!motivo_mancante', v, v = '!motivo_mancante');
  v := pg_temp.decidi((select id from nl where chiave = 'n5'), false, 'Il testo promette un esito: va riscritto.');
  v2 := pg_temp.salva(6, (select id from nl where chiave = 'bozza6'), 'Bozza di Nl6', (select giorno from g where chiave = 'ott'), true);
  insert into esiti values (8, 'rifiutata, e il sesto ente ora trova posto', 'rifiutata · in_approvazione',
    v || ' · ' || coalesce((select stato from public.newsletter_enti where id = (select id from nl where chiave = 'bozza6')), v2),
    v = 'rifiutata' and (select stato from public.newsletter_enti where id = (select id from nl where chiave = 'bozza6')) = 'in_approvazione');
end $$;

-- 9. L'approvazione avvisa l'ente dentro KIREO; il rifiuto pure.
do $$
declare v text;
begin
  v := pg_temp.decidi((select id from nl where chiave = 'n1'), true, null);
  perform pg_temp.decidi((select id from nl where chiave = 'n2'), true, null);
  perform pg_temp.decidi((select id from nl where chiave = 'n3'), true, null);
  perform pg_temp.decidi((select id from nl where chiave = 'n4'), true, null);
  insert into esiti select 9, 'approvata, e l''ente ha la notifica; il rifiutato anche la sua',
    'approvata · approvata 1 · rifiutata 1',
    format('%s · approvata %s · rifiutata %s', v,
      (select count(*) from public.notifiche_studenti where student_id = '55555555-0000-0000-0000-0000000000e1' and tipo = 'newsletter_approvata'),
      (select count(*) from public.notifiche_studenti where student_id = '55555555-0000-0000-0000-0000000000e5' and tipo = 'newsletter_rifiutata')),
    v = 'approvata'
      and (select count(*) from public.notifiche_studenti where student_id = '55555555-0000-0000-0000-0000000000e1' and tipo = 'newsletter_approvata') = 1
      and (select count(*) from public.notifiche_studenti where student_id = '55555555-0000-0000-0000-0000000000e5' and tipo = 'newsletter_rifiutata') = 1;
end $$;

-- 10-11. Dopo l'approvazione: la data si sposta e resta approvata; una parola
-- cambiata torna in approvazione.
do $$
declare v text;
begin
  v := pg_temp.salva(4, (select id from nl where chiave = 'n4'), 'Newsletter 4', (select giorno from g where chiave = 'ott15'), true);
  insert into esiti select 10, 'spostata la data, il testo uguale: resta approvata', 'approvata', stato, stato = 'approvata'
    from public.newsletter_enti where id = (select id from nl where chiave = 'n4');
  v := pg_temp.salva(4, (select id from nl where chiave = 'n4'), 'Newsletter 4, con una parola in più', (select giorno from g where chiave = 'ott15'), false);
  insert into esiti select 11, 'cambiata una parola: si rilegge', 'in_approvazione', stato, stato = 'in_approvazione'
    from public.newsletter_enti where id = (select id from nl where chiave = 'n4');
end $$;

-- 12. Il client legge le sue, e non le scrive.
do $$
declare v_lette int; v text := 'scritta';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '55555555-0000-0000-0000-0000000000e1', true);
  select count(*) into v_lette from public.newsletter_enti;
  begin
    insert into public.newsletter_enti (istituzione_id, oggetto, corpo, giorno, ultimo_giorno)
    values ('dddddddd-0000-0000-0000-000000000001', 'x', 'x', current_date + 30, current_date + 30);
  exception when insufficient_privilege then v := 'negata';
  end;
  reset role;
  insert into esiti values (12, 'l''ente legge le sue (1) e non scrive la tabella', '1 · negata', v_lette || ' · ' || v,
    v_lette = 1 and v = 'negata');
end $$;

-- 13. Il cancello dell'età, e la notifica a tutti i destinatari il giorno stesso.
do $$
declare v_dest text; v_notif text;
begin
  perform public.prepara_newsletter_del_giorno((select giorno from g where chiave = 'ott'));
  select string_agg(p.nome, ',' order by p.nome) into v_dest
    from public.newsletter_consegne c join public.profiles p on p.id = c.student_id
   where c.newsletter_id = (select id from nl where chiave = 'n1');
  select count(*)::text into v_notif from public.notifiche_studenti
   where tipo = 'newsletter_ente' and student_id = '55555555-0000-0000-0000-0000000000c1';
  insert into esiti values (13, 'solo chi si è iscritto da maggiorenne; e la notifica per le due newsletter',
    'Magg · 2 · inviata', format('%s · %s · %s', v_dest, v_notif, (select stato from public.newsletter_enti where id = (select id from nl where chiave = 'n1'))),
    v_dest = 'Magg' and v_notif = '2' and (select stato from public.newsletter_enti where id = (select id from nl where chiave = 'n1')) = 'inviata');
end $$;

-- 14. Un evento approvato resta approvato, e avvisa l'ente.
do $$
declare v_id uuid;
begin
  insert into public.eventi (titolo, tipo, data_inizio, data_fine, organizzatore_id, stato, pubblico)
  values ('Evento Nl', 'webinar', now() + interval '20 days', now() + interval '20 days 1 hour',
          'dddddddd-0000-0000-0000-000000000001', 'in_approvazione', 'studenti')
  returning id into v_id;
  update public.eventi set stato = 'approvato' where id = v_id;
  insert into esiti select 14, 'evento approvato: notifica all''ente', 'approvato · 1',
    (select stato::text from public.eventi where id = v_id) || ' · ' ||
    (select count(*) from public.notifiche_studenti where student_id = '55555555-0000-0000-0000-0000000000e1' and tipo = 'evento_approvato' and riferimento_id = v_id),
    (select stato::text from public.eventi where id = v_id) = 'approvato'
      and (select count(*) from public.notifiche_studenti where student_id = '55555555-0000-0000-0000-0000000000e1' and tipo = 'evento_approvato' and riferimento_id = v_id) = 1;
end $$;

-- 15. L'uscita dalla posta: la pagina dice l'ente, il bottone toglie.
do $$
declare v_codice uuid; v_info text; v_esce boolean;
begin
  select codice_uscita into v_codice from public.newsletter_iscrizioni where student_id = '55555555-0000-0000-0000-0000000000c4';
  -- Le chiama solo il server, con la service role (la pagina e la route):
  -- un visitatore non le esegue dal client.
  set local role service_role;
  select ente_nome into v_info from public.uscita_newsletter_info(v_codice);
  v_esce := public.esci_newsletter_con_codice(v_codice);
  reset role;
  insert into esiti values (15, 'dal server, con il solo codice: il nome dell''ente, poi l''uscita; anon non le esegue',
    'Ente Nl 3 · true · false false', format('%s · %s · %s %s', v_info, v_esce,
      has_function_privilege('anon', 'public.esci_newsletter_con_codice(uuid)', 'execute'),
      has_function_privilege('authenticated', 'public.uscita_newsletter_info(uuid)', 'execute')),
    v_info = 'Ente Nl 3' and v_esce
      and not has_function_privilege('anon', 'public.esci_newsletter_con_codice(uuid)', 'execute')
      and not has_function_privilege('authenticated', 'public.uscita_newsletter_info(uuid)', 'execute'));
end $$;

-- 16-17. La coda: una email al giorno per studente; chi è uscito non la riceve.
-- ⚠️ (30/10) Le newsletter 1 e 2 hanno lo stesso giorno e sono state approvate
-- nella stessa transazione, cioè con la stessa `approvata_il`: la coda le
-- ordinava per l'uuid, a caso, e la 16 era verde un giorno e rossa l'altro. In
-- produzione due approvazioni sono due richieste, e non coincidono: qui la 1
-- si approva un minuto prima, scritto da postgres.
update public.newsletter_enti set approvata_il = approvata_il - interval '1 minute'
 where id = (select id from nl where chiave = 'n1');
do $$
declare v_primo text; v_secondo int; v_esce text;
begin
  select string_agg(email || '/' || oggetto, ',') into v_primo
    from public.newsletter_da_inviare((select giorno from g where chiave = 'ott'), 100);
  select count(*) into v_secondo from public.newsletter_da_inviare((select giorno from g where chiave = 'ott'), 100);
  select stato into v_esce from public.newsletter_consegne where student_id = '55555555-0000-0000-0000-0000000000c4';
  insert into esiti values (16, 'il primo giro: una email, la più vecchia; il secondo giro dello stesso giorno: niente',
    'magg@nl.test/Newsletter 1 · 0', v_primo || ' · ' || v_secondo, v_primo = 'magg@nl.test/Newsletter 1' and v_secondo = 0);
  insert into esiti values (17, 'chi è uscito: la sua consegna in coda è chiusa', 'scaduta', v_esce, v_esce = 'scaduta');
end $$;

-- 18-19. La scadenza: la seconda newsletter, saltati i suoi giorni, non parte
-- più; e com'è andata dice inviate e scadute, separate.
do $$
declare v_n int; v_es jsonb;
begin
  perform public.segna_consegna_newsletter((select c.id from public.newsletter_consegne c
    where c.newsletter_id = (select id from nl where chiave = 'n1') and c.student_id = '55555555-0000-0000-0000-0000000000c1'), true, null);
  select count(*) into v_n from public.newsletter_da_inviare((select giorno from g where chiave = 'ott') + 3, 100);
  -- Com'è andata la legge l'ente (qui come l'ente 2, poi l'1).
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '55555555-0000-0000-0000-0000000000e2', true);
  v_es := public.esito_newsletter((select id from nl where chiave = 'n2'));
  reset role;
  insert into esiti values (18, 'tre giorni dopo: la seconda è scaduta, niente da mandare', '0 · scadute 1',
    v_n || ' · scadute ' || (v_es ->> 'scadute'), v_n = 0 and (v_es ->> 'scadute')::int = 1);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '55555555-0000-0000-0000-0000000000e1', true);
  v_es := public.esito_newsletter((select id from nl where chiave = 'n1'));
  reset role;
  insert into esiti values (19, 'la prima: inviata a uno', 'destinatari 1 · inviate 1',
    format('destinatari %s · inviate %s', v_es ->> 'destinatari', v_es ->> 'inviate'),
    (v_es ->> 'destinatari')::int = 1 and (v_es ->> 'inviate')::int = 1);
end $$;

-- 20. La newsletter dentro KIREO: la legge chi l'ha ricevuta, non un altro.
do $$
declare v_mia int; v_altro int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '55555555-0000-0000-0000-0000000000c1', true);
  select count(*) into v_mia from public.newsletter_per_me((select id from nl where chiave = 'n1'));
  perform set_config('request.jwt.claim.sub', '55555555-0000-0000-0000-0000000000c2', true);
  select count(*) into v_altro from public.newsletter_per_me((select id from nl where chiave = 'n1'));
  reset role;
  insert into esiti values (20, 'la legge il destinatario (1), non il minorenne iscritto (0)', '1 · 0', v_mia || ' · ' || v_altro,
    v_mia = 1 and v_altro = 0);
end $$;

-- 21. Il motore non lo chiama il client.
insert into esiti select 21, 'prepara, coda e segna: solo service_role', 'false false false',
  format('%s %s %s',
    has_function_privilege('authenticated', 'public.prepara_newsletter_del_giorno(date)', 'execute'),
    has_function_privilege('authenticated', 'public.newsletter_da_inviare(date, integer)', 'execute'),
    has_function_privilege('anon', 'public.segna_consegna_newsletter(uuid, boolean, text)', 'execute')),
  not has_function_privilege('authenticated', 'public.prepara_newsletter_del_giorno(date)', 'execute')
    and not has_function_privilege('authenticated', 'public.newsletter_da_inviare(date, integer)', 'execute')
    and not has_function_privilege('anon', 'public.segna_consegna_newsletter(uuid, boolean, text)', 'execute');

-- 23. Com'è andata la sa l'ente che l'ha scritta, non un altro.
do $$
declare v jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '55555555-0000-0000-0000-0000000000e3', true);
  v := public.esito_newsletter((select id from nl where chiave = 'n1'));
  reset role;
  insert into esiti values (23, 'un altro ente non legge com''è andata', 'null', coalesce(v::text, 'null'), v is null);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte from esiti;

rollback;
