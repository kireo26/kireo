-- LE REGISTRAZIONI SALVATE (20261124100000).
--
-- Gira in una transazione con ROLLBACK, nel SQL Editor così com'è.
--
-- La riga è divisa in due: l'identità (titolo, ente, data, video) si copia al
-- gesto; dove si guarda si legge dall'evento ogni volta. Salvare non scrive
-- presenze, ore né activity_log. Il client legge e cancella le sue righe, e non
-- le scrive.
--
-- Rosse attese su una replica nata senza 20261124100000: tutte (la tabella e le
-- funzioni non ci sono), tranne nessuna: ogni proprietà nomina un oggetto suo.

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values
  ('f2000000-0000-0000-0000-0000000000a1', 'ente-rs@prova.it'),
  ('f2000000-0000-0000-0000-0000000000a2', 'stud-rs@prova.it'),
  ('f2000000-0000-0000-0000-0000000000a3', 'stud2-rs@prova.it'),
  ('f2000000-0000-0000-0000-0000000000a4', 'doc-rs@prova.it');
insert into public.profiles(id, ruolo, nome, cognome) values
  ('f2000000-0000-0000-0000-0000000000a1', 'istituzione', 'E', 'Rs'),
  ('f2000000-0000-0000-0000-0000000000a2', 'studente', 'S', 'Rs'),
  ('f2000000-0000-0000-0000-0000000000a3', 'studente', 'T', 'Rs'),
  ('f2000000-0000-0000-0000-0000000000a4', 'docente', 'D', 'Rs');
insert into public.istituzioni(id, nome, slug, tipo, stato, piano_id) values
  ('e2000000-0000-0000-0000-0000000000a1', 'Ente Rs', 'ente-rs', 'its', 'attiva', (select id from public.piani where nome = 'free'));
insert into public.institution_profiles(user_id, istituzione_id) values ('f2000000-0000-0000-0000-0000000000a1', 'e2000000-0000-0000-0000-0000000000a1');

-- Quattro dirette: finita e vista (a1), finita con l'incorporamento spento (a2),
-- in corso (a3), finita con il video sparito (a4).
insert into public.eventi(id, titolo, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, hosting_diretta, youtube_video_id,
  checklist_diretta, checklist_diretta_accettata_il)
select v.id::uuid, v.titolo, 'webinar', 'e2000000-0000-0000-0000-0000000000a1', v.inizio, v.inizio + interval '1 hour', 'approvato', 'studenti', 'proprio', v.video,
  jsonb_build_object('non_in_elenco', now(), 'incorporamento_attivo', now(), 'chat_disattivata', now(), 'no_contenuti_terzi', now()), now()
from (values
  ('ac000000-0000-0000-0000-0000000000a1', 'Diretta vista', now() - interval '3 days', '5doxLWDlAJU'),
  ('ac000000-0000-0000-0000-0000000000a2', 'Diretta su YouTube', now() - interval '3 days', 'nyeZXqVZcWA'),
  ('ac000000-0000-0000-0000-0000000000a3', 'Diretta in corso', now() - interval '10 minutes', 'xHyJSZIkYAw'),
  ('ac000000-0000-0000-0000-0000000000a4', 'Diretta sparita', now() - interval '3 days', 'aaaaaaaaaaa')
) as v(id, titolo, inizio, video);
update public.eventi set registrazione_esito = 'disponibile', registrazione_sondata_il = now() where id in ('ac000000-0000-0000-0000-0000000000a1', 'ac000000-0000-0000-0000-0000000000a3');
update public.eventi set registrazione_esito = 'non_incorporabile', registrazione_sondata_il = now() where id = 'ac000000-0000-0000-0000-0000000000a2';
update public.eventi set registrazione_esito = 'non_trovata', registrazione_sondata_il = now() where id = 'ac000000-0000-0000-0000-0000000000a4';

