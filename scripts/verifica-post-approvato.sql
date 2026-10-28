-- LA DATA DI APPROVAZIONE DI UN POST LA SCRIVE IL DATABASE (20261110100000 e
-- 20261110110000).
--
-- Gira in una transazione con ROLLBACK, nel SQL Editor così com'è.
-- Rosse attese:
--   - su una replica nata senza 20261110100000: 1 (resta vuota: il client di
--     oggi non la manda), 3 (dal SQL Editor resta vuota), 4 (un approvato
--     senza data entra), e 2 (il client la scrive, manca anche la seconda);
--   - su una replica nata senza la sola 20261110110000: 2.
-- Verdi nei due mondi: 5 (rifiutare senza data va bene) e 6 (l'admin approva,
-- la strada vera).

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to authenticated;

insert into auth.users(id, email) values ('ad000000-0000-0000-0000-0000000000ad', 'admin@prova.it');
insert into public.profiles(id, ruolo, nome, cognome) values ('ad000000-0000-0000-0000-0000000000ad', 'admin', 'A', 'Dmin');
-- Due enti, perché un ente ha un tetto di post in revisione
-- (limite_post_in_approvazione).
insert into public.istituzioni(id, nome, slug, tipo, stato) values
  ('e1000000-0000-0000-0000-0000000000e1', 'Ente Post', 'ente-post-approvato', 'its', 'attiva'),
  ('e2000000-0000-0000-0000-0000000000e2', 'Ente Post Due', 'ente-post-approvato-due', 'its', 'attiva');
insert into public.post_enti(id, istituzione_id, tipo, corpo, stato) values
  ('90000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1', 'testo', 'Uno', 'in_approvazione'),
  ('90000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-0000000000e1', 'testo', 'Due', 'in_approvazione'),
  ('90000000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-0000000000e2', 'testo', 'Tre', 'in_approvazione'),
  ('90000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-0000000000e2', 'testo', 'Cinque', 'in_approvazione');

set local role authenticated;
set local request.jwt.claim.sub = 'ad000000-0000-0000-0000-0000000000ad';

-- 6 e 1) l'admin approva dal client, come AzioneApprovazionePost
do $$ begin
  update public.post_enti set stato = 'approvato', approvato_da = 'ad000000-0000-0000-0000-0000000000ad'
   where id = '90000000-0000-0000-0000-000000000001';
  insert into esiti select 6, 'l''admin approva un post dal client', 'approvato',
    stato = 'approvato', stato::text from public.post_enti where id = '90000000-0000-0000-0000-000000000001';
  insert into esiti select 1, 'la data è quella del database, non del browser', 'entro un minuto da adesso',
    approvato_il between now() - interval '1 minute' and now() + interval '1 minute', coalesce(approvato_il::text, 'vuota')
    from public.post_enti where id = '90000000-0000-0000-0000-000000000001';
exception when others then
  insert into esiti values (6, 'l''admin approva un post dal client', 'approvato', false, 'respinto: ' || sqlerrm);
  insert into esiti values (1, 'la data è quella del database, non del browser', 'entro un minuto da adesso', false, 'respinto: ' || sqlerrm);
end $$;

-- 2) l'admin prova a scegliersi la data, come faceva il codice di prima
do $$ begin
  update public.post_enti set stato = 'approvato', approvato_il = '2020-01-01'
   where id = '90000000-0000-0000-0000-000000000002';
  insert into esiti select 2, 'il client non sceglie la data di approvazione', 'RESPINTO', false,
    '*** PASSA *** ' || coalesce(approvato_il::text, '') from public.post_enti where id = '90000000-0000-0000-0000-000000000002';
exception when others then
  insert into esiti values (2, 'il client non sceglie la data di approvazione', 'RESPINTO', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;

-- 5) controllo: rifiutare senza data va bene
do $$ begin
  update public.post_enti set stato = 'rifiutato', motivo_rifiuto = 'Non va'
   where id = '90000000-0000-0000-0000-000000000005';
  insert into esiti select 5, 'rifiutare un post non chiede una data di approvazione', 'rifiutato, senza data',
    stato = 'rifiutato' and approvato_il is null, stato::text || ' / ' || coalesce(approvato_il::text, 'vuota')
    from public.post_enti where id = '90000000-0000-0000-0000-000000000005';
exception when others then
  insert into esiti values (5, 'rifiutare un post non chiede una data di approvazione', 'rifiutato, senza data', false, 'respinto: ' || sqlerrm);
end $$;
reset role;

-- 3) dal SQL Editor (postgres, nessuna sessione) la data c'è lo stesso
do $$ begin
  update public.post_enti set stato = 'approvato' where id = '90000000-0000-0000-0000-000000000003';
  insert into esiti select 3, 'approvato dal SQL Editor, la data la scrive il database', 'entro un minuto da adesso',
    approvato_il between now() - interval '1 minute' and now() + interval '1 minute', coalesce(approvato_il::text, 'vuota')
    from public.post_enti where id = '90000000-0000-0000-0000-000000000003';
exception when others then
  insert into esiti values (3, 'approvato dal SQL Editor, la data la scrive il database', 'entro un minuto da adesso', false, 'respinto: ' || sqlerrm);
end $$;

-- 4) un post che nasce approvato senza data non entra (il trigger guarda solo
-- gli update: lo ferma il vincolo)
do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, stato)
    values ('e2000000-0000-0000-0000-0000000000e2', 'testo', 'Quattro', 'approvato');
  insert into esiti values (4, 'un post approvato senza data non entra', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (4, 'un post approvato senza data non entra', 'RESPINTO', sqlstate = '23514', 'respinto: ' || sqlerrm);
end $$;

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
