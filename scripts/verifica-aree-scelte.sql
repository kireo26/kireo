-- LE AREE L'ENTE SE LE SCEGLIE, E KIREO LE TOGLIE (20261123100000, 20261123110000).
--
-- Gira in una transazione con ROLLBACK, nel SQL Editor così com'è.
--
-- Rosse attese su una replica nata senza 20261123110000: 1 (l'area nasce in
-- approvazione), 6, 7, 8, 9 (la revoca e l'avviso non ci sono), e di
-- conseguenza 4 e 5 (senza revoca la riga non è tolta: l'ente la cancella e la
-- reinserisce). Verdi nei due mondi: 2 (l'insert riesce anche con la policy
-- vecchia, che voleva lo stato di nascita di allora), 3 (un'area di un altro
-- ente), 10 (un'area scelta da sé si toglie).

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values
  ('ad000000-0000-0000-0000-0000000000c1', 'admin-aree@prova.it'),
  ('f1000000-0000-0000-0000-0000000000c1', 'ente-aree-scelte@prova.it');
insert into public.profiles(id, ruolo, nome, cognome) values
  ('ad000000-0000-0000-0000-0000000000c1', 'admin', 'A', 'Dmin'),
  ('f1000000-0000-0000-0000-0000000000c1', 'istituzione', 'E', 'Scelte');
insert into public.istituzioni(id, nome, slug, tipo, stato, piano_id) values
  ('e1000000-0000-0000-0000-0000000000c1', 'Ente Scelte', 'ente-scelte', 'its', 'attiva', (select id from public.piani where nome = 'free')),
  ('e2000000-0000-0000-0000-0000000000c2', 'Altro Ente', 'altro-ente-scelte', 'its', 'attiva', (select id from public.piani where nome = 'free'));
insert into public.institution_profiles(user_id, istituzione_id) values
  ('f1000000-0000-0000-0000-0000000000c1', 'e1000000-0000-0000-0000-0000000000c1');

set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000c1';

do $$ declare v text; begin
  insert into public.istituzioni_aree(istituzione_id, area_slug) values ('e1000000-0000-0000-0000-0000000000c1', 'informatica-digitale');
  select stato::text into v from public.istituzioni_aree where istituzione_id = 'e1000000-0000-0000-0000-0000000000c1' and area_slug = 'informatica-digitale';
  insert into esiti values (1, 'l''ente sceglie un''area, e vale subito', 'approvata', v = 'approvata', coalesce(v, 'null'));
exception when others then
  insert into esiti values (1, 'l''ente sceglie un''area, e vale subito', 'approvata', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.istituzioni_aree(istituzione_id, area_slug) values ('e1000000-0000-0000-0000-0000000000c1', 'comunicazione-media');
  insert into esiti values (2, 'l''ente sceglie una seconda area', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (2, 'l''ente sceglie una seconda area', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.istituzioni_aree(istituzione_id, area_slug) values ('e2000000-0000-0000-0000-0000000000c2', 'arte-design-moda');
  insert into esiti values (3, 'un ente non sceglie un''area per un altro', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (3, 'un ente non sceglie un''area per un altro', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- La revoca: l'ente prova a farla da sé, poi l'admin senza motivo, poi l'admin.
do $$ begin
  perform public.revoca_area_ente('e1000000-0000-0000-0000-0000000000c1', 'comunicazione-media', 'Me la tolgo da solo');
  insert into esiti values (6, 'l''ente non esegue una revoca', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (6, 'l''ente non esegue una revoca', 'RESPINTO', sqlerrm like '%non_autorizzato%', 'respinto: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = 'ad000000-0000-0000-0000-0000000000c1';
do $$ begin
  perform public.revoca_area_ente('e1000000-0000-0000-0000-0000000000c1', 'comunicazione-media', '   ');
  insert into esiti values (7, 'una revoca senza motivo non si fa', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (7, 'una revoca senza motivo non si fa', 'RESPINTO', sqlerrm like '%motivo_mancante%', 'respinto: ' || sqlerrm);
end $$;

do $$ declare v record; n int; begin
  perform public.revoca_area_ente('e1000000-0000-0000-0000-0000000000c1', 'comunicazione-media', 'L''ente non forma in quest''area');
  reset role;
  select stato::text as stato, revocata_da, motivo_revoca into v from public.istituzioni_aree
   where istituzione_id = 'e1000000-0000-0000-0000-0000000000c1' and area_slug = 'comunicazione-media';
  select count(*) into n from public.notifiche_studenti where student_id = 'f1000000-0000-0000-0000-0000000000c1' and tipo = 'area_revocata';
  insert into esiti values (8, 'l''admin toglie un''area con il motivo, e resta scritto chi', 'rifiutata, admin, motivo',
    v.stato = 'rifiutata' and v.revocata_da = 'ad000000-0000-0000-0000-0000000000c1' and v.motivo_revoca like 'L''ente non forma%',
    v.stato || ' · ' || coalesce(v.revocata_da::text, 'null'));
  insert into esiti values (9, 'l''ente riceve l''avviso dentro KIREO', '1 notifica', n = 1, n::text);
exception when others then
  insert into esiti values (8, 'l''admin toglie un''area con il motivo, e resta scritto chi', 'rifiutata, admin, motivo', false, 'errore: ' || sqlerrm);
  insert into esiti values (9, 'l''ente riceve l''avviso dentro KIREO', '1 notifica', false, 'nessuna revoca: ' || sqlerrm);
end $$;

-- Una revoca non si aggira dal profilo: l'ente non cancella la riga tolta, e
-- non la reinserisce.
set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000c1';
do $$ declare n int; begin
  delete from public.istituzioni_aree where istituzione_id = 'e1000000-0000-0000-0000-0000000000c1' and area_slug = 'comunicazione-media';
  get diagnostics n = row_count;
  insert into esiti values (4, 'l''ente non cancella un''area che KIREO gli ha tolto', '0 righe', n = 0, n::text || ' righe');
exception when others then
  insert into esiti values (4, 'l''ente non cancella un''area che KIREO gli ha tolto', '0 righe', true, 'respinto: ' || sqlerrm);
end $$;
do $$ begin
  insert into public.istituzioni_aree(istituzione_id, area_slug) values ('e1000000-0000-0000-0000-0000000000c1', 'comunicazione-media');
  insert into esiti values (5, 'e non la riprende reinserendola', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (5, 'e non la riprende reinserendola', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

do $$ declare n int; begin
  delete from public.istituzioni_aree where istituzione_id = 'e1000000-0000-0000-0000-0000000000c1' and area_slug = 'informatica-digitale';
  get diagnostics n = row_count;
  insert into esiti values (10, 'un''area scelta da sé l''ente la toglie da sé', '1 riga', n = 1, n::text || ' righe');
exception when others then
  insert into esiti values (10, 'un''area scelta da sé l''ente la toglie da sé', '1 riga', false, 'errore: ' || sqlerrm);
end $$;

reset role;
select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
