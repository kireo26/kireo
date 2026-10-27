-- Verifica di 20261029100000_ore_pcto_dall_orario.sql e 20261029110000_ore_pcto_insert_dal_client.sql:
-- le ore PCTO di un evento si calcolano dall'orario, in un posto solo (il
-- trigger), e il client non le scrive più.
--
-- ⚠️ LA TABELLA DELLA FORMULA È SCRITTA A MANO (l'atteso non si importa dalla
-- cosa che si prova), e contiene i due casi che una tabella «di quello che si
-- sa già» non avrebbe: sotto il minuto, e il cambio dell'ora (Mario: «la tua
-- tabella ha la mezzanotte, non ha l'ora legale»). Il 25/10/2026 alle 03:00
-- l'Italia è tornata all'ora solare: dalle 01:30 (+02) alle 02:30 (+01) sono
-- passate DUE ore vere, anche se l'orologio a muro ne segna una.
--
-- Transazione con ROLLBACK: gira anche nel SQL Editor di Supabase.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

-- ---------------------------------------------------------------- la formula
create temp table formula (n int, inizio timestamptz, fine timestamptz, atteso numeric) on commit drop;
insert into formula values
  (1, '2026-11-02 10:00:00+01', '2026-11-02 10:00:30+01', 0.00),  -- trenta secondi
  (2, '2026-11-02 10:00:00+01', '2026-11-02 10:01:00+01', 0.01),  -- un minuto esatto: 60/36 = 1,67 → 1
  (3, '2026-11-02 10:00:00+01', '2026-11-02 10:20:00+01', 0.33),  -- venti minuti: 1200/36 = 33,3
  (4, '2026-11-02 10:00:00+01', '2026-11-02 10:59:00+01', 0.98),
  (5, '2026-11-02 10:00:00+01', '2026-11-02 11:00:00+01', 1.00),  -- l'ora esatta
  (6, '2026-11-02 10:00:00+01', '2026-11-02 11:01:00+01', 1.01),
  (7, '2026-11-02 23:30:00+01', '2026-11-03 00:30:00+01', 1.00),  -- a cavallo di mezzanotte
  (8, '2026-10-25 01:30:00+02', '2026-10-25 02:30:00+01', 2.00),  -- ritorno all'ora solare: due ore vere
  (9, '2027-03-28 01:30:00+01', '2027-03-28 03:30:00+02', 1.00),  -- passaggio all'ora legale: un'ora vera
  (10, '2026-11-02 10:00:00+01', '2026-11-02 10:00:00+01', 0.00); -- finestra di durata zero

insert into esiti
select f.n, 'formula: ' || to_char(f.fine - f.inizio, 'HH24:MI:SS'), f.atteso::text,
       coalesce(public.ore_dichiarate_da_finestra(f.inizio, f.fine)::text, 'null'),
       public.ore_dichiarate_da_finestra(f.inizio, f.fine) = f.atteso
from formula f;

insert into esiti select 11, 'formula: la fine prima dell''inizio non ha ore', 'null',
  coalesce(public.ore_dichiarate_da_finestra('2026-11-02 11:00+01', '2026-11-02 10:00+01')::text, 'null'),
  public.ore_dichiarate_da_finestra('2026-11-02 11:00+01', '2026-11-02 10:00+01') is null;

