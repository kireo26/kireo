-- LA DATA DI APPROVAZIONE DI UN POST LA SCRIVE IL DATABASE (28/10).
--
-- Da oggi la Bacheca si ordina per `approvato_il` (Mario, 28/10: un post
-- scritto lunedì e approvato mercoledì, per lo studente, nasce mercoledì).
-- Ma quella colonna la scriveva il BROWSER dell'admin
-- (`AzioneApprovazionePost`, `new Date().toISOString()`): l'ordine della
-- Bacheca sarebbe dipeso dall'orologio di un computer. E nessun vincolo
-- impediva un post approvato senza data — per esempio approvato dal SQL
-- Editor —, che in un ordine decrescente finisce in fondo o in cima a seconda
-- di come si trattano i NULL, cioè in silenzio.
--
-- Due pezzi qui, e il terzo dopo il deploy:
--   1. un trigger: quando un post passa ad «approvato», `approvato_il` è
--      `now()`. Vale per il client e per il SQL Editor (una regola sul posto,
--      non su una strada). Un'ora riscritta dal database non è un valore
--      rimesso in silenzio: è la stessa forma di `created_at := now()` nei
--      tetti del 27/10, e il client nuovo non la manda più;
--   2. un vincolo validato: un post approvato ha una data;
--   3. (20261110110000, DOPO il deploy) la colonna esce dalle scritture del
--      client. Prima del deploy romperebbe le approvazioni: il codice vecchio
--      manda ancora la data, e senza il privilegio l'update fallirebbe. Con il
--      solo trigger il codice vecchio funziona, e la sua data viene
--      sovrascritta.
--
-- ⚠️ PRIMA DI TUTTO, UNA MISURA: se esiste già un post approvato senza data,
-- la migrazione si ferma e dice quanti sono. Non si inventa una data per un
-- fatto che non abbiamo registrato (`created_at` sarebbe un'altra cosa): quel
-- giorno si guardano per id e si decide.

do $$
declare
  v_senza int;
begin
  select count(*) into v_senza from public.post_enti where stato = 'approvato' and approvato_il is null;
  if v_senza > 0 then
    raise exception 'ci sono % post approvati senza data di approvazione: si guardano prima (select id, created_at from public.post_enti where stato = ''approvato'' and approvato_il is null)', v_senza;
  end if;
end $$;

create or replace function public.data_approvazione_post()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.stato = 'approvato' and old.stato is distinct from 'approvato' then
    new.approvato_il := now();
  end if;
  return new;
end;
$$;

drop trigger if exists post_enti_data_approvazione on public.post_enti;
create trigger post_enti_data_approvazione
  before update of stato on public.post_enti
  for each row execute function public.data_approvazione_post();

alter table public.post_enti
  add constraint post_enti_approvato_con_data check (stato <> 'approvato' or approvato_il is not null);

comment on column public.post_enti.approvato_il is
  'L''istante in cui il post è diventato «approvato», scritto dal database (trigger post_enti_data_approvazione, 20261110100000). La Bacheca degli studenti si ordina su questa colonna.';

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'post_enti_data_approvazione' and not tgisinternal) then
    raise exception 'il trigger post_enti_data_approvazione non è atterrato';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'post_enti_approvato_con_data' and convalidated) then
    raise exception 'il vincolo post_enti_approvato_con_data non è atterrato validato';
  end if;
end $$;
