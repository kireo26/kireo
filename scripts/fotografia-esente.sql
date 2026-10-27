-- Fotografia per 20261031100000_esente_dai_cancelli.sql: si lancia PRIMA e
-- DOPO, e gira uguale tutte e due le volte (la colonna nuova si legge con
-- `to_jsonb(p) ->>`, che dà null invece di fallire quando non c'è).
--
-- Come si legge:
--   prima: «esenti» e «righe diverse» sono 0 (la colonna non esiste) e «di prova» è il numero da ricordare;
--   dopo:  «esenti» = «di prova» di prima, e «righe diverse» = 0.
-- Un «righe diverse» maggiore di zero subito dopo la migrazione vuol dire che la
-- copia non ha preso tutte le righe: nell'istante della migrazione qualcuno ha
-- cambiato comportamento, che è proprio quello che non doveva succedere.
-- Sola lettura.

select
  count(*)                                                             as profili,
  count(*) filter (where p.di_prova)                                   as di_prova,
  count(*) filter (where not p.di_prova)                               as non_di_prova,
  count(*) filter (where (to_jsonb(p) ->> 'esente_cancelli')::boolean) as esenti,
  count(*) filter (where (to_jsonb(p) ->> 'esente_cancelli') is not null
                     and (to_jsonb(p) ->> 'esente_cancelli')::boolean is distinct from p.di_prova) as righe_diverse,
  (select pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d
     join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'public.profiles'::regclass and a.attname = 'di_prova')  as default_di_prova
from public.profiles p;
