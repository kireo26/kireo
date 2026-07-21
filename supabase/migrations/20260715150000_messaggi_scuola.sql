-- Comunicazioni interne scuola -> studenti. A differenza delle
-- comunicazioni ente (comunicazioni, tabella già esistente per gli enti
-- formativi), queste NON passano da revisione KIREO — rapporto
-- istituzionale interno, non un contenuto promozionale — l'admin può solo
-- visionarle a posteriori (sola lettura).

create table public.messaggi_scuola (
  id uuid primary key default gen_random_uuid(),
  scuola_profilo_id uuid not null references public.scuole_profili (id) on delete cascade,
  mittente_user uuid not null references public.profiles (id),
  destinatari text not null check (destinatari in ('tutta_scuola', 'classe', 'selezione')),
  classe_id uuid references public.classi (id),
  oggetto text not null,
  corpo text not null,
  canale text not null default 'interno' check (canale in ('interno', 'email')),
  created_at timestamptz not null default now()
);

comment on table public.messaggi_scuola is
  'Comunicazioni interne di una scuola verso i propri studenti (nessuna revisione KIREO, ammesso solo l''admin in sola lettura a posteriori). canale=email è predisposto ma non attivo: nessun provider email collegato in questa fase, il messaggio resta comunque consegnato internamente (messaggi_scuola_destinatari).';

