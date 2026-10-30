-- Verifica di 20261111100000 (Mario, 28/10): gli «Interessati» di un ente.
-- L'ente vede il dichiarato e quello che lo studente ha fatto VERSO DI LUI, e
-- l'attività solo se il consenso la nominava; mai quello fatto con altri enti;
-- una revoca toglie la scheda; un piano gratuito e un altro ente non vedono.
--
-- LA CONTROPROVA, fatta il 28/10 sulla replica con le funzioni sabotate:
--   - la scheda senza il filtro sull'ente → rossa la 6 (compare «Evento di Due»);
--   - la scheda senza il ritorno anticipato del consenso vecchio → rossa la 7;
--   - il valore di partenza della colonna lasciato a false → rosse 1, 4 e 6.
-- Su una replica NATA SENZA la migrazione lo script non parte (la fixture
-- scrive copre_attivita): è il «NON PARTITA» di controprova-sql.sh, non una
-- conferma.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('NAPS000INT', 'LICEO INTERESSATI', 'Napoli', 'Liceo');

insert into auth.users (id, email) values
  ('22222222-0000-0000-0000-0000000000a1', 'ente-int-1@test.it'),
  ('22222222-0000-0000-0000-0000000000a2', 'ente-int-2@test.it'),
  ('22222222-0000-0000-0000-0000000000a3', 'ente-int-free@test.it'),
  ('22222222-0000-0000-0000-0000000000b1', 'stud-int-nuovo@test.it'),
  ('22222222-0000-0000-0000-0000000000b2', 'stud-int-vecchio@test.it'),
  ('22222222-0000-0000-0000-0000000000b3', 'stud-int-altro@test.it'),
  ('22222222-0000-0000-0000-0000000000b4', 'stud-int-revocato@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('22222222-0000-0000-0000-0000000000a1', 'istituzione', 'E', 'Uno', '1980-01-01'),
  ('22222222-0000-0000-0000-0000000000a2', 'istituzione', 'E', 'Due', '1980-01-01'),
  ('22222222-0000-0000-0000-0000000000a3', 'istituzione', 'E', 'Free', '1980-01-01'),
  ('22222222-0000-0000-0000-0000000000b1', 'studente', 'Nuova', 'Condivisione', '2008-01-01'),
  ('22222222-0000-0000-0000-0000000000b2', 'studente', 'Vecchia', 'Condivisione', '2008-01-01'),
  ('22222222-0000-0000-0000-0000000000b3', 'studente', 'Solo', 'Altrove', '2008-01-01'),
  ('22222222-0000-0000-0000-0000000000b4', 'studente', 'Ha', 'Revocato', '2008-01-01');
insert into public.student_profiles (user_id, school_code, classe, anno_diploma) values
  ('22222222-0000-0000-0000-0000000000b1', 'NAPS000INT', '5° anno', 2027),
  ('22222222-0000-0000-0000-0000000000b2', 'NAPS000INT', '4° anno', 2028),
  ('22222222-0000-0000-0000-0000000000b3', 'NAPS000INT', '5° anno', 2027),
  ('22222222-0000-0000-0000-0000000000b4', 'NAPS000INT', '5° anno', 2027);
insert into public.student_area_interests (user_id, area_slug) values
  ('22222222-0000-0000-0000-0000000000b1', 'informatica-digitale');

insert into public.istituzioni (id, nome, slug, tipo, stato, piano_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Ente Uno', 'ente-int-uno', 'universita', 'attiva', (select id from public.piani where nome = 'premium')),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'Ente Due', 'ente-int-due', 'universita', 'attiva', (select id from public.piani where nome = 'premium')),
  ('aaaaaaaa-0000-0000-0000-0000000000a3', 'Ente Free', 'ente-int-free', 'universita', 'attiva', (select id from public.piani where nome = 'free'));
insert into public.institution_profiles (user_id, istituzione_id) values
  ('22222222-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1'),
  ('22222222-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a2'),
  ('22222222-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-0000000000a3');

-- Un evento di ciascun ente, e lo studente «nuovo» collegato a TUTTI E DUE:
-- l'ente Uno deve vedere il suo e non quello dell'ente Due.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'Evento di Uno', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000a1', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti'),
  ('eeeeeeee-0000-0000-0000-0000000000a2', 'Evento di Due', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000a2', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti');
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000b1', 37),
  ('eeeeeeee-0000-0000-0000-0000000000a2', '22222222-0000-0000-0000-0000000000b1', 12),
  ('eeeeeeee-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000b2', 20);
insert into public.recinto_enti (student_id, istituzione_id, origine) values
  ('22222222-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'guida'),
  ('22222222-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'guida');

-- La condivisione «vecchia», come le righe di prima della migrazione.
insert into public.manifestazioni_interesse (student_id, istituzione_id, copre_attivita) values
  ('22222222-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000a1', false);
-- Quella con un altro ente soltanto, e una revocata.
insert into public.manifestazioni_interesse (student_id, istituzione_id) values
  ('22222222-0000-0000-0000-0000000000b3', 'aaaaaaaa-0000-0000-0000-0000000000a2');
insert into public.manifestazioni_interesse (student_id, istituzione_id, revocata_il) values
  ('22222222-0000-0000-0000-0000000000b4', 'aaaaaaaa-0000-0000-0000-0000000000a1', now());

do $$
declare
  v_copre boolean;
  v_errore text := 'nessuno';
  v_elenco jsonb;
  v_scheda_nuovo jsonb;
  v_scheda_vecchio jsonb;
  v_scheda_revocato jsonb;
  v_free text := 'nessuno';
  v_due_su_uno text := 'nessuno';
  v_vecchia int := -1;
begin
  -- La condivisione nuova, dal client come la fa il bottone.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-0000000000b1', true);
  insert into public.manifestazioni_interesse (student_id, istituzione_id)
    values ('22222222-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000a1');
  begin
    insert into public.manifestazioni_interesse (student_id, istituzione_id, copre_attivita)
      values ('22222222-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000a2', true);
  exception when others then v_errore := sqlstate;
  end;
  reset role;
  select copre_attivita into v_copre from public.manifestazioni_interesse
   where student_id = '22222222-0000-0000-0000-0000000000b1' and istituzione_id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
  insert into esiti values (1, 'una condivisione nuova dal client copre l''attività', 'true', coalesce(v_copre::text, 'null'), v_copre is true);
  insert into esiti values (2, 'il client non scrive copre_attivita', '42501', v_errore, v_errore = '42501');

  -- L'ente Uno guarda.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-0000000000a1', true);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.cognome, r.nome), '[]'::jsonb) into v_elenco
    from public.interessati_ente('aaaaaaaa-0000-0000-0000-0000000000a1') r;
  v_scheda_nuovo := public.scheda_interessato_ente('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000b1');
  v_scheda_vecchio := public.scheda_interessato_ente('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000b2');
  v_scheda_revocato := public.scheda_interessato_ente('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000b4');
  select count(*) into v_vecchia from public.manifestazioni_dettaglio_ente('aaaaaaaa-0000-0000-0000-0000000000a1');
  reset role;

  insert into esiti values (3, 'l''elenco ha i due che hanno condiviso con Uno: non chi ha condiviso solo con Due, non il revocato', 'Nuova, Vecchia',
    (select string_agg(e->>'nome', ', ' order by e->>'nome') from jsonb_array_elements(v_elenco) e),
    (select string_agg(e->>'nome', ', ' order by e->>'nome') from jsonb_array_elements(v_elenco) e) = 'Nuova, Vecchia');
  insert into esiti values (4, 'il nuovo: un evento seguito (il suo, non quello di Due) e la guida', '1 · true',
    (select (e->>'eventi_seguiti') || ' · ' || (e->>'guida_scaricata') from jsonb_array_elements(v_elenco) e where e->>'nome' = 'Nuova'),
    (select e->>'eventi_seguiti' = '1' and e->>'guida_scaricata' = 'true' from jsonb_array_elements(v_elenco) e where e->>'nome' = 'Nuova'));
  insert into esiti values (5, 'il vecchio consenso: l''attività è vuota, non zero', 'null · null',
    (select coalesce(e->>'eventi_seguiti', 'null') || ' · ' || coalesce(e->>'guida_scaricata', 'null') from jsonb_array_elements(v_elenco) e where e->>'nome' = 'Vecchia'),
    (select e->'eventi_seguiti' = 'null'::jsonb and e->'guida_scaricata' = 'null'::jsonb from jsonb_array_elements(v_elenco) e where e->>'nome' = 'Vecchia'));
  insert into esiti values (6, 'la scheda del nuovo: un evento, il suo, con i minuti', 'Evento di Uno · 37',
    coalesce((select string_agg((e->>'titolo') || ' · ' || (e->>'minuti'), '; ') from jsonb_array_elements(v_scheda_nuovo->'eventi') e), 'null'),
    jsonb_array_length(v_scheda_nuovo->'eventi') = 1 and v_scheda_nuovo->'eventi'->0->>'titolo' = 'Evento di Uno' and v_scheda_nuovo->'eventi'->0->>'minuti' = '37');
  insert into esiti values (7, 'la scheda del vecchio consenso non porta né eventi né guida', 'assenti',
    case when v_scheda_vecchio ? 'eventi' or v_scheda_vecchio ? 'guida_scaricata_il' then 'presenti' else 'assenti' end,
    v_scheda_vecchio is not null and not (v_scheda_vecchio ? 'eventi') and not (v_scheda_vecchio ? 'guida_scaricata_il'));
  insert into esiti values (8, 'chi ha revocato non ha più una scheda', 'null', coalesce(v_scheda_revocato::text, 'null'), v_scheda_revocato is null);

  -- Il piano gratuito, e un ente che chiede le righe di un altro.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-0000000000a3', true);
  begin
    perform public.interessati_ente('aaaaaaaa-0000-0000-0000-0000000000a3');
  exception when others then v_free := sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-0000000000a2', true);
  begin
    perform public.scheda_interessato_ente('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000b1');
  exception when others then v_due_su_uno := sqlerrm;
  end;
  reset role;
  insert into esiti values (9, 'un piano gratuito non legge l''elenco', 'non_autorizzato', v_free, v_free = 'non_autorizzato');
  insert into esiti values (10, 'un ente non legge le schede di un altro', 'non_autorizzato', v_due_su_uno, v_due_su_uno = 'non_autorizzato');
  insert into esiti values (11, 'controllo: la funzione di prima risponde ancora (il codice vecchio durante il deploy)', '2', v_vecchia::text, v_vecchia = 2);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
