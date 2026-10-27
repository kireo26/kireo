-- I TETTI DELLE DUE ROUTE CHE SPENDONO SENZA LIMITE, E LE COLONNE DEI
-- TENTATIVI CHE IL CLIENT NON DEVE SCRIVERE (Mario, 27/10; censimento in
-- «Il censimento delle route che spendono»).
--
-- 1 · L'ASSISTENTE CONTA LE RICHIESTE, NON LE CONVERSAZIONI. Il tetto delle tre
-- conversazioni al giorno scattava solo se il client dichiarava
-- `nuovaConversazione: true`: *una guardia che chiede alla parte sorvegliata se
-- deve scattare non è una guardia, è una cortesia* (Mario). La conversazione è
-- un concetto del client; la richiesta è un fatto del server. Ogni chiamata
-- all'assistente scrive una riga in `assistente_richieste` PRIMA di chiamare il
-- modello, e il trigger la rifiuta oltre `tetto_richieste_assistente_giorno()`.
-- Il client non sceglie niente: scrive solo `student_id`, e il trigger lo
-- pretende uguale a chi chiama. Niente policy di delete, quindi una riga
-- scritta non si toglie per rientrare nel conto. Il tetto delle tre
-- conversazioni resta com'era: per il nostro client è il limite che si
-- incontra prima, e ha già il suo testo.
-- Il 30 è SCELTO, non misurato: tre conversazioni da dieci domande, cioè il
-- massimo che il prodotto prometteva già.
--
-- 2 · UN TENTATIVO DI MISSIONE AL GIORNO NON È GRATIS. Ogni tentativo finito
-- costa fino a tre chiamate (gli step aperti), e i tentativi lo studente li
-- apriva quando voleva: il tetto va sull'apertura, non sulla finalizzazione
-- (Mario). `tetto_missioni_al_giorno()` = 5, scelto e non misurato: le missioni
-- sono dieci, e cinque in un giorno è già un pomeriggio intero.
--
-- 3 · LE COLONNE DEI TENTATIVI: il client scrive solo il proprio progresso.
-- `mission_attempt_update_own` e `test_attempt_update_own` non limitavano le
-- colonne, e nemmeno le policy di insert. Quindi, dal client:
--   · `stato` si riscriveva: un tentativo completato tornava `in_corso` e si
--     rifinalizzava (altre chiamate a pagamento), e un tentativo NUOVO si
--     poteva inserire già `completata` — cioè tre `test_attempt` scritti a
--     mano passavano il cancello delle missioni (`ha_completato_i_tre_test`),
--     e una `mission_attempt` completata il cancello dei workshop
--     (`ha_esperienza_percorso`);
--   · `started_at` si riscriveva: decide quale tentativo conta per il profilo
--     («conta il primo» per le missioni, «l'ultimo» per i test, 20260823100000)
--     e, da qui, in quale giorno cade un tentativo per il tetto del punto 2.
-- Lo `stato` lo scrivono solo funzioni SECURITY DEFINER (registra_evidence,
-- registra_evidenze_test), che non passano dai privilegi del client. Il client
-- aggiorna solo l'avanzamento (`stanza_corrente`/`item_corrente`, `updated_at`)
-- e la route di finalizzazione `revisore_esito` con la sessione dello studente
-- [letto: EscapePlayer, TestPlayer, escape/finalizza].
-- ⚠️ CONSEGUENZA, scritta perché si legga: una colonna nuova di queste due
-- tabelle non è scrivibile dal client finché qualcuno non la aggiunge qui
-- sotto. È il verso rumoroso.
-- ⚠️ NON CURATO QUI: `revisore_esito` resta scritto dalla sessione dello
-- studente (la route la usa), quindi un client può riscriverlo; oggi decide
-- solo quale tentativo è «valido» per il profilo. E la falla in quarantena
-- «tentativo-completato-non-congelato» (le risposte di un tentativo completato
-- si riscrivono e `registra_evidence` si richiama) resta com'è: questa
-- migrazione toglie la strada dello `stato`, non quella delle risposte.
--
-- I GIORNI sono in ora italiana (Europe/Rome), non in UTC come i tetti di
-- prima: il rifiuto dice «domani», e «domani» per uno studente comincia a
-- mezzanotte italiana.
--
-- COME SI VERIFICA APPLICATA:
--   select has_column_privilege('authenticated','public.mission_attempt','stato','UPDATE')   → false
--   select has_column_privilege('authenticated','public.test_attempt','stato','INSERT')      → false
--   select has_column_privilege('authenticated','public.mission_attempt','stanza_corrente','UPDATE') → true
--   select to_regclass('public.assistente_richieste') is not null                             → true
-- La migrazione rilegge da sé i privilegi e si ferma se non sono quelli scritti.

-- ── 1 · le richieste all'assistente ──────────────────────────────────────────
create table public.assistente_richieste (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index assistente_richieste_studente_giorno_idx on public.assistente_richieste (student_id, created_at);
alter table public.assistente_richieste enable row level security;

create policy assistente_richieste_insert_own on public.assistente_richieste
  for insert to authenticated with check (student_id = auth.uid());
revoke all on public.assistente_richieste from anon, authenticated;
grant insert (student_id) on public.assistente_richieste to authenticated;

create or replace function public.tetto_richieste_assistente_giorno()
returns integer language sql immutable as $$ select 30 $$;

create or replace function public.tetto_missioni_al_giorno()
returns integer language sql immutable as $$ select 5 $$;

create or replace function public.limite_richieste_assistente_giorno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteggio integer;
begin
  select count(*) into v_conteggio
  from public.assistente_richieste
  where student_id = new.student_id
    and (created_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date;

  if v_conteggio >= public.tetto_richieste_assistente_giorno() then
    raise exception 'troppe_richieste_assistente_oggi';
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger assistente_richieste_limite
  before insert on public.assistente_richieste
  for each row execute function public.limite_richieste_assistente_giorno();

-- ── 2 · i tentativi di missione al giorno ────────────────────────────────────
create or replace function public.limite_missioni_al_giorno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteggio integer;
begin
  select count(*) into v_conteggio
  from public.mission_attempt
  where student_id = new.student_id
    and (started_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date;

  if v_conteggio >= public.tetto_missioni_al_giorno() then
    raise exception 'troppi_tentativi_missione_oggi';
  end if;
  return new;
end;
$$;

create trigger mission_attempt_limite_giorno
  before insert on public.mission_attempt
  for each row execute function public.limite_missioni_al_giorno();

-- ── 3 · le colonne che il client scrive ──────────────────────────────────────
revoke insert, update on public.mission_attempt from anon, authenticated;
grant insert (student_id, mission_slug) on public.mission_attempt to authenticated;
grant update (stanza_corrente, updated_at, revisore_esito) on public.mission_attempt to authenticated;

revoke insert, update on public.test_attempt from anon, authenticated;
grant insert (student_id, test_slug) on public.test_attempt to authenticated;
grant update (item_corrente, updated_at) on public.test_attempt to authenticated;

-- ── la rilettura ─────────────────────────────────────────────────────────────
do $$
declare v_sbagliati text;
begin
  select string_agg(t || '.' || c || ' ' || p || ' = ' || atteso::text, ', ')
    into v_sbagliati
  from (values
    ('mission_attempt', 'stato', 'UPDATE', false),
    ('mission_attempt', 'started_at', 'UPDATE', false),
    ('mission_attempt', 'stato', 'INSERT', false),
    ('mission_attempt', 'started_at', 'INSERT', false),
    ('mission_attempt', 'stanza_corrente', 'UPDATE', true),
    ('mission_attempt', 'revisore_esito', 'UPDATE', true),
    ('mission_attempt', 'mission_slug', 'INSERT', true),
    ('test_attempt', 'stato', 'UPDATE', false),
    ('test_attempt', 'started_at', 'UPDATE', false),
    ('test_attempt', 'stato', 'INSERT', false),
    ('test_attempt', 'item_corrente', 'UPDATE', true),
    ('test_attempt', 'test_slug', 'INSERT', true),
    ('assistente_richieste', 'created_at', 'INSERT', false),
    ('assistente_richieste', 'student_id', 'INSERT', true)
  ) as v(t, c, p, atteso)
  where has_column_privilege('authenticated', 'public.' || t, c, p) is distinct from atteso;

  if v_sbagliati is not null then
    raise exception 'privilegi diversi da quelli scritti (atteso): %', v_sbagliati;
  end if;
end $$;
