-- CHIUDERE UNA DIRETTA LASCIA UNA TRACCIA SULL'EVENTO (11/10/2026)
--
-- ⚠️ IL DIFETTO, osservato da Mario dopo la prima diretta vera (4/10): `eventi`
-- ha ventotto colonne e NESSUNA dice che la diretta è stata chiusa. `stato`
-- resta `approvato`, il badge legge APPROVATO, e il messaggio verde «Diretta
-- chiusa: 12 presenti, 9 nuove certificazioni» vive soltanto nello stato React
-- del browser di chi ha premuto — un F5 e non è mai esistito.
--
-- Le conseguenze, in ordine di gravità:
--
--   1. L'ente non può sapere se ha già chiuso. Il bottone «Concludi diretta e
--      certifica presenze» è IDENTICO prima e dopo, quindi la cosa ovvia da
--      fare è ripremerlo — e la risposta era «0 nuove certificazioni», che si
--      legge come «nessuno si è qualificato». Cioè una AFFERMAZIONE FALSA
--      sugli studenti al posto di «l'ho già fatto»: la specie di casa, nel
--      punto in cui il prodotto riporta un esito che finisce su un documento
--      di scuola.
--   2. Due moderatori (KIREO e l'ente) non vedono il gesto l'uno dell'altro.
--   3. Nessuno, a posteriori, può dire se una diretta è stata chiusa.
--
-- COSA FA QUESTA MIGRAZIONE: cinque colonne (quando, da chi, da che parte, e i
-- due numeri della ricevuta), la chiusura che diventa IDEMPOTENTE E LO DICE, e
-- la scrittura della traccia che fa da lucchetto. Nessun dato trasformato: le
-- colonne nascono nulle su tutti
-- gli eventi esistenti, e una diretta già chiusa prima di oggi resta
-- indistinguibile da una non chiusa — non si prova a indovinarlo a posteriori
-- (le certificazioni `sistema` ci sono, ma non dicono chi premette né quando
-- esattamente, e inventare un'attribuzione è la cosa che questo file esiste per
-- evitare).
--
-- ⚠️ COSA **NON** FA, ed è la domanda che resta aperta: IL DENOMINATORE.
-- `ping_attesi_evento` è la durata PROGRAMMATA in minuti, quindi chi ha seguito
-- una diretta interrotta prima può restare sotto la soglia del 75% pur avendo
-- visto tutto quello che c'era. La traccia rende la domanda rispondibile e non
-- la risponde, per due ragioni misurate:
--
--   • `diretta_chiusa_il` NON è la fine vera della trasmissione. La chiusura è
--     vietata prima di `data_fine` (`evento_ancora_in_corso`), quindi la
--     traccia è SEMPRE >= `data_fine`: usarla come denominatore lo farebbe
--     crescere, cioè renderebbe la soglia più difficile — l'opposto.
--   • Togliere quel cancello per far chiudere in anticipo apre una trappola:
--     `ping_attesi` è `greatest(1, durata)`, quindi una chiusura al primo
--     minuto porta il denominatore a 1 e **certifica con ore PCTO piene
--     chiunque abbia caricato la pagina una volta**. Serve un pavimento, e
--     quale sia è una decisione di prodotto, non una riga.
--
-- Chi ci tornerà ha quindi bisogno di tutte e due le cose: una chiusura
-- anticipata ammessa (con il suo pavimento) **e** questa traccia. Oggi c'è la
-- seconda.
--
-- ⚠️⚠️ QUESTO FILE È STATO RISCRITTO L'11/10 DOPO LA PRIMA STESURA, per
-- aggiungere i due conteggi della RICEVUTA (correzione di Mario). **Si
-- rilancia**: ogni istruzione è guardata (`add column if not exists`, `drop
-- constraint if exists`, `drop policy if exists`, `drop function if exists`),
-- quindi se la prima versione è già stata applicata basta rieseguirlo tutto.
--
-- ⚠️ PERCHÉ I DUE NUMERI SI SCRIVONO INVECE DI RIDERIVARLI, e non è una
-- preferenza: `certificati` NON è stabile a posteriori. `certifica_presenza` è
-- un upsert INCONDIZIONATO, quindi una certificazione manuale della scuola può
-- sovrascrivere una riga `certificata_da_tipo='sistema'` — e allora un conteggio
-- rifatto oggi sarebbe PIÙ BASSO di quello che la chiusura ha prodotto. Una
-- ricevuta che cambia da sola non è una ricevuta.
--   (E la strada del conteggio al volo non era comunque aperta: `presenze_live`
--   non ha nessuna policy di lettura per l'organizzatore — di proposito, vedi
--   `20260726110000` — quindi una `select count(*)` dalla sessione dell'ente
--   avrebbe risposto **zero**, cioè un numero falso in silenzio.)

-- ============ 1) le cinque colonne ============
alter table public.eventi
  add column if not exists diretta_chiusa_il timestamptz,
  add column if not exists diretta_chiusa_da_tipo text,
  add column if not exists diretta_chiusa_da_user uuid references public.profiles(id),
  add column if not exists diretta_chiusa_presenti integer,
  add column if not exists diretta_chiusa_certificati integer;

