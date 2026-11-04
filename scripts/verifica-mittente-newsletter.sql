-- Verifica di 20261207100000 (Mario, 04/11, §6d): una newsletter ricevuta dice
-- chi l'ha mandata, e lo studente lo legge dalla sua riga.
--
-- CONTROPROVA: su una replica nata senza la migrazione non parte (le colonne
-- non esistono). Con il trigger tolto sono rosse tutte e tre (misurato il
-- 04/11: la 2 legge una riga rimasta senza mittente).
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-0000000000e1', 'ente@mitt.test'),
  ('66666666-0000-0000-0000-0000000000c1', 'stud@mitt.test');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('66666666-0000-0000-0000-0000000000e1', 'istituzione', 'E', 'Mitt', null),
  ('66666666-0000-0000-0000-0000000000c1', 'studente', 'S', 'Mitt', '2000-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato, piano_id)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Ente Mittente', 'ente-mittente', 'universita', 'attiva',
        (select id from public.piani where nome = 'premium'::public.piano_nome));
insert into public.newsletter_enti (id, istituzione_id, oggetto, corpo, giorno, ultimo_giorno)
values ('eeeeeeee-0000-0000-0000-0000000000a1', 'eeeeeeee-0000-0000-0000-000000000001', 'Open day', 'Un corpo qualunque.', current_date + 10, current_date + 12);

-- 1. Una consegna nuova copia l'ente e l'oggetto, chiunque la scriva.
insert into public.newsletter_consegne (newsletter_id, student_id)
values ('eeeeeeee-0000-0000-0000-0000000000a1', '66666666-0000-0000-0000-0000000000c1');
insert into esiti
select 1, 'la consegna nasce con il mittente e l''oggetto', 'Ente Mittente · Open day',
  coalesce(ente_nome, '∅') || ' · ' || coalesce(oggetto, '∅'),
  ente_nome = 'Ente Mittente' and oggetto = 'Open day'
from public.newsletter_consegne where newsletter_id = 'eeeeeeee-0000-0000-0000-0000000000a1';

-- 2. Lo studente legge il mittente dalla sua riga, dal client.
do $$
declare v text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '66666666-0000-0000-0000-0000000000c1', true);
  select coalesce(ente_nome, '∅') into v from public.newsletter_consegne where student_id = '66666666-0000-0000-0000-0000000000c1';
  reset role;
  insert into esiti values (2, 'lo studente legge il mittente dalla sua consegna', 'Ente Mittente', coalesce(v, 'nessuna riga'), v = 'Ente Mittente');
end $$;

-- 3. Un mittente scritto da chi inserisce non vale: lo decide la newsletter.
delete from public.newsletter_consegne where newsletter_id = 'eeeeeeee-0000-0000-0000-0000000000a1';
insert into public.newsletter_consegne (newsletter_id, student_id, ente_nome, oggetto)
values ('eeeeeeee-0000-0000-0000-0000000000a1', '66666666-0000-0000-0000-0000000000c1', 'Un altro', 'Un altro oggetto');
insert into esiti
select 3, 'il mittente lo copia il database, non chi inserisce', 'Ente Mittente',
  coalesce(ente_nome, '∅'), ente_nome = 'Ente Mittente'
from public.newsletter_consegne where newsletter_id = 'eeeeeeee-0000-0000-0000-0000000000a1';

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
