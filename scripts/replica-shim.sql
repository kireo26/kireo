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
-- ║                                                                         ║
-- ║ ⚠️⚠️ E UN TIPO DI COLONNA NON STA IN QUELL'ELENCO, ANZI: È L'UNICA      ║
-- ║     COSA CHE QUESTO FILE DEVE AZZECCARE (11/10/2026). Le colonne        ║
-- ║     finte qui sotto portano i TIPI DI PRODUZIONE, non quelli comodi.    ║
-- ║     Vedi `auth.users.email`: per tre mesi era `text` mentre in          ║
-- ║     Supabase è `character varying`, e l'export presenze dell'admin è    ║
-- ║     stato ROTTO IN PRODUZIONE dal 26 luglio con 19 proprietà verdi      ║
-- ║     sulla replica. Un tipo sbagliato qui non fa mentire una prova su    ║
-- ║     un dettaglio dell'ambiente: la fa mentire sul prodotto.             ║
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

-- ⚠️ I TIPI SONO QUELLI DI SUPABASE, NON QUELLI COMODI — e le tre colonne
-- `varchar` sono la ragione per cui questo commento esiste.
--
-- In PL/pgSQL un `return query` confronta i tipi delle colonne della query con
-- quelli dichiarati nel `returns table (...)`, e il confronto è STRETTO: non
-- ammette nemmeno la conversione `character varying` → `text`, che altrove
-- passa senza che nessuno se ne accorga. Quindi una funzione che dichiara
-- `email text` e seleziona `u.email` solleva «structure of query does not match
-- function result type» — in produzione.
--
-- Finché qui `email` era `text`, quella funzione era CORRETTA sulla replica, e
-- nessuna prova poteva vedere il difetto: non per un buco di una prova, ma
-- perché la replica le mostrava un sistema diverso. È il modo 4 dei tredici (una
-- guardia che misura l'ambiente invece del sistema), applicato a una classe
-- intera invece che a una proprietà.
--
-- ⚠️ E NON LO PRENDE «SEMINARE UNA RIGA», che era l'ipotesi: il controllo di
-- PL/pgSQL scatta all'esecuzione del `return query`, NON all'emissione della
-- prima riga — misurato, zero righe solleva uguale. Su una replica con i tipi
-- giusti, basta che una prova CHIAMI la funzione.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email character varying(255),
  encrypted_password character varying(255),
  email_confirmed_at timestamptz,
  confirmed_at timestamptz,
  confirmation_token character varying(255),
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

-- E lo schema `storage`, che qui non serve a niente (le migrazioni di storage si
-- saltano) ma in produzione ha la stessa riga di `postgres`: misurata da Mario
-- il 28/10 (`postgres  storage  r  anon=arwdDxtm, authenticated=arwdDxtm`). Senza,
-- la replica diceva che una sola fabbrica restava da chiudere, e la migrazione
-- 20261106100000 è passata qui e si è fermata in produzione. Le righe di
-- `supabase_admin` non si imitano: valgono per gli oggetti che crea Supabase, e
-- qui quel ruolo non esiste.
create schema if not exists storage;
alter default privileges in schema storage grant all on tables to anon, authenticated, service_role;
