-- DUE SIGNIFICATI, DUE COLONNE (Mario, 27/10 — strada (b)).
--
-- `profiles.di_prova` diceva due cose insieme: «fuori dai conti» (le misure lo
-- escludono, i guasti lo marcano) ed «esente dai cancelli» (il tetto dei
-- workshop, l'attesa fra le tappe). Finché valevano per le stesse persone non
-- costava niente. Ma la cura scelta per «di_prova nasce false su ogni strada» è
-- far nascere `di_prova` VERO fino all'apertura, e con un flag solo ogni account
-- creato prima dell'apertura avrebbe saltato il tetto: il muro dei tre e «uno
-- alla volta» non li avrebbe più visti nessuno come li vedrà uno studente.
--
-- I PUNTI IN CUI IL FLAG DECIDE UN COMPORTAMENTO (censimento del 27/10,
-- CLAUDE.md, punti aperti): (1) `puo_iscriversi_a_un_workshop`, cioè il tetto e
-- «uno alla volta», qui sotto; (2) l'attesa fra le tappe nel cron
-- (`app/api/cron/workshop-motore/route.ts`), che passa a `e_esente_dai_cancelli`
-- nello stesso commit; (3) il banco, che pretende tutte e due. Tutto il resto
-- marca e resta su `di_prova`.
--
-- 1. LA COLONNA NUOVA NASCE CON IL VALORE DI OGGI. `esente_cancelli := di_prova`
--    su ogni riga: nell'istante della migrazione nessun comportamento cambia
--    (Mario). Da qui in poi le due colonne si muovono da sole.
--
-- 2. IL VALORE DI PARTENZA DI `di_prova` DIVENTA VERO, e sta in UNA funzione
--    (`di_prova_di_partenza`), usata sia come default della colonna sia dal
--    trigger. ⚠️ IL GIORNO DELL'APERTURA SI ROVESCIA QUI, con una migrazione
--    nuova che la riscrive a `false`: «se nessuno rovescia il valore di
--    partenza, i primi utenti veri di KIREO non esisteranno per nessuna
--    statistica». Il fatto che lo fa scattare: il primo account di una persona
--    che non è Mario. `esente_cancelli` nasce falso, e resta falso: da oggi
--    ogni account nuovo è uno studente di prova NON esente, cioè quello che
--    serve per vedere i cancelli a schermo.
--
-- 3. ⚠️ NESSUNO SI ESENTA DA SÉ, NEANCHE ALLA NASCITA. Il trigger del 30/08
--    copriva solo l'UPDATE, e la policy `profiles_insert_own` lascia a un
--    utente collegato inserire la propria riga: chi la scriveva a mano con
--    `di_prova = true` saltava già oggi il tetto. Con una colonna che esiste
--    SOLO per esentare, quella porta non può restare aperta. Ora il trigger è
--    anche BEFORE INSERT: da una sessione che non è admin, `di_prova` prende il
--    valore di partenza ed `esente_cancelli` falso, qualunque cosa sia stata
--    scritta. Un admin e una connessione privilegiata (auth.uid() NULL)
--    possono, come prima.
--
-- 4. `stato_tetto_workshop` PERDE LA COLONNA `esente`. Nata il 26/09 con il
--    tetto (8ff703a), non l'ha mai letta nessuno, e nessun commento dice
--    perché c'era. «Sei esente dal tetto» è un'informazione sul nostro
--    apparato di prova, non sul prodotto: non ha niente da fare in una
--    risposta che arriva alla pagina di uno studente. Togliere una colonna da
--    una RETURNS TABLE vuol dire drop + create, e i permessi si rinominano.
--
-- COME SI VERIFICA APPLICATA: `profiles.esente_cancelli` esiste e
-- `to_regprocedure('public.e_esente_dai_cancelli(uuid)')` non è null (li crea
-- solo questa migrazione); `scripts/fotografia-esente.sql`, lanciata prima e
-- dopo, deve dire «esenti dopo = di prova prima» e «nessuna riga diversa».

-- ── 1. la colonna, col valore di oggi ─────────────────────────────────────
alter table public.profiles
  add column if not exists esente_cancelli boolean not null default false;

comment on column public.profiles.esente_cancelli is
  'Esente dai cancelli dei workshop (tetto, uno alla volta, attesa fra le tappe). Distinta da di_prova («fuori dai conti») dal 20261031100000. La mette solo un admin o una connessione privilegiata.';

update public.profiles set esente_cancelli = di_prova where esente_cancelli is distinct from di_prova;

-- ── 2. il predicato, accanto a e_profilo_di_prova ─────────────────────────
create or replace function public.e_esente_dai_cancelli(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.esente_cancelli from public.profiles p where p.id = p_student_id), false);
$$;

