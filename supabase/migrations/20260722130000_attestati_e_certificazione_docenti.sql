-- Attestati di partecipazione ai webinar docenti + certificazione presenza
-- lato organizzatore/admin. Riusa iscrizioni_eventi (già live): la colonna
-- si chiama "student_id" per storia (nata quando solo gli studenti si
-- iscrivevano agli eventi) ma la FK punta a public.profiles, non a
-- student_profiles — qualunque ruolo autenticato, docente compreso, può
-- avere una riga lì senza bisogno di una tabella o una colonna nuova. Le
-- policy self-service esistenti (iscrizioni_eventi_select_own/insert_own/
-- delete_own, tutte scoped a "student_id = auth.uid()") coprono già
-- l'iscrizione/disiscrizione di un docente a un webinar, senza bisogno di
-- policy nuove per quella parte.

-- "ente" è un nuovo valore di certificata_da_tipo (oltre a sistema/kireo/
-- scuola già live): la certificazione di un webinar docenti può arrivare
-- dall'istituzione organizzatrice, non solo da KIREO o dalla scuola.
alter table public.iscrizioni_eventi
  drop constraint iscrizioni_eventi_certificata_da_tipo_check;

alter table public.iscrizioni_eventi
  add constraint iscrizioni_eventi_certificata_da_tipo_check
  check (certificata_da_tipo in ('sistema', 'kireo', 'scuola', 'ente'));

create table public.attestati (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  evento_id uuid not null references public.eventi (id) on delete cascade,
  rilasciato_il timestamptz not null default now(),
  codice_verifica uuid not null default gen_random_uuid() unique,
  constraint attestati_uno_per_evento unique (user_id, evento_id)
);

comment on table public.attestati is
  'Attestato di partecipazione a un webinar docenti, generato da certifica_partecipazione_docente() quando la presenza viene certificata (mai un insert diretto lato client). codice_verifica è pubblico e usato da /verifica-attestato/[codice] e verifica_attestato() per confermare l''autenticità senza esporre altri dati.';

create index attestati_user_id_idx on public.attestati (user_id);

alter table public.attestati enable row level security;

create policy attestati_select_own
  on public.attestati for select
  to authenticated
  using (user_id = auth.uid());

create policy attestati_select_organizzatore
  on public.attestati for select
  to authenticated
  using (
    exists (
      select 1 from public.eventi e
      where e.id = attestati.evento_id and e.organizzatore_id = public.current_istituzione_id()
    )
  );

create policy attestati_admin_tutto
  on public.attestati for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Nessuna policy insert/update/delete self-service o per l'organizzatore:
-- l'unica scrittura passa da certifica_partecipazione_docente (SECURITY
-- DEFINER, sotto) — stesso principio già usato per certifica_presenza
-- nell'area scuola.

-- ============ certificazione presenza docenti ============
-- Ammessi: admin (certificata_da_tipo='kireo') o l'istituzione
-- organizzatrice dell'evento (certificata_da_tipo='ente'). Un branching
-- "positivo" con else di rifiuto invece di un controllo negato (<>/NOT):
-- se il chiamante non è staff KIREO né l'organizzatore, nessuno dei due
-- rami if/elsif è vero (mai per un valore null, sempre per costruzione) e
-- si cade nell'else che rifiuta — niente trappola null da dover
-- neutralizzare con IS DISTINCT FROM, perché qui non c'è nessun confronto
-- di negazione da cui partire.
create or replace function public.certifica_partecipazione_docente(p_evento_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruolo public.profile_role := public.current_ruolo();
  v_istituzione_id uuid := public.current_istituzione_id();
  v_organizzatore_id uuid;
  v_pubblico text;
  v_tipo_certificatore text;
  v_iscritto boolean;
begin
  select organizzatore_id, pubblico into v_organizzatore_id, v_pubblico
  from public.eventi
  where id = p_evento_id;

  if v_pubblico is distinct from 'docenti' then
    raise exception 'evento_non_trovato';
  end if;

  if v_ruolo = 'admin' then
    v_tipo_certificatore := 'kireo';
  elsif v_organizzatore_id is not null and v_istituzione_id is not null and v_istituzione_id = v_organizzatore_id then
    v_tipo_certificatore := 'ente';
  else
    raise exception 'non_autorizzato';
  end if;

  -- Un docente non certifica mai sé stesso: per costruzione un utente con
  -- ruolo 'docente' non può già raggiungere questo punto (non è mai
  -- admin né ha un'istituzione collegata), ma il controllo esplicito
  -- resta comunque una seconda barriera indipendente dal ramo sopra.
  if p_user_id = auth.uid() then
    raise exception 'non_autorizzato';
  end if;

  select exists (
    select 1 from public.iscrizioni_eventi where evento_id = p_evento_id and student_id = p_user_id
  ) into v_iscritto;

  if not v_iscritto then
    raise exception 'non_iscritto';
  end if;

  update public.iscrizioni_eventi
  set stato = 'partecipato', certificata_da_tipo = v_tipo_certificatore, certificata_da_user = auth.uid(), certificata_il = now()
  where evento_id = p_evento_id and student_id = p_user_id;

  -- on conflict do nothing: idempotente, ricertificare la stessa persona
  -- sullo stesso evento non crea un secondo attestato né tocca
  -- rilasciato_il/codice_verifica del primo.
  insert into public.attestati (user_id, evento_id)
  values (p_user_id, p_evento_id)
  on conflict (user_id, evento_id) do nothing;
end;
$$;

grant execute on function public.certifica_partecipazione_docente(uuid, uuid) to authenticated;

-- ============ verifica pubblica attestato ============
-- Nessun altro dato oltre questi campi (mai email, mai altri dati del
-- profilo) — stesso principio di verifica_invito_tutor/check_class_code:
-- una funzione pubblica espone solo il minimo indispensabile, mai la riga
-- intera.
create or replace function public.verifica_attestato(p_codice uuid)
returns table (
  valido boolean,
  nome_completo text,
  titolo_evento text,
  filone public.filone_docenti,
  data_evento timestamptz,
  organizzatore_nome text,
  rilasciato_il timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (a.id is not null) as valido,
    (p.nome || ' ' || p.cognome) as nome_completo,
    e.titolo as titolo_evento,
    e.filone,
    e.data_inizio as data_evento,
    coalesce(i.nome, 'KIREO') as organizzatore_nome,
    a.rilasciato_il
  from (select 1) as uno
  left join public.attestati a on a.codice_verifica = p_codice
  left join public.profiles p on p.id = a.user_id
  left join public.eventi e on e.id = a.evento_id
  left join public.istituzioni i on i.id = e.organizzatore_id;
$$;

grant execute on function public.verifica_attestato(uuid) to anon, authenticated;
