-- Flusso di upgrade piano per gli enti: nessun pagamento online, l'upgrade
-- è una richiesta che KIREO approva manualmente (stessa logica di
-- attivazione istituzioni/approvazione eventi/comunicazioni — una coda,
-- non un pagamento). Vedi CLAUDE.md per il contesto del cantiere.

-- Scadenza del piano attivo: null per il piano Free (nessuna scadenza) o
-- per un'istituzione mai passata a un piano a pagamento; valorizzate solo
-- dall'approvazione di una richiesta di upgrade (vedi
-- approva_richiesta_upgrade sotto).
alter table public.istituzioni
  add column piano_attivato_il date,
  add column piano_scade_il date;

create type public.richiesta_upgrade_stato as enum ('in_attesa', 'approvata', 'rifiutata');

create table public.richieste_upgrade (
  id uuid primary key default gen_random_uuid(),
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  piano_richiesto_id uuid not null references public.piani (id),
  note text,
  stato public.richiesta_upgrade_stato not null default 'in_attesa',
  note_kireo text,
  created_at timestamptz not null default now()
);

comment on table public.richieste_upgrade is
  'Richieste di upgrade piano da parte degli enti, approvate/rifiutate manualmente da KIREO — nessun pagamento online in questa fase.';

-- Una sola richiesta in_attesa per istituzione: indice unico parziale
-- (non un vincolo su tutta la tabella, altrimenti due richieste storiche
-- approvate/rifiutate per la stessa istituzione confliggerebbero) — stesso
-- principio già usato per il cap giornaliero di activity_log.
create unique index richieste_upgrade_una_in_attesa_idx
  on public.richieste_upgrade (istituzione_id)
  where stato = 'in_attesa';

create index richieste_upgrade_istituzione_idx on public.richieste_upgrade (istituzione_id);

alter table public.richieste_upgrade enable row level security;

create policy richieste_upgrade_select_propria
  on public.richieste_upgrade for select
  to authenticated
  using (istituzione_id = public.current_istituzione_id());

-- L'ente crea la propria richiesta sempre in stato in_attesa: l'indice
-- unico sopra rifiuta da solo una seconda richiesta concorrente, non serve
-- ripetere quel controllo qui.
create policy richieste_upgrade_insert_propria
  on public.richieste_upgrade for insert
  to authenticated
  with check (istituzione_id = public.current_istituzione_id() and stato = 'in_attesa');

create policy richieste_upgrade_admin_tutto
  on public.richieste_upgrade for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Estende blocca_autoescalation_istituzione (20260713130000) alle due
-- colonne nuove: stesso principio di stato/piano_id, un ente non deve
-- potersi scrivere da solo una scadenza piano — solo approva_richiesta_
-- upgrade (sotto, chiamata solo da admin) o un admin diretto possono
-- valorizzarle.
--
-- Trovato e corretto qui (opportunisticamente, mentre si toccava questa
-- stessa funzione per le due colonne nuove): la versione originale
-- (20260713130000, già live in produzione) confrontava con `<>` invece di
-- `IS DISTINCT FROM` — `current_ruolo() <> 'admin'` vale null (non true)
-- per un utente autenticato senza ancora un profilo, quindi l'IF non
-- entrerebbe nel ramo che blocca l'escalation e i campi passerebbero
-- invariati. Rischio reale basso oggi (istituzioni_update_propria richiede
-- comunque id = current_istituzione_id(), che è null per chi non ha
-- ancora un profilo collegato, quindi la RLS fa comunque da rete di
-- sicurezza — stesso ragionamento già fatto per approva_richiesta_upgrade
-- sotto), ma corretto per costruzione invece di affidarsi a quella
-- coincidenza. Poiché questa migration fa comunque un CREATE OR REPLACE
-- sulla stessa funzione, applicarla corregge anche la versione già live,
-- senza bisogno di una migration di fix separata.
create or replace function public.blocca_autoescalation_istituzione()
returns trigger
language plpgsql
as $$
begin
  if public.current_ruolo() is distinct from 'admin' then
    new.stato := old.stato;
    new.piano_id := old.piano_id;
    new.piano_attivato_il := old.piano_attivato_il;
    new.piano_scade_il := old.piano_scade_il;
  end if;
  return new;
end;
$$;

-- Approvazione di una richiesta di upgrade: aggiorna istituzioni (piano,
-- attivazione, scadenza a 12 mesi) e la richiesta stessa in un'unica
-- transazione — SECURITY INVOKER (RLS governa comunque le scritture, le
-- policy *_admin_tutto già permettono tutto a un admin), con un controllo
-- esplicito in testa per un messaggio d'errore chiaro invece di un generico
-- fallimento RLS silenzioso se qualcuno la chiamasse senza essere admin.
create or replace function public.approva_richiesta_upgrade(p_richiesta_id uuid, p_nota text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_istituzione_id uuid;
  v_piano_id uuid;
begin
  -- IS DISTINCT FROM, non <>: current_ruolo() è null per un utente
  -- autenticato senza ancora un profilo (es. a metà registrazione), e
  -- "null <> 'admin'" vale null, non true — un IF con condizione null non
  -- solleva l'eccezione. In questo caso specifico la RLS di richieste_
  -- upgrade fa comunque da rete di sicurezza (select sotto non troverebbe
  -- righe), ma il controllo esplicito deve comunque essere corretto per
  -- dare il messaggio d'errore giusto, non affidarsi al caso.
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  select istituzione_id, piano_richiesto_id into v_istituzione_id, v_piano_id
  from public.richieste_upgrade
  where id = p_richiesta_id and stato = 'in_attesa';

  if v_istituzione_id is null then
    raise exception 'richiesta_non_trovata';
  end if;

  update public.istituzioni
  set piano_id = v_piano_id,
      piano_attivato_il = current_date,
      piano_scade_il = (current_date + interval '12 months')::date
  where id = v_istituzione_id;

  update public.richieste_upgrade
  set stato = 'approvata', note_kireo = p_nota
  where id = p_richiesta_id;
end;
$$;

grant execute on function public.approva_richiesta_upgrade(uuid, text) to authenticated;
