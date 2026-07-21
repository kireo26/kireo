-- Iscrizioni d'ufficio (la scuola iscrive i propri studenti a un evento) e
-- certificazione presenze con catena di responsabilità. Principi da
-- rispettare (vedi CLAUDE.md): l'iscrizione d'ufficio NON è un segnale di
-- interesse dello studente e non scrive activity_log; la PARTECIPAZIONE
-- certificata sì (peso 15/25). Ogni certificazione registra chi l'ha fatta.

alter table public.iscrizioni_eventi
  add column origine text not null default 'studente' check (origine in ('studente', 'scuola')),
  add column iscritto_da uuid references public.profiles (id),
  add column certificata_da_tipo text check (certificata_da_tipo in ('sistema', 'kireo', 'scuola')),
  add column certificata_da_user uuid references public.profiles (id),
  add column certificata_il timestamptz;

comment on column public.iscrizioni_eventi.origine is
  'studente: iscrizione self-service dallo studente stesso. scuola: iscrizione d''ufficio da un referente/tutor (iscrivi_classe_evento/iscrivi_studenti_evento) — non scrive activity_log, a differenza della partecipazione certificata.';

comment on column public.iscrizioni_eventi.certificata_da_tipo is
  'Chi ha portato stato a partecipato: sistema (automatico, non ancora implementato), kireo (staff KIREO, non ancora implementato), scuola (referente/tutor via certifica_presenza). Null finché non certificato.';

create type public.iscrizione_classe_modalita as enum ('individuale', 'dad');

create table public.iscrizioni_classe_eventi (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classi (id) on delete cascade,
  evento_id uuid not null references public.eventi (id) on delete cascade,
  modalita public.iscrizione_classe_modalita not null,
  iscritto_da uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint iscrizioni_classe_eventi_unica unique (classe_id, evento_id)
);

comment on table public.iscrizioni_classe_eventi is
  'Iscrizione di un''intera classe a un evento. modalita=individuale crea anche le iscrizioni_eventi (origine=scuola) per ogni studente verificato della classe; modalita=dad iscrive la classe come gruppo senza righe individuali (create al momento della certificazione, vedi certifica_presenza) — l''elenco studenti resta comunque disponibile per il registro presenze via classi_studenti.';

alter table public.iscrizioni_classe_eventi enable row level security;

create policy iscrizioni_classe_eventi_select_scuola
  on public.iscrizioni_classe_eventi for select
  to authenticated
  using (
    exists (
      select 1 from public.classi c
      where c.id = iscrizioni_classe_eventi.classe_id and c.scuola_profilo_id = public.current_scuola_profilo_id()
    )
  );

create policy iscrizioni_classe_eventi_admin_tutto
  on public.iscrizioni_classe_eventi for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Nessuna policy insert/update/delete self-service: le uniche scritture
-- passano da iscrivi_classe_evento (SECURITY DEFINER, sotto), che scrive
-- anche le iscrizioni_eventi individuali per conto degli studenti — cosa
-- che nessuna RLS "riga propria" può permettere, dato che chi scrive è lo
-- staff, non lo studente.

-- ============ RLS: la scuola vede le iscrizioni/partecipazioni dei propri
-- studenti verificati (per il registro presenze) ============
create policy iscrizioni_eventi_select_scuola
  on public.iscrizioni_eventi for select
  to authenticated
  using (
    public.current_ruolo_staff() in ('referente', 'tutor')
    and exists (
      select 1 from public.student_profiles sp
      where sp.user_id = iscrizioni_eventi.student_id
        and sp.stato_verifica = 'verificato'
        and sp.school_code = public.current_scuola_id()
    )
  );

-- ============ iscrizione d'ufficio: classe intera ============
-- Referente e tutor possono iscrivere una classe (individuale o dad).
-- SECURITY DEFINER: scrive iscrizioni_eventi per conto di altri utenti
-- (gli studenti), cosa che nessuna RLS self-service può coprire — tutte le
-- verifiche di appartenenza/autorizzazione sono esplicite qui dentro,
-- niente si affida a policy esterne.
create or replace function public.iscrivi_classe_evento(
  p_classe_id uuid,
  p_evento_id uuid,
  p_modalita public.iscrizione_classe_modalita
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scuola_profilo_id uuid;
begin
  -- Delegabile al tutor via puo_gestire_classi (vedi
  -- current_ha_permesso_staff in 20260715110000); il referente ha sempre
  -- tutto.
  if not public.current_ha_permesso_staff('gestione_classi') then
    raise exception 'non_autorizzato';
  end if;

  select scuola_profilo_id into v_scuola_profilo_id from public.classi where id = p_classe_id;
  if v_scuola_profilo_id is null or v_scuola_profilo_id <> public.current_scuola_profilo_id() then
    raise exception 'classe_non_trovata';
  end if;

  if not exists (select 1 from public.eventi where id = p_evento_id and stato = 'approvato') then
    raise exception 'evento_non_disponibile';
  end if;

  insert into public.iscrizioni_classe_eventi (classe_id, evento_id, modalita, iscritto_da)
  values (p_classe_id, p_evento_id, p_modalita, auth.uid())
  on conflict (classe_id, evento_id) do update set modalita = excluded.modalita;

  -- Solo in modalità individuale: una riga per studente, subito. In dad la
  -- classe risulta iscritta come gruppo, niente righe individuali finché
  -- non si certifica la presenza (vedi certifica_presenza).
  if p_modalita = 'individuale' then
    insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, iscritto_da)
    select cs.student_id, p_evento_id, 'iscritto', 'scuola', auth.uid()
    from public.classi_studenti cs
    where cs.classe_id = p_classe_id
    on conflict (student_id, evento_id) do nothing;
  end if;