-- Stessa forma della catena di responsabilità di `iscrizioni_eventi`
-- (`certificata_da_tipo`/`certificata_da_user`/`certificata_il`): il TIPO si
-- congela invece di dedurlo dal ruolo attuale della persona, che può cambiare.
alter table public.eventi
  drop constraint if exists eventi_chiusa_da_tipo_valido;
alter table public.eventi
  add constraint eventi_chiusa_da_tipo_valido
  check (diretta_chiusa_da_tipo is null or diretta_chiusa_da_tipo in ('kireo', 'ente'));

-- Le cinque stanno insieme o non stanno: una traccia con l'ora e senza l'autore
-- non risponde alla domanda per cui esiste, e una senza i due numeri è la
-- versione che perde il conto — cioè il difetto da cui nasce il giro.
--
-- ⚠️ PERCHÉ `diretta_chiusa_certificati` PARTE DA ZERO E NON DA NULL, ed è il
-- vincolo che decide la forma della funzione: un CHECK non è differibile in
-- Postgres (lo sono solo FK e unique), quindi la riga deve essere completa a
-- OGNI statement. `certificati` però si conosce solo DOPO il ciclo, mentre il
-- lucchetto deve stare PRIMA — quindi l'update del lucchetto scrive 0 e un
-- secondo update in coda mette il numero vero. Nella stessa transazione:
-- se il ciclo si interrompe, non resta niente.
alter table public.eventi
  drop constraint if exists eventi_chiusura_completa;
alter table public.eventi
  add constraint eventi_chiusura_completa
  check (
    (diretta_chiusa_il is null and diretta_chiusa_da_tipo is null and diretta_chiusa_da_user is null
      and diretta_chiusa_presenti is null and diretta_chiusa_certificati is null)
    or (diretta_chiusa_il is not null and diretta_chiusa_da_tipo is not null and diretta_chiusa_da_user is not null
      and diretta_chiusa_presenti is not null and diretta_chiusa_certificati is not null)
  );

alter table public.eventi
  drop constraint if exists eventi_chiusura_conteggi_non_negativi;
alter table public.eventi
  add constraint eventi_chiusura_conteggi_non_negativi
  check (
    (diretta_chiusa_presenti is null or diretta_chiusa_presenti >= 0)
    and (diretta_chiusa_certificati is null or diretta_chiusa_certificati >= 0)
  );

comment on column public.eventi.diretta_chiusa_il is
  'Quando la diretta è stata chiusa (scritto SOLO da chiudi_diretta_evento). Null = non chiusa, oppure chiusa prima dell''11/10/2026, quando la chiusura non lasciava traccia: i due casi non sono distinguibili e non si prova a indovinarlo.';
comment on column public.eventi.diretta_chiusa_da_tipo is
  'Da che parte è arrivata la chiusura: kireo (admin) o ente (l''organizzatore). Congelato come certificata_da_tipo — il ruolo della persona può cambiare, il fatto no.';
comment on column public.eventi.diretta_chiusa_presenti is
  'LA RICEVUTA: quante persone si erano collegate (righe di presenze_live) al momento della chiusura. Si SCRIVE e non si rideriva — vedi la testa del file: `certifica_presenza` è un upsert incondizionato, quindi un conteggio rifatto a posteriori può essere più basso di quello che la chiusura ha prodotto, e una ricevuta che cambia da sola non è una ricevuta.';
comment on column public.eventi.diretta_chiusa_certificati is
  'LA RICEVUTA: quanti sono stati certificati DA QUELLA chiusura (certificata_da_tipo=sistema scritto in quella transazione). Parte da 0 nello stesso update del lucchetto e viene completato in coda al ciclo: un CHECK non è differibile, quindi la riga deve essere completa a ogni statement.';
comment on column public.eventi.diretta_chiusa_da_user is
  'Chi ha premuto. La FK BLOCCA la cancellazione del profilo, come le altre dieci colonne di responsabilità (certificata_da_user, verificato_da, approvato_da…): una chiusura deve sapere chi l''ha firmata anche dopo. Allunga di uno i motivi per cui una persona di un ente non riesce a cancellare il proprio account — vedi il punto aperto in CLAUDE.md.';

