-- I QUATTRO PROFILI NON MARCATI, MARCATI (Mario, 27/10).
--
-- Sono account di prova nati prima che il valore di partenza di `di_prova`
-- diventasse vero (20261031100000): nessun percorso del prodotto scrive quella
-- colonna, quindi sono nati falsi e contano come utenti veri in ogni misura.
-- Si marcano DOPO la separazione e l'inversione, non prima: «pulire il confine
-- con la porta ancora aperta vuol dire rifarlo».
--
-- Solo «fuori dai conti» (`di_prova`), NON «esente dai cancelli»: nessuno dei
-- quattro è il robot del banco, e un account che salta i cancelli non li fa
-- vedere a nessuno.
--
-- Per id, con l'indirizzo come commento: l'id è quello che non cambia, il
-- commento è quello che una persona riconosce.
--
-- ⚠️ TRE CASI, CONTATI PRIMA DI SCRIVERE. Quattro id dati da Mario devono
-- essere quattro righe: se ne esistono da una a tre la migrazione si ferma,
-- perché un `update` che ne tocca tre è riuscito a metà e si presenta come
-- riuscito (la regola del 30/08: dopo una scrittura si rilegge). Se non ne
-- esiste NESSUNO è una replica costruita dai file (`scripts/replica-locale.sh`),
-- che quei profili non li ha: lo dice e non tocca niente. Un caso a metà non si
-- confonde con una replica: zero è zero.
--
-- COME SI VERIFICA APPLICATA: le quattro righe hanno `di_prova = true` e
-- `esente_cancelli = false`.

do $$
declare
  v_presenti integer;
  v_n integer;
  v_ids uuid[] := array[
    '9fd1c239-8339-4d55-b1df-979a076e274a', -- afterapplep@gmail.com (referente_scuola)
    '0adfec45-0b8a-4656-a2cc-b576d97e8d5f', -- annamontefusco.1988@gmail.com (istituzione)
    '3eeea516-f071-4c96-af09-609c2b4ed99f', -- annamontefuscoboutique@gmail.com (studente)
    '4c4b0358-98d0-4eef-8751-3927de40b523'  -- consulente.izzo+test9@gmail.com (istituzione)
  ]::uuid[];
begin
  select count(*) into v_presenti from public.profiles where id = any(v_ids);

  if v_presenti = 0 then
    raise notice 'marca_quattro_profili: nessuno dei quattro profili esiste qui (una replica): niente da marcare';
    return;
  end if;
  if v_presenti <> 4 then
    raise exception 'marca_quattro_profili: esistono % profili su 4 — un id è sbagliato o un account è stato cancellato', v_presenti;
  end if;

  update public.profiles set di_prova = true where id = any(v_ids);

  select count(*) into v_n from public.profiles
  where id = any(v_ids) and di_prova and not esente_cancelli;
  if v_n <> 4 then
    raise exception 'marca_quattro_profili: dopo la scrittura % profili su 4 sono di prova e non esenti', v_n;
  end if;
end $$;
