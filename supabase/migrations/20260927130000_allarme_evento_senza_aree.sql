-- KIREO — l'allarme: una partecipazione certificata senza un'area a cui
-- accreditarsi non passa più per un successo.
--
-- COSA FA OGGI `chiudi_diretta_evento` (verificato leggendo la funzione, non
-- dedotto): per ogni studente certificato scrive il credito di esplorazione con
--
--   insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
--   select v_riga.user_id, ea.area_slug, …
--   from public.eventi_aree ea where ea.evento_id = p_evento_id
--
-- e su un evento senza aree quell'insert **scrive zero righe e riporta
-- successo**: `v_certificati` si alza comunque. Quindi uno studente può seguire
-- un webinar intero, essere certificato, vedersi contare le ore PCTO, e il
-- credito d'area finire nel nulla — senza che niente lo dica né a lui, né
-- all'ente, né a noi. È la definizione della specie che stiamo inseguendo da un
-- mese: un'assenza che passa per un risultato.
--
-- LA PORTA È CHIUSA DOVE NASCE, e sta nel form (`CreaEventoForm`: almeno
-- un'area su un evento `pubblico = 'studenti'`). Questo è l'ALLARME, e serve per
-- le due cose che la porta non copre: gli eventi già creati senza aree, e una
-- strada che non abbiamo visto.
--
-- NON aree obbligatorie a livello di tabella, di proposito: gli eventi per
-- docenti non devono averne (il trigger `blocca_aree_su_eventi_docenti` le
-- VIETA), e un vincolo che vale per metà delle righe è un vincolo che qualcuno
-- toglierà.
--
-- PERCHÉ SI CONTANO LE AREE E NON LE RIGHE SCRITTE. La tentazione è
-- `get diagnostics … row_count` sull'insert, ma quel numero è zero anche in un
-- caso legittimo: `activity_log` ha un indice unico su
-- (student_id, area_slug, tipo_attivita, data), quindi due webinar sulla stessa
-- area nello stesso giorno fanno conflittare il secondo — `on conflict do
-- nothing`, zero righe, nessun difetto. Contare `eventi_aree` è deterministico e
-- non confonde le due cose. (Provato: è la proprietà 6 di
-- scripts/verifica-allarme-evento-senza-aree.sql.)
--
-- UN GUASTO PER EVENTO, non per studente certificato: la causa è una — l'evento
-- non ha aree — e N righe identiche direbbero la stessa cosa N volte rendendo
-- illeggibile la coda. Quanti studenti hanno perso il credito sta nel dettaglio,
-- che è un numero che chi legge può ricontare.
--
-- `di_prova` = false, ed è una scelta da rivedere se il banco imparerà a giocare
-- le dirette: qui non c'è UNO studente da cui dedurlo (la chiusura è un gesto
-- sull'evento, non su una persona), e un evento senza aree è un difetto di
-- configurazione dell'ente, non un artefatto del robot. La regola di casa resta
-- quella: `di_prova` lo passa il chiamante, mai dedotto per via transitiva.
--
-- NOTA SULLO STATO DELLE MIGRAZIONI: da questa sessione non si può interrogare
-- il database reale, quindi **non ho guardato** se
-- 20260726110000_diretta_presenze_domande.sql risulti applicata là. Per questo
-- la funzione si sostituisce qui con un `create or replace` in una migrazione
-- nuova, invece di modificare quel file: applicare questa è corretto in tutti e
-- due i casi.
--
-- Il corpo è quello del 26/07 riportato tale e quale (stessa firma, stessa
-- soglia, stessa idempotenza sulla certificazione manuale): l'unica aggiunta è
-- il conteggio delle aree e l'allarme in coda.

create or replace function public.chiudi_diretta_evento(p_evento_id uuid)
returns table (presenti integer, certificati integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizzatore_id uuid;
  v_pubblico text;
  v_tipo text;
  v_data_fine timestamptz;
  v_trovato boolean;
  v_ping_attesi numeric;
  v_presenti integer;
  v_certificati integer := 0;
  v_riga record;
  v_tipo_attivita public.tipo_attivita;
  v_peso integer;
  v_aree_evento integer;
begin
  select true, organizzatore_id, pubblico, tipo, data_fine
    into v_trovato, v_organizzatore_id, v_pubblico, v_tipo, v_data_fine
  from public.eventi where id = p_evento_id;

  if v_trovato is not true then
    raise exception 'evento_non_trovato';
  end if;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  if v_data_fine is null then
    raise exception 'evento_senza_data_fine';
  end if;
  if now() < v_data_fine then
    raise exception 'evento_ancora_in_corso';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);

  select count(*) into v_presenti from public.presenze_live where evento_id = p_evento_id;

  -- Quante aree ha questo evento: serve all'allarme in coda, e si legge una
  -- volta sola perché la risposta non cambia dentro il ciclo.
  select count(*) into v_aree_evento from public.eventi_aree where evento_id = p_evento_id;

  for v_riga in
    select pl.user_id, pl.ping_totali
    from public.presenze_live pl
    join public.iscrizioni_eventi ie on ie.evento_id = p_evento_id and ie.student_id = pl.user_id
    where pl.evento_id = p_evento_id
      and ie.certificata_da_tipo is null
      and least(1.0, pl.ping_totali::numeric / v_ping_attesi) >= 0.75
  loop
    update public.iscrizioni_eventi
    set stato = 'partecipato', certificata_da_tipo = 'sistema', certificata_da_user = null, certificata_il = now()
    where evento_id = p_evento_id and student_id = v_riga.user_id and certificata_da_tipo is null;

    if not found then
      continue;
    end if;

    v_certificati := v_certificati + 1;

    if v_pubblico = 'docenti' then
      insert into public.attestati (user_id, evento_id)
      values (v_riga.user_id, p_evento_id)
      on conflict (user_id, evento_id) do nothing;
    else
      v_tipo_attivita := case v_tipo when 'workshop' then 'workshop_pcto' else 'partecipazione_webinar' end;
      v_peso := case v_tipo when 'workshop' then 25 else 15 end;

      insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
      select v_riga.user_id, ea.area_slug, v_tipo_attivita, v_peso
      from public.eventi_aree ea
      where ea.evento_id = p_evento_id
      on conflict do nothing;
    end if;
  end loop;

  -- ============ l'allarme ============
  -- `is distinct from` e non `<>`: la condizione deve essere ESATTAMENTE quella
  -- del ramo che ha scritto (o non scritto) il credito qui sopra, e quel ramo è
  -- l'`else` di `if v_pubblico = 'docenti'` — quindi ci cade anche un `pubblico`
  -- nullo. Con `<>` un NULL non farebbe scattare l'if, e resterebbe muto
  -- esattamente il caso più strano.
  if v_pubblico is distinct from 'docenti' and v_certificati > 0 and v_aree_evento = 0 then
    begin
      perform public.registra_guasto(
        p_processo => 'diretta/chiusura',
        p_specie => 'credito_area_evento',
        p_motivo => 'evento_senza_aree',
        p_dettaglio => format(
          'evento %s: %s studenti certificati, nessuna area a cui accreditare il credito di esplorazione',
          p_evento_id, v_certificati
        ),
        p_di_prova => false
      );
    exception when others then
      -- Best-effort come ogni scrittura di guasto: un allarme che non si
      -- registra non deve portarsi dietro la certificazione già fatta. Peggio
      -- del guasto invisibile sarebbe l'allarme che annulla il lavoro.
      --
      -- [verificato, non dedotto] Provato sulla replica locale cancellando
      -- `registra_guasto` e richiudendo una diretta senza aree: la
      -- certificazione arriva comunque (certificati=1,
      -- certificata_da_tipo='sistema') ed esce solo questo warning. Questa
      -- proprietà NON sta nello script di verifica di proposito: per provarla
      -- servirebbe un `drop function` dentro uno script che qualcuno incolla nel
      -- SQL Editor di produzione, e un drop è la sola istruzione il cui commit
      -- accidentale fa davvero male. Il ROLLBACK finale la renderebbe sicura, e
      -- non vale il rischio di chi lo esegue a pezzi.
      raise warning 'chiudi_diretta_evento: allarme non registrato (%)', sqlerrm;
    end;
  end if;

  return query select v_presenti, v_certificati;
end;
$$;

-- Il grant è quello di sempre. `registra_guasto` invece è revocata da
-- `authenticated`: la si può chiamare da qui perché questa funzione è SECURITY
-- DEFINER e gira col proprietario, che l'EXECUTE ce l'ha. È una cosa verificata
-- e non assunta (proprietà 2 e 7 di scripts/verifica-allarme-evento-senza-aree.sql:
-- l'allarme si scrive con la sessione di un ente, che da fuori non potrebbe).
grant execute on function public.chiudi_diretta_evento(uuid) to authenticated;
