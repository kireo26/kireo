-- Workshop: progetti multidisciplinari con cliente AI per l'area studenti.
-- Uno studente si iscrive a un ruolo (uno per workshop, posto singolo —
-- indice unico parziale sotto), riceve un kit materiali per area (contenuto
-- statico in lib/workshop/config.ts), dialoga con un cliente simulato via
-- Anthropic e carica una consegna finale con feedback AI automatico.
-- L'attività "workshop_pcto" (già presente nell'enum tipo_attivita, vedi
-- 20260712150000_activity_log.sql) alimenta il radar attitudinale
-- sull'area ufficiale del ruolo scelto — non un valore libero.

create type public.workshop_iscrizione_stato as enum ('attivo', 'completato', 'ritirato');
create type public.workshop_chat_mittente as enum ('studente', 'cliente');
create type public.workshop_consegna_stato as enum ('caricato', 'analizzato');

-- ============ workshop (catalogo progetti) ============
create table public.workshop (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titolo text not null,
  sottotitolo text,
  descrizione text,
  durata_giorni integer not null default 16 check (durata_giorni > 0),
  attivo boolean not null default true,
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============ ruoli disponibili per workshop ============
-- area_slug è una delle 18 aree ufficiali (stessa lista di activity_log):
-- alimenta il radar attitudinale. slug è invece l'identificativo del ruolo
-- nel progetto (es. "economia"), usato per la chiave del kit materiali in
-- lib/workshop/config.ts — due cose diverse, non vanno confuse.
create table public.workshop_ruoli (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id) on delete cascade,
  slug text not null,
  titolo text not null,
  area_slug text not null check (
    area_slug in (
      'informatica-digitale',
      'salute-professioni-sanitarie',
      'ristorazione-turismo',
      'meccanica-meccatronica',
      'agrifood-ambiente',
      'arte-design-moda',
      'musica-spettacolo',
      'energia-sostenibilita',
      'edilizia-architettura',
      'economia-management',
      'giurisprudenza-pa',
      'mobilita-sostenibile',
      'scienze-educazione',
      'comunicazione-media',
      'scienze-ricerca',
      'sicurezza-difesa',
      'lingue-relazioni-internazionali',
      'studi-umanistici-beni-culturali'
    )
  ),
  descrizione text,
  ordine integer not null default 0,
  unique (workshop_id, slug)
);

-- ============ iscrizioni studenti ============
create table public.workshop_iscrizioni (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  ruolo_id uuid not null references public.workshop_ruoli (id) on delete cascade,
  stato public.workshop_iscrizione_stato not null default 'attivo',
  created_at timestamptz not null default now(),
  unique (workshop_id, student_id)
);

comment on table public.workshop_iscrizioni is
  'Un ruolo per workshop può avere un solo studente attivo alla volta (indice unico parziale sotto): non c''è ancora un flusso di ritiro/completamento nell''interfaccia, gli stati completato/ritirato sono predisposti per una fase successiva.';

-- Posto singolo per ruolo: chiude la finestra di corsa fra due studenti che
-- scelgono lo stesso ruolo quasi simultaneamente (vincolo DB reale, non
-- solo applicativo).
create unique index workshop_iscrizioni_ruolo_attivo_idx
  on public.workshop_iscrizioni (ruolo_id)
  where stato = 'attivo';

-- ============ chat con il cliente simulato ============
create table public.workshop_chat_cliente (
  id uuid primary key default gen_random_uuid(),
  iscrizione_id uuid not null references public.workshop_iscrizioni (id) on delete cascade,
  mittente public.workshop_chat_mittente not null,
  contenuto text not null check (char_length(contenuto) > 0 and char_length(contenuto) <= 2000),
  created_at timestamptz not null default now()
);

create index workshop_chat_cliente_iscrizione_idx on public.workshop_chat_cliente (iscrizione_id, created_at);