comment on function public.e_esente_dai_cancelli(uuid) is
  '20261031100000: true se il profilo salta i cancelli dei workshop. coalesce a false, come e_profilo_di_prova: un id inesistente non è esente.';

-- Lo chiama il cron con la service-role, e `puo_iscriversi_a_un_workshop`
-- dall'interno (SECURITY DEFINER, quindi come proprietario): ad
-- `authenticated` non serve, e i ruoli si nominano.
revoke all on function public.e_esente_dai_cancelli(uuid) from public, anon, authenticated;
grant execute on function public.e_esente_dai_cancelli(uuid) to service_role;

-- ── 3. il valore di partenza, in un posto solo ────────────────────────────
create or replace function public.di_prova_di_partenza()
returns boolean
language sql
immutable
as $$
  select true;
$$;

comment on function public.di_prova_di_partenza() is
  '20261031100000: il valore con cui nasce profiles.di_prova. VERO fino all''apertura; il giorno in cui si iscrive la prima persona che non è Mario, una migrazione nuova lo riscrive a false.';

-- Un default si valuta con i privilegi di chi inserisce.
revoke all on function public.di_prova_di_partenza() from public, anon;
grant execute on function public.di_prova_di_partenza() to authenticated, service_role;

alter table public.profiles alter column di_prova set default public.di_prova_di_partenza();

-- ── 4. il trigger: tutte e due le colonne, anche alla nascita ─────────────
create or replace function public.blocca_autoflag_di_prova()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Il ramo affermativo è «chi può» (admin, o nessuna sessione: service_role,
  -- SQL Editor, le migrazioni); tutti gli altri ricevono i valori decisi qui.
  -- IS DISTINCT FROM: current_ruolo() è NULL per chi non ha ancora un profilo,
  -- che è esattamente il caso dell'insert.
  if auth.uid() is not null and public.current_ruolo() is distinct from 'admin' then
    if tg_op = 'INSERT' then
      new.di_prova := public.di_prova_di_partenza();
      new.esente_cancelli := false;
    else
      new.di_prova := old.di_prova;
      new.esente_cancelli := old.esente_cancelli;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.blocca_autoflag_di_prova() is
  '20261031100000: nessuno si marca da sé né si esenta da sé, né all''insert né all''update. Un admin e una connessione privilegiata (auth.uid() NULL) possono. Verificabile con scripts/verifica-flag-di-prova.sql.';

drop trigger if exists blocca_autoflag_di_prova on public.profiles;
create trigger blocca_autoflag_di_prova
  before insert or update on public.profiles
  for each row execute function public.blocca_autoflag_di_prova();

-- ── 5. i cancelli dei workshop leggono la colonna loro ────────────────────
create or replace function public.puo_iscriversi_a_un_workshop()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and (
       public.e_esente_dai_cancelli(auth.uid())
       or (
         not public.ha_un_workshop_attivo()
         and public.iscrizioni_workshop_contate() < public.tetto_iscrizioni_workshop()
       )
     )
$$;

comment on function public.puo_iscriversi_a_un_workshop() is
  'Il tetto dei workshop: nessuno già attivo, e meno di tetto_iscrizioni_workshop() fra attive e completate. Esenti i profili con esente_cancelli (dal 20261031100000; prima era di_prova): il robot del banco gioca 25 ruoli con un account solo. Chiamata sia dalla policy di insert sia da riprendi_iscrizione_workshop.';

drop function if exists public.stato_tetto_workshop();
create function public.stato_tetto_workshop()
returns table (
  usate integer,
  tetto integer,
  puo boolean,
  attivo_slug text,
  attivo_titolo text,
  attivo_ruolo text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.iscrizioni_workshop_contate(),
    public.tetto_iscrizioni_workshop(),
    public.puo_iscriversi_a_un_workshop(),
    w.slug,
    w.titolo,
    r.titolo
  from (select 1) _
  left join public.workshop_iscrizioni wi
    on wi.student_id = auth.uid() and wi.stato = 'attivo'
  left join public.workshop w on w.id = wi.workshop_id
  left join public.workshop_ruoli r on r.id = wi.ruolo_id
  limit 1
$$;

comment on function public.stato_tetto_workshop() is
  'Cosa la pagina dice allo studente sul tetto dei workshop: quante iscrizioni ha usate, su quante, se può cominciarne un''altra, e — se ne ha una attiva — quale. Solo le proprie righe. Dal 20261031100000 senza la colonna esente, che nessuno leggeva.';

revoke all on function public.stato_tetto_workshop() from public, anon;
grant execute on function public.stato_tetto_workshop() to authenticated;
