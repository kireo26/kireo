-- Verifica di 20261103120000 (Mario, 27/10): le colonne di `istituzioni` che
-- decidono non le scrive chi ne beneficia.
--
-- CONTROPROVA: su una replica nata senza la migrazione sono rosse la 1, 2, 3,
-- 5, 8 e 9: l'ente cambia tipo e nome, lo stato gli «riesce» senza cambiare
-- (muto), un collegato crea un'istituzione con il piano che vuole, e dal SQL
-- Editor un cambio di piano non atterra. La 4, 6 e 7 sono il comportamento di
-- prima, che non deve cambiare.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000c1', 'ente-col@test.it'),
  ('11111111-0000-0000-0000-0000000000c2', 'admin-col@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000c1', 'istituzione', 'E', 'Col', '1980-01-01'),
  ('11111111-0000-0000-0000-0000000000c2', 'admin', 'A', 'Col', '1980-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'Accademia Col', 'accademia-col', 'academy', 'in_attesa');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1');

-- Prova una scrittura come una persona, e dice com'è andata.
create or replace function pg_temp.prova(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v_righe integer;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute p_sql;
  get diagnostics v_righe = row_count;
  return 'righe ' || v_righe;
exception when others then
  return 'errore ' || sqlstate || ' ' || sqlerrm;
end $$;
grant execute on function pg_temp.prova(uuid, text) to authenticated;

do $$
declare
  v_tipo text; v_nome text; v_desc text; v_stato text; v_attiva text; v_piano text; v_ins text;
  v_tipo_val text; v_stato_val text;
  ENTE constant uuid := '11111111-0000-0000-0000-0000000000c1';
  ADMIN constant uuid := '11111111-0000-0000-0000-0000000000c2';
  IST constant text := '''aaaaaaaa-0000-0000-0000-0000000000c1''';
begin
  set local role authenticated;
  v_tipo := pg_temp.prova(ENTE, 'update public.istituzioni set tipo = ''universita'' where id = ' || IST);
  v_nome := pg_temp.prova(ENTE, 'update public.istituzioni set nome = ''Università di Bologna'' where id = ' || IST);
  v_desc := pg_temp.prova(ENTE, 'update public.istituzioni set descrizione = ''Chi siamo'', provincia = ''Milano'' where id = ' || IST);
  v_stato := pg_temp.prova(ENTE, 'update public.istituzioni set stato = ''attiva'' where id = ' || IST);
  v_ins := pg_temp.prova(ENTE, 'insert into public.istituzioni (nome, slug, tipo, stato, piano_id) values (''Altra'', ''altra-col'', ''universita'', ''in_attesa'', null)');
  v_attiva := pg_temp.prova(ADMIN, 'update public.istituzioni set stato = ''attiva'' where id = ' || IST);
  v_piano := pg_temp.prova(ADMIN, 'update public.istituzioni set piano_scade_il = current_date + 30 where id = ' || IST);
  reset role;
  select tipo::text, stato::text into v_tipo_val, v_stato_val from public.istituzioni where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  insert into esiti values (1, 'l''ente non cambia il proprio tipo (decide le aree)', 'errore 42501', v_tipo || ' → tipo ' || v_tipo_val,
    v_tipo like 'errore 42501%' and v_tipo_val = 'academy');
  insert into esiti values (2, 'l''ente non cambia il proprio nome (è quello approvato)', 'errore 42501', v_nome, v_nome like 'errore 42501%');
  insert into esiti values (3, 'l''ente non scrive il tipo nemmeno per privilegio', 'falso',
    has_column_privilege('authenticated', 'public.istituzioni', 'tipo', 'UPDATE')::text,
    not has_column_privilege('authenticated', 'public.istituzioni', 'tipo', 'UPDATE'));
  insert into esiti values (4, 'l''ente aggiorna descrizione e provincia, come dal profilo', 'righe 1', v_desc, v_desc = 'righe 1');
  insert into esiti values (5, 'l''ente che prova ad attivarsi riceve un errore, non un «riuscito» muto', 'errore … colonna_riservata_admin', v_stato,
    v_stato like '%colonna_riservata_admin%');
  insert into esiti values (6, 'l''admin attiva l''ente dal client', 'righe 1 → attiva', v_attiva || ' → ' || v_stato_val, v_attiva = 'righe 1' and v_stato_val = 'attiva');
  insert into esiti values (7, 'l''admin cambia il piano dal client (approva_richiesta_upgrade non è definer)', 'righe 1', v_piano, v_piano = 'righe 1');
  insert into esiti values (8, 'un collegato non crea un''istituzione da sé (la crea finalize_registration_istituzione)', 'errore 42501', v_ins, v_ins like 'errore 42501%');
end $$;

-- 9 · dal SQL Editor (nessuna sessione) un cambio di piano atterra.
do $$
declare v_prima date; v_dopo date;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  select piano_scade_il into v_prima from public.istituzioni where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  update public.istituzioni set piano_scade_il = date '2030-01-01' where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  select piano_scade_il into v_dopo from public.istituzioni where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  insert into esiti values (9, 'dal SQL Editor un cambio di piano atterra (prima veniva rimesso in silenzio)', '2030-01-01',
    coalesce(v_dopo::text, 'null'), v_dopo = date '2030-01-01');
exception when others then
  insert into esiti values (9, 'dal SQL Editor un cambio di piano atterra', '2030-01-01', 'errore ' || sqlerrm, false);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
