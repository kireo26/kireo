-- Infrastruttura webinar in diretta (2/3): rilevamento presenze (heartbeat),
-- domande in diretta, chiusura con certificazione automatica.
--
-- Principi non negoziabili applicati qui:
-- - I dati individuali degli studenti non arrivano mai all'ente: né
--   presenze_live né domande_live hanno una policy SELECT diretta per
--   organizzatore/admin. L'unico accesso è tramite funzioni SECURITY
--   DEFINER che restituiscono solo aggregati (conteggio_presenti_live) o
--   righe strutturalmente prive di user_id (domande_live_organizzatore per
--   pubblico=studenti non tocca mai la tabella profiles).
-- - Nessuna chat tra studenti: domande_live è solo studente→organizzatore,
--   nessuna policy permette a uno studente di leggere le domande altrui.
-- - certificata_da_tipo='sistema' è già un valore ammesso dal CHECK fin
--   dalla sua primissima versione (20260715140000, commento "sistema
--   (automatico, non ancora implementato)"): NESSUNA modifica al vincolo è
--   necessaria in questa migration.

-- ============ presenze_live ============
create table public.presenze_live (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventi (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primo_ping timestamptz not null default now(),
  ultimo_ping timestamptz not null default now(),
  ping_totali integer not null default 1,
  constraint presenze_live_unica unique (evento_id, user_id)
);

comment on table public.presenze_live is
  'Un heartbeat ogni 60s dalla pagina live (vedi ping_presenza_live). Mai leggibile riga per riga da organizzatore/admin: solo tramite conteggio_presenti_live() (aggregato) o, a diretta chiusa, tramite le funzioni di export presenze (dati individuali, ma solo admin o scuola sui propri studenti verificati — mai l''ente).';

create index presenze_live_evento_idx on public.presenze_live (evento_id);

alter table public.presenze_live enable row level security;

create policy presenze_live_select_own
  on public.presenze_live for select
  to authenticated
  using (user_id = auth.uid());

-- Nessuna policy insert/update/delete self-service e nessuna policy
-- select per organizzatore/admin: l'unica scrittura passa da
-- ping_presenza_live (SECURITY DEFINER, sotto), l'unica lettura aggregata
-- da conteggio_presenti_live/le funzioni di export (SECURITY DEFINER).

-- ============ domande_live ============
create table public.domande_live (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventi (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  testo text not null check (char_length(testo) <= 500 and char_length(btrim(testo)) > 0),
  creata_il timestamptz not null default now(),
  stato text not null default 'nuova' check (stato in ('nuova', 'letta', 'risposta_live')),
  letta_il timestamptz
);

comment on table public.domande_live is
  'Domande studente/docente -> organizzatore durante una diretta. Nessuna chat: uno studente vede solo le proprie (domande_live_select_own), l''organizzatore vede quelle del proprio evento solo tramite domande_live_organizzatore() — anonime (nessun user_id/nome) per pubblico=studenti, con nome per pubblico=docenti.';

create index domande_live_evento_idx on public.domande_live (evento_id);

alter table public.domande_live enable row level security;

create policy domande_live_select_own
  on public.domande_live for select
  to authenticated
  using (user_id = auth.uid());

-- Verifica finestra diretta + iscrizione: SECURITY INVOKER (di proposito,
-- non definer) perché si affida alla RLS di lettura pubblica già esistente
-- su eventi (solo approvati sono leggibili) — nessun bisogno di bypassare
-- RLS per una lettura che il chiamante può già fare da sé.
create or replace function public.evento_in_finestra_diretta(p_evento_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = p_evento_id
      and e.stato = 'approvato'
      and now() >= e.data_inizio - interval '15 minutes'
      and now() < coalesce(e.data_fine, e.data_inizio + interval '3 hours')
  );
$$;

create policy domande_live_insert_own
  on public.domande_live for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.iscrizioni_eventi ie
      where ie.evento_id = domande_live.evento_id and ie.student_id = auth.uid()
    )
    and public.evento_in_finestra_diretta(domande_live.evento_id)
  );

-- Nessuna policy update/delete self-service (una domanda inviata non si
-- modifica né si cancella) e nessuna policy select per
-- organizzatore/admin: la lettura organizzatore passa esclusivamente da
-- domande_live_organizzatore() (SECURITY DEFINER, sotto), che decide da
-- sola se includere o meno l'identità di chi ha scritto.

-- Rate limit: max 1 domanda/minuto, max 10 per evento per utente. Un
-- trigger DB reale (non solo un controllo applicativo), stesso principio
-- già in uso per limite_eventi_in_approvazione/
-- limite_conversazioni_assistente_giorno. Conteggi numerici, mai un
-- confronto di uguaglianza/negazione: NULL-safe per costruzione.
create or replace function public.limite_domande_live()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ultimo_minuto integer;
  v_totale_evento integer;
begin
  select count(*) into v_ultimo_minuto
  from public.domande_live
  where user_id = new.user_id and creata_il > now() - interval '1 minute';

  if v_ultimo_minuto >= 1 then
    raise exception 'troppo_frequente';
  end if;

  select count(*) into v_totale_evento
  from public.domande_live
  where user_id = new.user_id and evento_id = new.evento_id;

  if v_totale_evento >= 10 then
    raise exception 'troppe_domande_evento';
  end if;

  return new;
end;
$$;

create trigger domande_live_limite_trigger
  before insert on public.domande_live
  for each row
  execute function public.limite_domande_live();

-- ============ heartbeat ============
-- SECURITY DEFINER: bypassa la mancanza di policy insert/update
-- self-service su presenze_live (scelta intenzionale, vedi sopra), tutte
-- le verifiche di autorizzazione sono esplicite qui dentro. La modalità
-- DAD delle classi resta strutturalmente esclusa: iscrivi_classe_evento
-- con modalita='dad' non crea mai una riga individuale in
-- iscrizioni_eventi, quindi la guardia "utente iscritto" sotto la esclude
-- automaticamente, senza bisogno di alcun codice specifico per la DAD.
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

  if not public.evento_in_finestra_diretta(p_evento_id) then
    raise exception 'evento_non_in_corso';
  end if;

  insert into public.presenze_live (evento_id, user_id)
  values (p_evento_id, v_user_id)
  on conflict (evento_id, user_id) do update
  set ultimo_ping = now(), ping_totali = public.presenze_live.ping_totali + 1;
end;
$$;

grant execute on function public.ping_presenza_live(uuid) to authenticated;

-- Durata attesa della diretta in minuti (un ping ogni 60s = un ping atteso
-- per minuto), null se l'evento non ha ancora una data_fine (impossibile
-- calcolare una copertura senza una durata). SECURITY DEFINER solo per
-- semplicità di riuso (nessun dato sensibile restituito, un solo numero).
create or replace function public.ping_attesi_evento(p_evento_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when e.data_fine is null then null
    else greatest(1, extract(epoch from (e.data_fine - e.data_inizio)) / 60)
  end
  from public.eventi e
  where e.id = p_evento_id;
$$;

-- ============ contatore presenti (solo aggregato) ============
-- "Presenti in questo momento": ultimo ping negli ultimi 2 minuti. Stessa
-- regola per pubblico=studenti e pubblico=docenti (l'eccezione "nomi
-- visibili ai docenti" riguarda solo domande_live, non le presenze).
create or replace function public.conteggio_presenti_live(p_evento_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizzatore_id uuid;
begin
  select organizzatore_id into v_organizzatore_id from public.eventi where id = p_evento_id;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  return (
    select count(*)::integer from public.presenze_live
    where evento_id = p_evento_id and ultimo_ping > now() - interval '2 minutes'
  );
end;
$$;

grant execute on function public.conteggio_presenti_live(uuid) to authenticated;

-- ============ domande per l'organizzatore ============
-- Anonimato strutturale per pubblico=studenti: il ramo studenti non tocca
-- mai la tabella profiles, quindi user_id/nome non possono trapelare per
-- costruzione, non solo per "dimenticanza evitata".
create or replace function public.domande_live_organizzatore(p_evento_id uuid)
returns table (id uuid, testo text, stato text, creata_il timestamptz, letta_il timestamptz, nome_completo text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizzatore_id uuid;
  v_pubblico text;
begin
  select e.organizzatore_id, e.pubblico into v_organizzatore_id, v_pubblico from public.eventi e where e.id = p_evento_id;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  if v_pubblico = 'docenti' then
    return query
      select d.id, d.testo, d.stato, d.creata_il, d.letta_il, (p.nome || ' ' || p.cognome)
      from public.domande_live d
      join public.profiles p on p.id = d.user_id
      where d.evento_id = p_evento_id
      order by d.creata_il;
  else
    return query
      select d.id, d.testo, d.stato, d.creata_il, d.letta_il, null::text
      from public.domande_live d
      where d.evento_id = p_evento_id
      order by d.creata_il;
  end if;
end;
$$;

grant execute on function public.domande_live_organizzatore(uuid) to authenticated;

create or replace function public.aggiorna_stato_domanda_live(p_domanda_id uuid, p_stato text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento_id uuid;
  v_organizzatore_id uuid;
begin
  if p_stato not in ('letta', 'risposta_live') then
    raise exception 'stato_non_valido';
  end if;

  select evento_id into v_evento_id from public.domande_live where id = p_domanda_id;
  if v_evento_id is null then
    raise exception 'domanda_non_trovata';
  end if;

  select organizzatore_id into v_organizzatore_id from public.eventi where id = v_evento_id;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  update public.domande_live
  set stato = p_stato, letta_il = coalesce(letta_il, now())
  where id = p_domanda_id;
end;
$$;

grant execute on function public.aggiorna_stato_domanda_live(uuid, text) to authenticated;

-- ============ chiusura diretta + certificazione automatica ============
-- Idempotente: ogni chiamata successiva ricalcola la stessa soglia ma
-- l'update tocca solo righe con certificata_da_tipo is null, quindi una
-- certificazione manuale precedente (scuola/ente/kireo) non viene MAI
-- sovrascritta — a differenza di certifica_presenza/
-- certifica_partecipazione_docente, che restano upsert incondizionati
-- (una ricertificazione manuale successiva resta sempre possibile e
-- autorevole, invariate, non toccate da questa migration).
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

  return query select v_presenti, v_certificati;
end;
$$;

grant execute on function public.chiudi_diretta_evento(uuid) to authenticated;