create temp table prima as
select (select count(*) from public.iscrizioni_eventi) as iscrizioni,
       (select count(*) from public.presenze_live) as presenze,
       (select count(*) from public.activity_log) as attivita;
grant all on prima to anon, authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000a2';

do $$ declare r jsonb; v text; begin
  r := public.salva_registrazione('ac000000-0000-0000-0000-0000000000a1');
  select titolo_evento || ' · ' || ente_nome || ' · ' || video_id into v from public.registrazioni_salvate where evento_id = 'ac000000-0000-0000-0000-0000000000a1';
  insert into esiti values (1, 'lo studente salva una registrazione che si rivede in KIREO, e la riga copia titolo, ente e video', 'salvata',
    r ->> 'stato' = 'salvata' and v = 'Diretta vista · Ente Rs · 5doxLWDlAJU', (r ->> 'stato') || ' / ' || coalesce(v, 'nessuna riga'));
exception when others then
  insert into esiti values (1, 'lo studente salva una registrazione che si rivede in KIREO', 'salvata', false, 'errore: ' || sqlerrm);
end $$;

do $$ declare r jsonb; n int; begin
  r := public.salva_registrazione('ac000000-0000-0000-0000-0000000000a1');
  select count(*) into n from public.registrazioni_salvate where evento_id = 'ac000000-0000-0000-0000-0000000000a1';
  insert into esiti values (2, 'salvarla di nuovo dice «già salvata» e non fa una seconda riga', 'gia_salvata · 1',
    r ->> 'stato' = 'gia_salvata' and n = 1, (r ->> 'stato') || ' · ' || n);
exception when others then
  insert into esiti values (2, 'salvarla di nuovo', 'gia_salvata · 1', false, 'errore: ' || sqlerrm);
end $$;

do $$ declare r jsonb; begin
  r := public.salva_registrazione('ac000000-0000-0000-0000-0000000000a2');
  insert into esiti values (3, 'una registrazione con l''incorporamento spento si salva (si guarda su YouTube)', 'salvata', r ->> 'stato' = 'salvata', r ->> 'stato');
exception when others then
  insert into esiti values (3, 'una registrazione su YouTube si salva', 'salvata', false, 'errore: ' || sqlerrm);
end $$;

do $$ declare a text; b text; begin
  a := public.salva_registrazione('ac000000-0000-0000-0000-0000000000a3') ->> 'stato';
  b := public.salva_registrazione('ac000000-0000-0000-0000-0000000000a4') ->> 'stato';
  insert into esiti values (4, 'una diretta in corso e una col video sparito non si salvano', 'non_rivedibile · non_rivedibile',
    a = 'non_rivedibile' and b = 'non_rivedibile', a || ' · ' || b);
