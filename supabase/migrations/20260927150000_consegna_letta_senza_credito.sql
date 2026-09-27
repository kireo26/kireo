-- KIREO — «letta e non ne è emerso niente» smette di somigliare a «non l'abbiamo
-- letta».
--
-- IL DIFETTO, trovato mentre si costruiva il modo di far rileggere una consegna.
-- `consegne_evento.valutata_il` nasce nullo e lo scrive solo
-- `registra_evidenze_consegna_evento`, che con un array di prove vuoto SOLLEVA
-- (`nessuna_prova`, la guardia del 19/09: una scrittura che non ha niente da
-- scrivere non deve dichiarare di essere andata bene). Ma «nessuna area
-- riconosciuta» è un ESITO LEGITTIMO del prodotto, non un guasto: la route lo
-- dice allo studente e non registra niente. Conseguenza: quella consegna resta
-- `valutata_il` nulla **per sempre**, indistinguibile da una che la nostra
-- chiamata non è riuscita a leggere.
--
-- Perché non è un dettaglio: la pagina della diretta, su una consegna non
-- valutata, dice «la stiamo leggendo» e (da oggi) offre di farla rileggere. Su
-- una lettura riuscita-senza-credito quell'invito sarebbe una porta che riporta
-- sempre allo stesso posto, **e ogni giro costa una chiamata a pagamento**.
--
-- COSA FA QUESTA FUNZIONE, e cosa NON fa: segna la consegna come letta, e non
-- scrive nessuna prova. Quindi `valutata_il is not null` significa da qui in
-- avanti «l'abbiamo letta» — con credito o senza — e `valutata_il is null`
-- significa «la lettura non è arrivata», che è l'unico caso in cui rileggere ha
-- senso. Prima quei due stati erano lo stesso stato.
--
-- Non tocca `registra_evidenze_consegna_evento`: la sua guardia sull'array vuoto
-- resta com'è, perché serve a un'altra cosa (una scrittura di prove che non
-- scrive niente). Le due funzioni dicono due cose diverse e restano due.
--
-- SICUREZZA: definer, e l'identità la decide `auth.uid()` come le sorelle — mai
-- un parametro con l'id dello studente, che sarebbe un modo per segnare la
-- consegna di un altro. Aggiorna solo se `valutata_il` è ancora nullo, quindi
-- chiamarla due volte non sposta la data.

create or replace function public.segna_consegna_letta(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_righe integer;
begin
  if v_student is null then
    raise exception 'non_autorizzato';
  end if;

  update public.consegne_evento
     set valutata_il = now()
   where evento_id = p_evento_id
     and student_id = v_student
     and valutata_il is null;

  get diagnostics v_righe = row_count;

  -- Zero righe non è un errore da sollevare: o la consegna era già letta
  -- (idempotenza) o non esiste. Il secondo caso lo si distingue perché la riga
  -- non c'è, e chi chiama l'ha appena scritta.
  if v_righe = 0 and not exists (
    select 1 from public.consegne_evento
     where evento_id = p_evento_id and student_id = v_student
  ) then
    raise exception 'non_autorizzato';
  end if;
end;
$$;

comment on function public.segna_consegna_letta(uuid) is
  'Segna la propria consegna come letta senza scrivere prove: serve all''esito legittimo «nessuna area riconosciuta», che altrimenti lascerebbe valutata_il nulla e indistinguibile da una lettura non arrivata. Idempotente.';

-- `revoke … from public, anon` e non solo `from public`: i default privileges di
-- Supabase concedono EXECUTE ad anon e authenticated su ogni funzione nuova
-- dello schema public, e una revoca da PUBLIC non li tocca (verificato sul DB
-- live il 19/09).
revoke all on function public.segna_consegna_letta(uuid) from public, anon;
grant execute on function public.segna_consegna_letta(uuid) to authenticated;
