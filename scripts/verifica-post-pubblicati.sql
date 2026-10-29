-- I POST SI PUBBLICANO SUBITO, E KIREO PUÒ TOGLIERLI (20261113100000,
-- 20261113110000, 20261113120000).
--
-- Gira in una transazione con ROLLBACK, nel SQL Editor così com'è.
--
-- LA TABELLA DEI SOGGETTI (la regola del 28/10: prima di togliere un controllo
-- si guarda chi fermava). La policy di insert di prima faceva due lavori:
-- imporre `in_approvazione` e tenere `link_social` fuori dal piano free. Le
-- proprietà 1-7 sono i soggetti che possono arrivare a un insert: l'ente free,
-- l'ente a pagamento, un ente per un altro, lo studente, il docente, l'anonimo.
-- La 2 è quella che la riscrittura poteva portarsi via.
--
-- Rosse attese:
--   - su una replica nata senza 20261113110000 (e quindi senza la 120000):
--     1, 3 (l'insert pubblicato è respinto dalla policy di prima), 9, 11, 12, 15,
--     16, 17, 18, 19, 20, 21 (le funzioni, i trigger e le colonne non ci sono);
--   - su una replica nata senza la sola 20261113120000: 13, 14 (i motivi si
--     leggono dal client), 22 (l'admin aggiorna lo stato dal client).
-- Verdi nei due mondi: 2 (link_social da free: prima lo fermava la policy, ora
-- il trigger), 4, 5, 6, 7, 8, 10.

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values
  ('ad000000-0000-0000-0000-0000000000ad', 'admin@prova.it'),
  ('f1000000-0000-0000-0000-0000000000f1', 'free@prova.it'),
  ('f2000000-0000-0000-0000-0000000000f2', 'premium@prova.it'),
  ('5a000000-0000-0000-0000-00000000005a', 'studente@prova.it'),
  ('d0000000-0000-0000-0000-0000000000d0', 'docente@prova.it');
insert into public.profiles(id, ruolo, nome, cognome) values
  ('ad000000-0000-0000-0000-0000000000ad', 'admin', 'A', 'Dmin'),
  ('f1000000-0000-0000-0000-0000000000f1', 'istituzione', 'E', 'Free'),
  ('f2000000-0000-0000-0000-0000000000f2', 'istituzione', 'E', 'Premium'),
  ('5a000000-0000-0000-0000-00000000005a', 'studente', 'S', 'Tudente'),
  ('d0000000-0000-0000-0000-0000000000d0', 'docente', 'D', 'Ocente');
insert into public.istituzioni(id, nome, slug, tipo, stato, piano_id) values
  ('e1000000-0000-0000-0000-0000000000e1', 'Ente Free', 'ente-post-free', 'its', 'attiva', (select id from public.piani where nome = 'free')),
  ('e2000000-0000-0000-0000-0000000000e2', 'Ente Premium', 'ente-post-premium', 'its', 'attiva', (select id from public.piani where nome = 'premium'));
insert into public.institution_profiles(user_id, istituzione_id) values
  ('f1000000-0000-0000-0000-0000000000f1', 'e1000000-0000-0000-0000-0000000000e1'),
  ('f2000000-0000-0000-0000-0000000000f2', 'e2000000-0000-0000-0000-0000000000e2');
insert into public.seguiti(student_id, istituzione_id) values
  ('5a000000-0000-0000-0000-00000000005a', 'e1000000-0000-0000-0000-0000000000e1'),
  ('5a000000-0000-0000-0000-00000000005a', 'e2000000-0000-0000-0000-0000000000e2');

set local role authenticated;

-- ============ la tabella dei soggetti ============
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000f1';
do $$ declare r record; begin
  insert into public.post_enti(istituzione_id, tipo, corpo)
    values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Uno');
  insert into esiti values (1, 'l''ente free pubblica un post di testo, ed è subito visibile', 'pubblicato, visibile', true, 'riuscito');
exception when others then
  insert into esiti values (1, 'l''ente free pubblica un post di testo, ed è subito visibile', 'pubblicato, visibile', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, embed_url)
    values ('e1000000-0000-0000-0000-0000000000e1', 'link_social', 'Social', 'https://www.instagram.com/p/x');
  insert into esiti values (2, 'l''ente free NON pubblica un link_social (il secondo lavoro della policy di prima)', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (2, 'l''ente free NON pubblica un link_social (il secondo lavoro della policy di prima)', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo)
    values ('e2000000-0000-0000-0000-0000000000e2', 'testo', 'A nome di un altro');
  insert into esiti values (4, 'un ente non pubblica a nome di un altro', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (4, 'un ente non pubblica a nome di un altro', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, stato)
    values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'In coda', 'in_approvazione');
  insert into esiti values (8, 'l''ente non sceglie lo stato del proprio post', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (8, 'l''ente non sceglie lo stato del proprio post', 'RESPINTO', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, created_at)
    values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Di ieri', now() - interval '2 days');
  insert into esiti values (10, 'l''ente non sceglie la data di nascita del post (scavalcherebbe il tetto)', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (10, 'l''ente non sceglie la data di nascita del post (scavalcherebbe il tetto)', 'RESPINTO', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000f2';
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, embed_url)
    values ('e2000000-0000-0000-0000-0000000000e2', 'link_social', 'Social', 'https://www.instagram.com/p/x');
  insert into esiti values (3, 'l''ente a pagamento pubblica un link_social', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (3, 'l''ente a pagamento pubblica un link_social', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = '5a000000-0000-0000-0000-00000000005a';
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo) values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Studente');
  insert into esiti values (5, 'lo studente non pubblica un post', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (5, 'lo studente non pubblica un post', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-0000000000d0';
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo) values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Docente');
  insert into esiti values (6, 'il docente non pubblica un post', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (6, 'il docente non pubblica un post', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

reset role;
set local role anon;
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo) values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Anonimo');
  insert into esiti values (7, 'chi non ha fatto l''accesso non pubblica un post', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (7, 'chi non ha fatto l''accesso non pubblica un post', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;
reset role;

-- Il client non sceglie l'id di un post (non è concesso): gli id si leggono da
-- qui, per nome.
create temp table ids as
  select 1 as n, id from public.post_enti where corpo = 'Uno'
  union all select 2, id from public.post_enti where corpo = 'Social' and istituzione_id = 'e2000000-0000-0000-0000-0000000000e2';
grant select, insert on ids to anon, authenticated;

-- La 1 vista da fuori: stato, visibile e la data scritta dal database.
update esiti e set ok = e.ok and p.stato = 'pubblicato' and p.visibile
                     and p.visibile_dal between now() - interval '1 minute' and now() + interval '1 minute',
                   osservato = e.osservato || ' · ' || p.stato || ' · visibile ' || p.visibile || ' · dal ' || coalesce(p.visibile_dal::text, 'vuota')
  from (select to_jsonb(x) j from public.post_enti x where x.id = (select id from ids where n = 1)) q,
       lateral (select (q.j->>'stato') stato, coalesce((q.j->>'visibile')::boolean, false) visibile, (q.j->>'visibile_dal')::timestamptz visibile_dal) p
 where e.n = 1;

-- ============ il tetto: 3 nelle ultime 24 ore ============
set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000f1';
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo) values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Due');
  insert into public.post_enti(istituzione_id, tipo, corpo) values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Tre');
  insert into public.post_enti(istituzione_id, tipo, corpo) values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Quattro');
  insert into esiti values (9, 'il quarto post nelle 24 ore è respinto, con il suo nome', 'troppi_post_nelle_24_ore', false, '*** PASSA ***');
exception when others then
  insert into esiti values (9, 'il quarto post nelle 24 ore è respinto, con il suo nome', 'troppi_post_nelle_24_ore', sqlerrm = 'troppi_post_nelle_24_ore', 'respinto: ' || sqlerrm);
end $$;
reset role;
-- Due e Tre non ci sono (il blocco è tornato indietro tutto): li rifaccio, poi
-- il primo post invecchia di 25 ore, e il quarto passa.
set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000f1';
insert into public.post_enti(istituzione_id, tipo, corpo) values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Due');
insert into public.post_enti(istituzione_id, tipo, corpo) values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Tre');
reset role;
insert into ids select 3, id from public.post_enti where corpo = 'Tre';
update public.post_enti set created_at = now() - interval '25 hours' where id = (select id from ids where n = 1);
set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000f1';
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo) values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Quattro, dopo');
  insert into esiti values (11, 'un post di più di 24 ore fa non conta più', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (11, 'un post di più di 24 ore fa non conta più', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;
reset role;

-- ============ le notifiche ============
insert into esiti
select 12, 'pubblicare avvisa i follower dell''ente a pagamento, non quelli del free, e avvisa l''admin',
  'premium 1 · free 0 · admin 1',
  (select count(*) from public.notifiche_studenti where tipo = 'nuovo_post' and riferimento_id = (select id from ids where n = 2)) = 1
  and (select count(*) from public.notifiche_studenti where tipo = 'nuovo_post' and riferimento_id = (select id from ids where n = 3)) = 0
  and (select count(*) from public.notifiche_studenti where tipo::text = 'post_pubblicato' and riferimento_id = (select id from ids where n = 3)
       and student_id = 'ad000000-0000-0000-0000-0000000000ad') = 1,
  'premium ' || (select count(*) from public.notifiche_studenti where tipo = 'nuovo_post' and riferimento_id = (select id from ids where n = 2))
  || ' · free ' || (select count(*) from public.notifiche_studenti where tipo = 'nuovo_post' and riferimento_id = (select id from ids where n = 3))
  || ' · admin ' || (select count(*) from public.notifiche_studenti where tipo::text = 'post_pubblicato' and riferimento_id = (select id from ids where n = 3));

-- ============ i motivi non si leggono dal client ============
set local role anon;
do $$ declare t text; begin
  select motivo_rifiuto into t from public.post_enti limit 1;
  insert into esiti values (13, 'chi non ha fatto l''accesso non legge la colonna dei motivi del rifiuto', 'permesso negato', false, '*** LEGGE ***');
exception when others then
  insert into esiti values (13, 'chi non ha fatto l''accesso non legge la colonna dei motivi del rifiuto', 'permesso negato', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '5a000000-0000-0000-0000-00000000005a';
do $$ declare t text; begin
  select motivo_rimozione into t from public.post_enti limit 1;
  insert into esiti values (14, 'lo studente non legge la colonna dei motivi della rimozione', 'permesso negato', false, '*** LEGGE ***');
exception when others then
  insert into esiti values (14, 'lo studente non legge la colonna dei motivi della rimozione', 'permesso negato', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;

-- ============ togliere un post ============
do $$ begin
  perform public.togli_post((select id from ids where n = 2), 'Lo studente prova');
  insert into esiti values (15, 'lo studente e l''ente non tolgono un post', 'non_autorizzato', false, '*** PASSA ***');
exception when others then
  insert into esiti values (15, 'lo studente e l''ente non tolgono un post', 'non_autorizzato', sqlerrm = 'non_autorizzato', 'respinto: ' || sqlerrm);
end $$;
set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000f2';
do $$ begin
  perform public.togli_post((select id from ids where n = 2), 'L''ente prova');
  update esiti set ok = false, osservato = osservato || ' · l''ente: *** PASSA ***' where n = 15;
exception when others then
  update esiti set ok = ok and sqlerrm = 'non_autorizzato', osservato = osservato || ' · l''ente: ' || sqlerrm where n = 15;
end $$;

set local request.jwt.claim.sub = 'ad000000-0000-0000-0000-0000000000ad';
do $$ begin
  perform public.togli_post((select id from ids where n = 2), '   ');
  insert into esiti values (16, 'l''admin non toglie un post senza motivazione', 'motivo_mancante', false, '*** PASSA ***');
exception when others then
  insert into esiti values (16, 'l''admin non toglie un post senza motivazione', 'motivo_mancante', sqlerrm = 'motivo_mancante', 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  update public.post_enti set stato = 'approvato' where id = (select id from ids where n = 2);
  insert into esiti values (22, 'l''admin non cambia lo stato di un post dal client', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (22, 'l''admin non cambia lo stato di un post dal client', 'RESPINTO', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;

do $$ declare j jsonb; begin
  perform public.togli_post((select id from ids where n = 2), 'Il link porta a una promozione a tempo');
  insert into esiti values (17, 'l''admin toglie un post: tolto, con chi, quando e perché', 'tolto · admin · adesso', true, 'riuscito');
exception when others then
  insert into esiti values (17, 'l''admin toglie un post: tolto, con chi, quando e perché', 'tolto · admin · adesso', false, 'respinto: ' || sqlerrm);
end $$;
reset role;

update esiti e set
  ok = e.ok and (j->>'stato') = 'tolto' and (j->>'tolto_da') = 'ad000000-0000-0000-0000-0000000000ad'
       and (j->>'tolto_il')::timestamptz between now() - interval '1 minute' and now() + interval '1 minute'
       and (j->>'motivo_rimozione') = 'Il link porta a una promozione a tempo'
       and (select count(*) from public.notifiche_studenti where tipo::text = 'post_tolto' and student_id = 'f2000000-0000-0000-0000-0000000000f2'
            and riferimento_id = (select id from ids where n = 2)) = 1
       and (select count(*) from public.notifiche_studenti where tipo = 'nuovo_post' and riferimento_id = (select id from ids where n = 2)) = 1,
  osservato = e.osservato || ' · ' || coalesce(j->>'stato', '?') || ' · da ' || coalesce(j->>'tolto_da', 'nessuno')
    || ' · notifica all''ente ' || (select count(*) from public.notifiche_studenti where tipo::text = 'post_tolto' and riferimento_id = (select id from ids where n = 2))
    || ' · notifiche ai follower ancora lì ' || (select count(*) from public.notifiche_studenti where tipo = 'nuovo_post' and riferimento_id = (select id from ids where n = 2))
from (select to_jsonb(x) j from public.post_enti x where x.id = (select id from ids where n = 2)) q
where e.n = 17;

-- 18) il post tolto non lo vede lo studente; il motivo lo legge l'ente suo e
-- l'admin, non un altro ente
set local role authenticated;
set local request.jwt.claim.sub = '5a000000-0000-0000-0000-00000000005a';
do $$ declare v int; begin
  select count(*) into v from public.post_enti where id = (select id from ids where n = 2);
  insert into esiti values (18, 'lo studente non vede più il post tolto', '0 righe', v = 0, v || ' righe');
exception when others then
  insert into esiti values (18, 'lo studente non vede più il post tolto', '0 righe', false, 'respinto: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000f2';
do $$ declare m text; altro int; begin
  select motivo_rimozione into m from public.motivi_post_enti(array[(select id from ids where n = 2)]);
  insert into esiti values (19, 'il motivo lo legge l''ente del post (e non un altro ente)', 'il motivo · altro ente 0 righe',
    m = 'Il link porta a una promozione a tempo', coalesce(m, 'niente'));
exception when others then
  insert into esiti values (19, 'il motivo lo legge l''ente del post (e non un altro ente)', 'il motivo · altro ente 0 righe', false, 'respinto: ' || sqlerrm);
end $$;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000f1';
do $$ declare altro int; begin
  select count(*) into altro from public.motivi_post_enti(array[(select id from ids where n = 2)]);
  update esiti set ok = ok and altro = 0, osservato = osservato || ' · altro ente ' || altro || ' righe' where n = 19;
exception when others then
  update esiti set ok = false, osservato = osservato || ' · altro ente: ' || sqlerrm where n = 19;
end $$;
reset role;

-- 20) un post tolto non torna visibile, nemmeno dal SQL Editor
do $$ begin
  update public.post_enti set stato = 'pubblicato' where id = (select id from ids where n = 2);
  insert into esiti values (20, 'un post tolto non torna visibile', 'post_tolto_non_torna', false, '*** PASSA ***');
exception when others then
  insert into esiti values (20, 'un post tolto non torna visibile', 'post_tolto_non_torna', sqlerrm = 'post_tolto_non_torna', 'respinto: ' || sqlerrm);
end $$;

-- 21) dal SQL Editor senza autore si ferma; con l'autore scritto a mano passa.
-- Senza sessione davvero: la sessione dell'admin di sopra è ancora impostata
-- (il modo 9), e con lei l'autore lo darebbe lei.
set local request.jwt.claim.sub = '';
do $$ begin
  update public.post_enti set stato = 'tolto', motivo_rimozione = 'Dal SQL Editor' where id = (select id from ids where n = 3);
  insert into esiti values (21, 'dal SQL Editor un post si toglie solo dicendo chi', 'autore_rimozione_mancante, poi riuscito', false, '*** PASSA SENZA AUTORE ***');
exception when others then
  insert into esiti values (21, 'dal SQL Editor un post si toglie solo dicendo chi', 'autore_rimozione_mancante, poi riuscito', sqlerrm = 'autore_rimozione_mancante', 'senza autore: ' || sqlerrm);
end $$;
do $$ begin
  update public.post_enti set stato = 'tolto', motivo_rimozione = 'Dal SQL Editor', tolto_da = 'ad000000-0000-0000-0000-0000000000ad'
   where id = (select id from ids where n = 3);
  update esiti set osservato = osservato || ' · con autore: riuscito' where n = 21;
exception when others then
  update esiti set ok = false, osservato = osservato || ' · con autore: ' || sqlerrm where n = 21;
end $$;

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