-- ---------------------------------------------------------------- il mondo
insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000a1', 'ente-oo@test.it'),
  ('11111111-0000-0000-0000-0000000000a2', 'admin-oo@test.it'),
  ('22222222-0000-0000-0000-0000000000a1', 'stud-oo@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000a1', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('11111111-0000-0000-0000-0000000000a2', 'admin', 'Ad', 'Min', '1980-01-01'),
  ('22222222-0000-0000-0000-0000000000a1', 'studente', 'St', 'Udente', '2008-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Ente OO', 'ente-oo', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1');

-- EV_A: approvato, futuro, 20 minuti, «dichiarate» 9 dal client → il trigger
--       scrive 0,33. EV_B: in bozza, 1 ora (l'ente può aggiornare la riga).
-- EV_C: cominciato 30 minuti fa, programmato 40, si chiude più sotto.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, ore_pcto) values
  ('e0000000-0000-0000-0000-0000000000a1', 'A', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000a1',
   '2026-12-01 10:00+01', '2026-12-01 10:20+01', 'approvato', 'studenti', 9),
  ('e0000000-0000-0000-0000-0000000000a2', 'B', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000a1',
   '2026-12-02 10:00+01', '2026-12-02 11:00+01', 'bozza', 'studenti', 9),
  ('e0000000-0000-0000-0000-0000000000a3', 'C', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000a1',
   now() - interval '30 minutes', now() + interval '10 minutes', 'approvato', 'studenti', 0);
insert into public.eventi_aree (evento_id, area_slug) values
  ('e0000000-0000-0000-0000-0000000000a1', 'informatica-digitale'),
  ('e0000000-0000-0000-0000-0000000000a3', 'informatica-digitale');

-- 12) All'insert il valore del client si ignora.
insert into esiti select 12, 'insert: le ore sono quelle della finestra, non quelle mandate', '0.33',
  ore_pcto::text, ore_pcto = 0.33 from public.eventi where id = 'e0000000-0000-0000-0000-0000000000a1';

-- 13) All'insert la fine è obbligatoria.
do $$
declare v_msg text := 'nessun errore';
begin
  begin
    insert into public.eventi (titolo, descrizione, tipo, organizzatore_id, data_inizio, stato, pubblico)
      values ('Senza fine', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000a1', now() + interval '1 day', 'bozza', 'studenti');
  exception when others then v_msg := sqlerrm;
  end;
  insert into esiti values (13, 'insert senza fine: rifiutato', 'data_fine_obbligatoria', v_msg, v_msg = 'data_fine_obbligatoria');
end $$;

-- 38) …e la durata zero non è un incontro (Mario, 26/10): rifiutata dal
-- trigger, anche se `eventi_date_order` (`>=`) la lascerebbe passare.
do $$
declare v_msg text := 'nessun errore';
begin
  begin
    insert into public.eventi (titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico)
      values ('Durata zero', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000a1', '2026-12-05 10:00+01', '2026-12-05 10:00+01', 'bozza', 'studenti');
  exception when others then v_msg := sqlerrm;
  end;
  insert into esiti values (38, 'insert di durata zero: rifiutato', 'fine_non_dopo_inizio', v_msg, v_msg = 'fine_non_dopo_inizio');
end $$;

-- 14) L'anteprima dello spostamento, dalla porta dell'ente: stessi numeri che il trigger scriverà.
do $$
declare r record;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a1', true);
  select * into r from public.anteprima_spostamento_finestra('e0000000-0000-0000-0000-0000000000a1', '2026-12-01 10:00+01', '2026-12-01 11:00+01');
  insert into esiti values (14, 'anteprima: da 0,33 a 1,00, non fissate, con fine', '0.33/1.00/f/t',
    format('%s/%s/%s/%s', r.ore_attuali, r.ore_nuove, case when r.fissate_a_mano then 't' else 'f' end, case when r.aveva_fine then 't' else 'f' end),
    r.ore_attuali = 0.33 and r.ore_nuove = 1.00 and not r.fissate_a_mano and r.aveva_fine);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;

-- 15) Lo spostamento ricalcola.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a1', true);
  -- Lo stato visto è quello dell'anteprima della 14 (0,33, non fissate, con fine).
  perform public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000a1', '2026-12-01 10:00+01', '2026-12-01 11:00+01', 0.33, false, true);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;
insert into esiti select 15, 'spostamento: le ore seguono la nuova durata', '1.00',
  ore_pcto::text, ore_pcto = 1.00 from public.eventi where id = 'e0000000-0000-0000-0000-0000000000a1';

-- 16) La correzione dell'admin, in su, con il segno.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a2', true);
  perform public.correggi_ore_evento('e0000000-0000-0000-0000-0000000000a1', 2.5);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;
insert into esiti select 16, 'correzione: 2,50 con chi e quando', '2.50/admin/quando',
  format('%s/%s/%s', ore_pcto, case when ore_pcto_fissate_da = '11111111-0000-0000-0000-0000000000a2' then 'admin' else coalesce(ore_pcto_fissate_da::text, 'null') end,
         case when ore_pcto_fissate_il is not null then 'quando' else 'null' end),
  ore_pcto = 2.50 and ore_pcto_fissate_da = '11111111-0000-0000-0000-0000000000a2' and ore_pcto_fissate_il is not null
  from public.eventi where id = 'e0000000-0000-0000-0000-0000000000a1';

-- 17) Un update che non tocca le date non toglie la correzione.
update public.eventi set titolo = 'A rinominato' where id = 'e0000000-0000-0000-0000-0000000000a1';
insert into esiti select 17, 'update senza date: la correzione resta', '2.50/fissata',
  format('%s/%s', ore_pcto, case when ore_pcto_fissate_il is not null then 'fissata' else 'tolta' end),
  ore_pcto = 2.50 and ore_pcto_fissate_il is not null from public.eventi where id = 'e0000000-0000-0000-0000-0000000000a1';

