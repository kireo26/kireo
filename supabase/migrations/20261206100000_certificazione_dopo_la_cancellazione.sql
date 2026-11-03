-- 20261206100000 — Dopo la cancellazione non si certifica più, e prima del clic
-- si dice quante presenze lo aspettano.
--
-- Decisione di Mario (03/11): la scuola che certifica una presenza di chi si è
-- cancellato si rifiuta. *Una certificazione senza nome non serve a nessuno,
-- nemmeno alla scuola che la scrive.* Lo stesso vale per le due altre strade
-- che certificano: la chiusura di una diretta (chi si è cancellato non entra
-- nel ciclo) e il registro dei docenti (`account_cancellato`).
--
-- E la condizione che la rende giusta: così nasce una scadenza che oggi
-- nessuno conosce, e va detta a chi se ne va. `stato_cancellazione_account`
-- porta `presenze_in_sospeso`, e la pagina lo dice prima del clic; se il
-- numero non arriva, la pagina dice che non è riuscita a contarlo.
--
-- Da applicare PRIMA del deploy: la pagina nuova legge il numero; senza la
-- migrazione dice che non è riuscita a contarlo, e il resto funziona.

-- 1. La scuola.
create or replace function public.certifica_presenza(p_evento_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raggiungibile boolean;
  v_gia_certificato boolean;
  v_fusi text[];
  v_tipo_attivita public.tipo_attivita;
begin
  -- Delegabile al tutor via puo_certificare_presenze (vedi
  -- current_ha_permesso_staff in 20260715110000); il referente ha sempre
  -- tutto.
  if not public.current_ha_permesso_staff('certificazione_presenze') then
    raise exception 'non_autorizzato';
  end if;

  if not exists (
    select 1 from public.student_profiles sp
    where sp.user_id = p_student_id
      and sp.stato_verifica = 'verificato'
      and sp.school_code = public.current_scuola_id()
  ) then
    raise exception 'studente_non_verificato_o_scuola_diversa';
  end if;

  -- 03/11 (20261206100000): chi ha cancellato l'account non riceve più una
  -- certificazione. Una certificazione scritta dopo non avrebbe il nome (lo
  -- copia la cancellazione, solo sulle presenze già certificate), e non
  -- servirebbe a nessuno: la persona lo sa prima del clic, con il numero.
  if exists (select 1 from public.profiles where id = p_student_id and cancellato_il is not null) then
    raise exception 'account_cancellato';
  end if;

  select exists (
    select 1 from public.iscrizioni_eventi ie
    where ie.evento_id = p_evento_id and ie.student_id = p_student_id and ie.origine = 'scuola'
    union all
    select 1
    from public.iscrizioni_classe_eventi ice
    join public.classi_studenti cs on cs.classe_id = ice.classe_id
    join public.classi c on c.id = ice.classe_id
    where ice.evento_id = p_evento_id
      and cs.student_id = p_student_id
      and c.scuola_profilo_id = public.current_scuola_profilo_id()
  ) into v_raggiungibile;

  if not v_raggiungibile then
    raise exception 'evento_non_raggiungibile_per_questa_scuola';
  end if;

  -- §C, lato scuola — e la domanda si fa PRIMA dell'upsert, perché qui, a
  -- differenza dell'altra funzione, una ri-certificazione dello STESSO evento è
  -- ammessa: se questo studente era già certificato, la riga di `activity_log`
  -- che esiste oggi può essere la sua, e non c'è niente da segnalare.
  select ie.certificata_da_tipo is not null into v_gia_certificato
  from public.iscrizioni_eventi ie
  where ie.evento_id = p_evento_id and ie.student_id = p_student_id;

  select (case e.tipo when 'workshop' then 'workshop_pcto' else 'partecipazione_webinar' end)::public.tipo_attivita
    into v_tipo_attivita
  from public.eventi e where e.id = p_evento_id;

  if v_gia_certificato is not true then
    select array_agg(format('%s:%s', p_student_id, ea.area_slug)) into v_fusi
    from public.eventi_aree ea
    where ea.evento_id = p_evento_id
      and exists (
        select 1 from public.activity_log al
        where al.student_id = p_student_id
          and al.area_slug = ea.area_slug
          and al.tipo_attivita = v_tipo_attivita
          and (al.created_at at time zone 'utc')::date = (now() at time zone 'utc')::date
      );
  end if;

  -- 27/10: le ore sono quelle DICHIARATE per l'evento, senza il tetto della
  -- durata vera né il minimo dei 20 minuti (vedi testa del file). 26/10: si
  -- emettono qui come nella chiusura. Una RI-certificazione
  -- di una riga già partecipata NON le riscrive: una certificazione emessa è un
  -- fatto (il valore resta quello del primo gesto).
  insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, certificata_da_tipo, certificata_da_user, certificata_il, ore_riconosciute)
  values (p_student_id, p_evento_id, 'partecipato', 'scuola', 'scuola', auth.uid(), now(), (select coalesce(e.ore_pcto, 0) from public.eventi e where e.id = p_evento_id))
  on conflict (student_id, evento_id) do update
  set stato = 'partecipato', certificata_da_tipo = 'scuola', certificata_da_user = auth.uid(), certificata_il = now(),
      ore_riconosciute = case when public.iscrizioni_eventi.stato = 'partecipato'
        then public.iscrizioni_eventi.ore_riconosciute else excluded.ore_riconosciute end;

  insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
  select
    p_student_id,
    ea.area_slug,
    v_tipo_attivita,
    (case e.tipo when 'workshop' then 25 else 15 end)
  from public.eventi e
  join public.eventi_aree ea on ea.evento_id = e.id
  where e.id = p_evento_id
  on conflict do nothing;

  if v_fusi is not null then
    begin
      perform public.registra_guasto(
        p_processo => 'scuola/certificazione',
        p_specie => 'credito_area_fuso',
        p_motivo => 'cap_giornaliero',
        p_dettaglio => format(
          'evento %s: il cap giornaliero di activity_log ha soppresso %s crediti d''area già presenti oggi per un altro evento — %s',
          p_evento_id, array_length(v_fusi, 1), array_to_string(v_fusi, ', ')
        ),
        p_di_prova => false
      );
    exception when others then
      raise warning 'allarme credito_area_fuso non registrato per %: %', p_evento_id, sqlerrm;
    end;
  end if;