-- ============ consegne finali ============
-- file_percorso è il path nel bucket privato workshop-consegne (vedi
-- migration storage), MAI un URL pubblico: il bucket non è pubblico, la
-- vista genera signed URL a tempo lato server.
create table public.workshop_consegne (
  id uuid primary key default gen_random_uuid(),
  iscrizione_id uuid not null references public.workshop_iscrizioni (id) on delete cascade,
  file_nome text not null,
  file_percorso text not null,
  file_tipo text not null,
  file_dimensione integer not null check (file_dimensione > 0 and file_dimensione <= 10485760),
  feedback_ai jsonb,
  stato public.workshop_consegna_stato not null default 'caricato',
  created_at timestamptz not null default now()
);

create index workshop_consegne_iscrizione_idx on public.workshop_consegne (iscrizione_id, created_at desc);

-- ============ messaggi fra studenti dello stesso workshop ============
create table public.workshop_messaggi (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshop (id) on delete cascade,
  mittente_id uuid not null references public.profiles (id) on delete cascade,
  destinatario_id uuid not null references public.profiles (id) on delete cascade,
  contenuto text not null check (char_length(contenuto) > 0 and char_length(contenuto) <= 2000),
  letto boolean not null default false,
  created_at timestamptz not null default now(),
  check (mittente_id <> destinatario_id)
);

create index workshop_messaggi_coppia_idx on public.workshop_messaggi (workshop_id, mittente_id, destinatario_id, created_at);
create index workshop_messaggi_destinatario_idx on public.workshop_messaggi (destinatario_id, letto);

-- ============ RLS ============
alter table public.workshop enable row level security;
alter table public.workshop_ruoli enable row level security;
alter table public.workshop_iscrizioni enable row level security;
alter table public.workshop_chat_cliente enable row level security;
alter table public.workshop_consegne enable row level security;
alter table public.workshop_messaggi enable row level security;

create policy workshop_select_attivo
  on public.workshop for select
  to authenticated
  using (attivo or public.current_ruolo() = 'admin');

create policy workshop_admin_tutto
  on public.workshop for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

create policy workshop_ruoli_select
  on public.workshop_ruoli for select
  to authenticated
  using (
    exists (select 1 from public.workshop w where w.id = workshop_id and w.attivo)
    or public.current_ruolo() = 'admin'
  );

create policy workshop_ruoli_admin_tutto
  on public.workshop_ruoli for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Iscrizioni: lo studente vede e crea solo le proprie. La visibilità dei
-- compagni di workshop (network) passa dalla funzione minimal-exposure
-- peers_workshop sotto, mai da una policy select aperta su questa tabella
-- (esporrebbe la relazione studente<->ruolo di chiunque a chiunque).
create policy workshop_iscrizioni_select_own
  on public.workshop_iscrizioni for select
  to authenticated
  using (student_id = auth.uid());

create policy workshop_iscrizioni_insert_own
  on public.workshop_iscrizioni for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and stato = 'attivo'
    and exists (select 1 from public.workshop w where w.id = workshop_id and w.attivo)
    and exists (select 1 from public.workshop_ruoli r where r.id = ruolo_id and r.workshop_id = workshop_id)
  );

create policy workshop_iscrizioni_admin_tutto
  on public.workshop_iscrizioni for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Chat cliente: solo lettura diretta per lo studente. Nessuna policy
-- insert/update/delete: entrambi i lati (messaggio dello studente e
-- risposta del cliente simulato) passano dalle funzioni sotto, stesso
-- principio già in uso per conversazioni_enti/messaggi_enti — mai un
-- insert libero che permetterebbe di scrivere ruolo/contenuto arbitrari.
create policy workshop_chat_cliente_select_own
  on public.workshop_chat_cliente for select
  to authenticated
  using (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
  );

create policy workshop_chat_cliente_admin_select
  on public.workshop_chat_cliente for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- Consegne: lo studente vede e carica solo le proprie (append-only, nessun
-- update/delete: una revisione è una nuova consegna, non una modifica di
-- quella precedente — lo storico resta leggibile).
create policy workshop_consegne_select_own
  on public.workshop_consegne for select
  to authenticated
  using (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
  );

