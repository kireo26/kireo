-- I POST NELLE PAGINE DELLE AREE (20261121100000).
--
-- Gira in una transazione con ROLLBACK, nel SQL Editor così com'è.
--
-- Un post porta al massimo 2 aree, solo fra le APPROVATE del suo ente, e la
-- regola sta nel database (un trigger), non solo nel modulo. La regola della
-- revoca sta nella lettura (lib/app/postArea.ts): qui si prova che la colonna
-- non si ripulisce e che chi legge vede le aree, perché la lettura le confronta.
--
-- Rosse attese su una replica nata senza 20261121100000: 1, 2, 3, 4, 5, 6, 9
-- (la colonna non c'è: le respinte lo sono per il motivo sbagliato, e la prova
-- guarda il motivo). Verdi nei due mondi: 7 (un post senza aree) e 8 (il
-- client non aggiorna post_enti dal 20261113120000).
-- Con il solo trigger tolto: rosse 2, 3, 6; la 4 resta verde, perché il CHECK
-- fa da seconda rete sul numero delle aree.

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values
  ('f1000000-0000-0000-0000-0000000000a1', 'ente-aree@prova.it'),
  ('5a000000-0000-0000-0000-0000000000a5', 'studente-aree@prova.it');
insert into public.profiles(id, ruolo, nome, cognome) values
  ('f1000000-0000-0000-0000-0000000000a1', 'istituzione', 'E', 'Aree'),
  ('5a000000-0000-0000-0000-0000000000a5', 'studente', 'S', 'Aree');
insert into public.istituzioni(id, nome, slug, tipo, stato, piano_id) values
  ('e1000000-0000-0000-0000-0000000000a1', 'Ente Aree', 'ente-post-aree', 'its', 'attiva', (select id from public.piani where nome = 'free'));
insert into public.institution_profiles(user_id, istituzione_id) values
  ('f1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000a1');
-- Due approvate, una in revisione, una rifiutata.
insert into public.istituzioni_aree(istituzione_id, area_slug, stato) values
  ('e1000000-0000-0000-0000-0000000000a1', 'informatica-digitale', 'approvata'),
  ('e1000000-0000-0000-0000-0000000000a1', 'comunicazione-media', 'approvata'),
  ('e1000000-0000-0000-0000-0000000000a1', 'arte-design-moda', 'in_approvazione');

set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000a1';

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, aree)
    values ('e1000000-0000-0000-0000-0000000000a1', 'testo', 'Due aree approvate', array['informatica-digitale', 'comunicazione-media']);
  insert into esiti values (1, 'l''ente pubblica un post in due delle sue aree approvate', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (1, 'l''ente pubblica un post in due delle sue aree approvate', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, aree)
    values ('e1000000-0000-0000-0000-0000000000a1', 'testo', 'In revisione', array['arte-design-moda']);
  -- Se passa, si annulla: un post in più farebbe scattare il tetto dei 3 nelle
  -- 24 ore più avanti, e il rosso nominerebbe la prova sbagliata (il modo 9).
  raise exception 'passa_e_si_annulla';
exception when others then
  insert into esiti values (2, 'un''area in revisione non si dà a un post (è una richiesta, non un fatto)', 'RESPINTO',
    sqlerrm like '%area_post_non_approvata%', case when sqlerrm = 'passa_e_si_annulla' then '*** PASSA *** (annullato)' else 'respinto: ' || sqlerrm end);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, aree)
    values ('e1000000-0000-0000-0000-0000000000a1', 'testo', 'Area mai dichiarata', array['salute-professioni-sanitarie']);
  -- Se passa, si annulla: un post in più farebbe scattare il tetto dei 3 nelle
  -- 24 ore più avanti, e il rosso nominerebbe la prova sbagliata (il modo 9).
  raise exception 'passa_e_si_annulla';
exception when others then
  insert into esiti values (3, 'un''area che l''ente non ha mai dichiarato non si dà a un post', 'RESPINTO',
    sqlerrm like '%area_post_non_approvata%', case when sqlerrm = 'passa_e_si_annulla' then '*** PASSA *** (annullato)' else 'respinto: ' || sqlerrm end);
end $$;

-- Tre aree: la terza sarebbe una richiesta in revisione, ma il limite viene
-- prima, e il CHECK lo ripete.
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, aree)
    values ('e1000000-0000-0000-0000-0000000000a1', 'testo', 'Tre aree', array['informatica-digitale', 'comunicazione-media', 'arte-design-moda']);
  -- Se passa, si annulla: un post in più farebbe scattare il tetto dei 3 nelle
  -- 24 ore più avanti, e il rosso nominerebbe la prova sbagliata (il modo 9).
  raise exception 'passa_e_si_annulla';
exception when others then
  insert into esiti values (4, 'un post non porta più di 2 aree', 'RESPINTO',
    sqlerrm like '%troppe_aree_post%' or sqlerrm like '%post_enti_al_massimo_due_aree%', case when sqlerrm = 'passa_e_si_annulla' then '*** PASSA *** (annullato)' else 'respinto: ' || sqlerrm end);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, aree)
    values ('e1000000-0000-0000-0000-0000000000a1', 'testo', 'Una sola', array['informatica-digitale']);
  insert into esiti values (5, 'l''ente pubblica un post in una sola area', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (5, 'l''ente pubblica un post in una sola area', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, aree)
    values ('e1000000-0000-0000-0000-0000000000a1', 'testo', 'Ripetuta', array['informatica-digitale', 'informatica-digitale']);
  -- Se passa, si annulla: un post in più farebbe scattare il tetto dei 3 nelle
  -- 24 ore più avanti, e il rosso nominerebbe la prova sbagliata (il modo 9).
  raise exception 'passa_e_si_annulla';
exception when others then
  insert into esiti values (6, 'la stessa area due volte non vale due aree', 'RESPINTO',
    sqlerrm like '%area_post_ripetuta%', case when sqlerrm = 'passa_e_si_annulla' then '*** PASSA *** (annullato)' else 'respinto: ' || sqlerrm end);
end $$;

-- Il tetto dei 3 post nelle 24 ore conta anche questo: è il terzo riuscito.
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo)
    values ('e1000000-0000-0000-0000-0000000000a1', 'testo', 'Senza aree');
  insert into esiti values (7, 'un post senza aree si pubblica come prima', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (7, 'un post senza aree si pubblica come prima', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  update public.post_enti set aree = '{}' where corpo = 'Una sola';
  insert into esiti values (8, 'l''ente non cambia le aree di un post dal client', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (8, 'l''ente non cambia le aree di un post dal client', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- La revoca: KIREO riporta l'area a rifiutata. Il post non si tocca (la regola
-- sta nella lettura), e chi legge vede ancora le aree del post — è quello che
-- permette alla pagina dell'area di confrontarle con le approvate di adesso.
reset role;
update public.istituzioni_aree set stato = 'rifiutata'
  where istituzione_id = 'e1000000-0000-0000-0000-0000000000a1' and area_slug = 'comunicazione-media';
set local role anon;
do $$ declare v text[]; begin
  select aree into v from public.post_enti where corpo = 'Due aree approvate';
  insert into esiti values (9, 'a un''area revocata il post resta com''era, e chi non ha fatto l''accesso ne legge le aree', 'le due aree',
    v = array['informatica-digitale', 'comunicazione-media'], coalesce(array_to_string(v, ', '), 'null'));
exception when others then
  insert into esiti values (9, 'a un''area revocata il post resta com''era, e chi non ha fatto l''accesso ne legge le aree', 'le due aree', false, 'errore: ' || sqlerrm);
end $$;

reset role;
select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
