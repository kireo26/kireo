-- KIREO — il flag dell'account di prova.
--
-- PRECONDIZIONE del robot che gioca (banco, secondo pezzo), e va applicata
-- PRIMA che quel robot scriva una sola riga. Le righe scritte prima del flag
-- restano indistinguibili per sempre: è l'unica cosa di tutta questa
-- architettura che dopo non si aggiusta più.
--
-- NON INVISIBILE, RICONOSCIBILE. Un dato invisibile non si può nemmeno
-- verificare che sia escluso. Il flag MARCA: la riga porta con sé da dove
-- viene, e ogni consumatore decide che farne — perché le misure non vogliono
-- tutte la stessa cosa:
--   · quelle che dicono qualcosa sugli STUDENTI (pesi per area, caso D,
--     abbandoni) il robot le sporca: vanno depurate;
--   · quelle che dicono qualcosa sul MODELLO (guardia della lingua, revisori
--     falliti, troncature) il robot le arricchisce — è lo stesso revisore, con
--     gli stessi prompt, su contenuto vero. Buttarle via sarebbe buttare via il
--     campione migliore che avremo.
--
-- PERCHÉ UNA COLONNA SU `profiles` E NON UNA CONVENZIONE SULL'EMAIL. Una
-- convenzione si dimentica, non è interrogabile, e non regge un cambio di
-- indirizzo. E perché una sola colonna basta: `evidence`, `area_signal`,
-- `mission_attempt`, `test_attempt`, `step_response`, `activity_log` e le
-- tabelle workshop risalgono tutte a `profiles` — la marcatura è transitiva,
-- e non serve una colonna su ognuna.

-- ── 1. il flag ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists di_prova boolean not null default false;

comment on column public.profiles.di_prova is
  'true = profilo di collaudo (il robot del banco, o una prova a mano). Le righe che ne discendono restano nel database ma vanno ESCLUSE da ogni misura che descrive gli studenti. Non si cancella e non si nasconde: si riconosce.';

-- Indice parziale: i profili di prova sono pochissimi, e ogni misura li deve
-- poter escludere senza scandire l'intera tabella.
create index if not exists profiles_di_prova_idx
  on public.profiles (id) where di_prova;

-- ── 2. il predicato, in un posto solo ──────────────────────────────────────
-- Ogni misura chiama QUESTA, invece di scrivere il join a mano: una condizione
-- ripetuta in sei query è una condizione che in sei mesi diverge in sei modi.
-- STABLE e SECURITY DEFINER perché serve anche là dove chi interroga non ha
-- diritto di leggere `profiles` di altri (le diagnostiche girano come admin,
-- ma il robot e le route no).
create or replace function public.e_profilo_di_prova(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.di_prova from public.profiles p where p.id = p_student_id), false);
$$;

comment on function public.e_profilo_di_prova(uuid) is
  'true se il profilo è di collaudo. coalesce a false: un id inesistente non è "di prova" — un NULL qui renderebbe NULL ogni `where not ...`, cioè escluderebbe TUTTO invece di niente (lo stesso errore NULL già pagato più volte in questo progetto).';

revoke all on function public.e_profilo_di_prova(uuid) from public;
grant execute on function public.e_profilo_di_prova(uuid) to authenticated, service_role;

-- Nessuno può marcarsi da sé: il flag lo mette un admin (o service_role) a
-- mano. Il trigger anti-autoelevazione di `profiles` protegge già `ruolo`;
-- questo aggiunge `di_prova` allo stesso principio.
create or replace function public.blocca_autoflag_di_prova()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- IS DISTINCT FROM, non <>: `current_ruolo()` è NULL per chi non ha ancora un
  -- profilo, e con `<>` il confronto darebbe NULL invece di TRUE — cioè il
  -- blocco non scatterebbe. È lo stesso errore già cacciato in
  -- `verifica_studente`, `approva_richiesta_upgrade` e
  -- `blocca_autoescalation_istituzione`.
  if new.di_prova is distinct from old.di_prova and public.current_ruolo() is distinct from 'admin' then
    new.di_prova := old.di_prova;
  end if;
  return new;
end;
$$;

drop trigger if exists blocca_autoflag_di_prova on public.profiles;
create trigger blocca_autoflag_di_prova
  before update on public.profiles
  for each row execute function public.blocca_autoflag_di_prova();

-- ── 3. la guardia della lingua: separata, non esclusa ──────────────────────
-- `guardia_lingua_giorno` misura il MODELLO, non gli studenti, e non ha
-- dimensione per studente — apposta: la funzione «non sa e non deve sapere CHI
-- ha generato l'intervento». Quindi qui il flag non può arrivare per via
-- transitiva: va passato dal chiamante, che quello lo sa.
--
-- Si separa invece di escludere, perché i due numeri servono a due domande
-- diverse: quello di produzione dice qual è il tasso vero sui testi degli
-- studenti; quello di prova dice com'è andata la passata del robot, su
-- venticinque ruoli in un colpo — il campione più grande che avremo.
alter table public.guardia_lingua_giorno
  add column if not exists di_prova boolean not null default false;

alter table public.guardia_lingua_giorno drop constraint if exists guardia_lingua_giorno_pkey;
alter table public.guardia_lingua_giorno add primary key (giorno, di_prova);

-- ATTENZIONE, lezione già pagata: aggiungere un parametro con default a una
-- funzione NON la sostituisce, ne crea un SECONDO overload (in Postgres
-- l'identità di una funzione è nome + tipi dei parametri). È successo con
-- `finalize_registration`, che è rimasta in due versioni finché non l'abbiamo
-- scoperto. Quindi la vecchia firma si droppa esplicitamente.
drop function if exists public.registra_guardia_lingua(boolean);

create or replace function public.registra_guardia_lingua(p_ancora_accordato boolean, p_di_prova boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.guardia_lingua_giorno as g (giorno, di_prova, interventi, ancora_accordato)
  values ((now() at time zone 'utc')::date, coalesce(p_di_prova, false), 1, case when p_ancora_accordato then 1 else 0 end)
  on conflict (giorno, di_prova) do update
    set interventi = g.interventi + 1,
        ancora_accordato = g.ancora_accordato + case when p_ancora_accordato then 1 else 0 end;
end;
$$;

revoke all on function public.registra_guardia_lingua(boolean, boolean) from public;
grant execute on function public.registra_guardia_lingua(boolean, boolean) to authenticated, service_role;
