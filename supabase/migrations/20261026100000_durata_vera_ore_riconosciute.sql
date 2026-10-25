-- LA DURATA VERA E LE ORE RICONOSCIUTE (Mario, 26/10/2026).
--
-- Tre decisioni, e questa migrazione le applica insieme perché si toccano:
--
-- (1) LA DURATA VERA VIENE DALLA CHIUSURA. Ogni cosa che KIREO afferma su uno
--     studente deve venire da un gesto che qualcuno ha compiuto: la chiusura
--     lo è (una persona identificata, una ricevuta permanente); l'ultimo
--     battito di uno studente o la fine del suo video no — misurano chi
--     guarda, e uno studente rimasto indietro allunga la diretta. Quindi si
--     può chiudere PRIMA della fine programmata (mai prima dell'inizio), la
--     durata vera va dall'inizio alla chiusura e non supera mai la fine
--     programmata, e se nessuno chiude la durata vera è quella programmata:
--     l'assenza di un gesto non è un gesto (ramo (b) di durata_vera_minuti).
--
-- (2) SOTTO I 20 MINUTI NON SI CERTIFICA NESSUNO. «Un limite si mette dove un
--     numero finisce, non dove continua»: la lettura alternativa (soglia mai
--     su meno di 20) chiederebbe a una diretta di 16 minuti 15 minuti su 16,
--     cioè rifiuterebbe tutti fingendo che potessero farcela.
--
-- (3) LE ORE SI EMETTONO, NON SI CALCOLANO. `iscrizioni_eventi.ore_riconosciute`
--     si scrive UNA volta, nel momento della certificazione (min(ore dichiarate,
--     durata vera), zero sotto il minimo), e non si ricalcola mai: se restasse
--     un calcolo su `eventi.ore_pcto`, correggere quel campo cambierebbe ore già
--     riconosciute a studenti che non hanno fatto niente. Chi somma legge la
--     colonna emessa — nessuna strada risale a `eventi.ore_pcto`
--     (`npm run test:durata` conta le strade). Le certificazioni GIÀ emesse si
--     fotografano col valore di oggi: la migrazione non le ricalcola.
--
-- ⚠️ UN EFFETTO CHE NESSUNO HA CHIESTO E CHE SERVE: aprendo la chiusura in
-- anticipo, `ping_presenza_live` smette di accettare battiti dopo la
-- chiusura (motivo `diretta_chiusa`, che la pagina dello studente dice).
-- Altrimenti una diretta chiusa alle 10:20 accumulerebbe presenza fino alle
-- 10:35 programmate — su un incontro finito.
--
-- ⚠️ LA CERTIFICAZIONE MANUALE DELLA SCUOLA (certifica_presenza) SEGUE LA
-- STESSA REGOLA DELLE ORE: sotto il minimo certifica la presenza con 0 ore.
-- È una scelta MIA (Mario ha deciso sulla chiusura automatica): la scuola
-- attesta che lo studente c'era, e non è un'attestazione da togliere; le ore
-- però non possono superare quelle di un'attività che non è formativa.
--
-- Funzioni sostituite: i corpi sono ripresi VERBATIM dalle definizioni vive
-- (chiudi_diretta_evento da 20261011100000, certifica_presenza da
-- 20261004160000, certifica_partecipazione_docente da 20260722130000,
-- ping_presenza_live da 20261004130000, le due di export da 20261025100000,
-- stats_scuola da 20261018110000) con le sole righe che dicono 26/10.
-- chiudi_diretta_evento e le due di export cambiano tipo di ritorno: drop +
-- create, e i permessi si rimettono in coda (revoke prima di grant).

-- ============ 1 · colonne ============
alter table public.eventi add column if not exists diretta_durata_minuti integer;
alter table public.iscrizioni_eventi add column if not exists ore_riconosciute numeric(6, 2);

-- ============ 2 · la fotografia (mai un ricalcolo) ============
-- Le dirette già chiuse lo sono state DOPO la fine (fino a oggi era l'unico
-- modo): la loro durata vera è quella programmata, ed è la regola applicata,
-- non un valore indovinato.
update public.eventi
set diretta_durata_minuti = floor(extract(epoch from (least(diretta_chiusa_il, data_fine) - data_inizio)) / 60)::integer
where diretta_chiusa_il is not null and diretta_durata_minuti is null;

-- ⚠️ LE CERTIFICAZIONI GIÀ EMESSE PRENDONO IL VALORE ATTUALE E RESTANO LÌ. Se
-- questa riga le ricalcolasse col tetto nuovo, il primo atto della regola «le
-- certificazioni non cambiano» sarebbe cambiarle tutte.
update public.iscrizioni_eventi ie
set ore_riconosciute = coalesce(e.ore_pcto, 0)
from public.eventi e
where e.id = ie.evento_id and ie.stato = 'partecipato' and ie.ore_riconosciute is null;

-- ============ 3 · i vincoli ============
alter table public.eventi drop constraint if exists eventi_durata_con_chiusura;
alter table public.eventi add constraint eventi_durata_con_chiusura
  check ((diretta_chiusa_il is null) = (diretta_durata_minuti is null) and coalesce(diretta_durata_minuti, 0) >= 0);

-- Ore riconosciute ⇔ partecipazione certificata. Un writer che si dimentica le
-- ore fallisce A VOCE ALTA; e un insert dal client (stato «iscritto», vedi
-- 20261004140000) non può portarsi dietro delle ore.
alter table public.iscrizioni_eventi drop constraint if exists iscrizioni_ore_riconosciute_con_partecipazione;
alter table public.iscrizioni_eventi add constraint iscrizioni_ore_riconosciute_con_partecipazione
  check ((stato = 'partecipato') = (ore_riconosciute is not null) and coalesce(ore_riconosciute, 0) >= 0);

-- ============ 4 · la durata vera, il minimo, le ore ============
create or replace function public.minuti_minimi_certificazione()
returns integer
language sql
immutable
as $$ select 20 $$;
comment on function public.minuti_minimi_certificazione() is
  'Sotto questa durata vera una diretta non certifica ore a nessuno (Mario, 26/10). Specchio: MINUTI_MINIMI_CERTIFICAZIONE in lib/eventi/chiusuraDiretta.ts, confrontato da npm run test:durata.';

create or replace function public.durata_vera_minuti(p_evento_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  -- (a) chiusa: la durata scritta dalla chiusura, mai ricalcolata.
  -- (b) NON chiusa: quella programmata. L'assenza di un gesto non è un gesto
  --     (Mario, 26/10): è un ramo, non un effetto collaterale.
  -- (c) senza una fine: non si sa.
  select case
    when e.diretta_chiusa_il is not null then e.diretta_durata_minuti::numeric
    when e.data_fine is not null then extract(epoch from (e.data_fine - e.data_inizio)) / 60
    else null
  end
  from public.eventi e
  where e.id = p_evento_id;
$$;
revoke all on function public.durata_vera_minuti(uuid) from public, anon;
grant execute on function public.durata_vera_minuti(uuid) to authenticated;

-- Stessa firma, stesso tipo: ora il denominatore è la durata vera.
create or replace function public.ping_attesi_evento(p_evento_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when public.durata_vera_minuti(p_evento_id) is null then null
    else greatest(1, public.durata_vera_minuti(p_evento_id))
  end;
$$;

-- Le ore che una certificazione di QUESTO evento emette adesso: quelle
-- dichiarate, mai più della durata vera, zero sotto il minimo. Si chiama solo
-- da chi certifica — chi somma legge `iscrizioni_eventi.ore_riconosciute`.
create or replace function public.ore_riconoscibili_evento(p_evento_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.durata_vera_minuti(e.id) is null then coalesce(e.ore_pcto, 0)
    when public.durata_vera_minuti(e.id) < public.minuti_minimi_certificazione() then 0
    else round(least(coalesce(e.ore_pcto, 0), public.durata_vera_minuti(e.id) / 60.0), 2)
  end
  from public.eventi e
  where e.id = p_evento_id;
$$;
revoke all on function public.ore_riconoscibili_evento(uuid) from public, anon;
grant execute on function public.ore_riconoscibili_evento(uuid) to authenticated;

-- Una diretta chiusa prima della fine non accetta più battiti: dopo la
-- chiusura non c'è più niente a cui essere presenti.
create or replace function public.evento_in_diretta(p_evento_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = p_evento_id
      and e.stato = 'approvato'
      and e.diretta_chiusa_il is null
      and now() >= e.data_inizio
      and now() < coalesce(e.data_fine, e.data_inizio + interval '3 hours')
  );
$$;

create or replace function public.ping_presenza_live(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'non_autenticato';
  end if;

  if not exists (
    select 1 from public.iscrizioni_eventi
    where evento_id = p_evento_id and student_id = v_user_id
  ) then
    raise exception 'non_iscritto';
  end if;

  -- 26/10: chiusa è un motivo a sé, perché la pagina dello studente lo dice.
  if exists (select 1 from public.eventi where id = p_evento_id and diretta_chiusa_il is not null) then
    raise exception 'diretta_chiusa';
  end if;

  if not public.evento_in_diretta(p_evento_id) then
    raise exception 'evento_non_in_corso';
  end if;

  insert into public.presenze_live (evento_id, user_id)
  values (p_evento_id, v_user_id)
  on conflict (evento_id, user_id) do update
  set ultimo_ping = now(), ping_totali = public.presenze_live.ping_totali + 1;
end;
$$;

-- ============ 5 · chi certifica emette le ore ============
drop function if exists public.chiudi_diretta_evento(uuid);
create function public.chiudi_diretta_evento(p_evento_id uuid)
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
comment on function public.chiudi_diretta_evento(uuid) is
  'Chiude la diretta, anche prima della fine programmata e mai prima dell''inizio: fissa la durata vera (diretta_durata_minuti), certifica chi ha superato la soglia calcolata su quella durata — nessuno sotto minuti_minimi_certificazione() — emettendo le ore riconosciute, e scrive la ricevuta. Restituisce (presenti, certificati, gia_chiusa_il, durata_minuti).';
revoke all on function public.chiudi_diretta_evento(uuid) from public, anon;
grant execute on function public.chiudi_diretta_evento(uuid) to authenticated;

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

  -- 26/10: le ore si emettono qui come nella chiusura. Una RI-certificazione
  -- di una riga già partecipata NON le riscrive: una certificazione emessa è un
  -- fatto (il valore resta quello del primo gesto).
  insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, certificata_da_tipo, certificata_da_user, certificata_il, ore_riconosciute)
  values (p_student_id, p_evento_id, 'partecipato', 'scuola', 'scuola', auth.uid(), now(), public.ore_riconoscibili_evento(p_evento_id))
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
revoke all on function public.certifica_presenza(uuid, uuid) from public, anon;
grant execute on function public.certifica_presenza(uuid, uuid) to authenticated;

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
revoke all on function public.certifica_partecipazione_docente(uuid, uuid) from public, anon;
grant execute on function public.certifica_partecipazione_docente(uuid, uuid) to authenticated;

-- ============ 6 · chi somma legge le ore emesse ============
drop view if exists public.stats_scuola;
-- Ricreata da 20261018110000 con UNA differenza: la somma legge le ore emesse,
-- non quelle dichiarate sull'evento (e quindi non ha più bisogno di eventi).
create view public.stats_scuola as
select
  sp.id as scuola_profilo_id,
  (
    select count(*) from public.student_profiles s
    where s.school_code = sp.scuola_id and s.stato_verifica = 'verificato'
  ) as studenti_verificati,
  (
    select count(*)
    from public.iscrizioni_eventi ie
    join public.student_profiles s on s.user_id = ie.student_id
    where s.school_code = sp.scuola_id and s.stato_verifica = 'verificato' and ie.stato = 'partecipato'
  ) as partecipazioni_totali,
  (
    select coalesce(sum(ie.ore_riconosciute), 0)
    from public.iscrizioni_eventi ie
    join public.student_profiles s on s.user_id = ie.student_id
    where s.school_code = sp.scuola_id and s.stato_verifica = 'verificato' and ie.stato = 'partecipato'
  ) as ore_pcto_totali
from public.scuole_profili sp
where sp.id = public.current_scuola_profilo_id() or public.current_ruolo() = 'admin';

comment on view public.stats_scuola is
  'Aggregati per scuola (mai righe individuali di studenti, mai dati di profilazione). Le ore sono quelle EMESSE (iscrizioni_eventi.ore_riconosciute), mai quelle dichiarate sull''evento. Distribuzione per area in stats_scuola_aree.';

drop function if exists public.esporta_presenze_admin(uuid);
create function public.esporta_presenze_admin(p_evento_id uuid)
returns table (
  nome text,
  cognome text,
  email text,
  scuola_denominazione text,
  scuola_codice text,
  classe_nome text,
  primo_ping timestamptz,
  ultimo_ping timestamptz,
  minuti_presenza numeric,
  minuti_contati integer,
  copertura_percento numeric,
  stato_finale text,
  certificata_da_tipo text,
  certificata_da_nome text,
  attestato_emesso boolean,
  attestato_codice uuid,
  ore_riconosciute numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ping_attesi numeric;
  v_inizio timestamptz;
  v_fine timestamptz;
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);
  -- 26/10: la fine VERA — una diretta chiusa prima finisce alla chiusura.
  select e.data_inizio, case when e.diretta_chiusa_il is not null then least(e.data_fine, e.diretta_chiusa_il) else e.data_fine end
    into v_inizio, v_fine from public.eventi e where e.id = p_evento_id;

  return query
    select
      p.nome,
      p.cognome,
      -- Il cast è la correzione di `20261011130000`, invariata: `auth.users.email` è
      -- `character varying(255)`, e in PL/pgSQL un `return query` non lo
      -- converte da sé in `text`. Senza, questa funzione solleva sempre.
      u.email::text,
      s.denominazione,
      s.codice_meccanografico,
      (select cl.nome_visualizzato from public.classi_studenti cst join public.classi cl on cl.id = cst.classe_id where cst.student_id = ie.student_id limit 1),
      pl.primo_ping,
      pl.ultimo_ping,
      -- ⚠️ IL TAGLIO ALLA FINESTRA, IN LETTURA (11/10, vedi la testa del file):
      -- la sovrapposizione di [primo_ping, ultimo_ping] con [data_inizio,
      -- data_fine], mai sotto zero. Senza una finestra dichiarata il numero
      -- non si può tagliare, quindi non si stampa.
      case when pl.primo_ping is not null and v_inizio is not null and v_fine is not null
        then round(greatest(0, extract(epoch from (least(pl.ultimo_ping, v_fine) - greatest(pl.primo_ping, v_inizio)))) / 60, 1)
        else null end,
      -- ⚠️ NESSUN TETTO: qui si MISURA. Un rapporto sopra 100 è un conteggio che
      -- non torna, e va fatto vedere invece di arrotondarlo.
      -- ⚠️ I MINUTI CONTATI (25/10): un battito al minuto, cioè il tempo davvero
      -- contato. Chi non si è mai collegato ne ha zero, ed è un fatto.
      coalesce(pl.ping_totali, 0),
      -- ⚠️ NESSUN TETTO: qui si MISURA. E chi non si è mai collegato ha 0%, non
      -- una cella vuota (25/10): zero battiti su N attesi è un fatto.
      case when v_ping_attesi is not null then round(coalesce(pl.ping_totali, 0)::numeric / v_ping_attesi * 100, 1) else null end,
      ie.stato::text,
      ie.certificata_da_tipo,
      (select (cp.nome || ' ' || cp.cognome) from public.profiles cp where cp.id = ie.certificata_da_user),
      (att.id is not null),
      att.codice_verifica,
      ie.ore_riconosciute
    from public.iscrizioni_eventi ie
    join public.profiles p on p.id = ie.student_id
    left join auth.users u on u.id = ie.student_id
    left join public.presenze_live pl on pl.evento_id = ie.evento_id and pl.user_id = ie.student_id
    left join public.student_profiles sp on sp.user_id = ie.student_id
    left join public.schools s on s.codice_meccanografico = sp.school_code
    left join public.attestati att on att.evento_id = ie.evento_id and att.user_id = ie.student_id
    where ie.evento_id = p_evento_id
    order by p.cognome, p.nome, u.email nulls last, ie.student_id;
end;
$$;
revoke all on function public.esporta_presenze_admin(uuid) from public, anon;
grant execute on function public.esporta_presenze_admin(uuid) to authenticated;

drop function if exists public.esporta_presenze_scuola(uuid);
create function public.esporta_presenze_scuola(p_evento_id uuid)
returns table (
  nome text,
  cognome text,
  email text,
  classe_nome text,
  primo_ping timestamptz,
  ultimo_ping timestamptz,
  minuti_presenza numeric,
  minuti_contati integer,
  copertura_percento numeric,
  stato_finale text,
  certificata_da_tipo text,
  certificata_da_nome text,
  ore_riconosciute numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scuola_id text := public.current_scuola_id();
  v_ping_attesi numeric;
  v_inizio timestamptz;
  v_fine timestamptz;
begin
  if not public.current_ha_permesso_staff('certificazione_presenze') then
    raise exception 'non_autorizzato';
  end if;
  if v_scuola_id is null then
    raise exception 'non_autorizzato';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);
  -- 26/10: la fine VERA — una diretta chiusa prima finisce alla chiusura.
  select e.data_inizio, case when e.diretta_chiusa_il is not null then least(e.data_fine, e.diretta_chiusa_il) else e.data_fine end
    into v_inizio, v_fine from public.eventi e where e.id = p_evento_id;

  return query
    select
      p.nome,
      p.cognome,
      -- Stesso cast, stessa ragione: vedi sopra.
      u.email::text,
      (select cl.nome_visualizzato from public.classi_studenti cst join public.classi cl on cl.id = cst.classe_id where cst.student_id = ie.student_id limit 1),
      pl.primo_ping,
      pl.ultimo_ping,
      -- ⚠️ IL TAGLIO ALLA FINESTRA, IN LETTURA (11/10, vedi la testa del file):
      -- la sovrapposizione di [primo_ping, ultimo_ping] con [data_inizio,
      -- data_fine], mai sotto zero. Senza una finestra dichiarata il numero
      -- non si può tagliare, quindi non si stampa.
      case when pl.primo_ping is not null and v_inizio is not null and v_fine is not null
        then round(greatest(0, extract(epoch from (least(pl.ultimo_ping, v_fine) - greatest(pl.primo_ping, v_inizio)))) / 60, 1)
        else null end,
      -- ⚠️ NESSUN TETTO: qui si MISURA. Un rapporto sopra 100 è un conteggio che
      -- non torna, e va fatto vedere invece di arrotondarlo.
      -- ⚠️ I MINUTI CONTATI (25/10): un battito al minuto, cioè il tempo davvero
      -- contato. Chi non si è mai collegato ne ha zero, ed è un fatto.
      coalesce(pl.ping_totali, 0),
      -- ⚠️ NESSUN TETTO: qui si MISURA. E chi non si è mai collegato ha 0%, non
      -- una cella vuota (25/10): zero battiti su N attesi è un fatto.
      case when v_ping_attesi is not null then round(coalesce(pl.ping_totali, 0)::numeric / v_ping_attesi * 100, 1) else null end,
      ie.stato::text,
      ie.certificata_da_tipo,
      (select (cp.nome || ' ' || cp.cognome) from public.profiles cp where cp.id = ie.certificata_da_user),
      ie.ore_riconosciute
    from public.iscrizioni_eventi ie
    join public.student_profiles sp on sp.user_id = ie.student_id
    join public.profiles p on p.id = ie.student_id
    left join auth.users u on u.id = ie.student_id
    left join public.presenze_live pl on pl.evento_id = ie.evento_id and pl.user_id = ie.student_id
    where ie.evento_id = p_evento_id
      and sp.stato_verifica = 'verificato'
      and sp.school_code = v_scuola_id
    order by p.cognome, p.nome, u.email nulls last, ie.student_id;
end;
$$;
revoke all on function public.esporta_presenze_scuola(uuid) from public, anon;
grant execute on function public.esporta_presenze_scuola(uuid) to authenticated;
