-- Verifica di 20261027100000_fine_effettiva.sql: una diretta chiusa in anticipo
-- è finita alla chiusura, e le tre finestre che rispondono a «è finito?» lo
-- sanno — la domanda finale non si cambia più, la consegna si apre, le domande in
-- diretta si chiudono.
--
-- Gira anche nel SQL Editor di Supabase: transazione con ROLLBACK, e in coda un
-- `select` invece di un silenzio.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA la migrazione: con le
-- funzioni di prima, le proprietà 4-8 diventano rosse (il caso del 25/10:
-- chiusa alle 14:24, la domanda si cambiava fino alle 14:30).

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000f1', 'ente-fe@test.it'),
  ('22222222-0000-0000-0000-0000000000f1', 's-fe@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000f1', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('22222222-0000-0000-0000-0000000000f1', 'studente', 'Stu', 'Dente', '2008-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Ente FE', 'ente-fe', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1');

-- EV_A (anticipata): cominciata 25 minuti fa, programmata fino a fra 35 minuti.
--   Si chiude adesso: la fine effettiva è adesso, non fra 35 minuti.
-- EV_N (non chiusa): stessa finestra, nessuna chiusura.
-- EV_T (tardiva): finita un'ora fa, chiusa adesso — la fine effettiva resta
--   quella programmata.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                           hosting_diretta, youtube_video_id, incorporamento_sonda, ore_pcto, domanda_consegna) values
  ('e0000000-0000-0000-0000-0000000000fa', 'Anticipata', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000f1',
   now() - interval '25 minutes', now() + interval '35 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo', 1,
   'Che vincolo hai scelto e chi lo paga?'),
  ('e0000000-0000-0000-0000-0000000000fb', 'Non chiusa', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000f1',
   now() - interval '25 minutes', now() + interval '35 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo', 1, null),
  ('e0000000-0000-0000-0000-0000000000fc', 'Tardiva', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000f1',
   now() - interval '2 hours', now() - interval '1 hour', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo', 1, null);
insert into public.eventi_aree (evento_id, area_slug) values
  ('e0000000-0000-0000-0000-0000000000fa', 'informatica-digitale'),
  ('e0000000-0000-0000-0000-0000000000fb', 'informatica-digitale'),
  ('e0000000-0000-0000-0000-0000000000fc', 'informatica-digitale');
insert into public.iscrizioni_eventi (evento_id, student_id) values
  ('e0000000-0000-0000-0000-0000000000fa', '22222222-0000-0000-0000-0000000000f1');

-- 1) PRIMA della chiusura: la domanda si cambia, la consegna è chiusa, le domande
--    in diretta sono aperte. Senza questa riga le proprietà dopo potrebbero essere
--    vere per una ragione qualunque.
insert into esiti select 1, 'prima della chiusura: domanda modificabile, consegna chiusa, diretta aperta',
  'true/false/true',
  public.domanda_consegna_modificabile('e0000000-0000-0000-0000-0000000000fa')::text || '/' ||
  public.consegna_evento_aperta('e0000000-0000-0000-0000-0000000000fa')::text || '/' ||
  public.evento_in_finestra_diretta('e0000000-0000-0000-0000-0000000000fa')::text,
  public.domanda_consegna_modificabile('e0000000-0000-0000-0000-0000000000fa')
    and not public.consegna_evento_aperta('e0000000-0000-0000-0000-0000000000fa')
    and public.evento_in_finestra_diretta('e0000000-0000-0000-0000-0000000000fa');

-- 2) Non chiusa: la fine effettiva è la programmata.
insert into esiti select 2, 'non chiusa: fine effettiva = data_fine', 'uguali',
  (public.fine_effettiva_evento(e.id) = e.data_fine)::text, public.fine_effettiva_evento(e.id) = e.data_fine
  from public.eventi e where e.id = 'e0000000-0000-0000-0000-0000000000fb';

-- La chiusura anticipata, dalla porta dell'ente.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000f1', true);
  perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000fa');
  perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000fc');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
end $$;

-- 3) Anticipata: la fine effettiva è la chiusura.
insert into esiti select 3, 'chiusa in anticipo: fine effettiva = chiusura', 'uguali',
  (public.fine_effettiva_evento(e.id) = e.diretta_chiusa_il)::text,
  e.diretta_chiusa_il is not null and public.fine_effettiva_evento(e.id) = e.diretta_chiusa_il
  from public.eventi e where e.id = 'e0000000-0000-0000-0000-0000000000fa';

-- 4) Il caso del 25/10: dopo la chiusura la domanda NON si cambia più.
insert into esiti select 4, 'chiusa in anticipo: la domanda non è più modificabile', 'false',
  public.domanda_consegna_modificabile('e0000000-0000-0000-0000-0000000000fa')::text,
  not public.domanda_consegna_modificabile('e0000000-0000-0000-0000-0000000000fa');

-- 5) …e la porta dell'ente lo dice, con il rifiuto che il pannello traduce.
do $$
declare v_msg text := 'nessun errore';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000f1', true);
  begin
    perform public.imposta_domanda_consegna('e0000000-0000-0000-0000-0000000000fa', 'Una domanda cambiata dopo la chiusura');
  exception when others then v_msg := sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (5, 'chiusa in anticipo: imposta_domanda_consegna rifiuta', 'domanda_non_piu_modificabile', v_msg,
    v_msg = 'domanda_non_piu_modificabile');
end $$;

-- 6) La consegna si apre ALLA CHIUSURA, non alla fine programmata.
insert into esiti select 6, 'chiusa in anticipo: la consegna è aperta', 'true',
  public.consegna_evento_aperta('e0000000-0000-0000-0000-0000000000fa')::text,
  public.consegna_evento_aperta('e0000000-0000-0000-0000-0000000000fa');

-- 7) La finestra della diretta è chiusa.
insert into esiti select 7, 'chiusa in anticipo: evento_in_finestra_diretta è falso', 'false',
  public.evento_in_finestra_diretta('e0000000-0000-0000-0000-0000000000fa')::text,
  not public.evento_in_finestra_diretta('e0000000-0000-0000-0000-0000000000fa');

-- 8) …quindi una domanda in diretta scritta dopo la chiusura viene respinta.
do $$
declare v_msg text := 'passata';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-0000000000f1', true);
  begin
    insert into public.domande_live (evento_id, user_id, testo)
      values ('e0000000-0000-0000-0000-0000000000fa', '22222222-0000-0000-0000-0000000000f1', 'Una domanda dopo la chiusura');
  exception when others then v_msg := 'respinta';
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (8, 'chiusa in anticipo: una domanda in diretta è respinta', 'respinta', v_msg, v_msg = 'respinta');
end $$;

-- 9) Chiusa DOPO la fine programmata: la fine effettiva resta la programmata.
insert into esiti select 9, 'chiusa tardi: fine effettiva = data_fine, non la chiusura', 'uguali',
  (public.fine_effettiva_evento(e.id) = e.data_fine)::text,
  e.diretta_chiusa_il is not null and public.fine_effettiva_evento(e.id) = e.data_fine
  from public.eventi e where e.id = 'e0000000-0000-0000-0000-0000000000fc';

-- 10) Un anonimo non la chiama.
do $$
declare v_msg text := 'eseguita';
begin
  set local role anon;
  begin
    perform public.fine_effettiva_evento('e0000000-0000-0000-0000-0000000000fa');
  exception when insufficient_privilege then v_msg := 'negata';
  end;
  reset role;
  insert into esiti values (10, 'anon non può chiamare fine_effettiva_evento', 'negata', v_msg, v_msg = 'negata');
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