-- 18) L'anteprima lo dice, e 19) lo spostamento toglie il segno.
do $$
declare r record;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a1', true);
  select * into r from public.anteprima_spostamento_finestra('e0000000-0000-0000-0000-0000000000a1', '2026-12-01 10:00+01', '2026-12-01 10:45+01');
  insert into esiti values (18, 'anteprima su un valore fissato: 2,50 → 0,75, fissate', '2.50/0.75/t',
    format('%s/%s/%s', r.ore_attuali, r.ore_nuove, case when r.fissate_a_mano then 't' else 'f' end),
    r.ore_attuali = 2.50 and r.ore_nuove = 0.75 and r.fissate_a_mano);
  perform public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000a1', '2026-12-01 10:00+01', '2026-12-01 10:45+01', r.ore_attuali, r.fissate_a_mano, r.aveva_fine);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;
insert into esiti select 19, 'spostamento dopo una correzione: segno tolto, ore ricalcolate', '0.75/tolta',
  format('%s/%s', ore_pcto, case when ore_pcto_fissate_il is null and ore_pcto_fissate_da is null then 'tolta' else 'fissata' end),
  ore_pcto = 0.75 and ore_pcto_fissate_il is null and ore_pcto_fissate_da is null
  from public.eventi where id = 'e0000000-0000-0000-0000-0000000000a1';

-- 20-21) IL CLIENT NON SCRIVE LE ORE: né l'ente su un evento in bozza (la sua
-- policy gli lascia la riga), né l'admin (`eventi_admin_tutto`).
do $$
declare v_msg text := 'nessun errore'; v_n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a1', true);
  begin
    update public.eventi set ore_pcto = 5 where id = 'e0000000-0000-0000-0000-0000000000a2';
  exception when insufficient_privilege then v_msg := 'permesso negato';
            when others then v_msg := 'altro: ' || sqlerrm;
  end;
  insert into esiti values (20, 'l''ente in bozza non scrive ore_pcto', 'permesso negato', v_msg, v_msg = 'permesso negato');

  v_msg := 'nessun errore';
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a2', true);
  begin
    update public.eventi set ore_pcto = 5 where id = 'e0000000-0000-0000-0000-0000000000a1';
  exception when insufficient_privilege then v_msg := 'permesso negato';
            when others then v_msg := 'altro: ' || sqlerrm;
  end;
  insert into esiti values (21, 'l''admin dal client non scrive ore_pcto', 'permesso negato', v_msg, v_msg = 'permesso negato');

  -- 22) LA COLONNA DI CONTROLLO: quella che il client scrive davvero
  -- (`AzioneApprovazione`) resta scrivibile. Senza, la 20-21 sarebbero verdi
  -- anche su un revoke che toglie tutto.
  update public.eventi set note_revisione = 'ok' where id = 'e0000000-0000-0000-0000-0000000000a1';
  get diagnostics v_n = row_count;
  insert into esiti values (22, 'l''admin dal client scrive ancora note_revisione', '1 riga', v_n || ' righe', v_n = 1);

  -- 23) L'ente in bozza sposta le date dal client: il trigger ricalcola anche lì.
  update public.eventi set data_fine = '2026-12-02 10:30+01' where id = 'e0000000-0000-0000-0000-0000000000a2';
  get diagnostics v_n = row_count;
  insert into esiti values (23, 'l''ente in bozza cambia la fine dal client', '1 riga', v_n || ' righe', v_n = 1);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;
insert into esiti select 24, '…e le ore seguono anche su quella strada', '0.50',
  ore_pcto::text, ore_pcto = 0.50 from public.eventi where id = 'e0000000-0000-0000-0000-0000000000a2';

-- 25-26) La correzione è solo dell'admin, e due decimali al massimo.
do $$
declare v_msg text := 'nessun errore';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a1', true);
  begin
    perform public.correggi_ore_evento('e0000000-0000-0000-0000-0000000000a2', 3);
  exception when others then v_msg := sqlerrm;
  end;
  insert into esiti values (25, 'l''ente non corregge le ore', 'non_autorizzato', v_msg, v_msg = 'non_autorizzato');

  v_msg := 'nessun errore';
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a2', true);
  begin
    perform public.correggi_ore_evento('e0000000-0000-0000-0000-0000000000a2', 0.755);
  exception when others then v_msg := sqlerrm;
  end;
  insert into esiti values (26, 'tre decimali rifiutati', 'ore_troppi_decimali', v_msg, v_msg = 'ore_troppi_decimali');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;

