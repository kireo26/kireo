-- LA PRESENZA CERTIFICATA ENTRA NEL PROFILO, E IL CAP DICE QUELLO CHE SCARTA.
--
-- Due cose nella stessa migrazione perché toccano la stessa funzione e lo
-- stesso ciclo: una scrive una prova, l'altra dice quando una scrittura che
-- c'era non è arrivata.
--
-- ════════════════════════ §2 — la prova della presenza ════════════════════════
--
-- Fino a oggi una presenza certificata lasciava il credito di ESPLORAZIONE
-- (una riga `activity_log` per area, peso 15 o 25, che alimenta il radar) e
-- non toccava `evidence`. Era giusto a metà: l'esplorazione dice DOVE si è
-- messo piede, e quella parte funzionava; ma l'aver seguito un incontro per
-- intero dice anche qualcosa su verso cosa quella persona si gira, e quel
-- pezzo non arrivava da nessuna parte.
--
-- LE QUATTRO SCELTE, ognuna con la sua ragione — non sono una sola scelta
-- scritta in quattro righe:
--
-- 1 · DIMENSIONE `curiosity`, NON `interest`. Essere andato a vedere una cosa
--     è curiosità; dire che quell'area ti interessa è un'altra affermazione, e
--     a un incontro ci si può essere trovati per mille motivi (la classe,
--     un'ora buca, un docente che l'ha detto). La conseguenza di questa scelta
--     è scritta per esteso in lib/escape/fonti.ts, nel punto in cui si scelgono
--     le dimensioni, e si riassume così: nessuna affinità può nascere da qui,
--     per nessun peso e per nessun numero.
--
-- 2 · PESO 0,5, cioè SOTTO una risposta scritta (1,0) e sotto ogni prova di
--     missione (0,4…1,5 ma su azioni scelte). Il numero è SCELTO, non misurato,
--     e sta scritto come tale perché nessuno fra sei mesi lo ritrovi credendolo
--     tarato. L'aritmetica che rende: la barra delle affinità è
--     `confidence >= 0,40` cioè Σpeso >= 4, quindi otto presenze la toccano —
--     e non producono comunque nessuna affinità, perché `interest_score`
--     resta nullo. Quello che otto presenze fanno è portare quell'area in cima
--     alle «aree che stai sfiorando», dove non c'è nessun punteggio da
--     esibire e c'è la frase che dice da dove viene.
--
-- 3 · `valore` = LA COPERTURA MISURATA, `least(1, ping/attesi)`, non una
--     costante. È l'unico numero che abbiamo davvero, viene da `presenze_live`
--     e si può andare a ricontare; ed è la stessa forma dei test, dove `valore`
--     è `punteggio/massimo`. Poiché la certificazione scatta a 0,75, il valore
--     sta sempre in [0,75; 1]. ⚠️ Conseguenza nota: con una prova sola la media
--     pesata non smorza niente e `curiosity_score` esce fra 75 e 100 — è la
--     stessa quantizzazione già registrata il 27/09 sui tre 71 e il 28/09 sul
--     `performance 100` di una consegna, e NON si compensa qui con una costante
--     più bassa: una taratura messa in un posto per correggere un difetto di un
--     altro è un difetto nascosto in due posti invece di uno.
--
-- 4 · IL DISCRIMINANTE È `certificata_da_tipo = 'sistema'`, NON
--     `origine = 'studente'`, e la differenza non è di severità. Con `origine`
--     si escluderebbe CHI È STATO ISCRITTO; con `certificata_da_tipo` si
--     esclude CHI È STATO DICHIARATO PRESENTE DA QUALCUN ALTRO. La regola di
--     luglio («l'iscrizione d'ufficio non è un segnale di interesse») parla
--     dell'iscrizione, ma il fatto qui è l'AVER SEGUITO: uno studente iscritto
--     dalla sua scuola che poi si collega davvero e resta per intero ha
--     compiuto un'azione sua, dentro un obbligo che non era suo, e `origine`
--     la butterebbe via. Verificato che il caso esiste e che è quello normale:
--     `iscrivi_classe_evento(modalita='individuale')` e
--     `iscrivi_studenti_evento` creano righe individuali con
--     `origine = 'scuola'`, e `ping_presenza_live` non guarda `origine`. Resta
--     fuori solo la dichiarazione di un terzo: `'scuola'` (certificazione
--     manuale, DAD, nessun ping) e `'kireo'`.
--     Qui la scrittura è dentro il ramo di `chiudi_diretta_evento` che
--     certifica, cioè l'unico posto che scrive `'sistema'`: la condizione è
--     strutturale, non un filtro da ricordare. E la policy di insert chiusa
--     dalla 20261004140000 è la precondizione di questa frase — senza quella,
--     uno studente potrebbe scriversi `certificata_da_tipo = 'sistema'` da sé.
--
-- L'AGGREGAZIONE LA VEDE, e non è dedotto: `ricalcola_area_signal` ammette le
-- prove con `e.fonte not in ('mission','test')` senza altri filtri, quindi una
-- prova di presenza entra nella media. ⚠️ Ma la chiave di `attivita_distinte`
-- cade nel ramo `else e.fonte::text` → `'presenza'`, quindi DIECI presenze
-- contano come UNA attività distinta. Oggi non decide niente (il badge guarda
-- solo la confidence dal 27/09, e la barra delle affinità pure), resta un dato
-- diagnostico: il giorno in cui servirà, la chiave va portata a
-- `'p:' || evento_id`, esattamente come `'m:' || mission_slug` per le missioni —
-- è la stessa raffinatura già annotata per il cross-feed `workshop`.
--
-- IDEMPOTENTE PER LA STESSA GUARDIA DI TUTTO IL RESTO: il ciclo prende solo
-- le righe con `certificata_da_tipo is null`, quindi una seconda chiusura non
-- scrive una seconda prova, esattamente come non riscrive le ore né
-- l'`activity_log`. `evidence` non ha un indice unico su cui andare in
-- conflitto, e non ne serve uno: due presenze a due eventi diversi sulla
-- stessa area sono due fatti e devono essere due righe (vedi il §C qui
-- sotto, dove il cap di `activity_log` fa l'opposto).
--
-- SOLO EVENTI PER STUDENTI: nel ramo `docenti` la certificazione produce un
-- attestato, e un docente non ha un profilo d'area.
--
-- ════════════════════ §C — il cap registra quello che scarta ════════════════════
--
-- L'indice unico di `activity_log` (20260813120000) è
-- `(student_id, area_slug, tipo_attivita, data UTC, coalesce(livello,0))`.
-- Due webinar DIVERSI della stessa area lo stesso giorno producono la stessa
-- tupla, e l'`on conflict do nothing` fa sparire il secondo: un fatto vero che
-- non lascia una riga.
--
-- IL CAP RESTA — è una difesa reale, perché `score_aree` SOMMA i pesi e senza
-- cap il radar si gonfierebbe; `evidence` fa una MEDIA e non ne ha bisogno,
-- ed è per questo che la prova del §2 qui sopra non riusa questo cap. Due
-- aritmetiche, due risposte.
--
-- MA IL SILENZIO NO. L'allarme del 27/09 non vede questo caso: quello scatta
-- se l'evento non ha aree, qui l'evento ha la sua area e la riga non esiste
-- comunque — due cause diverse, un esito identico e invisibile. Quindi si
-- registra un guasto dedicato, con dentro la risposta alla domanda che
-- qualcuno si farà fra sei mesi: «questo studente ha seguito due incontri
-- quel giorno?»
--
-- SI GUARDA PRIMA DELL'INSERT, NON SI DEDUCE DOPO. La strada che viene in
-- mente è `get diagnostics row_count` e confrontarlo col numero di aree — e
-- dice QUANTE righe sono state soppresse ma non QUALI, perché `activity_log`
-- non ha nessuna colonna che registri da quale evento viene una riga
-- [verificato sulle colonne reali: id, student_id, area_slug, tipo_attivita,
-- peso, created_at, livello]. La prima stesura di questa migrazione aveva
-- inventato un `evento_marcatore` che non esiste. Guardare prima quali aree
-- hanno già una riga oggi dà la risposta esatta e non richiede nessuna colonna
-- nuova.
--
-- E UNA RIGA GIÀ PRESENTE È SEMPRE UN ALTRO FATTO, non questa stessa
-- scrittura: ci si arriva una volta sola per (studente, evento), perché il
-- ciclo prende solo `certificata_da_tipo is null`. Se fosse stato certificato
-- prima — da una chiusura precedente o dalla sua scuola — non sarebbe nel
-- ciclo. Lato `certifica_presenza` la stessa cosa non è gratis, perché lì
-- l'upsert ammette una RI-certificazione dello stesso evento: lì si guarda
-- prima se era già certificato, e in quel caso non c'è niente da segnalare.
--
-- UNA RIGA PER CHIUSURA, non una per studente: il dettaglio porta le coppie
-- `studente:area` soppresse, così la domanda ha una risposta precisa senza
-- venticinque righe per una classe intera.
--
-- NON SI RECUPERA, si registra. Riscrivere la riga a posteriori non si può
-- comunque: il cap è per giorno, e una riga inserita domani porterebbe la data
-- di domani — cioè racconterebbe un fatto in un giorno in cui non è successo.

-- ════════════════════════════════════════════════════════════════════════════
-- Corpo ripreso da 20260927130000_allarme_evento_senza_aree.sql (che a sua
-- volta lo riprende da 20260726110000): chi applica deve sapere da dove viene,
-- perché l'elenco in CLAUDE.md non è un registro di cosa c'è sul database. Le
-- differenze sono tre e sono tutte dentro il ciclo e in coda: la prova del §2,
-- il conteggio delle righe scartate, l'allarme del §C.
-- ════════════════════════════════════════════════════════════════════════════
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
  v_copertura numeric;
  v_fusi text[] := '{}';
  v_aree_studente text[];
  v_area text;
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

  return query select v_presenti, v_certificati;
end;
$$;

revoke all on function public.chiudi_diretta_evento(uuid) from public, anon;
grant execute on function public.chiudi_diretta_evento(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Lo stesso silenzio c'era nella certificazione manuale della scuola, e
-- lasciarlo lì renderebbe la risposta PARZIALE: la domanda «questo studente ha
-- seguito due incontri quel giorno?» avrebbe risposta solo per le
-- certificazioni automatiche. Corpo ripreso tale e quale da
-- 20260715140000_iscrizioni_e_certificazione.sql — l'unica differenza è il
-- conteggio delle righe scritte e l'allarme in coda.
--
-- Qui NON si scrive nessuna prova: questa è la dichiarazione di un terzo, non
-- un heartbeat. È la scelta 4 del §2, applicata dall'altro lato.
-- ════════════════════════════════════════════════════════════════════════════
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

  insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, certificata_da_tipo, certificata_da_user, certificata_il)
  values (p_student_id, p_evento_id, 'partecipato', 'scuola', 'scuola', auth.uid(), now())
  on conflict (student_id, evento_id) do update
  set stato = 'partecipato', certificata_da_tipo = 'scuola', certificata_da_user = auth.uid(), certificata_il = now();

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

revoke all on function public.certifica_presenza(uuid, uuid) from public, anon;
grant execute on function public.certifica_presenza(uuid, uuid) to authenticated;
