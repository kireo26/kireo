-- 20261210110000 — lo studente legge le proprie righe di assistente_richieste (04/11)
--
-- PERCHÉ. «Scarica i miei dati» dal 04/11 (6b) porta le domande fatte
-- all'assistente: una riga per domanda, con la sola data, scritta dal tetto
-- del giorno (20261104140000). Quella migrazione aveva tolto al client ogni
-- privilegio e concesso solo l'insert di `student_id`, senza una ragione per
-- la lettura: il client non aveva niente da leggere lì. Adesso sì, e solo le
-- righe sue.
--
-- COSA SI APRE: `student_id` e `created_at`, per le righe dove
-- `student_id = auth.uid()`. Niente testo (la tabella non ne ha), niente righe
-- di altri. L'id resta chiuso: nel file non serve.
--
-- SE SI ROMPE: senza questa migrazione la sezione «assistenteDomande» del file
-- non si ottiene, e il file lo dice in cima (`parti.nonOttenute`). Il resto
-- del file non cambia.

create policy assistente_richieste_select_own on public.assistente_richieste
  for select to authenticated using (student_id = auth.uid());
grant select (student_id, created_at) on public.assistente_richieste to authenticated;

do $$
begin
  if not has_column_privilege('authenticated', 'public.assistente_richieste', 'created_at', 'SELECT') then
    raise exception '20261210110000: authenticated non legge created_at di assistente_richieste';
  end if;
  if has_column_privilege('anon', 'public.assistente_richieste', 'created_at', 'SELECT') then
    raise exception '20261210110000: anon legge assistente_richieste';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assistente_richieste' and policyname = 'assistente_richieste_select_own') then
    raise exception '20261210110000: manca la policy di lettura';
  end if;
end $$;