-- 27-28) SU UN EVENTO CHIUSO la correzione non tocca NESSUNA riga di
-- `iscrizioni_eventi` (Mario: «una garanzia che vale perché nessuno ha ancora
-- provato a violarla è una coincidenza»). Si confronta l'impronta di tutte
-- le righe dell'evento prima e dopo — non solo le ore.
insert into public.iscrizioni_eventi (evento_id, student_id) values
  ('e0000000-0000-0000-0000-0000000000a3', '22222222-0000-0000-0000-0000000000a1');
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('e0000000-0000-0000-0000-0000000000a3', '22222222-0000-0000-0000-0000000000a1', 28);
-- Le ore dichiarate di C le fissa la fixture (40 minuti → 0,66 dal trigger):
-- 2 ore, perché il tetto della chiusura abbia qualcosa da tagliare.
update public.eventi set ore_pcto = 2 where id = 'e0000000-0000-0000-0000-0000000000a3';
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a1', true);
  perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000a3');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;
create temp table prima on commit drop as
  select md5(string_agg(to_jsonb(ie)::text, '|' order by ie.student_id)) as impronta, count(*) as n,
         max(ie.ore_riconosciute) as ore
  from public.iscrizioni_eventi ie where ie.evento_id = 'e0000000-0000-0000-0000-0000000000a3';
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a2', true);
  perform public.correggi_ore_evento('e0000000-0000-0000-0000-0000000000a3', 4);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;
insert into esiti select 27, 'la fixture ha una certificazione da proteggere', '1 riga, 0.50',
  format('%s riga, %s', p.n, p.ore), p.n = 1 and p.ore = 0.50 from prima p;
insert into esiti select 28, 'correzione su evento chiuso: iscrizioni_eventi identica', 'impronta uguale',
  case when d.impronta = p.impronta then 'impronta uguale' else 'CAMBIATA' end, d.impronta = p.impronta
  from prima p,
  (select md5(string_agg(to_jsonb(ie)::text, '|' order by ie.student_id)) as impronta
   from public.iscrizioni_eventi ie where ie.evento_id = 'e0000000-0000-0000-0000-0000000000a3') d;

-- 29) L'anteprima della correzione: il massimo della chiusura automatica sulla
-- durata vera (C chiuso a 30 minuti → 0,50), e che è chiuso.
do $$
declare r record;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a2', true);
  select * into r from public.anteprima_correzione_ore('e0000000-0000-0000-0000-0000000000a3');
  insert into esiti values (29, 'anteprima correzione: durata 30, massimo 0,50, chiusa', '30/0.50/t',
    format('%s/%s/%s', r.durata_minuti, r.massimo, case when r.chiusa then 't' else 'f' end),
    r.durata_minuti = 30 and r.massimo = 0.50 and r.chiusa);
  select * into r from public.anteprima_correzione_ore('e0000000-0000-0000-0000-0000000000a1');
  insert into esiti values (30, 'anteprima correzione: non chiuso, 45 minuti programmati → 0,75', '45/0.75/f',
    format('%s/%s/%s', round(r.durata_minuti), r.massimo, case when r.chiusa then 't' else 'f' end),
    round(r.durata_minuti) = 45 and r.massimo = 0.75 and not r.chiusa);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;

-- 31) L'evento VECCHIO senza fine: lo spostamento non è un guasto, e
-- l'anteprima lo dice (`aveva_fine` falso) — il caso che Mario ha separato
-- dall'errore, perché bloccarlo chiuderebbe proprio la strada che gli dà un orario.
alter table public.eventi disable trigger eventi_ore_da_orario;
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, ore_pcto) values
  ('e0000000-0000-0000-0000-0000000000a4', 'Vecchio senza fine', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000a1',
   '2026-12-03 10:00+01', null, 'approvato', 'studenti', 3);
alter table public.eventi enable trigger eventi_ore_da_orario;
-- 39) L'anteprima della correzione lo riconosce: senza fine e mai chiuso è
-- l'unico caso senza tetto, e il testo dell'admin lo dice (`ha_fine` falso).
do $$
declare r record;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a2', true);
  select * into r from public.anteprima_correzione_ore('e0000000-0000-0000-0000-0000000000a4');
  insert into esiti values (39, 'anteprima correzione su un evento senza fine: nessuna durata, ha_fine falso', 'null/null/f/no',
    format('%s/%s/%s/%s', coalesce(r.durata_minuti::text, 'null'), coalesce(r.massimo::text, 'null'), case when r.chiusa then 't' else 'f' end, case when r.ha_fine then 'sì' else 'no' end),
    r.durata_minuti is null and r.massimo is null and not r.chiusa and not r.ha_fine);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;