exception when others then
  insert into esiti values (4, 'in corso e sparita non si salvano', 'non_rivedibile', false, 'errore: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.registrazioni_salvate(student_id, evento_id, titolo_evento, ente_nome, data_evento, video_id)
  values ('f2000000-0000-0000-0000-0000000000a2', 'ac000000-0000-0000-0000-0000000000a3', 'Finta', 'Finto', now(), 'x');
  insert into esiti values (5, 'il client non scrive la tabella: la copia la fa il database', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (5, 'il client non scrive la tabella: la copia la fa il database', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- Dopo il gesto l'ente cambia il titolo e la sonda vede il video sparire: la
-- riga tiene il titolo di allora e legge l'esito di adesso.
reset role;
update public.eventi set titolo = 'Titolo cambiato dopo' where id = 'ac000000-0000-0000-0000-0000000000a1';
update public.eventi set registrazione_esito = 'non_trovata', registrazione_sondata_il = now() where id = 'ac000000-0000-0000-0000-0000000000a1';
delete from public.eventi where id = 'ac000000-0000-0000-0000-0000000000a2';
set local role authenticated;
set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000a2';

do $$ declare t text; e text; begin
  select titolo_evento, registrazione_esito into t, e from public.registrazioni_salvate_mie() where evento_id = 'ac000000-0000-0000-0000-0000000000a1';
  insert into esiti values (6, 'l''identità è quella del gesto, lo stato è quello di adesso', 'Diretta vista · non_trovata',
    t = 'Diretta vista' and e = 'non_trovata', coalesce(t, 'null') || ' · ' || coalesce(e, 'null'));
exception when others then
  insert into esiti values (6, 'identità copiata, stato letto', 'Diretta vista · non_trovata', false, 'errore: ' || sqlerrm);
end $$;

do $$ declare n int; t text; vis boolean; begin
  select count(*) into n from public.registrazioni_salvate_mie();
  select titolo_evento, evento_visibile into t, vis from public.registrazioni_salvate_mie() where evento_id is null;
  insert into esiti values (7, 'un evento cancellato lascia la riga, con il titolo copiato e «non visibile»', '2 · Diretta su YouTube · false',
    n = 2 and t = 'Diretta su YouTube' and vis = false, n || ' · ' || coalesce(t, 'null') || ' · ' || coalesce(vis::text, 'null'));
exception when others then
  insert into esiti values (7, 'un evento cancellato lascia la riga', '2 righe', false, 'errore: ' || sqlerrm);
end $$;

-- Un altro studente: non vede le righe del primo e non le cancella.
set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000a3';
do $$ declare n int; m int; begin
  select count(*) into n from public.registrazioni_salvate_mie();
  with d as (delete from public.registrazioni_salvate returning 1) select count(*) into m from d;
  insert into esiti values (8, 'un altro studente non legge né cancella le righe del primo', '0 · 0', n = 0 and m = 0, n || ' · ' || m);
exception when others then
  insert into esiti values (8, 'un altro studente', '0 · 0', false, 'errore: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000a4';
do $$ begin
  perform public.salva_registrazione('ac000000-0000-0000-0000-0000000000a3');
  insert into esiti values (9, 'chi non è uno studente non salva', 'solo_studenti', false, '*** PASSA ***');
exception when others then
  insert into esiti values (9, 'chi non è uno studente non salva', 'solo_studenti', sqlerrm like '%solo_studenti%', 'respinto: ' || sqlerrm);
end $$;

-- Lo studente toglie la sua: una riga.
set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000a2';
do $$ declare m int; begin
  with d as (delete from public.registrazioni_salvate where evento_id = 'ac000000-0000-0000-0000-0000000000a1' returning 1) select count(*) into m from d;
  insert into esiti values (10, 'lo studente toglie la propria, e il delete tocca una riga', '1', m = 1, m::text);
exception when others then
  insert into esiti values (10, 'lo studente toglie la propria', '1', false, 'errore: ' || sqlerrm);
end $$;

reset role;
do $$ declare p record; begin
  select * into p from prima;
  insert into esiti values (11, 'salvare non scrive iscrizioni, presenze né attività', 'invariati',
    p.iscrizioni = (select count(*) from public.iscrizioni_eventi)
    and p.presenze = (select count(*) from public.presenze_live)
    and p.attivita = (select count(*) from public.activity_log), 'iscrizioni ' || p.iscrizioni || ' → ' || (select count(*) from public.iscrizioni_eventi));
exception when others then
  insert into esiti values (11, 'salvare non scrive iscrizioni, presenze né attività', 'invariati', false, 'errore: ' || sqlerrm);
end $$;

do $$ begin
  insert into esiti values (12, 'chi non ha fatto l''accesso non salva e non legge', 'no · no',
    not has_function_privilege('anon', 'public.salva_registrazione(uuid)', 'execute')
    and not has_table_privilege('anon', 'public.registrazioni_salvate', 'SELECT'),
    has_function_privilege('anon', 'public.salva_registrazione(uuid)', 'execute')::text);
exception when others then
  insert into esiti values (12, 'chi non ha fatto l''accesso non salva', 'no', false, 'errore: ' || sqlerrm);
end $$;

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
