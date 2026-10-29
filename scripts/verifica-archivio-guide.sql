-- Verifica di 20261116100000 (29/10): lo scaricamento di una guida è un gesto
-- dello studente, e resta anche quando l'ente cancella o sostituisce la guida,
-- o smette di esistere. «L'ente fa quello che vuole con i suoi file. Il gesto
-- dello studente resta» (Mario).
--
-- Le proprietà che la cura può rompere stanno accanto a quelle della cura:
-- l'ente CANCELLA ancora la sua guida (4), il visitatore non la vede più (8),
-- chi cancella il proprio account cancella le proprie tracce (12).

-- Transazione con ROLLBACK. Ogni blocco rimette l'identità che usa.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('44444444-0000-0000-0000-0000000000e1', 'ente-archivio@test.it'),
  ('44444444-0000-0000-0000-0000000000c1', 'stud-archivio@test.it'),
  ('44444444-0000-0000-0000-0000000000c2', 'stud-altro-archivio@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('44444444-0000-0000-0000-0000000000e1', 'istituzione', 'E', 'Archivio', null),
  ('44444444-0000-0000-0000-0000000000c1', 'studente', 'S', 'Uno', '2008-01-01'),
  ('44444444-0000-0000-0000-0000000000c2', 'studente', 'S', 'Due', '2008-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('cccccccc-0000-0000-0000-0000000000e1', 'Ente Archivio', 'ente-archivio', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('44444444-0000-0000-0000-0000000000e1', 'cccccccc-0000-0000-0000-0000000000e1');
insert into public.guide_enti (id, istituzione_id, titolo, pdf_url, created_at) values
  ('88888888-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000e1', 'Programma eventi', 'https://esempio.it/a.pdf', '2026-10-12 10:00+02');

-- 1. Lo studente scarica: la riga porta titolo, ente e data della guida,
-- copiati in quel momento.
do $$
declare r record;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000c1', true);
  perform public.registra_download_guida('88888888-0000-0000-0000-000000000001');
  reset role;
  select titolo_guida, ente_nome, guida_caricata_il into r from public.scaricamenti_guide_enti
   where student_id = '44444444-0000-0000-0000-0000000000c1';
  insert into esiti values (1, 'la copia al momento del gesto', 'Programma eventi · Ente Archivio · 2026-10-12',
    format('%s · %s · %s', r.titolo_guida, r.ente_nome, (r.guida_caricata_il at time zone 'Europe/Rome')::date),
    r.titolo_guida = 'Programma eventi' and r.ente_nome = 'Ente Archivio'
      and (r.guida_caricata_il at time zone 'Europe/Rome')::date = '2026-10-12');
end $$;

-- 2. La copia non segue la guida: un titolo cambiato dopo non riscrive quello
-- che lo studente ha preso.
do $$
declare t text; v_arch text;
begin
  update public.guide_enti set titolo = 'Titolo cambiato dopo' where id = '88888888-0000-0000-0000-000000000001';
  select titolo_guida into t from public.scaricamenti_guide_enti where student_id = '44444444-0000-0000-0000-0000000000c1';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000c1', true);
  select g.stato || ' · ' || coalesce(g.pdf_url, '—') into v_arch from public.guide_enti_scaricate() g;
  reset role;
  update public.guide_enti set titolo = 'Programma eventi' where id = '88888888-0000-0000-0000-000000000001';
  insert into esiti values (2, 'il titolo resta quello scaricato; nell''archivio la guida è pubblica, col file',
    'Programma eventi · pubblica · https://esempio.it/a.pdf', format('%s · %s', t, v_arch),
    t = 'Programma eventi' and v_arch = 'pubblica · https://esempio.it/a.pdf');
end $$;

-- 3. L'ente carica una guida nuova: la vecchia va in archivio, e lo studente
-- vede quella che ha scaricato lui, archiviata, con il file.
do $$
declare v text;
begin
  insert into public.guide_enti (id, istituzione_id, titolo, pdf_url) values
    ('88888888-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-0000000000e1', 'Guida nuova', 'https://esempio.it/b.pdf');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000c1', true);
  select string_agg(g.titolo || ' · ' || g.stato || ' · ' || coalesce(g.pdf_url, '—'), ' | ') into v from public.guide_enti_scaricate() g;
  reset role;
  insert into esiti values (3, 'sostituita: lo studente vede la sua, archiviata, col file',
    'Programma eventi · archiviata · https://esempio.it/a.pdf', v,
    v = 'Programma eventi · archiviata · https://esempio.it/a.pdf');
end $$;

-- 4-6. L'ente cancella la guida (la policy resta: è un suo diritto). La riga
-- dello studente resta, l'archivio dice «cancellata» senza un file, e le
-- statistiche dell'ente contano ancora quello scaricamento.
do $$
declare v_canc int; v_righe int; v_arch text; v_stat jsonb; v_det jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000e1', true);
  delete from public.guide_enti where id = '88888888-0000-0000-0000-000000000001';
  get diagnostics v_canc = row_count;
  v_stat := public.statistiche_ente('cccccccc-0000-0000-0000-0000000000e1');
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000c1', true);
  select string_agg(g.titolo || ' · ' || g.ente_nome || ' · ' || g.stato || ' · ' || coalesce(g.pdf_url, '—'), ' | ')
    into v_arch from public.guide_enti_scaricate() g;
  reset role;
  select count(*) into v_righe from public.scaricamenti_guide_enti where student_id = '44444444-0000-0000-0000-0000000000c1';
  select d into v_det from jsonb_array_elements(v_stat -> 'guide' -> 'per_guida') d
   where d ->> 'guida_id' = '88888888-0000-0000-0000-000000000001';
  insert into esiti values (4, 'l''ente cancella la propria guida, e la riga dello studente resta', '1 · 1',
    format('%s · %s', v_canc, v_righe), v_canc = 1 and v_righe = 1);
  insert into esiti values (5, 'nell''archivio: titolo ed ente, cancellata, nessun file',
    'Programma eventi · Ente Archivio · cancellata · —', v_arch,
    v_arch = 'Programma eventi · Ente Archivio · cancellata · —');
  insert into esiti values (6, 'le statistiche dell''ente: la guida cancellata resta nel conto',
    'cancellata true · scaricamenti 1 · studenti 1 · in tutto 1',
    format('cancellata %s · scaricamenti %s · studenti %s · in tutto %s',
      v_det ->> 'cancellata', v_det ->> 'scaricamenti', v_det ->> 'studenti', v_stat -> 'guide' ->> 'scaricamenti'),
    (v_det ->> 'cancellata')::boolean and (v_det ->> 'scaricamenti')::int = 1 and (v_det ->> 'studenti')::int = 1
      and (v_stat -> 'guide' ->> 'scaricamenti')::int = 1);
end $$;

-- 7-8. L'ente non è più attivo: la sua guida esce dalla pagina pubblica, e
-- resta nell'archivio di chi l'ha scaricata, col file.
do $$
declare v_arch text; v_pubblico int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000c1', true);
  perform public.registra_download_guida('88888888-0000-0000-0000-000000000002');
  reset role;
  -- Come dal SQL Editor: senza sessione (il trigger dello stato lo consente).
  perform set_config('request.jwt.claim.sub', '', true);
  update public.istituzioni set stato = 'sospesa' where id = 'cccccccc-0000-0000-0000-0000000000e1';
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  select count(*) into v_pubblico from public.guide_enti where id = '88888888-0000-0000-0000-000000000002';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000c1', true);
  select g.stato || ' · ' || coalesce(g.pdf_url, '—') into v_arch from public.guide_enti_scaricate() g
   where g.guida_id = '88888888-0000-0000-0000-000000000002';
  reset role;
  insert into esiti values (7, 'ente sospeso: nell''archivio di chi l''ha scaricata, col file',
    'archiviata · https://esempio.it/b.pdf', v_arch, v_arch = 'archiviata · https://esempio.it/b.pdf');
  insert into esiti values (8, 'ente sospeso: il visitatore non vede più la guida', '0',
    v_pubblico::text, v_pubblico = 0);
end $$;

-- 9. Le righe sono di chi le ha: un altro studente non vede niente.
do $$
declare v int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000c2', true);
  select count(*) into v from public.guide_enti_scaricate();
  reset role;
  insert into esiti values (9, 'un altro studente: nessuna riga', '0', v::text, v = 0);
end $$;

-- 10. Un visitatore non esegue la funzione.
do $$
declare v text := 'eseguita';
begin
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.guide_enti_scaricate();
  exception when insufficient_privilege then v := 'negata';
  end;
  reset role;
  insert into esiti values (10, 'un visitatore non esegue guide_enti_scaricate', 'negata', v, v = 'negata');
end $$;

-- 11. L'ente sparisce: le righe dello studente restano, tutte e due
-- cancellate, con il nome dell'ente di quel momento.
do $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  delete from public.institution_profiles where istituzione_id = 'cccccccc-0000-0000-0000-0000000000e1';
  delete from public.istituzioni where id = 'cccccccc-0000-0000-0000-0000000000e1';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-0000-0000-0000-0000000000c1', true);
  select string_agg(g.ente_nome || ' · ' || g.stato, ' | ' order by g.titolo) into v from public.guide_enti_scaricate() g;
  reset role;
  insert into esiti values (11, 'l''ente non c''è più: le due righe restano',
    'Ente Archivio · cancellata | Ente Archivio · cancellata', v,
    v = 'Ente Archivio · cancellata | Ente Archivio · cancellata');
end $$;

-- 12. Chi cancella il proprio account cancella le proprie tracce: la cascata
-- da profiles resta.
do $$
declare v int;
begin
  delete from public.profiles where id = '44444444-0000-0000-0000-0000000000c1';
  select count(*) into v from public.scaricamenti_guide_enti where student_id = '44444444-0000-0000-0000-0000000000c1';
  insert into esiti values (12, 'l''account cancellato porta via le sue righe', '0', v::text, v = 0);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