end;
$$;

-- 2. La chiusura di una diretta.
create or replace function public.chiudi_diretta_evento(p_evento_id uuid)
returns table (presenti integer, certificati integer, gia_chiusa_il timestamptz, durata_minuti integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizzatore_id uuid;
  v_pubblico text;
  v_tipo text;
  v_data_fine timestamptz;
  v_data_inizio timestamptz;
  -- 26/10: la durata VERA, e le ore che da lei discendono. Vedi la testa del file.
  v_durata integer;
  v_ore numeric;
  v_trovato boolean;
  v_ping_attesi numeric;
  v_presenti integer;
  v_certificati integer := 0;
  v_riga record;
  v_tipo_attivita public.tipo_attivita;
  v_peso integer;
  v_aree_evento integer;
  v_copertura numeric;
  v_fusi text[] := '{}';
  v_aree_studente text[];
  v_area text;
  -- (b) da che parte arriva la chiusura: deciso dove si autorizza, perché è
  -- lo stesso fatto. Un secondo controllo del ruolo più in basso sarebbe una
  -- seconda definizione della stessa cosa.
  v_chiusa_da_tipo text;
  v_gia_chiusa timestamptz;
  v_righe_traccia integer;
begin
  select true, organizzatore_id, pubblico, tipo, data_inizio, data_fine, diretta_chiusa_il
    into v_trovato, v_organizzatore_id, v_pubblico, v_tipo, v_data_inizio, v_data_fine, v_gia_chiusa
  from public.eventi where id = p_evento_id;

  if v_trovato is not true then
    raise exception 'evento_non_trovato';
  end if;

  if public.current_ruolo() = 'admin' then
    v_chiusa_da_tipo := 'kireo';
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    v_chiusa_da_tipo := 'ente';
  else
    raise exception 'non_autorizzato';
  end if;

  -- ⚠️ L'AUTORIZZAZIONE VIENE PRIMA DELLA LETTURA DELLA TRACCIA: chi non può
  -- chiudere non deve nemmeno sapere se e quando è stata chiusa.
  select count(*) into v_presenti from public.presenze_live where evento_id = p_evento_id;

  -- (c) GIÀ CHIUSA: si esce subito, e si DICE quando — mai «0 nuove
  -- certificazioni» a secco, che è un'affermazione sugli studenti al posto di
  -- «l'ho già fatto», cioè il difetto da cui nasce questa migrazione.
  --
  -- ⚠️ MA LA PROPRIETÀ NON LA TIENE QUESTA RIGA, E L'HA DETTO UNA CONTROPROVA:
  -- togliendo questo blocco le 17 proprietà restano VERDI, perché il caso
  -- sequenziale lo prende comunque il ramo `v_righe_traccia = 0` del lucchetto
  -- più in basso, che risponde allo stesso modo. A rendere rosse le proprietà 4
  -- e 6 serve togliere TUTTE E DUE le strade — e allora la seconda pressione
  -- non solo mente, RISCRIVE la traccia con l'autore sbagliato.
  --
  -- Quindi: il lucchetto è quello che tiene, e questo blocco resta per due
  -- cose che il lucchetto non fa. (1) Risparmia un tentativo di scrittura e due
  -- query. (2) Risponde «già chiusa» anche quando i due cancelli qui sotto
  -- parlerebbero prima: se un admin spostasse `data_fine` nel futuro DOPO una
  -- chiusura (`eventi_admin_tutto` glielo permette), senza questa riga una
  -- seconda pressione leggerebbe `evento_ancora_in_corso` invece della verità.
  -- Caso di bordo, ma la risposta giusta è questa.
  if v_gia_chiusa is not null then
    return query select v_presenti, 0, v_gia_chiusa, (select e.diretta_durata_minuti from public.eventi e where e.id = p_evento_id);
    return;
  end if;

  if v_data_fine is null then
    raise exception 'evento_senza_data_fine';
  end if;
  -- ⚠️ 26/10: SI PUÒ CHIUDERE PRIMA DELLA FINE PROGRAMMATA (decisione di
  -- Mario), non prima dell'inizio. La durata vera va dall'inizio alla
  -- chiusura e non supera mai la fine programmata. Si tronca al minuto: non si
  -- dichiara un minuto che non è passato.
  if now() < v_data_inizio then
    raise exception 'evento_non_iniziato';
  end if;
  v_durata := floor(extract(epoch from (least(now(), v_data_fine) - v_data_inizio)) / 60)::integer;

  -- ⚠️ LA TRACCIA È IL LUCCHETTO, ED È QUESTA LA RIGA CHE TIENE L'IDEMPOTENZA
  -- (misurato: vedi il blocco (c) sopra). La condizione sta nella `where` e non
  -- in un `if` sul valore letto prima, perché quell'`if` il caso concorrente non
  -- lo vede: due pressioni simultanee leggono entrambe null. Postgres rivaluta
  -- la `where` sulla versione nuova della riga dopo il lock, quindi la seconda
  -- tocca zero righe e lo sa. Stesso principio dei fair-use e di
  -- `apri_lettura_consegna`.
  --
  -- Toglierla non fa solo rispondere «0 certificazioni»: fa RISCRIVERE la
  -- traccia, quindi l'admin che ripreme si prende la firma di una chiusura
  -- dell'ente. Una colonna di responsabilità che cambia proprietario è peggio di
  -- una che non c'è.
  update public.eventi
  set diretta_chiusa_il = now(),
      diretta_chiusa_da_tipo = v_chiusa_da_tipo,
      diretta_chiusa_da_user = auth.uid(),
      -- La ricevuta: `presenti` si sa già, `certificati` lo sa solo il ciclo —
      -- parte da 0 perché il CHECK di completezza non è differibile, e viene
      -- completato in coda. Vedi il vincolo per il ragionamento intero.
      diretta_chiusa_presenti = v_presenti,
      diretta_chiusa_certificati = 0,
      -- La durata sta nella stessa istruzione della traccia: è la ricevuta che
      -- la dichiara, e da qui in poi `durata_vera_minuti` la legge invece di
      -- ricalcolarla.
      diretta_durata_minuti = v_durata
  where id = p_evento_id and diretta_chiusa_il is null;
  get diagnostics v_righe_traccia = row_count;

  if v_righe_traccia = 0 then
    -- Qualcun altro ha chiuso in questo istante: si rilegge la sua ora e si
    -- risponde come al caso «già chiusa». Mai «0 certificazioni» a secco.
    select e.diretta_chiusa_il, e.diretta_durata_minuti into v_gia_chiusa, v_durata from public.eventi e where e.id = p_evento_id;
    return query select v_presenti, 0, v_gia_chiusa, v_durata;
    return;
  end if;

  -- Letti DOPO il lucchetto: `durata_vera_minuti` ora legge la durata appena
  -- scritta, cioè il denominatore è la diretta vera.
  v_ping_attesi := public.ping_attesi_evento(p_evento_id);
  v_ore := public.ore_riconoscibili_evento(p_evento_id);

  -- Quante aree ha questo evento: serve all'allarme in coda, e si legge una
  -- volta sola perché la risposta non cambia dentro il ciclo.
  select count(*) into v_aree_evento from public.eventi_aree where evento_id = p_evento_id;

  -- ⚠️ SOTTO IL MINIMO NON SI CERTIFICA NESSUNO (Mario, 26/10): «sotto i
  -- venti minuti non è un'attività formativa». Il ciclo non gira, la ricevuta
  -- porta la durata e dice perché i certificati sono zero.
  for v_riga in
    select pl.user_id, pl.ping_totali
    from public.presenze_live pl
    join public.iscrizioni_eventi ie on ie.evento_id = p_evento_id and ie.student_id = pl.user_id
    -- 03/11 (20261206100000): un account cancellato non si certifica più.
    join public.profiles pr on pr.id = pl.user_id and pr.cancellato_il is null
    where pl.evento_id = p_evento_id
      and ie.certificata_da_tipo is null
      and least(1.0, pl.ping_totali::numeric / v_ping_attesi) >= 0.75
      and v_durata >= public.minuti_minimi_certificazione()
  loop
    update public.iscrizioni_eventi
    set stato = 'partecipato', certificata_da_tipo = 'sistema', certificata_da_user = null, certificata_il = now(),
        -- Le ore si EMETTONO qui, una volta, e non si ricalcolano mai.
        ore_riconosciute = v_ore
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

      -- §C: PRIMA dell'insert, quali aree hanno già una riga oggi con quella
      -- tupla. Sono esattamente quelle che il cap sta per sopprimere, e qui
      -- sono ancora attribuibili: arrivati a questo punto questo evento non ne
      -- ha mai scritta nessuna per questo studente, quindi una riga che c'è
      -- viene da un altro fatto.
      select array_agg(format('%s:%s', v_riga.user_id, ea.area_slug))
        into v_aree_studente
      from public.eventi_aree ea
      where ea.evento_id = p_evento_id
        and exists (
          select 1 from public.activity_log al
          where al.student_id = v_riga.user_id
            and al.area_slug = ea.area_slug
            and al.tipo_attivita = v_tipo_attivita
            and (al.created_at at time zone 'utc')::date = (now() at time zone 'utc')::date
        );
      v_fusi := v_fusi || coalesce(v_aree_studente, '{}');

      insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
      select v_riga.user_id, ea.area_slug, v_tipo_attivita, v_peso
      from public.eventi_aree ea
      where ea.evento_id = p_evento_id
      on conflict do nothing;

      -- §2: la prova della presenza. Una riga per area dell'evento, dimensione
      -- curiosity, peso 0,5, valore = la copertura misurata. `fonte` e
      -- `evento_id` dicono da dove viene senza che nessuno debba dedurlo.
      v_copertura := round(least(1.0, v_riga.ping_totali::numeric / v_ping_attesi), 3);

      insert into public.evidence
        (student_id, evento_id, area_slug, categoria, dimensione, valore, peso, fonte, step_id, motivazione)
      select
        v_riga.user_id,
        p_evento_id,
        ea.area_slug,
        'area'::public.evidence_categoria,
        'curiosity'::public.escape_dimensione,
        v_copertura,
        0.5,
        'presenza'::public.escape_fonte,
        null,
        'Da un incontro che hai seguito per intero.'
      from public.eventi_aree ea
      where ea.evento_id = p_evento_id;

      -- Il profilo si ricalcola per ogni area toccata, come fa ogni altra
      -- strada che scrive prove (stesso `foreach` di
      -- registra_evidenze_consegna_evento).
      for v_area in select ea.area_slug from public.eventi_aree ea where ea.evento_id = p_evento_id loop
        perform public.ricalcola_area_signal(v_riga.user_id, v_area);
      end loop;
    end if;
  end loop;

  -- ============ la ricevuta si completa ============
  -- ⚠️ SENZA QUESTA RIGA LA RICEVUTA DICE SEMPRE ZERO, cioè «nessuno ha
  -- raggiunto la soglia di presenza» su una chiusura che ha certificato nove
  -- persone: l'affermazione falsa sugli studenti che questo file esiste per
  -- togliere, ricreata un giro più in là. Si scrive senza condizioni, anche con
  -- `v_certificati = 0`: uno statement sempre, invece di un ramo che su un
  -- caso non passa.
  update public.eventi
  set diretta_chiusa_certificati = v_certificati
  where id = p_evento_id;

  -- ============ l'allarme del 27/09: l'evento non ha aree ============
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
      raise warning 'allarme credito_area_evento non registrato per %: %', p_evento_id, sqlerrm;
    end;
  end if;

  -- ============ §C: il cap ha soppresso dei crediti ============
  -- Una riga per chiusura, con dentro le coppie studente:area. Best-effort
  -- come ogni scrittura di guasto: un allarme non può annullare la
  -- certificazione che sta sorvegliando.
  if array_length(v_fusi, 1) > 0 then
    begin
      perform public.registra_guasto(
        p_processo => 'diretta/chiusura',
        p_specie => 'credito_area_fuso',
        p_motivo => 'cap_giornaliero',
        p_dettaglio => format(
          'evento %s: il cap giornaliero di activity_log ha soppresso %s crediti d''area già presenti oggi per un altro evento — %s',
          p_evento_id, array_length(v_fusi, 1), array_to_string(v_fusi, ', ')
        ),
        p_di_prova => false
      );
    exception when others then
      raise warning 'allarme credito_area_fuso non registrato per %: %', p_evento_id, sqlerrm;
    end;
  end if;

  return query select v_presenti, v_certificati, null::timestamptz, v_durata;
end;
$$;

-- 3. Il registro dei docenti.
create or replace function public.certifica_partecipazione_docente(p_evento_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruolo public.profile_role := public.current_ruolo();
  v_istituzione_id uuid := public.current_istituzione_id();
  v_organizzatore_id uuid;
  v_pubblico text;
  v_tipo_certificatore text;
  v_iscritto boolean;
begin
  select organizzatore_id, pubblico into v_organizzatore_id, v_pubblico
  from public.eventi
  where id = p_evento_id;

  if v_pubblico is distinct from 'docenti' then
    raise exception 'evento_non_trovato';
  end if;

  if v_ruolo = 'admin' then
    v_tipo_certificatore := 'kireo';
  elsif v_organizzatore_id is not null and v_istituzione_id is not null and v_istituzione_id = v_organizzatore_id then
    v_tipo_certificatore := 'ente';
  else
    raise exception 'non_autorizzato';
  end if;

  -- Un docente non certifica mai sé stesso: per costruzione un utente con
  -- ruolo 'docente' non può già raggiungere questo punto (non è mai
  -- admin né ha un'istituzione collegata), ma il controllo esplicito
  -- resta comunque una seconda barriera indipendente dal ramo sopra.
  if p_user_id = auth.uid() then
    raise exception 'non_autorizzato';
  end if;

  -- 03/11 (20261206100000): un account cancellato non si certifica più.
  if exists (select 1 from public.profiles where id = p_user_id and cancellato_il is not null) then
    raise exception 'account_cancellato';
  end if;

  select exists (
    select 1 from public.iscrizioni_eventi where evento_id = p_evento_id and student_id = p_user_id
  ) into v_iscritto;

  if not v_iscritto then
    raise exception 'non_iscritto';
  end if;

  update public.iscrizioni_eventi
  set stato = 'partecipato', certificata_da_tipo = v_tipo_certificatore, certificata_da_user = auth.uid(), certificata_il = now(),
      -- 26/10: emesse una volta, non riscritte da una ri-certificazione.
      ore_riconosciute = case when stato = 'partecipato' then ore_riconosciute else public.ore_riconoscibili_evento(p_evento_id) end
  where evento_id = p_evento_id and student_id = p_user_id;

  -- on conflict do nothing: idempotente, ricertificare la stessa persona
  -- sullo stesso evento non crea un secondo attestato né tocca
  -- rilasciato_il/codice_verifica del primo.
  insert into public.attestati (user_id, evento_id)
  values (p_user_id, p_evento_id)
  on conflict (user_id, evento_id) do nothing;
end;
$$;

-- 4. Quante presenze aspettano, prima del clic.
create or replace function public.stato_cancellazione_account(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ruolo public.profile_role;
  v_tutor int;
  v_firme jsonb;
  v_totale bigint;
  v_sospese int;
begin
  select ruolo into v_ruolo from public.profiles where id = p_uid and cancellato_il is null;
  if v_ruolo is null then
    return jsonb_build_object('puo', false, 'motivo', 'profilo_mancante');
  end if;
  if v_ruolo in ('admin', 'istituzione') then
    return jsonb_build_object('ruolo', v_ruolo, 'puo', false, 'motivo', 'ruolo_non_previsto');
  end if;

  if exists (select 1 from public.school_staff where user_id = p_uid and ruolo_staff = 'referente' and attivo) then
    select count(*) into v_tutor
    from public.school_staff me
    join public.school_staff t on t.scuola_profilo_id = me.scuola_profilo_id
    where me.user_id = p_uid and me.ruolo_staff = 'referente' and me.attivo
      and t.ruolo_staff = 'tutor' and t.attivo and t.user_id is not null and t.user_id <> p_uid;
    return jsonb_build_object('ruolo', v_ruolo, 'puo', false, 'motivo', 'referente_senza_successore', 'tutor_attivi', v_tutor);
  end if;

  v_firme := public.firme_di_un_account(p_uid);
  select coalesce(sum((f ->> 'n')::bigint), 0) into v_totale from jsonb_array_elements(v_firme) f;
  -- 03/11 (20261206100000): le presenze che qualcuno potrebbe ancora
  -- certificare, e che dopo la cancellazione nessuno certifica più. Si dicono
  -- prima del clic, con il numero (Mario). Un evento cominciato, una riga
  -- ancora «iscritto», e una strada aperta: la scuola (un'iscrizione d'ufficio
  -- o una classe in DAD), la chiusura di una diretta non ancora chiusa, o
  -- l'organizzatore di un webinar per docenti.
  select count(distinct q.evento_id) into v_sospese from (
    select ie.evento_id
      from public.iscrizioni_eventi ie join public.eventi e on e.id = ie.evento_id
     where ie.student_id = p_uid and ie.stato = 'iscritto' and e.data_inizio <= now()
       and (ie.origine = 'scuola' or (e.tipo = 'webinar' and e.diretta_chiusa_il is null) or v_ruolo = 'docente')
    union
    select ice.evento_id
      from public.iscrizioni_classe_eventi ice
      join public.classi_studenti cs on cs.classe_id = ice.classe_id
      join public.eventi e on e.id = ice.evento_id
     where cs.student_id = p_uid and ice.modalita = 'dad' and e.data_inizio <= now()
       and not exists (select 1 from public.iscrizioni_eventi x where x.evento_id = ice.evento_id and x.student_id = p_uid and x.stato = 'partecipato')
  ) q;

  return jsonb_build_object('ruolo', v_ruolo, 'puo', true, 'motivo', null, 'presenze_in_sospeso', v_sospese,
    'resta_il_nome', v_totale > 0, 'firme', v_firme,
    'esito', case when v_totale > 0 then 'cancellato_resta_il_nome'
                  when v_ruolo in ('studente', 'docente') then 'anonimizzato'
                  else 'cancellato' end);
end;
$$;

comment on function public.certifica_presenza(uuid, uuid) is
  '20261206100000: rifiuta una presenza di un account cancellato (account_cancellato).';
comment on function public.chiudi_diretta_evento(uuid) is
  '20261206100000: un account cancellato non entra fra le certificazioni della chiusura.';

do $$
begin
  if position('account_cancellato' in pg_get_functiondef('public.certifica_presenza(uuid, uuid)'::regprocedure)) = 0
     or position('cancellato_il is null' in pg_get_functiondef('public.chiudi_diretta_evento(uuid)'::regprocedure)) = 0
     or position('account_cancellato' in pg_get_functiondef('public.certifica_partecipazione_docente(uuid, uuid)'::regprocedure)) = 0
     or position('presenze_in_sospeso' in pg_get_functiondef('public.stato_cancellazione_account(uuid)'::regprocedure)) = 0 then
    raise exception '20261206100000: una delle quattro funzioni non è quella nuova';
  end if;
  if coalesce(obj_description('public.certifica_presenza(uuid, uuid)'::regprocedure), '') not like '20261206100000:%' then
    raise exception '20261206100000: il commento di certifica_presenza non è quello nuovo';
  end if;
end $$;
