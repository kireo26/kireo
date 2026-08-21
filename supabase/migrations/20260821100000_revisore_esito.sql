-- KIREO Escape — esito del revisore della proposta finale, persistito e
-- interrogabile. Prima, l'esito della singola azione più costosa della
-- missione (scrivere la proposta e farla leggere dal revisore AI) non lasciava
-- NESSUNA traccia se il revisore falliva: la proposta veniva letta dal modello
-- ma il parse del JSON lanciava, il catch tornava null, zero prove emesse, e
-- l'unico segnale era un console.error nei log di Vercel (30 minuti di
-- retention). Ora l'esito vive sul tentativo, nei tre stati distinti calcolati
-- dal motore di scoring (lib/escape/scoring.ts).

-- ── colonna sul tentativo ────────────────────────────────────────────────
-- Nullable: null = lo studente non ha scritto la proposta, OPPURE è un
-- tentativo antecedente a questa migrazione (per quei tentativi il display usa
-- l'euristica di ripiego — conteggio delle prove s4_proposta — senza lavoro
-- aggiuntivo). CHECK sui tre valori: nessun altro stato è ammesso.
alter table public.mission_attempt
  add column revisore_esito text
  check (revisore_esito in ('letto', 'letto_senza_credito', 'non_riuscito'));

comment on column public.mission_attempt.revisore_esito is
  'Esito del revisore della proposta finale (s4_proposta): letto | letto_senza_credito | non_riuscito. Null = proposta non scritta, o tentativo pre-migrazione.';

-- ── vista unificante, interrogabile ──────────────────────────────────────
-- Rende gli esiti del revisore osservabili senza incollare log a mano: una
-- SELECT invece di 30 minuti di retention Vercel. In particolare i
-- 'non_riuscito' delle ultime 24 ore (guasti nostri da correggere):
--   select * from public.revisore_esiti
--   where revisore_esito = 'non_riuscito' and aggiornato_il > now() - interval '24 hours';
-- La stessa query è usata dal cron giornaliero (workshop-motore) per l'alert
-- email. NESSUNA grant ad authenticated/anon: la vista è per service_role
-- (il cron) e per l'admin via SQL Editor — mai esposta a uno studente (che di
-- suo vede comunque solo le proprie righe via la RLS di mission_attempt).
create view public.revisore_esiti as
select
  ma.id            as attempt_id,
  ma.student_id,
  ma.mission_slug,
  ma.revisore_esito,
  ma.stato,
  ma.completed_at  as completato_il,
  ma.updated_at    as aggiornato_il
from public.mission_attempt ma
where ma.revisore_esito is not null;

comment on view public.revisore_esiti is
  'Esiti del revisore della proposta finale, interrogabili (per service_role/admin). Filtrare revisore_esito=non_riuscito + aggiornato_il nelle ultime 24h per i guasti da correggere.';

revoke all on public.revisore_esiti from anon, authenticated;
grant select on public.revisore_esiti to service_role;
