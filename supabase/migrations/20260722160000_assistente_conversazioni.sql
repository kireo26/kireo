-- Contatore leggero delle conversazioni con l'assistente digitale, per il
-- limite di 3 conversazioni/giorno per studente (compito esplicito).
--
-- Scelta: NON riusare activity_log per questo contatore. activity_log ha
-- già un cap DB reale di 1 riga al giorno per (studente, area, tipo) —
-- perfetto per "prima interazione della giornata" (chat_assistente, peso
-- 3, riusato as-is per il tracciamento di esplorazione, vedi
-- app/api/assistente/route.ts), ma incompatibile con un contatore che deve
-- arrivare fino a 3: il suo indice unico bloccherebbe già il secondo
-- inserimento dello stesso giorno. Serve quindi una tabella a sé, con un
-- solo scopo (contare le conversazioni iniziate oggi), senza toccare lo
-- schema di activity_log.
--
-- Nessun contenuto di conversazione qui dentro: le conversazioni vivono
-- solo nella sessione del browser (vincolo esplicito del compito) — questa
-- tabella registra solo CHE una conversazione è iniziata, non cosa è stato
-- detto.
create table public.assistente_conversazioni (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  area_slug text not null,
  created_at timestamptz not null default now()
);

comment on table public.assistente_conversazioni is
  'Una riga per ogni conversazione avviata con l''assistente digitale (mai il contenuto): alimenta solo il limite di 3 conversazioni/giorno per studente in app/api/assistente/route.ts.';

-- created_at::date non è IMMUTABLE (dipende dal timezone di sessione): si
-- fissa il timezone UTC nell'espressione per coerenza col resto del
-- progetto (stesso pattern di activity_log_cap_giornaliero_idx).
create index assistente_conversazioni_student_giorno_idx
  on public.assistente_conversazioni (student_id, ((created_at at time zone 'utc')::date));

alter table public.assistente_conversazioni enable row level security;

create policy assistente_conversazioni_select_own
  on public.assistente_conversazioni for select
  to authenticated
  using (student_id = auth.uid());

create policy assistente_conversazioni_insert_own
  on public.assistente_conversazioni for insert
  to authenticated
  with check (student_id = auth.uid());

-- Vincolo DB reale (non solo un controllo applicativo prima dell'insert):
-- stesso pattern di limite_eventi_in_approvazione sugli eventi. Chiude
-- anche la finestra di corsa tra il conteggio letto dalla route API e
-- l'insert (due richieste quasi simultanee potrebbero altrimenti superare
-- il limite di 3 conversazioni/giorno).
create or replace function public.limite_conversazioni_assistente_giorno()
returns trigger
language plpgsql
as $$
declare
  v_conteggio integer;
begin
  select count(*) into v_conteggio
  from public.assistente_conversazioni
  where student_id = new.student_id
    and (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date;

  if v_conteggio >= 3 then
    raise exception 'troppe_conversazioni_oggi';
  end if;

  return new;
end;
$$;

create trigger limite_conversazioni_assistente_giorno
before insert on public.assistente_conversazioni
for each row execute function public.limite_conversazioni_assistente_giorno();
