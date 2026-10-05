-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ ⚠️  QUESTO SHIM ESISTE PER FAR GIRARE LE MIGRAZIONI, NON PER            ║
-- ║     RIPRODURRE LA TOPOLOGIA DEI RUOLI DI SUPABASE — E NON È TENUTO     ║
-- ║     A IMITARLA BENE.                                                    ║
-- ║                                                                         ║
-- ║     Quindi: PRIMA di scrivere una proprietà che guarda uno di questi    ║
-- ║     valori, sappi che qui mente.                                        ║
-- ║                                                                         ║
-- ║       • `current_user` e `session_user`                                 ║
-- ║       • i NOMI dei ruoli, e chi è membro di chi                         ║
-- ║       • chi POSSIEDE una tabella o una funzione                         ║
-- ║       • qualunque `current_setting`                                     ║
-- ║       • i default privileges (imitati sotto, ma solo quelli che         ║
-- ║         servivano: non è un elenco completo)                            ║
-- ║                                                                         ║
-- ║     La replica mente ESATTAMENTE dove non ha promesso di dire la        ║
-- ║     verità. Il perimetro di quella promessa mancata è questo elenco.    ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- IL CASO CHE L'HA FATTA SCRIVERE (5/10/2026, e ha quasi prodotto una cura
-- peggiore del male). Per chiudere il buco di `student_profiles` serviva
-- distinguere una scrittura fatta da una SECURITY DEFINER da una fatta dal
-- client, e la strada sembrava `current_user` contro `session_user`. Qui:
--
--     dal client            → current=authenticated  session=postgres  (divergono)
--     dentro una DEFINER    → current=postgres       session=postgres  (coincidono)
--
-- …e il discriminante sembrava funzionare. MA `session_user` qui è `postgres`
-- per un artefatto di questo file: le sonde fanno `set local role` da una
-- sessione `postgres`, che per caso è anche il proprietario delle funzioni. In
-- Supabase vero PostgREST si collega come `authenticator`, quindi i due
-- divergono in TUTTI E DUE i casi e il discriminante non discrimina niente.
-- Il trigger che ne era uscito, provato: l'autoverifica ATTECCHIVA e
-- `verifica_studente` SI ROMPEVA. Verde sulla replica, il contrario in
-- produzione — proprio nel punto in cui replica e produzione differiscono,
-- cioè dove serviva guardare.
--
-- LA DOMANDA DA FARSI, OGNI VOLTA: il valore che sto guardando è del SISTEMA,
-- o dell'ambiente in cui lo sto provando? E se è del secondo: c'è uno
-- strumento che non ha bisogno di saperlo? (In quel caso sì — la policy, che
-- governa solo le scritture dal client perché una DEFINER del proprietario
-- scavalca la RLS.)
--
-- ─────────────────────────────── come si usa
--   PGBIN=/usr/lib/postgresql/16/bin
--   mkdir -p /tmp/pgk && chown pg /tmp/pgk
--   su pg -s /bin/bash -c "$PGBIN/initdb -D /tmp/pgk/data -U postgres -A trust"
--   su pg -s /bin/bash -c "$PGBIN/pg_ctl -D /tmp/pgk/data -l /tmp/pgk/log.txt -o \"-k /tmp/pgk -h ''\" start"
--
-- `-U postgres` NON è un dettaglio: senza, il superuser prende il nome
-- dell'utente di sistema e tutte le migrazioni cadono su «role "postgres" does
-- not exist». E `su pg` vuole `-s /bin/bash` perché quell'utente ha la shell a
-- `nologin`. (Verificato ricostruendo da zero: queste due righe, scritte senza
-- provarle, erano sbagliate tutte e due.)
--   psql -h /tmp/pgk -U postgres -d postgres -f scripts/replica-shim.sql
--   for f in supabase/migrations/*.sql; do
--     case "$(basename "$f")" in *storage*) continue;; esac
--     psql -h /tmp/pgk -U postgres -d postgres -v ON_ERROR_STOP=1 -q --single-transaction -f "$f" || break
--   done
--
-- LE MIGRAZIONI DI STORAGE SI SALTANO (`*storage*`): creano bucket, e qui non
-- c'è Storage. UNA TRANSAZIONE PER FILE, non tutte insieme: un valore enum
-- appena creato non si usa nella stessa transazione in cui nasce, e diverse
-- migrazioni sono isolate proprio per quel vincolo.
--
-- ⚠️ E UNA CONTROPROVA SU UNA MIGRAZIONE VA FATTA SU UNA REPLICA **NATA
-- SENZA** IL FIX: `create or replace`, `drop policy`/`create policy` e i grant
-- preservano o ricreano lo stato, quindi riapplicare un file sabotato sulla
-- stessa replica dà una risposta che SEMBRA una risposta. Si ricostruisce.

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

grant anon, authenticated, service_role to postgres;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  confirmed_at timestamptz,
  confirmation_token text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- L'identità la impostano le sonde con `set local request.jwt.claim.sub = '…'`.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text);
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select u.email from auth.users u where u.id = auth.uid();
$$;

-- I default privileges di Supabase sullo schema public: senza, una funzione o
-- una tabella nuova nascerebbe chiusa e le prove sui permessi direbbero il
-- contrario del vero (una funzione revocata dal solo `anon` risulterebbe
-- chiusa mentre è aperta via PUBLIC — misurato il 26/09).
--
-- ⚠️ SONO QUELLI CHE SERVIVANO, NON TUTTI QUELLI CHE SUPABASE IMPOSTA. Se una
-- prova dipende da un privilegio di default che qui non c'è, il risultato è
-- una proprietà dell'ambiente di prova e non del sistema.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
