-- 20261209110000 — I GIRI DEI CRON SI SCRIVONO (Mario, 04/11)
--
-- La mail dell'osservabilità parte solo quando c'è qualcosa da segnalare, quindi
-- un giorno senza mail si leggeva come un giorno sano anche quando il cron non
-- aveva girato. Decisione di Mario: nei giorni sani resta muta, e il lunedì
-- parte comunque, con l'ultima volta che ogni cron ha girato — così un giro
-- saltato o in ritardo si vede dalla DATA, non dall'assenza.
--
-- Una riga per giro, scritta da ogni cron appena autorizzato (prima di qualunque
-- lavoro che possa fermarlo) e completata alla fine con `finito_il`. Un giro
-- partito e mai finito è un'informazione: si è rotto a metà.
--
-- `programmato` è falso quando chi chiama si dichiara con `?alert=no` (il banco,
-- un giro a mano): la mail del lunedì conta solo i programmati.
--
-- Il client non legge e non scrive: la scrive e la legge il server con la
-- service role. Righe di 60 giorni, potate dal cron dei workshop.

create table if not exists public.giri_cron (
  id uuid primary key default gen_random_uuid(),
  processo text not null,
  programmato boolean not null,
  partito_il timestamptz not null default now(),
  finito_il timestamptz,
  constraint giri_cron_finito_dopo check (finito_il is null or finito_il >= partito_il)
);
create index if not exists giri_cron_processo_partito_idx on public.giri_cron (processo, partito_il desc);
alter table public.giri_cron enable row level security;
revoke all on public.giri_cron from anon, authenticated;
grant select, insert, update, delete on public.giri_cron to service_role;
comment on table public.giri_cron is
  '20261209110000: una riga per giro di ogni cron, scritta dal server. La legge la mail del lunedì dell''osservabilità.';

do $$
begin
  if to_regclass('public.giri_cron') is null then
    raise exception '20261209110000: manca la tabella';
  end if;
  if has_table_privilege('anon', 'public.giri_cron', 'SELECT') or has_table_privilege('authenticated', 'public.giri_cron', 'SELECT')
     or has_table_privilege('authenticated', 'public.giri_cron', 'INSERT') then
    raise exception '20261209110000: il client legge o scrive i giri dei cron';
  end if;
end $$;
