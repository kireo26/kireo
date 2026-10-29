-- Verifica di 20261102110000 (J1), 20261102120000 (J2) e 20261103100000
-- (Mario, 27/10): le statistiche dell'ente contano quello che dicono. Le 8-10
-- sono di 20261103100000 (i collegati, bozze e rifiutati fuori): rosse su una
-- replica nata senza.
--
-- I due casi visti a schermo su Davante:
--   - test7 iscritto a un evento, poi la guida scaricata: «Download guida: 0»;
--   - «0 iscritti · 1 partecipati» sulla stessa riga.
--
-- LA CONTROPROVA va fatta su repliche NATE SENZA: senza J1 e J2 sono rosse la
-- 2, 3, 5, 6 e 7 (la guida dopo l'evento non lascia riga, e gli iscritti non
-- contano i certificati); senza la sola J2 sono rosse la 2 e la 3 (il vecchio
-- vincolo scarta ancora la seconda riga). La 4 non la distingue nessuna delle
-- due: si prova rimettendo `count(*)` al posto di `count(distinct …)` nella
-- vista (misurato il 27/10: rossa la sola 4).
-- ⚠️ Dal 29/10 lo script chiama `registra_download_guida`: su una replica
-- nata senza 20261114100000 si ferma lì, quindi le controprove di J1 e J2 qui
-- sopra si rifanno solo su una replica che ha anche quella migrazione, con J1
-- o J2 tolte a mano.
--
-- Transazione con ROLLBACK. Le scritture sul recinto passano dalla sessione
-- dello studente, con lo stesso ON CONFLICT di `segnaNelRecinto`; dal 29/10
-- (20261114100000) la guida si scarica con `registra_download_guida`, come fa
-- la route, e la 3 conta gli scaricamenti, non il recinto.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000f1', 'ente-stat@test.it'),
  ('11111111-0000-0000-0000-0000000000f2', 'stud-stat-1@test.it'),
  ('11111111-0000-0000-0000-0000000000f3', 'stud-stat-2@test.it'),
  ('11111111-0000-0000-0000-0000000000f4', 'stud-stat-3@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000f1', 'istituzione', 'E', 'Stat', '1980-01-01'),
  ('11111111-0000-0000-0000-0000000000f2', 'studente', 'S', 'Uno', '2008-01-01'),
  ('11111111-0000-0000-0000-0000000000f3', 'studente', 'S', 'Due', '2008-01-01'),
  ('11111111-0000-0000-0000-0000000000f4', 'studente', 'S', 'Tre', '2008-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Ente Stat', 'ente-stat', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1');
insert into public.guide_enti (id, istituzione_id, titolo, pdf_url) values
  ('99999999-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'La guida', 'https://esempio.it/g.pdf');

-- Due eventi finiti dell'ente: A con un iscritto, un certificato e un assente;
-- B con un solo certificato e nessun «iscritto» (la riga del 25/10).
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', 'Evento A', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000f1', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti'),
  ('eeeeeeee-0000-0000-0000-0000000000f2', 'Evento B', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000f1', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti'),
  -- 20261103100000: una bozza, un rifiutato e un incontro in presenza.
  ('eeeeeeee-0000-0000-0000-0000000000f3', 'Evento bozza', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000f1', now() + interval '3 days', now() + interval '3 days 1 hour', 'bozza', 'studenti'),
  ('eeeeeeee-0000-0000-0000-0000000000f4', 'Evento rifiutato', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000f1', now() + interval '3 days', now() + interval '3 days 1 hour', 'rifiutato', 'studenti'),
  ('eeeeeeee-0000-0000-0000-0000000000f5', 'Incontro in aula', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000f1', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti');
insert into public.iscrizioni_eventi (evento_id, student_id, stato, ore_riconosciute) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-0000-0000-0000-0000000000f2', 'iscritto', null),
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-0000-0000-0000-0000000000f3', 'partecipato', 1),
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-0000-0000-0000-0000000000f4', 'assente', null),
  ('eeeeeeee-0000-0000-0000-0000000000f2', '11111111-0000-0000-0000-0000000000f3', 'partecipato', 1);

-- Sull'evento A si sono collegati in due: il certificato e quello rimasto
-- iscritto (sotto la soglia). L'assente no. È il numero che «partecipati» non
-- diceva.
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-0000-0000-0000-0000000000f2', 4),
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-0000-0000-0000-0000000000f3', 50);

-- Lo studente 1 si iscrive a un evento (origine evento), POI scarica la guida
-- (origine guida), POI la riscarica. È il gesto di test7 su Davante.
do $$
declare
  v_righe integer;
  v_seconda boolean := true;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000f2', true);
  insert into public.recinto_enti (student_id, istituzione_id, origine)
    values ('11111111-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'evento')
    on conflict do nothing;
  begin
    perform public.registra_download_guida('99999999-0000-0000-0000-0000000000f1');
    perform public.registra_download_guida('99999999-0000-0000-0000-0000000000f1');
  exception when others then
    v_seconda := false;
  end;
  reset role;
  select count(*) into v_righe from public.recinto_enti
   where student_id = '11111111-0000-0000-0000-0000000000f2' and origine = 'guida';
  v_seconda := v_seconda and v_righe = 1;
  insert into esiti values (1, 'la prima traccia (l''iscrizione all''evento) si scrive', 'sì', 'sì', true);
  insert into esiti values (2, 'la guida scaricata DOPO l''evento lascia la sua riga', 'scritta: sì',
    'scritta: ' || case when v_seconda then 'sì' else 'no' end, v_seconda);
end $$;

-- Lo studente 2 scarica solo la guida.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000f3', true);
  perform public.registra_download_guida('99999999-0000-0000-0000-0000000000f1');
  reset role;
end $$;

-- I numeri, letti come li legge l'ente.
do $$
declare
  v_raggiunti bigint; v_download bigint;
  v_ia bigint; v_pa bigint; v_ib bigint; v_pb bigint; v_oltre bigint;
  v_presa jsonb; v_presin jsonb; v_nascosti bigint;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000f1', true);
  select studenti_nel_recinto, download_guida into v_raggiunti, v_download from public.stats_istituzione;
  select iscritti, partecipati into v_ia, v_pa from public.stats_eventi_istituzione where evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1';
  select iscritti, partecipati into v_ib, v_pb from public.stats_eventi_istituzione where evento_id = 'eeeeeeee-0000-0000-0000-0000000000f2';
  select count(*) into v_oltre from public.stats_eventi_istituzione where partecipati > iscritti;
  -- `to_jsonb(riga) -> 'presenti'`: null invece di un errore dove la colonna non c'è.
  select to_jsonb(s) -> 'presenti' into v_presa from public.stats_eventi_istituzione s where evento_id = 'eeeeeeee-0000-0000-0000-0000000000f1';
  select coalesce(to_jsonb(s) -> 'presenti', '"assente"'::jsonb) into v_presin from public.stats_eventi_istituzione s where evento_id = 'eeeeeeee-0000-0000-0000-0000000000f5';
  select count(*) into v_nascosti from public.stats_eventi_istituzione
    where evento_id in ('eeeeeeee-0000-0000-0000-0000000000f3', 'eeeeeeee-0000-0000-0000-0000000000f4');
  reset role;
  insert into esiti values (3, 'download guida: i due studenti che l''hanno scaricata, una volta sola ciascuno', '2', v_download::text, v_download = 2);
  insert into esiti values (4, 'studenti raggiunti: distinti, non una riga per gesto', '2', v_raggiunti::text, v_raggiunti = 2);
  insert into esiti values (5, 'evento A: iscritti conta ogni stato (iscritto, partecipato, assente)', '3 iscritti · 1 partecipati',
    format('%s iscritti · %s partecipati', v_ia, v_pa), v_ia = 3 and v_pa = 1);
  insert into esiti values (6, 'evento B, il caso del 25/10: un certificato è anche un iscritto', '1 iscritti · 1 partecipati',
    format('%s iscritti · %s partecipati', v_ib, v_pb), v_ib = 1 and v_pb = 1);
  insert into esiti values (7, 'nessuna riga dice più partecipati che iscritti', '0', v_oltre::text, v_oltre = 0);
  insert into esiti values (8, 'evento A: presenti = i collegati (2), non i certificati (1) né gli iscritti (3)', '2',
    coalesce(v_presa::text, 'null'), v_presa = '2'::jsonb);
  insert into esiti values (9, 'incontro in presenza: presenti è vuoto, non zero (la presenza la registra la scuola)', 'null',
    v_presin::text, v_presin = 'null'::jsonb);
  insert into esiti values (10, 'bozze e rifiutati non compaiono in «Per evento»', '0', v_nascosti::text, v_nascosti = 0);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
