-- LA FINE EFFETTIVA (giro a schermo del 25/10 pomeriggio).
--
-- Dal 26/10 una diretta si chiude anche PRIMA della fine programmata
-- (`20261026100000_durata_vera_ore_riconosciute.sql`), e da quel giorno
-- `data_fine` e «quando l'incontro è finito» sono due momenti diversi. Fino al
-- giorno prima usare l'uno per l'altro non costava niente; da allora tutto ciò che
-- era agganciato alla fine programmata è potenzialmente sbagliato.
--
-- IL CASO VERO: evento chiuso alle 14:24, programmato fino alle 14:30. Alle 14:26
-- la pagina dell'ente diceva «Puoi ancora cambiarla fino alla fine della diretta:
-- 14:30», con «Aggiorna la domanda» attivo — e gli studenti la vedono a diretta
-- conclusa. Fra le 14:24 e le 14:30 si poteva cambiare una domanda che qualcuno
-- aveva già letto: due studenti, due domande, stesso incontro.
--
-- COSA FA: una funzione sola per la fine (`fine_effettiva_evento`) e le tre
-- finestre che rispondono a «l'incontro è finito?» passano da lì.
--   domanda_consegna_modificabile  → la domanda si cambia fino alla chiusura;
--   consegna_evento_aperta         → la consegna si apre alla chiusura, e le 48
--                                     ore partono da lì;
--   evento_in_finestra_diretta     → le domande in diretta e la segnalazione del
--                                     player si chiudono alla chiusura.
-- `evento_in_diretta` (il battito) ha già `diretta_chiusa_il is null` dal 26/10.
--
-- COSA NON TOCCA, E PERCHÉ (le esclusioni scritte, come vuole `npm run test:fine`):
--   - i MINUTI dell'export (`esporta_presenze_*`) tagliano su [data_inizio,
--     data_fine]: dopo la chiusura il battito è respinto (`diretta_chiusa`),
--     quindi l'ultimo battito sta comunque prima della chiusura e tagliare sulla
--     fine programmata dà lo stesso numero. Cambiarli vorrebbe dire ridefinire
--     due funzioni applicate per una differenza che non può presentarsi.
--   - `durata_vera_minuti`, `ping_attesi_evento`, `chiudi_diretta_evento`
--     guardano già la chiusura.
--   - `sposta_finestra_evento` lavora apposta sulla fine PROGRAMMATA, e rifiuta
--     una diretta già chiusa.
--
-- `create or replace` con firma e tipo di ritorno invariati: i privilegi si
-- conservano. Corpi ripresi dalle definizioni vive (20260929120000,
-- 20260927120000, 20260726110000) con UNA espressione cambiata ciascuno.
-- Nessun dato trasformato.

create or replace function public.fine_effettiva_evento(p_evento_id uuid)
returns timestamptz
language sql
stable
set search_path = public
as $$
  -- La chiusura, se c'è ed è prima della fine programmata; altrimenti la fine
  -- programmata (tre ore dall'inizio se manca). Una chiusura DOPO la fine
  -- programmata non sposta niente: la diretta era già finita quando qualcuno
  -- ha premuto. Specchio di `fineEffettiva` in lib/live.ts.
  select least(
    coalesce(e.data_fine, e.data_inizio + interval '3 hours'),
    coalesce(e.diretta_chiusa_il, 'infinity'::timestamptz)
  )
  from public.eventi e
  where e.id = p_evento_id;
$$;
comment on function public.fine_effettiva_evento(uuid) is
  'Quando l''incontro è finito davvero: la chiusura se è prima della fine programmata, altrimenti la fine programmata. Ogni finestra che risponde a «è finito?» passa da qui (20261027100000).';
revoke all on function public.fine_effettiva_evento(uuid) from public, anon;
grant execute on function public.fine_effettiva_evento(uuid) to authenticated;

create or replace function public.domanda_consegna_modificabile(p_evento_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = p_evento_id
      and e.stato = 'approvato'
      and now() < public.fine_effettiva_evento(e.id)
  );
$$;
comment on function public.domanda_consegna_modificabile(uuid) is
  'La finestra della domanda finale: da quando l''evento è approvato fino alla FINE EFFETTIVA della diretta (la chiusura, se anticipata). Si chiude esattamente dove si apre consegna_evento_aperta, così una domanda non cambia mai sotto a chi sta già rispondendo.';

create or replace function public.consegna_evento_aperta(p_evento_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = p_evento_id
      and e.stato = 'approvato'
      and e.domanda_consegna is not null
      and now() >= public.fine_effettiva_evento(e.id)
      and now() <  public.fine_effettiva_evento(e.id) + interval '48 hours'
  );
$$;
comment on function public.consegna_evento_aperta(uuid) is
  'La finestra della consegna: dalla FINE EFFETTIVA della diretta (la chiusura, se anticipata) a 48 ore dopo, e solo se una domanda è stata posta. 48 ore è un numero scelto, non misurato.';

create or replace function public.evento_in_finestra_diretta(p_evento_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = p_evento_id
      and e.stato = 'approvato'
      and now() >= e.data_inizio - interval '15 minutes'
      and now() < public.fine_effettiva_evento(e.id)
  );
$$;