-- ============ 2) l'ente non si scrive la chiusura da sé ============
-- ⚠️ `eventi_update_propria_non_revisionato` verifica DI CHI è la riga e, per
-- `stato` e `cta_esterna_approvata`, anche COSA dice — le tre colonne nuove no.
-- Finestra stretta (solo bozza/in_approvazione, cioè un evento che non si è
-- ancora tenuto) e nessun valore formale prodotto, quindi non è la falla del
-- 4-5/10: un ente che se la scrivesse disabiliterebbe la PROPRIA chiusura, che
-- è autolesionismo e non un attacco. Ma è esattamente la specie — una policy
-- che guarda la proprietà della riga e non le colonne — e la cura è una
-- clausola, quindi si mette adesso.
--
-- Le condizioni esistenti sono riportate PAROLA PER PAROLA da
-- `20260713150000_eventi_cta_esterna.sql`: l'unica differenza sono le tre righe
-- in coda.
drop policy if exists eventi_update_propria_non_revisionato on public.eventi;
create policy eventi_update_propria_non_revisionato
  on public.eventi for update
  to authenticated
  using (organizzatore_id = public.current_istituzione_id() and stato in ('bozza', 'in_approvazione'))
  with check (
    organizzatore_id = public.current_istituzione_id()
    and stato in ('bozza', 'in_approvazione')
    and cta_esterna_approvata = false
    and diretta_chiusa_il is null
    and diretta_chiusa_da_tipo is null
    and diretta_chiusa_da_user is null
    and diretta_chiusa_presenti is null
    and diretta_chiusa_certificati is null
  );

-- ============ 3) la chiusura, idempotente e che lo dice ============
-- ⚠️ `DROP` E NON `CREATE OR REPLACE`: il tipo di ritorno guadagna una colonna
-- (`gia_chiusa_il`), e Postgres non permette di cambiare il tipo di ritorno di
-- una funzione esistente. Il drop porta via i permessi, quindi sono rimessi in
-- coda — e `revoke` prima di `grant`, perché una funzione nuova nasce
-- eseguibile da `anon` e `authenticated` per i default privileges di Supabase
-- (vedi `20260919120000`: «non l'ho concessa a nessuno» non è mai una frase
-- vera qui dentro).
--
-- Il corpo è ripreso TALE E QUALE dalla definizione viva
-- (`20261004160000_presenza_profilo.sql`, non `20260927130000` — la §2 della
-- presenza l'ha sostituita dopo), con TRE differenze e nient'altro:
--
--   a. la terza colonna di ritorno, `gia_chiusa_il`;
--   b. `v_chiusa_da_tipo`, deciso nello stesso ramo che autorizza;
--   c. il blocco «la traccia è il lucchetto» prima del ciclo.
drop function if exists public.chiudi_diretta_evento(uuid);

create function public.chiudi_diretta_evento(p_evento_id uuid)
returns table (presenti integer, certificati integer, gia_chiusa_il timestamptz)
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
  -- (b) da che parte arriva la chiusura: deciso dove si autorizza, perché è
  -- lo stesso fatto. Un secondo controllo del ruolo più in basso sarebbe una
  -- seconda definizione della stessa cosa.
  v_chiusa_da_tipo text;
  v_gia_chiusa timestamptz;
  v_righe_traccia integer;
begin
  select true, organizzatore_id, pubblico, tipo, data_fine, diretta_chiusa_il
    into v_trovato, v_organizzatore_id, v_pubblico, v_tipo, v_data_fine, v_gia_chiusa
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
    return query select v_presenti, 0, v_gia_chiusa;
    return;
  end if;

  if v_data_fine is null then
    raise exception 'evento_senza_data_fine';
  end if;
  if now() < v_data_fine then
    raise exception 'evento_ancora_in_corso';
  end if;

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
      diretta_chiusa_certificati = 0
  where id = p_evento_id and diretta_chiusa_il is null;
  get diagnostics v_righe_traccia = row_count;

  if v_righe_traccia = 0 then
    -- Qualcun altro ha chiuso in questo istante: si rilegge la sua ora e si
    -- risponde come al caso «già chiusa». Mai «0 certificazioni» a secco.
    select e.diretta_chiusa_il into v_gia_chiusa from public.eventi e where e.id = p_evento_id;
    return query select v_presenti, 0, v_gia_chiusa;
    return;
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);

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

  return query select v_presenti, v_certificati, null::timestamptz;
end;
$$;

comment on function public.chiudi_diretta_evento(uuid) is
  'Chiude la diretta: certifica chi ha superato la soglia di presenza, scrive la traccia E LA RICEVUTA sull''evento (diretta_chiusa_presenti/_certificati, così il conto si rilegge dopo un F5 invece di vivere nello stato del browser di chi ha premuto) e restituisce (presenti, certificati, gia_chiusa_il). gia_chiusa_il non nullo = non ha fatto niente perché era già chiusa quel giorno a quell''ora: è l''unico modo di distinguere «nessuno si è qualificato» da «l''ho già fatto».';

revoke all on function public.chiudi_diretta_evento(uuid) from public, anon;
grant execute on function public.chiudi_diretta_evento(uuid) to authenticated;