create policy workshop_consegne_insert_own
  on public.workshop_consegne for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
  );

create policy workshop_consegne_admin_select
  on public.workshop_consegne for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- Fair use: max 10 consegne per iscrizione (vincolo DB reale, stesso
-- principio di limite_post_in_approvazione).
create or replace function public.limite_consegne_workshop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteggio integer;
begin
  select count(*) into v_conteggio from public.workshop_consegne where iscrizione_id = new.iscrizione_id;
  if v_conteggio >= 10 then
    raise exception 'troppe_consegne';
  end if;
  return new;
end;
$$;

create trigger limite_consegne_workshop_trg
before insert on public.workshop_consegne
for each row execute function public.limite_consegne_workshop();

-- Messaggi fra studenti: lettura solo alle due parti coinvolte. Nessuna
-- policy insert (solo via invia_messaggio_rete_workshop sotto, che
-- verifica che mittente e destinatario siano entrambi iscritti attivi
-- allo stesso workshop — senza questo controllo la tabella diventerebbe
-- una messaggistica libera fra qualunque coppia di studenti della
-- piattaforma, mai l'intenzione).
create policy workshop_messaggi_select_parte
  on public.workshop_messaggi for select
  to authenticated
  using (mittente_id = auth.uid() or destinatario_id = auth.uid());

create policy workshop_messaggi_update_letto
  on public.workshop_messaggi for update
  to authenticated
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

create policy workshop_messaggi_admin_select
  on public.workshop_messaggi for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- ============ ruoli_occupati_workshop: per la schermata di scelta ruolo ============
-- Nessuna identità esposta, solo quali ruolo_id sono già presi: serve anche
-- a chi non è ancora iscritto (select_own su workshop_iscrizioni non
-- basterebbe a "vedere" le iscrizioni altrui).
create or replace function public.ruoli_occupati_workshop(p_workshop_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ruolo_id from public.workshop_iscrizioni
  where workshop_id = p_workshop_id and stato = 'attivo';
$$;

grant execute on function public.ruoli_occupati_workshop(uuid) to authenticated;

-- ============ peers_workshop: chi altro è iscritto (minimal-exposure) ============
create or replace function public.peers_workshop(p_workshop_id uuid)
returns table (
  student_id uuid,
  nome text,
  cognome text,
  ruolo_slug text,
  ruolo_titolo text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- student_id qualificato: senza alias sarebbe ambiguo con il parametro
  -- OUT dello stesso nome (RETURNS TABLE dichiara implicitamente una
  -- variabile per colonna, che altrimenti oscura la colonna della tabella).
  if not exists (
    select 1 from public.workshop_iscrizioni wi
    where wi.workshop_id = p_workshop_id and wi.student_id = auth.uid() and wi.stato = 'attivo'
  ) then
    raise exception 'non_autorizzato';
  end if;

  return query
    select wi.student_id, p.nome, p.cognome, wr.slug, wr.titolo
    from public.workshop_iscrizioni wi
    join public.profiles p on p.id = wi.student_id
    join public.workshop_ruoli wr on wr.id = wi.ruolo_id
    where wi.workshop_id = p_workshop_id
      and wi.stato = 'attivo'
      and wi.student_id <> auth.uid()
    order by wr.ordine;
end;
$$;

grant execute on function public.peers_workshop(uuid) to authenticated;

-- ============ chat cliente: invio e risposta (function-only write) ============
create or replace function public.invia_messaggio_chat_cliente(p_iscrizione_id uuid, p_contenuto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteggio integer;
begin
  if not exists (
    select 1 from public.workshop_iscrizioni where id = p_iscrizione_id and student_id = auth.uid()
  ) then
    raise exception 'non_autorizzato';
  end if;

  select count(*) into v_conteggio from public.workshop_chat_cliente where iscrizione_id = p_iscrizione_id;
  if v_conteggio >= 60 then
    raise exception 'troppi_messaggi_chat_cliente';
  end if;

  insert into public.workshop_chat_cliente (iscrizione_id, mittente, contenuto)
  values (p_iscrizione_id, 'studente', p_contenuto);
end;
$$;

grant execute on function public.invia_messaggio_chat_cliente(uuid, text) to authenticated;

-- Chiamata solo dal server (route.ts) dopo la risposta di Anthropic, con la
-- sessione dello studente: verifica comunque la proprietà dell'iscrizione,
-- non si fida del solo fatto di essere chiamata da codice server.
create or replace function public.invia_risposta_cliente_workshop(p_iscrizione_id uuid, p_contenuto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.workshop_iscrizioni where id = p_iscrizione_id and student_id = auth.uid()
  ) then
    raise exception 'non_autorizzato';
  end if;

  insert into public.workshop_chat_cliente (iscrizione_id, mittente, contenuto)
  values (p_iscrizione_id, 'cliente', p_contenuto);
end;
$$;

grant execute on function public.invia_risposta_cliente_workshop(uuid, text) to authenticated;

-- ============ messaggi fra studenti (function-only write) ============
create or replace function public.invia_messaggio_rete_workshop(p_workshop_id uuid, p_destinatario_id uuid, p_contenuto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteggio_oggi integer;
begin
  if p_destinatario_id = auth.uid() then
    raise exception 'destinatario_non_valido';
  end if;

  if not exists (
    select 1 from public.workshop_iscrizioni
    where workshop_id = p_workshop_id and student_id = auth.uid() and stato = 'attivo'
  ) then
    raise exception 'non_iscritto';
  end if;

  if not exists (
    select 1 from public.workshop_iscrizioni
    where workshop_id = p_workshop_id and student_id = p_destinatario_id and stato = 'attivo'
  ) then
    raise exception 'destinatario_non_iscritto';
  end if;

  select count(*) into v_conteggio_oggi
  from public.workshop_messaggi
  where mittente_id = auth.uid()
    and (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date;

  if v_conteggio_oggi >= 30 then
    raise exception 'troppi_messaggi_oggi';
  end if;

  insert into public.workshop_messaggi (workshop_id, mittente_id, destinatario_id, contenuto)
  values (p_workshop_id, auth.uid(), p_destinatario_id, p_contenuto);
end;
$$;

grant execute on function public.invia_messaggio_rete_workshop(uuid, uuid, text) to authenticated;

-- ============ seed: workshop "Apri un'enoteca a Centocelle" ============
insert into public.workshop (slug, titolo, sottotitolo, descrizione, durata_giorni, ordine)
values (
  'enoteca-centocelle',
  'Apri un''enoteca a Centocelle',
  'Roma · Progetto imprenditoriale · 16 giorni',
  'Il tuo cliente vuole aprire un''enoteca nel quartiere Centocelle a Roma con 80.000€ di budget. Devi convincerlo con dati, idee concrete e un piano solido. Lavori in autonomia ma puoi confrontarti con chi sta coprendo le altre aree.',
  16,
  1
)
on conflict (slug) do nothing;

with ws as (select id from public.workshop where slug = 'enoteca-centocelle')
insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug, descrizione, ordine)
select ws.id, r.slug, r.titolo, r.area_slug, r.descrizione, r.ordine
from ws, (
  values
    ('economia', 'CFO junior', 'economia-management', 'Costruisci il business plan, calcola il break-even e gestisci il budget di 80.000€.', 1),
    ('giurisprudenza', 'Legal junior', 'giurisprudenza-pa', 'Individua le licenze necessarie, la forma societaria e gli adempimenti burocratici.', 2),
    ('grafica', 'Creative director', 'arte-design-moda', 'Definisci l''identità visiva: nome, logo, palette, applicazioni.', 3),
    ('marketing', 'Marketing manager', 'comunicazione-media', 'Studia il quartiere, definisci il target e crea il piano di lancio.', 4),
    ('food', 'Food & wine curator', 'ristorazione-turismo', 'Seleziona la carta vini, i fornitori e il menu food pairing.', 5)
) as r(slug, titolo, area_slug, descrizione, ordine)
on conflict (workshop_id, slug) do nothing;
