-- IL LINK SU QUALSIASI POST, IL FILE ALLEGATO, «SALVA» (20261119100000,
-- 20261119110000, 20261120100000: la scheda del link è uscita il 30/10).
--
-- Gira in una transazione con ROLLBACK, nel SQL Editor così com'è.
--
-- Le controprove, fatte il 30/10 su una replica ricostruita ogni volta, con le
-- rosse dichiarate prima (`scripts/controprova-sql.sh`), tutte RIUSCITE:
--   - il trigger del piano rimesso: 1, 3, 4, 8, 9, 13, 20, 21. La 4 non l'avevo
--     prevista: il link fuori piattaforma di un ente free lo ferma il piano e
--     non il vincolo, e la 4 guarda la ragione (23514). Le altre seguono dalla
--     1 (il post salvato non c'è);
--   - il trigger della scheda tolto: 2;
--   - `post_salvati_miei` senza il filtro su chi chiede: 12;
--   - `registra_download_allegato` che scrive la traccia per chiunque: 17;
--   - `interessati_ente` che ignora `copre_contenuti`: 20.
-- Su una replica nata senza le due migrazioni lo script non è pensato per
-- girare: la 19 chiede il privilegio di funzioni che non esistono.

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;
create temp table ids(n int, id uuid);
grant all on ids to anon, authenticated;

insert into auth.users(id, email) values
  ('ad000000-0000-0000-0000-0000000000ad', 'admin@prova.it'),
  ('f1000000-0000-0000-0000-0000000000f1', 'free@prova.it'),
  ('f2000000-0000-0000-0000-0000000000f2', 'altro@prova.it'),
  ('5a000000-0000-0000-0000-00000000005a', 'studente@prova.it'),
  ('5b000000-0000-0000-0000-00000000005b', 'studente2@prova.it'),
  ('d0000000-0000-0000-0000-0000000000d0', 'docente@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita) values
  ('ad000000-0000-0000-0000-0000000000ad', 'admin', 'A', 'Dmin', null),
  ('f1000000-0000-0000-0000-0000000000f1', 'istituzione', 'E', 'Free', null),
  ('f2000000-0000-0000-0000-0000000000f2', 'istituzione', 'E', 'Altro', null),
  ('5a000000-0000-0000-0000-00000000005a', 'studente', 'S', 'Uno', '2008-01-01'),
  ('5b000000-0000-0000-0000-00000000005b', 'studente', 'S', 'Due', '2008-01-01'),
  ('d0000000-0000-0000-0000-0000000000d0', 'docente', 'D', 'Ocente', null);
insert into public.istituzioni(id, nome, slug, tipo, stato, piano_id) values
  ('e1000000-0000-0000-0000-0000000000e1', 'Ente Free', 'ente-contenuti-free', 'its', 'attiva', (select id from public.piani where nome = 'free')),
  ('e2000000-0000-0000-0000-0000000000e2', 'Ente Premium', 'ente-contenuti-altro', 'its', 'attiva', (select id from public.piani where nome = 'premium'));
insert into public.institution_profiles(user_id, istituzione_id) values
  ('f1000000-0000-0000-0000-0000000000f1', 'e1000000-0000-0000-0000-0000000000e1'),
  ('f2000000-0000-0000-0000-0000000000f2', 'e2000000-0000-0000-0000-0000000000e2');

set local role authenticated;

-- ============ il link, da un ente free (20261120100000) ============
-- Il tipo link_social è uscito: resta un link facoltativo su qualsiasi post.
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000f1';
do $$ declare v uuid; begin
  insert into public.post_enti(istituzione_id, tipo, corpo, link_esterno)
    values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Il nostro open day', 'https://www.ente-free.it/open-day')
    returning id into v;
  insert into ids values (1, v);
  insert into esiti values (1, 'un ente FREE pubblica un testo con il link al suo sito (il piano non conta)', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (1, 'un ente FREE pubblica un testo con il link al suo sito (il piano non conta)', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, link_esterno)
    values ('e1000000-0000-0000-0000-0000000000e1', 'link_social', 'Il tipo uscito', 'https://www.tiktok.com/@ente');
  -- Se passa, si annulla: un post in più farebbe scattare il tetto (il modo 9).
  raise exception 'passa_e_si_annulla';
exception when others then
  insert into esiti values (2, 'un post NUOVO di tipo link_social è respinto dal database, non solo dal form', 'RESPINTO (23514)', sqlstate = '23514',
    case when sqlerrm = 'passa_e_si_annulla' then '*** PASSA ***' else 'respinto: ' || sqlerrm end);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, immagine_url, link_esterno)
    values ('e1000000-0000-0000-0000-0000000000e1', 'immagine', 'Su Instagram', 'https://x.supabase.co/storage/v1/object/public/post-enti-media/e1/b.png',
            'https://www.instagram.com/p/abc/');
  insert into esiti values (3, 'un''immagine con il link a un post di Instagram si pubblica', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (3, 'un''immagine con il link a un post di Instagram si pubblica', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

-- Tre link che non sono https: ognuno deve essere respinto dal vincolo (23514).
do $$ declare v_url text; v_passati text := ''; v_altro text := ''; begin
  foreach v_url in array array['http://www.ente-free.it', 'javascript:alert(1)', 'data:text/html,x', 'https://ente', 'https://ente.it/con spazio'] loop
    begin
      insert into public.post_enti(istituzione_id, tipo, corpo, link_esterno)
        values ('e1000000-0000-0000-0000-0000000000e1', 'testo', 'Fuori', v_url);
      v_passati := v_passati || ' ' || v_url;
      raise exception 'passa_e_si_annulla';
    exception when others then
      if sqlerrm <> 'passa_e_si_annulla' and sqlstate <> '23514' then v_altro := v_altro || ' ' || sqlstate; end if;
    end;
  end loop;
  insert into esiti values (4, 'un link non https (http, javascript:, data:), senza un host vero o con uno spazio è respinto', 'tutti respinti (23514)',
    v_passati = '' and v_altro = '',
    case when v_passati = '' and v_altro = '' then 'tutti respinti' else 'passati:' || v_passati || ' · altro:' || v_altro end);
end $$;

-- ============ il file ============
do $$ declare v uuid; begin
  insert into public.post_enti(istituzione_id, tipo, corpo, allegato_percorso, allegato_nome)
    values ('e1000000-0000-0000-0000-0000000000e1', 'file', 'Il programma', 'e1000000-0000-0000-0000-0000000000e1/post/programma.pdf', 'Programma 2027.pdf')
    returning id into v;
  insert into ids values (5, v);
  insert into esiti values (5, 'un ente pubblica un PDF dalla propria cartella', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (5, 'un ente pubblica un PDF dalla propria cartella', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

-- Il tetto è di 3 post nelle 24 ore, e qui l'ente ne ha già tre: la 6 deve
-- arrivare al vincolo, quindi la si prova su un altro ente.
set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000f2';
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, allegato_percorso, allegato_nome)
    values ('e2000000-0000-0000-0000-0000000000e2', 'file', 'Di un altro', 'e1000000-0000-0000-0000-0000000000e1/post/programma.pdf', 'Programma.pdf');
  insert into esiti values (6, 'un ente non pubblica un file dalla cartella di un altro', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (6, 'un ente non pubblica un file dalla cartella di un altro', 'RESPINTO', sqlstate = '23514', 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, allegato_percorso, allegato_nome)
    values ('e2000000-0000-0000-0000-0000000000e2', 'testo', 'Testo con file', 'e2000000-0000-0000-0000-0000000000e2/post/x.pdf', 'x.pdf');
  insert into esiti values (7, 'un post di testo non porta un file', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (7, 'un post di testo non porta un file', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

do $$ declare v uuid; begin
  insert into public.post_enti(istituzione_id, tipo, corpo)
    values ('e2000000-0000-0000-0000-0000000000e2', 'testo', 'Un post di un altro ente')
    returning id into v;
  insert into ids values (99, v);
end $$;

-- ============ «salva» ============
set local request.jwt.claim.sub = '5a000000-0000-0000-0000-00000000005a';
do $$ declare r jsonb; v int; c text; begin
  r := public.salva_post((select id from ids where n = 1));
  select count(*), max(corpo || ' · ' || ente_nome || ' · ' || coalesce(link_esterno, '-')) into v, c from public.post_salvati;
  insert into esiti values (8, 'lo studente salva un post, e la copia la fa il database, link compreso', 'salvato, una riga con testo, ente e link',
    r ->> 'stato' = 'salvato' and v = 1 and c = 'Il nostro open day · Ente Free · https://www.ente-free.it/open-day', r::text || ' · righe ' || v || ' · ' || coalesce(c, '-'));
exception when others then
  insert into esiti values (8, 'lo studente salva un post, e la copia la fa il database, link compreso', 'salvato, una riga con testo, ente e link', false, 'errore: ' || sqlerrm);
end $$;

do $$ declare r jsonb; v int; begin
  r := public.salva_post((select id from ids where n = 1));
  select count(*) into v from public.post_salvati;
  insert into esiti values (9, 'salvare due volte non fa due righe, e lo dice', 'gia_salvato, una riga', r ->> 'stato' = 'gia_salvato' and v = 1, r::text || ' · righe ' || v);
end $$;

do $$ begin
  insert into public.post_salvati(student_id, ente_nome, tipo, corpo) values ('5a000000-0000-0000-0000-00000000005a', 'Falso', 'testo', 'Inventato');
  insert into esiti values (11, 'lo studente non scrive un salvataggio da sé', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (11, 'lo studente non scrive un salvataggio da sé', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- Salva anche il post dell'altro ente e il file: servono alla 20 e alla 21.
do $$ begin
  perform public.salva_post((select id from ids where n = 99));
  perform public.salva_post((select id from ids where n = 5));
end $$;

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-0000000000d0';
do $$ begin
  perform public.salva_post((select id from ids where n = 1));
  insert into esiti values (10, 'un docente non salva un post (il gesto è dello studente)', 'solo_studenti', false, '*** PASSA ***');
exception when others then
  insert into esiti values (10, 'un docente non salva un post (il gesto è dello studente)', 'solo_studenti', sqlerrm = 'solo_studenti', 'respinto: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = '5b000000-0000-0000-0000-00000000005b';
do $$ declare v int; w int; begin
  select count(*) into v from public.post_salvati_miei();
  select count(*) into w from public.post_salvati;
  insert into esiti values (12, 'un altro studente non vede i salvataggi del primo', '0 e 0', v = 0 and w = 0, v || ' dalla funzione, ' || w || ' dalla tabella');
end $$;

-- ============ il file scaricato ============
set local request.jwt.claim.sub = '5a000000-0000-0000-0000-00000000005a';
do $$ declare r jsonb; r2 jsonb; v int; c text; begin
  r := public.registra_download_allegato((select id from ids where n = 5));
  r2 := public.registra_download_allegato((select id from ids where n = 5));
  select count(*), max(allegato_nome || ' · ' || ente_nome) into v, c from public.scaricamenti_allegati_post;
  insert into esiti values (16, 'lo studente scarica il file: la traccia si scrive prima, una volta sola, e il percorso è quello del post',
    'ok, una riga copiata, il percorso',
    r ->> 'stato' = 'ok' and r ->> 'percorso' = 'e1000000-0000-0000-0000-0000000000e1/post/programma.pdf' and r2 ->> 'stato' = 'ok' and v = 1 and c = 'Programma 2027.pdf · Ente Free',
    r::text || ' · righe ' || v || ' · ' || coalesce(c, '-'));
exception when others then
  insert into esiti values (16, 'lo studente scarica il file: la traccia si scrive prima, una volta sola, e il percorso è quello del post', 'ok, una riga copiata, il percorso', false, 'errore: ' || sqlerrm);
end $$;

do $$ declare r jsonb; begin
  r := public.registra_download_allegato((select id from ids where n = 1));
  insert into esiti values (18, 'un post che non è un file non dà un percorso', 'non_disponibile', r ->> 'stato' = 'non_disponibile', r::text);
end $$;

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000f1';
do $$ declare r jsonb; v int; begin
  r := public.registra_download_allegato((select id from ids where n = 5));
  reset role;
  select count(*) into v from public.scaricamenti_allegati_post where student_id = 'f1000000-0000-0000-0000-0000000000f1';
  set local role authenticated;
  insert into esiti values (17, 'l''ente che apre il proprio file non lascia una traccia', 'ok, 0 righe sue', r ->> 'stato' = 'ok' and v = 0, r::text || ' · righe ' || v);
end $$;

-- ============ chi esegue le funzioni ============
reset role;
insert into esiti values (19, 'un visitatore non esegue salva_post né registra_download_allegato', 'false, false',
  not has_function_privilege('anon', 'public.salva_post(uuid)', 'execute') and not has_function_privilege('anon', 'public.registra_download_allegato(uuid)', 'execute'),
  has_function_privilege('anon', 'public.salva_post(uuid)', 'execute')::text || ', ' || has_function_privilege('anon', 'public.registra_download_allegato(uuid)', 'execute')::text);

-- ============ il consenso degli Interessati ============
-- Due condivisioni con l'ente free: una «di prima» (copre_contenuti false,
-- come le righe esistenti all'applicazione) e una nuova. Il piano lo cambia il
-- SQL Editor: senza sessione, o il trigger degli enti lo rifiuta (il modo 9).
set local request.jwt.claim.sub = '';
insert into public.manifestazioni_interesse(student_id, istituzione_id, copre_contenuti)
  values ('5b000000-0000-0000-0000-00000000005b', 'e1000000-0000-0000-0000-0000000000e1', false);
insert into public.manifestazioni_interesse(student_id, istituzione_id)
  values ('5a000000-0000-0000-0000-00000000005a', 'e1000000-0000-0000-0000-0000000000e1');
update public.istituzioni set piano_id = (select id from public.piani where nome = 'premium') where id = 'e1000000-0000-0000-0000-0000000000e1';

set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000f1';
do $$ declare nuovo record; vecchio record; begin
  select * into nuovo from public.interessati_ente('e1000000-0000-0000-0000-0000000000e1') where student_id = '5a000000-0000-0000-0000-00000000005a';
  select * into vecchio from public.interessati_ente('e1000000-0000-0000-0000-0000000000e1') where student_id = '5b000000-0000-0000-0000-00000000005b';
  insert into esiti values (20, 'l''ente vede i salvataggi solo di chi ha condiviso col pannello nuovo, e solo i suoi', 'nuovo 2 post e 1 file · di prima null',
    nuovo.post_salvati = 2 and nuovo.allegati_scaricati = 1 and vecchio.post_salvati is null and vecchio.allegati_scaricati is null,
    'nuovo ' || coalesce(nuovo.post_salvati::text, 'null') || '/' || coalesce(nuovo.allegati_scaricati::text, 'null')
    || ' · di prima ' || coalesce(vecchio.post_salvati::text, 'null') || '/' || coalesce(vecchio.allegati_scaricati::text, 'null'));
exception when others then
  insert into esiti values (20, 'l''ente vede i salvataggi solo di chi ha condiviso col pannello nuovo, e solo i suoi', 'nuovo 2 post e 1 file · di prima null', false, 'errore: ' || sqlerrm);
end $$;

do $$ declare s jsonb; begin
  s := public.scheda_interessato_ente('e1000000-0000-0000-0000-0000000000e1', '5a000000-0000-0000-0000-00000000005a');
  insert into esiti values (21, 'nella scheda i post salvati sono solo quelli dell''ente che chiede', '2, nessuno dell''altro ente',
    jsonb_array_length(s -> 'post_salvati') = 2 and (s -> 'post_salvati')::text not like '%di un altro ente%',
    coalesce((s -> 'post_salvati')::text, 'null'));
exception when others then
  insert into esiti values (21, 'nella scheda i post salvati sono solo quelli dell''ente che chiede', '2, nessuno dell''altro ente', false, 'errore: ' || sqlerrm);
end $$;

-- ============ il post che esce dal flusso resta nell'archivio ============
set local request.jwt.claim.sub = 'ad000000-0000-0000-0000-0000000000ad';
do $$ begin
  perform public.togli_post((select id from ids where n = 1), 'Prova');
exception when others then
  -- Senza il post della 1 non c'è niente da togliere: la 13 lo dirà.
  null;
end $$;
set local request.jwt.claim.sub = '5a000000-0000-0000-0000-00000000005a';
do $$ declare r record; begin
  select * into r from public.post_salvati_miei() where post_id = (select id from ids where n = 1);
  insert into esiti values (13, 'un post salvato e poi tolto resta, e dice quando è uscito', 'tolto, con la data, testo copiato',
    r.stato = 'tolto' and r.tolto_il is not null and r.corpo = 'Il nostro open day', coalesce(r.stato, 'riga sparita') || ' · ' || coalesce(r.tolto_il::text, '-'));
end $$;

reset role;
set local request.jwt.claim.sub = '';
update public.istituzioni set stato = 'sospesa' where id = 'e2000000-0000-0000-0000-0000000000e2';
delete from public.post_enti where id = (select id from ids where n = 5);
set local role authenticated;
set local request.jwt.claim.sub = '5a000000-0000-0000-0000-00000000005a';
do $$ declare a text; b text; n int; begin
  select stato into a from public.post_salvati_miei() where ente_nome = 'Ente Premium';
  select stato into b from public.post_salvati_miei() where tipo = 'file';
  select count(*) into n from public.scaricamenti_allegati_post;
  insert into esiti values (14, 'un post cancellato resta come «cancellato», e la traccia del file resta', 'cancellato · 1', b = 'cancellato' and n = 1, coalesce(b, 'riga sparita') || ' · ' || n);
  insert into esiti values (15, 'un post di un ente non più attivo resta come «ente_non_attivo»', 'ente_non_attivo', a = 'ente_non_attivo', coalesce(a, 'riga sparita'));
end $$;

do $$ declare v int; w int; begin
  with tolte as (delete from public.post_salvati where ente_nome = 'Ente Premium' returning 1) select count(*) into v from tolte;
  set local request.jwt.claim.sub = '5b000000-0000-0000-0000-00000000005b';
  with tolte as (delete from public.post_salvati returning 1) select count(*) into w from tolte;
  insert into esiti values (22, 'lo studente toglie un proprio salvataggio, e non quelli di un altro', '1 e 0', v = 1 and w = 0, v || ' e ' || w);
end $$;

reset role;
select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
