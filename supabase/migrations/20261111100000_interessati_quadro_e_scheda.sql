-- GLI «INTERESSATI» DI UN ENTE: il quadro, l'elenco con i filtri, la scheda
-- (Mario, 28/10). Prima l'ente riceveva una riga di testo per ogni studente che
-- aveva premuto «condividi il profilo»: il gesto non arrivava a destinazione
-- per nessuno dei due. Non si toglie: si completa.
--
-- COSA VEDE L'ENTE, e cosa non vede mai:
--   - chi è lo studente, per come l'ha DICHIARATO lui: nome, cognome, scuola
--     (con la provincia), l'anno di diploma da cui la pagina ricava l'anno di
--     corso, le aree scelte in registrazione;
--   - cosa ha fatto VERSO QUELL'ENTE: i suoi eventi a cui è stato e per quanti
--     minuti (presenze_live), se ha scaricato la sua guida (recinto_enti);
--   - MAI: test, missioni, workshop, evidence, area_signal, style_signal — il
--     lavoro di orientamento del ragazzo, e quello che KIREO ne ha dedotto. E
--     mai niente di quello che lo studente ha fatto con gli ALTRI enti: ogni
--     lettura qui sotto è filtrata sull'ente che chiede. `npm run
--     test:interessati` lo sorveglia sul corpo di queste funzioni.
--
-- ⚠️ LA REGOLA DI presenze_live CAMBIA, e per chi: il suo commento dice «mai
-- l'ente». Da qui l'ente legge i minuti di uno studente SOLO se quello studente
-- ha condiviso il profilo con lui con un consenso che lo nomina (sotto), e solo
-- sugli eventi di quell'ente. Per tutti gli altri resta vero.
--
-- ⚠️ UN CONSENSO NON SI ALLARGA DA SÉ: `copre_attivita`. Chi ha condiviso il
-- profilo prima di oggi ha letto un pannello che diceva «nome, cognome, la tua
-- scuola e le aree»: l'attività verso l'ente non c'era. Quindi le righe di prima
-- nascono `false` e l'ente, per loro, vede solo il dichiarato; le righe nuove
-- nascono `true`, perché il pannello di conferma ora la nomina (stesso commit).
-- Lo studente che vuole mostrare anche l'attività revoca e ricondivide. Il
-- client non scrive la colonna (il registro dà all'insert solo student_id e
-- istituzione_id): la decide il valore di partenza, cioè la versione del testo.
-- Il giorno in cui il pannello cambia di nuovo quello che promette, serve una
-- colonna come questa, non un ritocco del testo.
--
-- ✅ QUI LA SOGLIA DI ANONIMATO NON SERVE, e la ragione va scritta accanto
-- perché il prossimo che legge «qui soglia, lì no» non debba ricostruirla: in
-- questa pagina ci sono solo studenti che hanno scelto di farsi vedere da
-- quell'ente, e possono revocare quando vogliono. I numeri del quadro sono il
-- riassunto di gesti individuali già visibili uno per uno. La soglia (k=5 in
-- report_evento_distribuzione, e quella che manca nelle statistiche degli
-- eventi, vedi CLAUDE.md) serve dove un aggregato nasconde persone che NON sanno
-- di essere contate. Le due cose si somigliano e sono opposte.

-- ============ il consenso che copre l'attività ============
-- `default false` all'aggiunta, poi `default true`: le righe esistenti restano
-- false, le nuove nascono true. Nessun update di dati.
alter table public.manifestazioni_interesse
  add column copre_attivita boolean not null default false;
alter table public.manifestazioni_interesse
  alter column copre_attivita set default true;

comment on column public.manifestazioni_interesse.copre_attivita is
  '20261111100000: true se lo studente ha condiviso il profilo con il pannello che nomina anche l''attività verso l''ente (eventi seguiti e minuti, guida scaricata). Le righe di prima nascono false: l''ente vede solo il dichiarato. Il client non la scrive.';

-- ============ l'elenco, con quanto serve al quadro e ai filtri ============
-- Una riga per studente con la condivisione ATTIVA. `eventi_seguiti` e
-- `guida_scaricata` sono NULL quando il consenso non copre l'attività: non
-- «zero», perché zero direbbe all'ente che lo studente non ha fatto niente.
create or replace function public.interessati_ente(p_istituzione_id uuid)
returns table (
  student_id uuid,
  nome text,
  cognome text,
  scuola_denominazione text,
  scuola_provincia text,
  anno_diploma integer,
  aree_interesse text[],
  creata_il timestamptz,
  copre_attivita boolean,
  eventi_seguiti integer,
  guida_scaricata boolean,
  conversazione_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.ente_vede_interessati(p_istituzione_id) then
    raise exception 'non_autorizzato';
  end if;

  return query
    select
      mi.student_id,
      pr.nome,
      pr.cognome,
      s.denominazione,
      s.provincia,
      sp.anno_diploma,
      coalesce(
        (select array_agg(sai.area_slug order by sai.area_slug)
         from public.student_area_interests sai where sai.user_id = mi.student_id),
        array[]::text[]),
      mi.created_at,
      mi.copre_attivita,
      case when mi.copre_attivita then (
        select count(distinct e.id)::integer
        from public.eventi e
        where e.organizzatore_id = p_istituzione_id
          and (exists (select 1 from public.presenze_live pl where pl.evento_id = e.id and pl.user_id = mi.student_id)
               or exists (select 1 from public.iscrizioni_eventi ie
                          where ie.evento_id = e.id and ie.student_id = mi.student_id and ie.stato = 'partecipato'))
      ) end,
      case when mi.copre_attivita then exists (
        select 1 from public.recinto_enti r
        where r.istituzione_id = p_istituzione_id and r.student_id = mi.student_id and r.origine = 'guida'
      ) end,
      (select c.id from public.conversazioni_enti c
       where c.istituzione_id = p_istituzione_id and c.student_id = mi.student_id
       order by c.created_at desc limit 1)
    from public.manifestazioni_interesse mi
    join public.profiles pr on pr.id = mi.student_id
    left join public.student_profiles sp on sp.user_id = mi.student_id
    left join public.schools s on s.codice_meccanografico = sp.school_code
    where mi.istituzione_id = p_istituzione_id and mi.revocata_il is null
    order by mi.created_at desc;
end;
$$;

-- ============ la scheda di uno studente ============
-- NULL se lo studente non ha una condivisione attiva con quell'ente: una
-- revoca toglie la scheda subito, anche a chi ha il link aperto.
create or replace function public.scheda_interessato_ente(p_istituzione_id uuid, p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_copre boolean;
  v_creata timestamptz;
  v_scheda jsonb;
begin
  if not public.ente_vede_interessati(p_istituzione_id) then
    raise exception 'non_autorizzato';
  end if;

  select mi.copre_attivita, mi.created_at into v_copre, v_creata
  from public.manifestazioni_interesse mi
  where mi.istituzione_id = p_istituzione_id and mi.student_id = p_student_id and mi.revocata_il is null;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'student_id', pr.id,
    'nome', pr.nome,
    'cognome', pr.cognome,
    'scuola_denominazione', s.denominazione,
    'scuola_provincia', s.provincia,
    'anno_diploma', sp.anno_diploma,
    'aree_interesse', coalesce(
      (select jsonb_agg(sai.area_slug order by sai.area_slug)
       from public.student_area_interests sai where sai.user_id = pr.id), '[]'::jsonb),
    'condiviso_il', v_creata,
    'copre_attivita', v_copre,
    'conversazione_id', (select c.id from public.conversazioni_enti c
                         where c.istituzione_id = p_istituzione_id and c.student_id = pr.id
                         order by c.created_at desc limit 1)
  ) into v_scheda
  from public.profiles pr
  left join public.student_profiles sp on sp.user_id = pr.id
  left join public.schools s on s.codice_meccanografico = sp.school_code
  where pr.id = p_student_id;

  if not v_copre then
    return v_scheda;
  end if;

  return v_scheda || jsonb_build_object(
    'eventi', coalesce((
      select jsonb_agg(jsonb_build_object(
               'evento_id', e.id,
               'titolo', e.titolo,
               'data_inizio', e.data_inizio,
               'minuti', pl.ping_totali,
               'presenza_certificata', coalesce(ie.stato = 'partecipato', false)
             ) order by e.data_inizio desc)
      from public.eventi e
      left join public.presenze_live pl on pl.evento_id = e.id and pl.user_id = p_student_id
      left join public.iscrizioni_eventi ie on ie.evento_id = e.id and ie.student_id = p_student_id
      where e.organizzatore_id = p_istituzione_id
        and (pl.id is not null or ie.stato = 'partecipato')
    ), '[]'::jsonb),
    'guida_scaricata_il', (
      select min(r.created_at) from public.recinto_enti r
      where r.istituzione_id = p_istituzione_id and r.student_id = p_student_id and r.origine = 'guida'
    )
  );
end;
$$;

-- ============ chi può guardare ============
-- La stessa regola di manifestazioni_dettaglio_ente, in un posto solo: l'admin,
-- o l'ente stesso con un piano a pagamento.
create or replace function public.ente_vede_interessati(p_istituzione_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_ruolo() = 'admin'
    or (p_istituzione_id = public.current_istituzione_id()
        and exists (
          select 1 from public.istituzioni i
          join public.piani p on p.id = i.piano_id
          where i.id = p_istituzione_id and p.nome <> 'free'
        ));
$$;

revoke all on function public.ente_vede_interessati(uuid) from public, anon;
revoke all on function public.interessati_ente(uuid) from public, anon;
revoke all on function public.scheda_interessato_ente(uuid, uuid) from public, anon;
grant execute on function public.ente_vede_interessati(uuid) to authenticated;
grant execute on function public.interessati_ente(uuid) to authenticated;
grant execute on function public.scheda_interessato_ente(uuid, uuid) to authenticated;

comment on function public.interessati_ente(uuid) is
  '20261111100000: gli studenti che hanno condiviso il profilo con l''ente. Solo il dichiarato più l''attività verso QUESTO ente, e quella solo se copre_attivita. Mai test, missioni, workshop, evidence, area_signal. Nessuna soglia di anonimato: le persone si sono mostrate apposta (vedi la testa della migrazione).';
comment on function public.scheda_interessato_ente(uuid, uuid) is
  '20261111100000: la scheda di uno studente che ha condiviso il profilo. NULL senza una condivisione attiva. Stesse esclusioni di interessati_ente.';

-- La rilettura: le righe di prima non coprono l'attività, le nuove sì.
do $$
declare
  v_coprono integer;
  v_default text;
begin
  select count(*) into v_coprono from public.manifestazioni_interesse where copre_attivita;
  if v_coprono <> 0 then
    raise exception 'copre_attivita: % righe di prima risultano coperte, attese 0', v_coprono;
  end if;
  select column_default into v_default from information_schema.columns
  where table_schema = 'public' and table_name = 'manifestazioni_interesse' and column_name = 'copre_attivita';
  if v_default is distinct from 'true' then
    raise exception 'copre_attivita: valore di partenza %, atteso true', v_default;
  end if;
  if has_column_privilege('authenticated', 'public.manifestazioni_interesse', 'copre_attivita', 'INSERT')
     or has_column_privilege('authenticated', 'public.manifestazioni_interesse', 'copre_attivita', 'UPDATE') then
    raise exception 'copre_attivita è scrivibile dal client';
  end if;
end $$;
