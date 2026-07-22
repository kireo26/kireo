-- Area docente — riuso dell'infrastruttura eventi/istituzioni esistente:
-- un webinar per docenti è un evento come un altro (eventi, già live),
-- distinto da un evento studenti tramite la nuova colonna `pubblico`. Gli
-- eventi docenti sono organizzati per FILONE tematico (5 filoni fissi,
-- vedi CLAUDE.md) invece che per le 18 aree di orientamento studenti:
-- eventi_aree resta esclusivamente per gli eventi studenti.

create type public.filone_docenti as enum (
  'ai_didattica',
  'valutazione_ai',
  'etica_normativa',
  'ai_burocrazia',
  'orientamento_pcto'
);

comment on type public.filone_docenti is
  'I 5 filoni della formazione continua docenti (etichette UI in data/filoniDocenti.ts): ai_didattica="AI nella didattica quotidiana", valutazione_ai="Valutazione nell''era dell''AI", etica_normativa="Etica, privacy e normativa", ai_burocrazia="AI contro la burocrazia", orientamento_pcto="Orientamento e PCTO".';

alter table public.eventi
  add column pubblico text not null default 'studenti' check (pubblico in ('studenti', 'docenti')),
  add column filone public.filone_docenti;

alter table public.eventi
  add constraint eventi_filone_coerente_con_pubblico
  check (
    (pubblico = 'docenti' and filone is not null)
    or (pubblico = 'studenti' and filone is null)
  );

comment on column public.eventi.pubblico is
  'studenti (default): evento di orientamento, usa eventi_aree. docenti: webinar di formazione continua, usa filone invece delle aree — mai entrambi contemporaneamente (vedi eventi_filone_coerente_con_pubblico e il trigger su eventi_aree sotto).';

-- Un evento pubblico=docenti non deve mai avere righe eventi_aree (le 18
-- aree di orientamento non si applicano alla formazione docenti): vincolo
-- a livello DB, non solo di convenzione applicativa, per non lasciare che
-- un futuro punto di scrittura lo violi per sbaglio.
create or replace function public.blocca_aree_su_eventi_docenti()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.eventi e where e.id = new.evento_id and e.pubblico = 'docenti') then
    raise exception 'eventi_docenti_non_usano_aree';
  end if;
  return new;
end;
$$;

create trigger blocca_aree_su_eventi_docenti
before insert on public.eventi_aree
for each row execute function public.blocca_aree_su_eventi_docenti();

-- ============ visibilità per l'organizzatore (registro presenze) ============
-- Un'istituzione legge nome/cognome e le iscrizioni SOLO dei docenti
-- iscritti a un PROPRIO evento pubblico=docenti — mai eventi studenti (il
-- principio "i dati degli studenti non escono mai da KIREO" resta intatto,
-- questa policy non lo tocca), mai eventi di altre istituzioni. Necessario
-- per il registro presenze/certificazione lato ente (vedi
-- certifica_partecipazione_docente, prossima migration): senza vedere
-- almeno nome/cognome l'ente non potrebbe certificare la persona giusta —
-- stesso principio già accettato per lo staff scuola sui propri studenti,
-- non è "profilazione" nel senso già usato in questo progetto (score,
-- radar, activity_log, che restano SEMPRE fuori portata di enti/scuole).
create policy iscrizioni_eventi_select_organizzatore_docenti
  on public.iscrizioni_eventi for select
  to authenticated
  using (
    exists (
      select 1 from public.eventi e
      where e.id = iscrizioni_eventi.evento_id
        and e.organizzatore_id = public.current_istituzione_id()
        and e.pubblico = 'docenti'
    )
  );

create policy profiles_select_organizzatore_docenti_iscritti
  on public.profiles for select
  to authenticated
  using (
    ruolo = 'docente'
    and exists (
      select 1 from public.iscrizioni_eventi ie
      join public.eventi e on e.id = ie.evento_id
      where ie.student_id = profiles.id
        and e.organizzatore_id = public.current_istituzione_id()
        and e.pubblico = 'docenti'
    )
  );
