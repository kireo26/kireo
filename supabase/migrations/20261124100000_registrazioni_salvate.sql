-- 20261124100000 — LE REGISTRAZIONI SALVATE (Mario, 31/10).
--
-- Uno studente salva la registrazione di una diretta, e la ritrova in «Le mie
-- cose» insieme alle guide e ai post. La ragione di Mario: l'Agenda mostra solo
-- gli ultimi 20 eventi passati, e una registrazione si perde scorrendo.
--
-- ⚠️ LA RIGA È DIVISA IN DUE, e la divisione è la decisione:
--   · l'IDENTITÀ si copia al momento del gesto (titolo, ente, data, id del
--     video): chi l'ha salvata ritrova quello che aveva salvato anche se
--     l'evento sparisce;
--   · DOVE SI GUARDA (dentro KIREO, su YouTube, da nessuna parte) NON si copia:
--     si legge dall'evento ogni volta (`registrazioni_salvate_mie`), con la
--     stessa regola della card (`doveSiRivede`, lib/eventi/registrazione.ts).
--     Un evento risondato cambia il bottone anche sulle righe salvate, perché
--     lo stato si legge e non si copia.
--
-- ⚠️ SALVARE NON È ESSERCI: nessuna presenza, nessuna ora, e non entra in «Le
-- mie attività». Questa migrazione non tocca iscrizioni, presenze o activity_log.
--
-- La copia la fa il database (`salva_registrazione`, security definer), mai il
-- client: il client legge e cancella le proprie righe, e non le scrive.

create table public.registrazioni_salvate (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  evento_id uuid references public.eventi (id) on delete set null,
  istituzione_id uuid references public.istituzioni (id) on delete set null,
  titolo_evento text not null,
  ente_nome text not null,
  data_evento timestamptz not null,
  video_id text not null,
  salvata_il timestamptz not null default now(),
  unique (student_id, evento_id)
);

comment on table public.registrazioni_salvate is
  '20261124100000: le registrazioni delle dirette che uno studente ha salvato. L''identità (titolo, ente, data, video) è copiata al gesto; dove si guarda si legge dall''evento ogni volta (registrazioni_salvate_mie). Salvare non dà presenza né ore.';

alter table public.registrazioni_salvate enable row level security;
revoke all on public.registrazioni_salvate from anon, authenticated;
grant select, delete on public.registrazioni_salvate to authenticated;

create policy registrazioni_salvate_select_own
  on public.registrazioni_salvate for select
  to authenticated
  using (student_id = auth.uid());

create policy registrazioni_salvate_delete_own
  on public.registrazioni_salvate for delete
  to authenticated
  using (student_id = auth.uid());

-- Salva una registrazione che oggi si può guardare (dentro KIREO o su
-- YouTube): la stessa condizione di `doveSiRivede` — un webinar approvato,
-- finito (fine effettiva), con un video e un esito della sonda che dice dove.
create or replace function public.salva_registrazione(p_evento uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_toccate int;
begin
  if public.current_ruolo() is distinct from 'studente' then
    raise exception 'solo_studenti';
  end if;

  insert into public.registrazioni_salvate (
    student_id, evento_id, istituzione_id, titolo_evento, ente_nome, data_evento, video_id
  )
  -- Un evento senza organizzatore è di KIREO (`organizzatore_id` null).
  select auth.uid(), e.id, e.organizzatore_id, e.titolo, coalesce(i.nome, 'KIREO'), e.data_inizio, e.youtube_video_id
  from public.eventi e
  left join public.istituzioni i on i.id = e.organizzatore_id
  where e.id = p_evento
    and e.tipo = 'webinar'
    and e.stato = 'approvato'
    and e.youtube_video_id is not null
    and e.registrazione_esito in ('disponibile', 'non_incorporabile')
    and public.fine_effettiva_evento(e.id) <= now()
  on conflict (student_id, evento_id) do nothing;
  get diagnostics v_toccate = row_count;

  if v_toccate = 1 then
    return jsonb_build_object('stato', 'salvata');
  end if;
  if exists (select 1 from public.registrazioni_salvate where student_id = auth.uid() and evento_id = p_evento) then
    return jsonb_build_object('stato', 'gia_salvata');
  end if;
  return jsonb_build_object('stato', 'non_rivedibile');
end;
$$;

revoke all on function public.salva_registrazione(uuid) from public, anon;
grant execute on function public.salva_registrazione(uuid) to authenticated;

-- Le righe di chi chiede: l'identità copiata, e accanto le colonne VIVE
-- dell'evento da cui il client calcola dove si guarda. `evento_visibile` è
-- falso se l'evento non c'è più o non è più approvato: lì non si guarda
-- niente, e la riga lo dice.
create or replace function public.registrazioni_salvate_mie()
returns table (
  salvataggio_id uuid,
  evento_id uuid,
  titolo_evento text,
  ente_nome text,
  istituzione_slug text,
  data_evento timestamptz,
  video_id text,
  salvata_il timestamptz,
  evento_visibile boolean,
  tipo text,
  data_inizio timestamptz,
  data_fine timestamptz,
  diretta_chiusa_il timestamptz,
  youtube_video_id text,
  registrazione_esito text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.evento_id, s.titolo_evento, s.ente_nome, i.slug, s.data_evento, s.video_id, s.salvata_il,
         (e.id is not null and e.stato = 'approvato'),
         e.tipo::text, e.data_inizio, e.data_fine, e.diretta_chiusa_il, e.youtube_video_id, e.registrazione_esito
  from public.registrazioni_salvate s
  left join public.eventi e on e.id = s.evento_id
  left join public.istituzioni i on i.id = s.istituzione_id
  where s.student_id = auth.uid()
  order by s.salvata_il desc, s.id desc
$$;

revoke all on function public.registrazioni_salvate_mie() from public, anon;
grant execute on function public.registrazioni_salvate_mie() to authenticated;

-- ============ si rilegge ============
do $$
begin
  if to_regclass('public.registrazioni_salvate') is null then
    raise exception '20261124100000: la tabella non c''è';
  end if;
  if has_table_privilege('authenticated', 'public.registrazioni_salvate', 'INSERT')
     or has_table_privilege('authenticated', 'public.registrazioni_salvate', 'UPDATE')
     or has_table_privilege('anon', 'public.registrazioni_salvate', 'SELECT') then
    raise exception '20261124100000: il client non deve scrivere la tabella, né anon leggerla';
  end if;
  if has_function_privilege('anon', 'public.salva_registrazione(uuid)', 'execute') then
    raise exception '20261124100000: anon non deve poter salvare';
  end if;
end;
$$;