do $$
declare r record;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000a1', true);
  select * into r from public.anteprima_spostamento_finestra('e0000000-0000-0000-0000-0000000000a4', '2026-12-03 10:00+01', '2026-12-03 11:00+01');
  insert into esiti values (31, 'anteprima su un evento senza fine: aveva_fine falso, 1,00', '3.00/1.00/f',
    format('%s/%s/%s', r.ore_attuali, r.ore_nuove, case when r.aveva_fine then 't' else 'f' end),
    r.ore_attuali = 3 and r.ore_nuove = 1.00 and not r.aveva_fine);
  perform public.sposta_finestra_evento('e0000000-0000-0000-0000-0000000000a4', '2026-12-03 10:00+01', '2026-12-03 11:00+01', r.ore_attuali, r.fissate_a_mano, r.aveva_fine);
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;
insert into esiti select 32, 'spostamento di un evento senza fine: ora ha fine e 1,00', '1.00',
  ore_pcto::text, ore_pcto = 1.00 and data_fine is not null from public.eventi where id = 'e0000000-0000-0000-0000-0000000000a4';

-- (Le colonne dicono «negato»/«concesso» e non f/t: `verifica-sql-tutti.sh`
-- legge una `f` in fondo a una riga come un booleano falso, cioè un rosso.)
-- 40) LA SECONDA PORTA DEL RAMO SENZA TETTO È CHIUSA DA UN VINCOLO, e lo si
-- prova (26/10): una diretta chiusa senza durata scritta farebbe valere per
-- intero le ore dichiarate. `eventi_durata_con_chiusura` lo impedisce, e deve
-- essere VALIDATO, cioè controllato anche sulle righe di prima. C chiuso sopra.
do $$
declare v_msg text := 'nessun errore'; v_valido boolean;
begin
  begin
    update public.eventi set diretta_durata_minuti = null where id = 'e0000000-0000-0000-0000-0000000000a3';
  exception when check_violation then v_msg := 'vincolo';
            when others then v_msg := 'altro: ' || sqlerrm;
  end;
  select convalidated into v_valido from pg_constraint where conname = 'eventi_durata_con_chiusura';
  insert into esiti values (40, 'una diretta chiusa senza durata non può esistere (vincolo validato)', 'vincolo/validato',
    v_msg || '/' || case when v_valido then 'validato' else 'NON validato' end, v_msg = 'vincolo' and v_valido);
end $$;

-- 33-36) I PRIVILEGI, nella forma che si guarda anche in produzione: la
-- colonna protetta FALSA e una colonna di controllo che il client usa davvero VERA.
insert into esiti select 33, 'privilegio: update di ore_pcto negato al client', 'negato',
  case when has_column_privilege('authenticated', 'public.eventi', 'ore_pcto', 'UPDATE') then 'concesso' else 'negato' end,
  not has_column_privilege('authenticated', 'public.eventi', 'ore_pcto', 'UPDATE');
insert into esiti select 34, 'privilegio: update di stato concesso al client', 'concesso',
  case when has_column_privilege('authenticated', 'public.eventi', 'stato', 'UPDATE') then 'concesso' else 'negato' end,
  has_column_privilege('authenticated', 'public.eventi', 'stato', 'UPDATE');
insert into esiti select 35, 'privilegio: insert di ore_pcto negato al client (migrazione B)', 'negato',
  case when has_column_privilege('authenticated', 'public.eventi', 'ore_pcto', 'INSERT') then 'concesso' else 'negato' end,
  not has_column_privilege('authenticated', 'public.eventi', 'ore_pcto', 'INSERT');
insert into esiti select 36, 'privilegio: insert di titolo concesso al client', 'concesso',
  case when has_column_privilege('authenticated', 'public.eventi', 'titolo', 'INSERT') then 'concesso' else 'negato' end,
  has_column_privilege('authenticated', 'public.eventi', 'titolo', 'INSERT');

-- 37) Il segno della correzione non lo scrive il client.
insert into esiti select 37, 'privilegio: update di ore_pcto_fissate_da negato al client', 'negato',
  case when has_column_privilege('authenticated', 'public.eventi', 'ore_pcto_fissate_da', 'UPDATE') then 'concesso' else 'negato' end,
  not has_column_privilege('authenticated', 'public.eventi', 'ore_pcto_fissate_da', 'UPDATE');

select n, case when coalesce(ok, false) then '✓' else '✗' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
