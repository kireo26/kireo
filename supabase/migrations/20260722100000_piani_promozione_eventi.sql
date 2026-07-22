-- Cambio di modello dei piani enti: la CREAZIONE di eventi diventa
-- illimitata per tutti (resta la revisione KIREO come filtro qualità, più
-- un fair-use di 4 eventi contemporaneamente in coda di revisione, uguale
-- per tutti i piani). I piani smettono di vendere "quanti eventi puoi
-- creare" e vendono invece PROMOZIONE (mettere un evento approvato in
-- evidenza) e informazione (newsletter, comunicazioni mirate KIREO, CTA
-- esterne) — questi ultimi tre invariati nel significato.
--
-- Il DB live ha già `piani` POPOLATA (free/plus/premium con le quote
-- vecchie): questa migration TRASFORMA le righe esistenti con UPDATE,
-- non le ricrea con INSERT.

-- ============ piani: nuova quota di promozione ============
alter table public.piani
  add column quota_eventi_promossi integer;

update public.piani set quota_eventi_promossi = case nome
  when 'free' then 0
  when 'plus' then 5
  when 'premium' then 20
end;

alter table public.piani
  alter column quota_eventi_promossi set not null;

comment on column public.piani.quota_eventi_promossi is
  'Quanti eventi APPROVATI un ente può mettere in evidenza per anno accademico (settembre-agosto) — non la creazione, che è illimitata per tutti. Vedi metti_in_evidenza_evento().';

-- quota_newsletter cambia scala (era 0/2/5, diventa 0/3/12) — quota_cta_
-- esterne (0/1/5) e quota_comunicazioni_kireo (0/0/5) restano agli stessi
-- valori già live, nessun UPDATE necessario per quelle due.
update public.piani set quota_newsletter = case nome
  when 'free' then 0
  when 'plus' then 3
  when 'premium' then 12
end;

-- quota_webinar_anno non ha più significato: gate va la creazione (ora
-- illimitata), non più un vincolo del piano. Drop e non deprecata, per non
-- lasciare una colonna morta che confonderebbe letture future — nessun
-- codice applicativo la legge più dopo questa migration.
alter table public.piani drop column quota_webinar_anno;

comment on table public.piani is
  'I 3 piani delle istituzioni formative. La creazione di eventi è illimitata per tutti (revisione KIREO + fair use di 4 in coda contemporaneamente): i piani vendono promozione (quota_eventi_promossi) e informazione (newsletter, comunicazioni KIREO, CTA esterne). Pagare non dà mai accesso privilegiato ai dati degli studenti — vedi CLAUDE.md.';

-- ============ eventi: evidenza ============
alter table public.eventi
  add column in_evidenza boolean not null default false,
  add column in_evidenza_dal timestamptz;

comment on column public.eventi.in_evidenza is
  'True se l''ente lo ha promosso consumando la quota_eventi_promossi del proprio piano per l''anno accademico corrente in cui è stato promosso (in_evidenza_dal). Solo eventi con stato=approvato possono essere promossi (vedi metti_in_evidenza_evento) — mai rimosso automaticamente, nessuna scadenza in questa fase.';

create index eventi_in_evidenza_idx on public.eventi (in_evidenza) where in_evidenza = true;

-- ============ fair use: max 4 eventi in coda di revisione per ente ============
-- Uguale per tutti i piani (non è una quota a pagamento, è un limite di
-- servizio): un trigger invece di un check applicativo nel client, così
-- vale per qualunque punto di scrittura presente o futuro, non solo
-- CreaEventoForm. Copre sia INSERT sia UPDATE che porta uno stato a
-- in_approvazione (es. bozza -> in_approvazione), ma non ri-blocca un
-- evento che resta in_approvazione durante una modifica dei suoi campi
-- (old.stato is distinct from 'in_approvazione' esclude quel caso).
create or replace function public.limite_eventi_in_approvazione()
returns trigger
language plpgsql
as $$
declare
  v_conteggio integer;
begin
  if new.organizzatore_id is not null
     and new.stato = 'in_approvazione'
     and (tg_op = 'INSERT' or old.stato is distinct from 'in_approvazione')
  then
    select count(*) into v_conteggio
    from public.eventi
    where organizzatore_id = new.organizzatore_id
      and stato = 'in_approvazione'
      and id is distinct from new.id;

    if v_conteggio >= 4 then
      raise exception 'troppi_eventi_in_revisione';
    end if;
  end if;

  return new;
end;
$$;

create trigger limite_eventi_in_approvazione
before insert or update on public.eventi
for each row execute function public.limite_eventi_in_approvazione();

-- ============ metti in evidenza ============
-- SECURITY DEFINER: deve poter leggere il piano dell'istituzione (join
-- istituzioni -> piani) e scrivere in_evidenza su un evento approvato,
-- superficie non coperta da nessuna policy UPDATE esistente (eventi_
-- update_propria_non_revisionato copre solo stato in bozza/in_approvazione,
-- di proposito: un evento approvato non deve poter essere modificato
-- liberamente dall'ente) — stesso principio già usato per certifica_
-- presenza/verifica_studente nell'area scuola: un'azione con controlli
-- incrociati (proprietà + stato + quota) espressa in una funzione, non in
-- RLS pura.
create or replace function public.metti_in_evidenza_evento(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_istituzione_id uuid := public.current_istituzione_id();
  v_organizzatore_id uuid;
  v_stato public.evento_stato;
  v_gia_evidenza boolean;
  v_piano_nome public.piano_nome;
  v_quota integer;
  v_usati integer;
  v_mese integer := extract(month from now())::integer;
  v_anno integer := extract(year from now())::integer;
  v_anno_inizio integer;
  v_inizio timestamptz;
  v_fine timestamptz;
begin
  if v_istituzione_id is null then
    raise exception 'non_autorizzato';
  end if;

  select organizzatore_id, stato, in_evidenza
    into v_organizzatore_id, v_stato, v_gia_evidenza
  from public.eventi
  where id = p_evento_id;

  if v_organizzatore_id is null or v_organizzatore_id is distinct from v_istituzione_id then
    raise exception 'evento_non_trovato';
  end if;

  if v_stato is distinct from 'approvato' then
    raise exception 'evento_non_approvato';
  end if;

  if v_gia_evidenza then
    return; -- già in evidenza: idempotente, non consuma di nuovo la quota
  end if;

  select p.nome, p.quota_eventi_promossi into v_piano_nome, v_quota
  from public.istituzioni ist
  join public.piani p on p.id = ist.piano_id
  where ist.id = v_istituzione_id;

  -- Anno accademico settembre-agosto, stesso calcolo di
  -- annoAccademicoCorrente() in lib/ente/quote.ts.
  v_anno_inizio := case when v_mese >= 9 then v_anno else v_anno - 1 end;
  v_inizio := make_timestamptz(v_anno_inizio, 9, 1, 0, 0, 0, 'UTC');
  v_fine := make_timestamptz(v_anno_inizio + 1, 8, 31, 23, 59, 59, 'UTC');

  select count(*) into v_usati
  from public.eventi
  where organizzatore_id = v_istituzione_id
    and in_evidenza = true
    and in_evidenza_dal >= v_inizio
    and in_evidenza_dal <= v_fine;

  if v_usati >= coalesce(v_quota, 0) then
    raise exception 'quota_eventi_promossi_esaurita';
  end if;

  update public.eventi set in_evidenza = true, in_evidenza_dal = now() where id = p_evento_id;
end;
$$;

grant execute on function public.metti_in_evidenza_evento(uuid) to authenticated;
