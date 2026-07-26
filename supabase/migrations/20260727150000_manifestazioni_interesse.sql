-- Livello social (6/8): manifestazione di interesse, riservata ai
-- maggiorenni. Lo studente condivide esplicitamente il proprio profilo con
-- un ente; la revoca rimuove la visibilità immediatamente. Nessun dato di
-- contatto (email/telefono) è mai esposto: il contatto avviene solo via
-- messaggi in piattaforma (vedi migration successiva).

create table public.manifestazioni_interesse (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  created_at timestamptz not null default now(),
  revocata_il timestamptz
);

comment on table public.manifestazioni_interesse is
  'revocata_il is null = attiva. Una volta revocata la riga resta (storico), lo studente può ri-manifestare interesse creandone una nuova (indice unico solo sulle righe attive, sotto). Nessuna policy update/delete per l''ente: solo lo studente controlla la propria visibilità.';

-- Indice unico PARZIALE (solo sulle righe attive): permette storico
-- multiplo nel tempo (manifesta -> revoca -> manifesta di nuovo) bloccando
-- solo un doppio "attiva" per la stessa coppia — stesso principio già in
-- uso per richieste_upgrade.
create unique index manifestazioni_interesse_attiva_idx
  on public.manifestazioni_interesse (student_id, istituzione_id)
  where revocata_il is null;

alter table public.manifestazioni_interesse enable row level security;

-- Solo maggiorenne (gate NULL-safe: current_e_maggiorenne() non è mai
-- NULL per costruzione, vedi 20260727100000) può crearne una, solo per sé
-- stesso.
create policy manifestazioni_interesse_insert_own
  on public.manifestazioni_interesse for insert
  to authenticated
  with check (student_id = auth.uid() and public.current_e_maggiorenne());

create policy manifestazioni_interesse_select_own
  on public.manifestazioni_interesse for select
  to authenticated
  using (student_id = auth.uid());

-- Revoca: solo sulla propria riga ancora attiva (una volta revocata non è
-- più "update-abile" da qui, resta storico immutabile).
create policy manifestazioni_interesse_update_own
  on public.manifestazioni_interesse for update
  to authenticated
  using (student_id = auth.uid() and revocata_il is null)
  with check (student_id = auth.uid());

create policy manifestazioni_interesse_admin_tutto
  on public.manifestazioni_interesse for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Nessuna policy select per il ruolo istituzione: l'unico accesso lato
-- ente è tramite le due funzioni sotto (minimal-exposure, stesso principio
-- di domande_live_organizzatore/email_studenti_scuola) — mai un raw
-- select che potrebbe esporre più della vista pensata.

-- ============ conteggio (qualunque piano, per il nudge upgrade) ============
create or replace function public.conteggio_manifestazioni_interesse(p_istituzione_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_ruolo() = 'admin' then
    null;
  elsif p_istituzione_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  return (
    select count(*)::integer from public.manifestazioni_interesse
    where istituzione_id = p_istituzione_id and revocata_il is null
  );
end;
$$;

grant execute on function public.conteggio_manifestazioni_interesse(uuid) to authenticated;

-- ============ dettaglio (SOLO piani a pagamento) ============
-- nome, cognome, scuola, aree di interesse, data — MAI email/telefono.
create or replace function public.manifestazioni_dettaglio_ente(p_istituzione_id uuid)
returns table (
  student_id uuid,
  nome text,
  cognome text,
  scuola_denominazione text,
  aree_interesse text[],
  creata_il timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_ruolo() = 'admin' then
    null;
  elsif p_istituzione_id = public.current_istituzione_id()
    and exists (
      select 1 from public.istituzioni i
      join public.piani p on p.id = i.piano_id
      where i.id = p_istituzione_id and p.nome <> 'free'
    )
  then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  return query
    select
      mi.student_id,
      pr.nome,
      pr.cognome,
      s.denominazione,
      coalesce(array_agg(sai.area_slug) filter (where sai.area_slug is not null), array[]::text[]),
      mi.created_at
    from public.manifestazioni_interesse mi
    join public.profiles pr on pr.id = mi.student_id
    left join public.student_profiles sp on sp.user_id = mi.student_id
    left join public.schools s on s.codice_meccanografico = sp.school_code
    left join public.student_area_interests sai on sai.user_id = mi.student_id
    where mi.istituzione_id = p_istituzione_id and mi.revocata_il is null
    group by mi.student_id, pr.nome, pr.cognome, s.denominazione, mi.created_at
    order by mi.created_at desc;
end;
$$;

grant execute on function public.manifestazioni_dettaglio_ente(uuid) to authenticated;
