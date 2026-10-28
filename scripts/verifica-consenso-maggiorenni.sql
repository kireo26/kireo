-- UN CONSENSO VALE SOLO SE DATO DA MAGGIORENNI, E NON SI EREDITA A 18 ANNI.
--
-- Prova la migrazione 20261107110000. Gira in una transazione con ROLLBACK.
-- Le tre metà: la regola (consenso_dato_da_maggiorenne), il rifiuto del sì
-- (imposta_comunicazioni_kireo), il conto dell'ente (stats_istituzione).

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

-- ─────────────── 1-4) la regola, con le date scritte a mano
insert into esiti select 1, 'un sì dato il giorno dei 18 anni vale', 'true',
  public.consenso_dato_da_maggiorenne('2025-03-10 00:00+00', '2007-03-10'),
  public.consenso_dato_da_maggiorenne('2025-03-10 00:00+00', '2007-03-10')::text;
insert into esiti select 2, 'un sì dato il giorno prima dei 18 anni non vale', 'false',
  not public.consenso_dato_da_maggiorenne('2025-03-09 12:00+00', '2007-03-10'),
  public.consenso_dato_da_maggiorenne('2025-03-09 12:00+00', '2007-03-10')::text;
insert into esiti select 3, 'un sì dato a 16 anni non vale nemmeno quando i 18 arrivano (non si eredita)', 'false',
  not public.consenso_dato_da_maggiorenne('2023-03-10 00:00+00', '2007-03-10'),
  public.consenso_dato_da_maggiorenne('2023-03-10 00:00+00', '2007-03-10')::text;
insert into esiti select 4, 'senza data di nascita non vale', 'false',
  not coalesce(public.consenso_dato_da_maggiorenne(now(), null), false),
  coalesce(public.consenso_dato_da_maggiorenne(now(), null)::text, 'null');

-- ─────────────── fixture: un maggiorenne, un minorenne, un ente
insert into auth.users(id, email) values
  ('a1a1a1a1-0000-0000-0000-0000000000a1', 'adulto@prova.it'),
  ('b2b2b2b2-0000-0000-0000-0000000000b2', 'minore@prova.it'),
  ('c3c3c3c3-0000-0000-0000-0000000000c3', 'diventato@prova.it'),
  ('e4e4e4e4-0000-0000-0000-0000000000e4', 'ente@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita) values
  ('a1a1a1a1-0000-0000-0000-0000000000a1', 'studente', 'A', 'Dulto', current_date - interval '19 years'),
  ('b2b2b2b2-0000-0000-0000-0000000000b2', 'studente', 'M', 'Inore', current_date - interval '16 years'),
  ('c3c3c3c3-0000-0000-0000-0000000000c3', 'studente', 'D', 'Iventato', current_date - interval '18 years' - interval '30 days'),
  ('e4e4e4e4-0000-0000-0000-0000000000e4', 'istituzione', 'E', 'Nte', null);
insert into public.istituzioni(id, nome, slug, tipo, stato)
  values ('f5f5f5f5-0000-0000-0000-0000000000f5', 'Ente Prova', 'ente-prova-consensi', 'its', 'attiva');

set local role authenticated;

-- ─────────────── 5-6) il sì si rifiuta solo a chi non è maggiorenne
set local request.jwt.claim.sub = 'b2b2b2b2-0000-0000-0000-0000000000b2';
do $$ begin
  perform public.imposta_comunicazioni_kireo(true, 'profilo');
  insert into esiti values (5, 'il minorenne dice sì alle comunicazioni di KIREO', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (5, 'il minorenne dice sì alle comunicazioni di KIREO', 'RESPINTO', sqlerrm like '%consenso_solo_maggiorenni%', 'respinto: ' || sqlerrm);
end $$;
do $$ declare v boolean; begin
  v := public.imposta_comunicazioni_kireo(false, 'profilo');
  insert into esiti values (6, 'il minorenne dice no (si registra)', 'false', v is false, coalesce(v::text, 'null'));
exception when others then
  insert into esiti values (6, 'il minorenne dice no (si registra)', 'false', false, 'respinto: ' || sqlerrm);
end $$;

-- ─────────────── 7) controllo: il maggiorenne dice ancora sì
set local request.jwt.claim.sub = 'a1a1a1a1-0000-0000-0000-0000000000a1';
do $$ declare v boolean; begin
  v := public.imposta_comunicazioni_kireo(true, 'profilo');
  insert into esiti values (7, 'il maggiorenne dice sì (controllo)', 'true', v is true, coalesce(v::text, 'null'));
exception when others then
  insert into esiti values (7, 'il maggiorenne dice sì (controllo)', 'true', false, 'respinto: ' || sqlerrm);
end $$;

reset role;

-- ─────────────── 8-9) il conto dell'ente: tre iscritti, uno raggiungibile.
-- Il «diventato» si è iscritto due mesi fa, quando aveva 17 anni: oggi è
-- maggiorenne e non è raggiungibile, perché il consenso non si eredita.
insert into public.newsletter_iscrizioni(student_id, istituzione_id, created_at) values
  ('a1a1a1a1-0000-0000-0000-0000000000a1', 'f5f5f5f5-0000-0000-0000-0000000000f5', now()),
  ('b2b2b2b2-0000-0000-0000-0000000000b2', 'f5f5f5f5-0000-0000-0000-0000000000f5', now()),
  ('c3c3c3c3-0000-0000-0000-0000000000c3', 'f5f5f5f5-0000-0000-0000-0000000000f5', now() - interval '60 days');

-- La vista la legge l'ente o l'admin: qui un admin.
insert into auth.users(id, email) values ('d6d6d6d6-0000-0000-0000-0000000000d6', 'admin@prova.it');
insert into public.profiles(id, ruolo, nome, cognome) values ('d6d6d6d6-0000-0000-0000-0000000000d6', 'admin', 'A', 'Dmin');
set local role authenticated;
set local request.jwt.claim.sub = 'd6d6d6d6-0000-0000-0000-0000000000d6';
do $$ declare v_tutti bigint; v_ragg bigint; begin
  select iscritti_newsletter, iscritti_newsletter_raggiungibili into v_tutti, v_ragg
    from public.stats_istituzione where istituzione_id = 'f5f5f5f5-0000-0000-0000-0000000000f5';
  insert into esiti values (8, 'l''admin legge gli iscritti in tutto', '3', v_tutti = 3, coalesce(v_tutti::text, 'null'));
  insert into esiti values (9, 'l''admin legge chi la riceverà: solo chi si è iscritto da maggiorenne', '1', v_ragg = 1, coalesce(v_ragg::text, 'null'));
exception when others then
  insert into esiti values (8, 'l''admin legge gli iscritti in tutto', '3', false, 'respinto: ' || sqlerrm);
  insert into esiti values (9, 'l''admin legge chi la riceverà: solo chi si è iscritto da maggiorenne', '1', false, 'respinto: ' || sqlerrm);
end $$;
reset role;

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
