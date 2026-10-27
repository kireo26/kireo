-- Verifica di 20261104110000 (Mario, 27/10): una delega dello staff cambiata
-- senza autore si rifiuta.
--
-- CONTROPROVA: su una replica nata senza la migrazione sono rosse la 2, la 3 e
-- la 4 (misurato il 27/10): la delega atterra con autore NULL, e anche l'autore
-- scritto a mano veniva sovrascritto con NULL — quindi senza sessione non c'era
-- nessuna strada per scrivere chi è stato. La 1 è il comportamento di prima.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('33333333-0000-0000-0000-0000000000e1', 'ref-del@test.it'),
  ('33333333-0000-0000-0000-0000000000e2', 'tutor-del@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('33333333-0000-0000-0000-0000000000e1', 'referente_scuola', 'Ref', 'Del', '1980-01-01'),
  ('33333333-0000-0000-0000-0000000000e2', 'tutor_scuola', 'Tut', 'Del', '1980-01-01');
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto)
  values ('TESTDEL1', 'Scuola Del', 'MI', 'Liceo') on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato)
  values ('dd000000-0000-0000-0000-0000000000e1', 'TESTDEL1', 'attiva');
insert into public.school_staff (id, scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da) values
  ('ee000000-0000-0000-0000-0000000000e1', 'dd000000-0000-0000-0000-0000000000e1', '33333333-0000-0000-0000-0000000000e1', 'referente', true, '33333333-0000-0000-0000-0000000000e1'),
  ('ee000000-0000-0000-0000-0000000000e2', 'dd000000-0000-0000-0000-0000000000e1', '33333333-0000-0000-0000-0000000000e2', 'tutor', true, '33333333-0000-0000-0000-0000000000e1');

-- 1 · con una sessione, l'autore è chi è collegato.
do $$
declare v_da uuid;
begin
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000e1', true);
  update public.school_staff set puo_gestire_classi = not puo_gestire_classi where id = 'ee000000-0000-0000-0000-0000000000e2';
  select delega_aggiornata_da into v_da from public.school_staff where id = 'ee000000-0000-0000-0000-0000000000e2';
  insert into esiti values (1, 'con una sessione l''autore è chi è collegato', 'il referente', coalesce(v_da::text, 'null'),
    v_da = '33333333-0000-0000-0000-0000000000e1');
end $$;

-- 2 · senza sessione e senza autore: si ferma.
do $$
declare v_esito text := 'atterrata'; v_da uuid;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    update public.school_staff set puo_verificare_studenti = not puo_verificare_studenti, delega_aggiornata_da = null
    where id = 'ee000000-0000-0000-0000-0000000000e2';
  exception when others then v_esito := sqlerrm;
  end;
  select delega_aggiornata_da into v_da from public.school_staff where id = 'ee000000-0000-0000-0000-0000000000e2';
  insert into esiti values (2, 'senza sessione, una delega con autore NULL si rifiuta', 'autore_delega_mancante',
    v_esito || ' (autore ' || coalesce(v_da::text, 'null') || ')', v_esito = 'autore_delega_mancante');
end $$;

-- 3 · senza sessione, lasciando l'autore di prima: si ferma (era l'autore della delega di prima).
do $$
declare v_esito text := 'atterrata';
begin
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    update public.school_staff set puo_inviare_comunicazioni = not puo_inviare_comunicazioni
    where id = 'ee000000-0000-0000-0000-0000000000e2';
  exception when others then v_esito := sqlerrm;
  end;
  insert into esiti values (3, 'senza sessione, l''autore di prima non vale per la delega nuova', 'autore_delega_mancante',
    v_esito, v_esito = 'autore_delega_mancante');
end $$;

-- 4 · senza sessione e con l'autore scritto a mano: atterra con quell'autore.
do $$
declare v_esito text := 'atterrata'; v_da uuid;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    update public.school_staff set puo_certificare_presenze = not puo_certificare_presenze,
      delega_aggiornata_da = '33333333-0000-0000-0000-0000000000e2'
    where id = 'ee000000-0000-0000-0000-0000000000e2';
  exception when others then v_esito := sqlerrm;
  end;
  select delega_aggiornata_da into v_da from public.school_staff where id = 'ee000000-0000-0000-0000-0000000000e2';
  insert into esiti values (4, 'senza sessione, con l''autore scritto a mano, la delega atterra con quell''autore', 'atterrata, il tutor',
    v_esito || ', ' || coalesce(v_da::text, 'null'), v_esito = 'atterrata' and v_da = '33333333-0000-0000-0000-0000000000e2');
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