create table public.messaggi_scuola_destinatari (
  messaggio_id uuid not null references public.messaggi_scuola (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  letto_il timestamptz,
  primary key (messaggio_id, student_id)
);

create index messaggi_scuola_destinatari_student_idx on public.messaggi_scuola_destinatari (student_id);

alter table public.messaggi_scuola enable row level security;
alter table public.messaggi_scuola_destinatari enable row level security;

create policy messaggi_scuola_select_propria_scuola
  on public.messaggi_scuola for select
  to authenticated
  using (
    public.current_ruolo_staff() in ('referente', 'tutor')
    and scuola_profilo_id = public.current_scuola_profilo_id()
  );

create policy messaggi_scuola_admin_select
  on public.messaggi_scuola for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- Lo studente destinatario legge il CONTENUTO del messaggio (oggetto/
-- corpo), non solo la propria riga in messaggi_scuola_destinatari — senza
-- questa policy un join tra le due tabelle da parte dello studente
-- restituirebbe silenziosamente zero righe (RLS filtra messaggi_scuola
-- prima ancora che la propria riga destinatario sia raggiungibile via
-- join), pur avendo accesso a quella riga: bug trovato testando
-- esplicitamente la consegna dei messaggi, come richiesto.
--
-- Il controllo passa da una funzione SECURITY DEFINER (e non da un EXISTS
-- diretto su messaggi_scuola_destinatari) per lo stesso motivo di
-- current_ruolo_staff()/current_istituzione_id() altrove in questo schema:
-- messaggi_scuola_destinatari_select_scuola (sotto) referenzia a sua volta
-- messaggi_scuola, quindi un EXISTS diretto nei due versi crea una
-- ricorsione RLS infinita ("infinite recursion detected in policy") — la
-- funzione bypassa le RLS del proprio interno, spezzando il ciclo.
create or replace function public.e_destinatario_messaggio(p_messaggio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.messaggi_scuola_destinatari d
    where d.messaggio_id = p_messaggio_id and d.student_id = auth.uid()
  );
$$;

grant execute on function public.e_destinatario_messaggio(uuid) to authenticated;

create policy messaggi_scuola_select_destinatario
  on public.messaggi_scuola for select
  to authenticated
  using (public.e_destinatario_messaggio(messaggi_scuola.id));

-- Insert: referente sempre, tutor solo se delegato (puo_inviare_
-- comunicazioni, vedi current_ha_permesso_staff in 20260715110000),
-- sempre per la propria scuola e come mittente se stesso — la funzione
-- sotto è SECURITY INVOKER apposta per restare sotto queste due policy
-- invece di bypassarle.
create policy messaggi_scuola_insert_autorizzato
  on public.messaggi_scuola for insert
  to authenticated
  with check (
    public.current_ha_permesso_staff('comunicazioni')
    and scuola_profilo_id = public.current_scuola_profilo_id()
    and mittente_user = auth.uid()
  );

create policy messaggi_scuola_destinatari_select_scuola
  on public.messaggi_scuola_destinatari for select
  to authenticated
  using (
    exists (
      select 1 from public.messaggi_scuola m
      where m.id = messaggi_scuola_destinatari.messaggio_id
        and public.current_ruolo_staff() in ('referente', 'tutor')
        and m.scuola_profilo_id = public.current_scuola_profilo_id()
    )
  );

-- Lo studente legge i propri messaggi ricevuti e può segnarli come letti
-- (solo il proprio letto_il, mai altro).
create policy messaggi_scuola_destinatari_select_own
  on public.messaggi_scuola_destinatari for select
  to authenticated
  using (student_id = auth.uid());

create policy messaggi_scuola_destinatari_update_own_letto
  on public.messaggi_scuola_destinatari for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy messaggi_scuola_destinatari_admin_select
  on public.messaggi_scuola_destinatari for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- Insert: stesso permesso di messaggi_scuola_insert_autorizzato sopra
-- (referente sempre, tutor solo se puo_inviare_comunicazioni), e solo per
-- destinatari di un messaggio della propria scuola (la funzione sotto
-- filtra comunque a studenti verificati della propria scuola prima di
-- arrivare qui: questa policy è la seconda linea di difesa, non l'unica).
create policy messaggi_scuola_destinatari_insert_scuola
  on public.messaggi_scuola_destinatari for insert
  to authenticated
  with check (
    exists (
      select 1 from public.messaggi_scuola m
      where m.id = messaggi_scuola_destinatari.messaggio_id
        and public.current_ha_permesso_staff('comunicazioni')
        and m.scuola_profilo_id = public.current_scuola_profilo_id()
    )
  );

-- Invio: referente sempre, tutor solo se delegato (puo_inviare_
-- comunicazioni) — aggiornato dalla delegabilità introdotta in
-- 20260715110000 (in origine solo il referente poteva comporre). SECURITY
-- INVOKER: nessun ordinamento circolare qui (il mittente è già staff
-- attivo quando invia), le due insert restano sotto RLS — la funzione
-- serve solo a risolvere "tutta_scuola/classe/selezione" in una lista di
-- studenti e scriverla atomicamente, non a bypassare permessi.
create or replace function public.invia_messaggio_scuola(
  p_destinatari text,
  p_oggetto text,
  p_corpo text,
  p_classe_id uuid default null,
  p_student_ids uuid[] default null,
  p_canale text default 'interno'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_scuola_profilo_id uuid := public.current_scuola_profilo_id();
  v_messaggio_id uuid;
begin
  if not public.current_ha_permesso_staff('comunicazioni') then
    raise exception 'non_autorizzato';
  end if;

  if p_destinatari not in ('tutta_scuola', 'classe', 'selezione') then
    raise exception 'destinatari_non_validi';
  end if;

  if p_destinatari = 'classe' and (
    p_classe_id is null or not exists (select 1 from public.classi where id = p_classe_id and scuola_profilo_id = v_scuola_profilo_id)
  ) then
    raise exception 'classe_non_valida';
  end if;

  v_messaggio_id := gen_random_uuid();
  insert into public.messaggi_scuola (id, scuola_profilo_id, mittente_user, destinatari, classe_id, oggetto, corpo, canale)
  values (v_messaggio_id, v_scuola_profilo_id, auth.uid(), p_destinatari, p_classe_id, p_oggetto, p_corpo, coalesce(p_canale, 'interno'));

  if p_destinatari = 'tutta_scuola' then
    insert into public.messaggi_scuola_destinatari (messaggio_id, student_id)
    select v_messaggio_id, sp.user_id
    from public.student_profiles sp
    where sp.stato_verifica = 'verificato' and sp.school_code = public.current_scuola_id();
  elsif p_destinatari = 'classe' then
    insert into public.messaggi_scuola_destinatari (messaggio_id, student_id)
    select v_messaggio_id, cs.student_id
    from public.classi_studenti cs
    where cs.classe_id = p_classe_id;
  else
    insert into public.messaggi_scuola_destinatari (messaggio_id, student_id)
    select v_messaggio_id, sp.user_id
    from public.student_profiles sp
    where sp.user_id = any (coalesce(p_student_ids, array[]::uuid[]))
      and sp.stato_verifica = 'verificato'
      and sp.school_code = public.current_scuola_id();
  end if;
end;
$$;

grant execute on function public.invia_messaggio_scuola(text, text, text, uuid, uuid[], text) to authenticated;
