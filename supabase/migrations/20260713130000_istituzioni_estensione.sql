-- Estende la tabella istituzioni minima (creata in 20260712140000_eventi.sql
-- per gli organizzatori di eventi) con i campi del profilo pubblico e del
-- piano attivo, invece di ricrearla. Aggiunge institution_profiles: il
-- collegamento mancante tra un utente autenticato (ruolo istituzione) e la
-- riga istituzioni corrispondente — senza non è possibile applicare RLS
-- "l'ente legge/scrive solo le proprie righe", né una dashboard sapere
-- quale istituzione rappresenta chi è loggato.

create type public.istituzione_tipo as enum ('universita', 'its', 'academy', 'ente_professionale', 'altro');
create type public.istituzione_stato as enum ('in_attesa', 'attiva', 'sospesa');

alter table public.istituzioni
  add column slug text unique,
  add column tipo public.istituzione_tipo,
  add column descrizione text,
  add column immagine_copertina_url text,
  add column sito_ufficiale text,
  add column piano_id uuid references public.piani (id),
  add column stato public.istituzione_stato not null default 'in_attesa';

comment on table public.istituzioni is
  'Anagrafica delle istituzioni formative post-diploma: profilo pubblico, piano attivo, stato di attivazione (manuale da parte di KIREO). Aggiornato da minima (solo id+nome per gli organizzatori di eventi) a completa.';

create table public.institution_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.institution_profiles is
  'Collega l''utente autenticato (ruolo istituzione, tipicamente il referente che ha fatto il signup) alla riga istituzioni che rappresenta. Stesso ruolo di student_profiles/teacher_profiles per gli altri ruoli.';

create or replace function public.check_ruolo_istituzione()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.profiles where id = new.user_id and ruolo = 'istituzione') then
    raise exception 'user_id % deve avere ruolo istituzione per avere un institution_profiles', new.user_id;
  end if;
  return new;
end;
$$;

create trigger check_ruolo_istituzione
before insert or update on public.institution_profiles
for each row execute function public.check_ruolo_istituzione();

alter table public.institution_profiles enable row level security;

create policy institution_profiles_select_own
  on public.institution_profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy institution_profiles_insert_own
  on public.institution_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

-- Istituzione corrente, per le policy RLS — stesso pattern di
-- current_school_code().
create or replace function public.current_istituzione_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select istituzione_id from public.institution_profiles where user_id = auth.uid();
$$;

grant execute on function public.current_istituzione_id() to authenticated;

-- Rivede la policy di lettura pubblica di istituzioni (era "using (true)",
-- troppo permissiva ora che esiste uno stato): solo le istituzioni attive
-- sono visibili pubblicamente. L'ente vede sempre la propria riga
-- (qualunque stato), l'admin vede tutto.
drop policy istituzioni_select_public on public.istituzioni;

create policy istituzioni_select_pubblico_attive
  on public.istituzioni for select
  to anon, authenticated
  using (stato = 'attiva');

create policy istituzioni_select_propria
  on public.istituzioni for select
  to authenticated
  using (id = public.current_istituzione_id());

create policy istituzioni_select_admin
  on public.istituzioni for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- L'ente aggiorna il proprio profilo (copertina, descrizione, sito), ma
-- non può cambiare da solo stato o piano. A differenza di eventi/
-- comunicazioni (dove il WITH CHECK basta perché i valori ammessi in
-- self-service sono un sottoinsieme fisso), qui l'ente non deve poter
-- scrivere NESSUN valore in quelle due colonne, nemmeno un altro valido:
-- un WITH CHECK non ha accesso alla riga precedente per confrontarla, quindi
-- non basta da solo. Un REVOKE di colonna bloccherebbe anche l'admin
-- (privilegi di colonna sono per ruolo Postgres "authenticated", non
-- condizionati dalla RLS) — la soluzione corretta è un trigger che
-- ripristina i valori precedenti se chi scrive non è admin.
create policy istituzioni_update_propria
  on public.istituzioni for update
  to authenticated
  using (id = public.current_istituzione_id())
  with check (id = public.current_istituzione_id());

create or replace function public.blocca_autoescalation_istituzione()
returns trigger
language plpgsql
as $$
begin
  if public.current_ruolo() <> 'admin' then
    new.stato := old.stato;
    new.piano_id := old.piano_id;
  end if;
  return new;
end;
$$;

create trigger blocca_autoescalation_istituzione
before update on public.istituzioni
for each row execute function public.blocca_autoescalation_istituzione();

-- Necessaria perché finalize_registration_istituzione (sotto) è SECURITY
-- INVOKER: un utente appena autenticato, senza ancora un profilo, deve
-- poter creare la propria riga istituzioni — ma solo in stato "in_attesa"
-- (mai già attiva), coerente con l'attivazione manuale KIREO.
create policy istituzioni_insert_self_signup
  on public.istituzioni for insert
  to authenticated
  with check (stato = 'in_attesa');

create policy istituzioni_admin_tutto
  on public.istituzioni for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Finalizzazione della registrazione ente: profilo separato da
-- finalize_registration (già usata da studente/docente), perché i campi
-- e la logica sono sufficientemente diversi da non giustificare un
-- ulteriore parametro su quella funzione (ed evita di ripetere l'errore di
-- overload scoperto in precedenza). Il piano è sempre "free" al signup: i
-- piani a pagamento richiedono un upgrade/pagamento, non ancora costruito
-- (Fase 2) — nessuna istituzione può "scegliersi" un piano a pagamento da
-- sola in questa fase.
create or replace function public.finalize_registration_istituzione(
  p_nome_ente text,
  p_slug text,
  p_tipo public.istituzione_tipo,
  p_referente_nome text,
  p_referente_cognome text,
  p_sito_ufficiale text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_istituzione_id uuid;
  v_piano_free_id uuid;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    return; -- già finalizzato (es. link email aperto due volte)
  end if;

  select id into v_piano_free_id from public.piani where nome = 'free';

  insert into public.istituzioni (nome, slug, tipo, sito_ufficiale, piano_id, stato)
  values (p_nome_ente, p_slug, p_tipo, p_sito_ufficiale, v_piano_free_id, 'in_attesa')
  returning id into v_istituzione_id;

  insert into public.profiles (id, ruolo, nome, cognome)
  values (v_uid, 'istituzione', p_referente_nome, p_referente_cognome);

  insert into public.institution_profiles (user_id, istituzione_id)
  values (v_uid, v_istituzione_id);
end;
$$;

grant execute on function public.finalize_registration_istituzione(text, text, public.istituzione_tipo, text, text, text) to authenticated;