end;
$$;

grant execute on function public.iscrivi_classe_evento(uuid, uuid, public.iscrizione_classe_modalita) to authenticated;

-- ============ iscrizione d'ufficio: selezione libera / tutti i verificati
-- ============
-- Stesso principio, senza passare da una classe: una selezione di studenti
-- verificati della propria scuola (il client può passare "tutti i
-- verificati" semplicemente elencandoli tutti).
create or replace function public.iscrivi_studenti_evento(p_evento_id uuid, p_student_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delegabile al tutor via puo_gestire_classi (vedi
  -- current_ha_permesso_staff in 20260715110000); il referente ha sempre
  -- tutto.
  if not public.current_ha_permesso_staff('gestione_classi') then
    raise exception 'non_autorizzato';
  end if;

  if not exists (select 1 from public.eventi where id = p_evento_id and stato = 'approvato') then
    raise exception 'evento_non_disponibile';
  end if;

  insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, iscritto_da)
  select sp.user_id, p_evento_id, 'iscritto', 'scuola', auth.uid()
  from public.student_profiles sp
  where sp.user_id = any (p_student_ids)
    and sp.stato_verifica = 'verificato'
    and sp.school_code = public.current_scuola_id()
  on conflict (student_id, evento_id) do nothing;
end;
$$;

grant execute on function public.iscrivi_studenti_evento(uuid, uuid[]) to authenticated;

-- ============ certificazione presenze ============
-- Upsert: se l'iscrizione individuale esiste già (modalita individuale, o
-- iscrizione self-service dello studente), la aggiorna; se non esiste
-- (modalita dad, nessuna riga creata all'iscrizione) la crea. In entrambi i
-- casi registra chi ha certificato (certificata_da_*) — catena di
-- responsabilità ai fini PCTO — e scrive activity_log (partecipazione
-- reale, mai per l'iscrizione d'ufficio in sé): idempotente grazie al cap
-- giornaliero già esistente sull'indice unico di activity_log, "on conflict
-- do nothing" copre anche una doppia certificazione nello stesso giorno.
create or replace function public.certifica_presenza(p_evento_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raggiungibile boolean;
begin
  -- Delegabile al tutor via puo_certificare_presenze (vedi
  -- current_ha_permesso_staff in 20260715110000); il referente ha sempre
  -- tutto.
  if not public.current_ha_permesso_staff('certificazione_presenze') then
    raise exception 'non_autorizzato';
  end if;

  if not exists (
    select 1 from public.student_profiles sp
    where sp.user_id = p_student_id
      and sp.stato_verifica = 'verificato'
      and sp.school_code = public.current_scuola_id()
  ) then
    raise exception 'studente_non_verificato_o_scuola_diversa';
  end if;

  select exists (
    select 1 from public.iscrizioni_eventi ie
    where ie.evento_id = p_evento_id and ie.student_id = p_student_id and ie.origine = 'scuola'
    union all
    select 1
    from public.iscrizioni_classe_eventi ice
    join public.classi_studenti cs on cs.classe_id = ice.classe_id
    join public.classi c on c.id = ice.classe_id
    where ice.evento_id = p_evento_id
      and cs.student_id = p_student_id
      and c.scuola_profilo_id = public.current_scuola_profilo_id()
  ) into v_raggiungibile;

  if not v_raggiungibile then
    raise exception 'evento_non_raggiungibile_per_questa_scuola';
  end if;

  insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, certificata_da_tipo, certificata_da_user, certificata_il)
  values (p_student_id, p_evento_id, 'partecipato', 'scuola', 'scuola', auth.uid(), now())
  on conflict (student_id, evento_id) do update
  set stato = 'partecipato', certificata_da_tipo = 'scuola', certificata_da_user = auth.uid(), certificata_il = now();

  insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
  select
    p_student_id,
    ea.area_slug,
    (case e.tipo when 'workshop' then 'workshop_pcto' else 'partecipazione_webinar' end)::public.tipo_attivita,
    (case e.tipo when 'workshop' then 25 else 15 end)
  from public.eventi e
  join public.eventi_aree ea on ea.evento_id = e.id
  where e.id = p_evento_id
  on conflict do nothing;
end;
$$;

grant execute on function public.certifica_presenza(uuid, uuid) to authenticated;
