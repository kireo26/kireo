-- Verifica di 20261028100000_ore_riconoscibili_per_difetto.sql: il tetto delle
-- ore riconoscibili si arrotonda per difetto, mai per eccesso.
--
-- La tabella dei casi è scritta a mano (l'atteso non si importa dalla cosa che
-- si prova). Gli eventi NON sono chiusi, quindi la durata vera è quella
-- programmata (ramo (b) di `durata_vera_minuti`), e le ore dichiarate (9) stanno
-- sopra qualunque durata: il numero che esce è il tetto e basta.
--
-- Transazione con ROLLBACK: gira anche nel SQL Editor di Supabase.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
create temp table casi (n int, minuti int, ore_pcto numeric, atteso numeric) on commit drop;
insert into casi values
  (1, 20, 9, 0.33),   -- 0,3333 → per eccesso sarebbe uguale: caso di controllo
  (2, 25, 9, 0.41),   -- 0,4166: col round era 0,42, il caso che ha aperto il difetto
  (3, 28, 9, 0.46),   -- 0,4666: col round era 0,47
  (4, 59, 9, 0.98),   -- 0,9833
  (5, 60, 9, 1.00),   -- l'ora esatta
  (6, 61, 9, 1.01),   -- 1,0166
  (7, 50, 9, 0.83),   -- 0,8333
  (8, 19, 9, 0),      -- sotto il minimo dei 20 minuti
  (9, 60, 0.25, 0.25);-- le ore dichiarate sotto la durata passano intatte

insert into auth.users (id, email) values ('11111111-0000-0000-0000-0000000000f1', 'ente-difetto@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000f1', 'istituzione', 'E', 'Nte', '1980-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Ente Difetto', 'ente-difetto', 'universita', 'attiva');

insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, ore_pcto)
select ('e0000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Caso ' || n, 'x', 'webinar',
       'aaaaaaaa-0000-0000-0000-0000000000f1',
       now() - interval '1 day', now() - interval '1 day' + make_interval(mins => minuti),
       'approvato', 'studenti', ore_pcto
from casi;

insert into esiti
select c.n, c.minuti || ' minuti, dichiarate ' || c.ore_pcto, c.atteso::text, r::text, r = c.atteso
from casi c,
lateral (select public.ore_riconoscibili_evento(('e0000000-0000-0000-0000-0000000000' || lpad(c.n::text, 2, '0'))::uuid) as r) x(r);

-- 10) Nessun caso esce sopra la durata vera: la proprietà, non il caso.
insert into esiti
select 10, 'nessun tetto sopra durata/60', 'nessuno', coalesce(string_agg(c.n::text, ','), 'nessuno'), count(*) = 0
from casi c
where public.ore_riconoscibili_evento(('e0000000-0000-0000-0000-0000000000' || lpad(c.n::text, 2, '0'))::uuid) > c.minuti / 60.0;

select n, cosa, atteso, trovato, case when ok then '✓' else '✗' end as esito from esiti order by n;
select count(*) filter (where ok) || '/' || count(*) || ' proprietà verdi' as riepilogo from esiti;
rollback;
