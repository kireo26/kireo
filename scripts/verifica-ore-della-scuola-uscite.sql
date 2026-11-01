-- Verifica di 20261129100000 (Mario, 01/11): le ore «registrate dalla scuola»
-- sono uscite, e le ore vengono solo dalle presenze certificate.
--
-- CONTROPROVA: su una replica nata senza la migrazione sono rosse la 1 e la 2
-- (le tabelle e il tipo ci sono ancora). Verdi nei due mondi la 3 e la 4: la
-- certificazione di una scuola (la strada della DAD) scrive ancora le ore, ed è
-- la cosa che la cura non doveva rompere.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

-- 1-2 · le tabelle e il tipo non ci sono più
insert into esiti
  select 1, 'activities e student_activities sono uscite', 'assenti',
         coalesce(to_regclass('public.activities')::text, '-') || ' · ' || coalesce(to_regclass('public.student_activities')::text, '-'),
         to_regclass('public.activities') is null and to_regclass('public.student_activities') is null;
insert into esiti
  select 2, 'il tipo student_activity_status è uscito', 'assente',
         case when exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                           where n.nspname = 'public' and t.typname = 'student_activity_status') then 'presente' else 'assente' end,
         not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                     where n.nspname = 'public' and t.typname = 'student_activity_status');

-- 3-4 · la scuola certifica una presenza (la DAD) e le ore si scrivono
insert into auth.users (id, email) values
  ('33333333-0000-0000-0000-0000000000d1', 'ref-osu@test.it'),
  ('22222222-0000-0000-0000-0000000000d1', 'stu-osu@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('33333333-0000-0000-0000-0000000000d1', 'referente_scuola', 'Ref', 'Osu', '1980-01-01'),
  ('22222222-0000-0000-0000-0000000000d1', 'studente', 'Stu', 'Osu', '2008-01-01');
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto)
  values ('TESTOSU1', 'Scuola Osu', 'MI', 'Liceo') on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato)
  values ('dd000000-0000-0000-0000-0000000000d1', 'TESTOSU1', 'attiva');
insert into public.school_staff (scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da,
                                 puo_verificare_studenti, puo_gestire_classi, puo_certificare_presenze, puo_inviare_comunicazioni)
  values ('dd000000-0000-0000-0000-0000000000d1', '33333333-0000-0000-0000-0000000000d1', 'referente', true,
          '33333333-0000-0000-0000-0000000000d1', true, true, true, true);
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica)
  values ('22222222-0000-0000-0000-0000000000d1', 'TESTOSU1', '5A', 2027, 'verificato');
insert into public.istituzioni (id, nome, slug, tipo, stato)
  values ('aaaaaaaa-0000-0000-0000-0000000000d1', 'Ente Osu', 'ente-osu', 'its', 'attiva');
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico)
  values ('e0000000-0000-0000-0000-0000000000d1', 'Webinar Osu', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000d1',
          now() - interval '3 hours', now() - interval '1 hour', 'approvato', 'studenti');
insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine)
  values ('22222222-0000-0000-0000-0000000000d1', 'e0000000-0000-0000-0000-0000000000d1', 'iscritto', 'scuola');

do $$
declare v_errore text; v_ore numeric;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000d1', true);
  begin
    perform public.certifica_presenza('e0000000-0000-0000-0000-0000000000d1', '22222222-0000-0000-0000-0000000000d1');
  exception when others then v_errore := sqlerrm;
  end;
  reset role;
  select ore_riconosciute into v_ore from public.iscrizioni_eventi
  where student_id = '22222222-0000-0000-0000-0000000000d1' and evento_id = 'e0000000-0000-0000-0000-0000000000d1';
  insert into esiti values (3, 'la scuola certifica la presenza (la strada della DAD)', 'riuscita',
    coalesce('errore: ' || v_errore, 'riuscita'), v_errore is null);
  insert into esiti values (4, '…e le ore riconosciute sono quelle dell''incontro (2,00)', '2.00',
    coalesce(v_ore::text, 'null'), v_ore = 2.00);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where not coalesce(ok, false)) || ' ROTTE su ' || count(*) as riepilogo from esiti;

rollback;
