-- LE STATISTICHE DELL'ENTE IN QUATTRO SEZIONI, E GLI SCARICAMENTI CONTATI
-- TUTTI (29/10). PRIMA DEL DEPLOY.
--
-- ══════ «DOWNLOAD GUIDA» DICEVA 1 SU DUE SCARICAMENTI ══════
-- Mario ha scaricato la guida due volte: da test7 collegato e da una finestra
-- in incognito. Il contatore ne vedeva uno, perché la traccia (20261114100000)
-- si appoggia a uno studente che conosciamo. Non è un difetto della traccia, è
-- una conseguenza che l'ente non può indovinare: domani leggerebbe «3» su una
-- guida scaricata quaranta volte, e concluderebbe che non interessa a nessuno.
-- Decisione di Mario: si contano tutti, e i due numeri restano distinti —
-- «scaricata 40 volte · di cui 3 da studenti iscritti a KIREO». Il primo dice
-- se la guida funziona, il secondo quanti si sono fatti conoscere.
--
-- ⚠️ LO SCARICAMENTO ANONIMO SI CONTA SENZA NESSUNA IDENTITÀ: un contatore per
-- guida e per giorno, non una riga per persona. Non raccogliamo un dato in più
-- per poterlo contare (la stessa ragione per cui il form ha perso cognome e
-- classe). Lo incrementano `registra_download_guida` (chi ha fatto l'accesso,
-- qualunque ruolo) e la route con il client service-role (chi no). ⚠️ Chi non
-- ha fatto l'accesso può gonfiarlo ripetendo la richiesta: è un numero di
-- scaricamenti, non di persone, e la riga sotto lo dice.
-- Le righe di stamattina in `scaricamenti_guide_enti` si copiano nel contatore
-- (una per studente e guida, il giorno della prima volta); gli scaricamenti
-- anonimi fra le 08:55 e questa migrazione non si recuperano.
--
-- ══════ LE QUATTRO SEZIONI IN UNA FUNZIONE ══════
-- `statistiche_ente(uuid)` restituisce Eventi, Studenti, Newsletter e Guide,
-- ognuna con il dato aggregato in cima e il dettaglio sotto. È una funzione e
-- non quattro viste perché la soglia di anonimato deve stare dove i numeri
-- escono dal database, non nella pagina: una pagina che riceve i gruppi piccoli
-- e li nasconde è una pagina che li ha già ricevuti.
--
-- ⚠️ LA SOGLIA DI ANONIMATO (Studenti): un gruppo con meno di 5 studenti non si
-- mostra da solo, si somma in «altre». 5 è la soglia che c'era già, in un posto
-- solo (`report_evento_distribuzione`, 20260726120000). Vale per le
-- ripartizioni (area, anno, indirizzo, provincia); i totali restano. Gli
-- «Interessati» non hanno soglia, e non è una dimenticanza: lì ci sono solo
-- persone che si sono mostrate a quell'ente apposta (20261111100000).
--
-- «Studenti che hanno fatto qualcosa verso l'ente»: chi ha un gesto suo verso
-- di lui — una riga nel recinto (evento, guida, newsletter), lo segue, ha una
-- condivisione attiva, ha scaricato una sua guida. Solo profili con ruolo
-- studente. NON conta chi è stato iscritto a un evento dalla sua scuola: non è
-- un gesto dello studente.
--
-- ══════ LA NEWSLETTER: CHI ESCE SI CONTA DA QUI ══════
-- Un'uscita è un delete: la riga sparisce, e con lei la possibilità di
-- contarla. `uscite_newsletter_giorno` la conta, senza identità, con un
-- trigger; le uscite di prima non si recuperano, e la data da cui si conta la
-- dice il database. ⚠️ Conta anche le righe tolte dalla cancellazione di un
-- account: dal lato dell'ente è un iscritto perso lo stesso.
--
-- ══════ `interazioni_stimate` ESCE DALLA VISTA ══════
-- Nessuna pagina la mostrava (il solo lettore di `stats_istituzione` fa
-- `select *` e non la nomina), e «una stima best-effort» in una vista che
-- l'ente legge è un numero senza definizione. Se un giorno servisse a noi, non
-- sta in una vista dell'ente. La vista resta per la pagina di prima finché il
-- deploy non arriva; la pagina nuova legge `statistiche_ente`.
--
-- ⚠️ PRIMA DEL DEPLOY: la pagina nuova chiama `statistiche_ente`, la route
-- `incrementa_scaricamenti_guida`. Con la migrazione applicata il codice di
-- prima funziona: legge `stats_istituzione` con `select *`.
-- Come si verifica applicata (la migrazione rilegge da sé, in fondo):
--   select to_regprocedure('public.statistiche_ente(uuid)') is not null;
--   select count(*) from information_schema.columns
--    where table_name = 'stats_istituzione' and column_name = 'interazioni_stimate';  -- 0

-- 1) Il contatore degli scaricamenti, senza identità.
create table public.contatore_scaricamenti_guide (
  guida_id uuid not null references public.guide_enti (id) on delete cascade,
  giorno date not null,
  scaricamenti integer not null default 0 check (scaricamenti >= 0),
  primary key (guida_id, giorno)
);

comment on table public.contatore_scaricamenti_guide is
  '20261115100000: quante volte una guida di un ente è stata scaricata, per giorno (ora italiana), da chiunque. Nessuna identità: per sapere chi, c''è scaricamenti_guide_enti, solo per gli studenti con un account. Il client non lo legge né lo scrive.';

alter table public.contatore_scaricamenti_guide enable row level security;
revoke all on public.contatore_scaricamenti_guide from anon, authenticated;

create or replace function public.incrementa_scaricamenti_guida(p_guida_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Si conta solo una guida pubblica di un ente attivo: la stessa regola della
  -- lettura pubblica, così un id inventato non crea righe.
  if not exists (
    select 1 from public.guide_enti g join public.istituzioni i on i.id = g.istituzione_id
     where g.id = p_guida_id and g.archiviata_il is null and i.stato = 'attiva'
  ) then
    return false;
  end if;
  insert into public.contatore_scaricamenti_guide (guida_id, giorno, scaricamenti)
    values (p_guida_id, (now() at time zone 'Europe/Rome')::date, 1)
    on conflict (guida_id, giorno) do update set scaricamenti = contatore_scaricamenti_guide.scaricamenti + 1;
  return true;
end;
$$;

revoke all on function public.incrementa_scaricamenti_guida(uuid) from public, anon, authenticated;
grant execute on function public.incrementa_scaricamenti_guida(uuid) to service_role;

comment on function public.incrementa_scaricamenti_guida(uuid) is
  '20261115100000: uno scaricamento in più per una guida pubblica, senza sapere di chi. La chiama registra_download_guida per chi ha fatto l''accesso e la route con la service-role per chi no. Falso se la guida non è pubblica.';

insert into public.contatore_scaricamenti_guide (guida_id, giorno, scaricamenti)
  select s.guida_id, (s.created_at at time zone 'Europe/Rome')::date, count(*)
    from public.scaricamenti_guide_enti s
   group by 1, 2;

-- 2) registra_download_guida conta anche lo scaricamento. Stessa firma e
-- stessa risposta di 20261114100000: cambia solo la riga del contatore.
create or replace function public.registra_download_guida(p_guida_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pdf text;
  v_ist uuid;
  v_archiviata timestamptz;
  v_slug text;
  v_stato_ist text;
  v_nome text;
  v_registrato boolean := false;
begin
  select g.pdf_url, g.istituzione_id, g.archiviata_il, i.slug, i.stato::text, i.nome
    into v_pdf, v_ist, v_archiviata, v_slug, v_stato_ist, v_nome
    from public.guide_enti g
    join public.istituzioni i on i.id = g.istituzione_id
   where g.id = p_guida_id;

  if v_ist is null or v_stato_ist <> 'attiva' then
    return jsonb_build_object('stato', 'non_trovata');
  end if;
  if v_archiviata is not null then
    return jsonb_build_object('stato', 'non_pubblica', 'slug', v_slug);
  end if;

  if auth.uid() is not null and public.current_ruolo() = 'studente' then
    insert into public.recinto_enti (student_id, istituzione_id, origine)
      values (auth.uid(), v_ist, 'guida')
      on conflict do nothing;
    insert into public.scaricamenti_guide_enti (guida_id, student_id, istituzione_id)
      values (p_guida_id, auth.uid(), v_ist)
      on conflict do nothing;
    v_registrato := true;
  end if;

  perform public.incrementa_scaricamenti_guida(p_guida_id);

  return jsonb_build_object('stato', 'ok', 'pdf_url', v_pdf, 'slug', v_slug, 'nome', v_nome, 'registrato', v_registrato);
end;
$$;

comment on function public.registra_download_guida(uuid) is
  '20261114100000, 20261115100000: il file della guida pubblica di un ente attivo. Conta lo scaricamento (contatore_scaricamenti_guide) per chiunque abbia fatto l''accesso; per uno studente scrive anche la riga del recinto (origine guida) e quella di scaricamenti_guide_enti. registrato dice se ha scritto quelle due. Stati: ok, non_pubblica, non_trovata.';

-- 3) Le uscite dalla newsletter, senza identità.
create table public.uscite_newsletter_giorno (
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  giorno date not null,
  uscite integer not null default 0 check (uscite >= 0),
  primary key (istituzione_id, giorno)
);

comment on table public.uscite_newsletter_giorno is
  '20261115100000: quanti iscritti escono dalla newsletter di un ente, per giorno (ora italiana). Nessuna identità. Conta anche le righe tolte con la cancellazione di un account. Il client non lo legge né lo scrive.';

alter table public.uscite_newsletter_giorno enable row level security;
revoke all on public.uscite_newsletter_giorno from anon, authenticated;

create or replace function public.conta_uscita_newsletter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Se l'ente stesso sta sparendo (la cascata), non c'è più nessuno a cui
  -- contarlo, e una riga nuova verso di lui farebbe fallire la cancellazione.
  if not exists (select 1 from public.istituzioni where id = old.istituzione_id) then
    return null;
  end if;
  insert into public.uscite_newsletter_giorno (istituzione_id, giorno, uscite)
    values (old.istituzione_id, (now() at time zone 'Europe/Rome')::date, 1)
    on conflict (istituzione_id, giorno) do update set uscite = uscite_newsletter_giorno.uscite + 1;
  return null;
end;
$$;

revoke all on function public.conta_uscita_newsletter() from public, anon, authenticated;

create trigger conta_uscita_newsletter
  after delete on public.newsletter_iscrizioni
  for each row execute function public.conta_uscita_newsletter();

-- 4) Da quando si contano le uscite: la data in cui questa migrazione gira.
do $$
begin
  execute format(
    'create function public.inizio_conteggio_uscite_newsletter() returns timestamptz language sql immutable as %L',
    format('select %L::timestamptz', now())
  );
end $$;

grant execute on function public.inizio_conteggio_uscite_newsletter() to authenticated;

comment on function public.inizio_conteggio_uscite_newsletter() is
  '20261115100000: il momento da cui si contano le uscite dalla newsletter di un ente. Quelle di prima non sono state registrate.';

-- 5) La soglia di anonimato, in un posto solo.
create or replace function public.soglia_anonimato_statistiche()
returns integer
language sql
immutable
as $$ select 5 $$;

grant execute on function public.soglia_anonimato_statistiche() to authenticated;

comment on function public.soglia_anonimato_statistiche() is
  '20261115100000: sotto questo numero di studenti un gruppo delle statistiche di un ente non si mostra da solo e si somma in «altre». Lo stesso 5 di report_evento_distribuzione.';

-- 6) Le quattro sezioni.
create or replace function public.statistiche_ente(p_istituzione_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_k integer := public.soglia_anonimato_statistiche();
  v_mese date := date_trunc('month', now() at time zone 'Europe/Rome')::date;
  v_inizio_mese timestamptz := (date_trunc('month', now() at time zone 'Europe/Rome')) at time zone 'Europe/Rome';
  v_eventi jsonb;
  v_lista jsonb;
  v_studenti jsonb;
  v_newsletter jsonb;
  v_guide jsonb;
begin
  if not (coalesce(public.current_ruolo() = 'admin', false)
          or coalesce(p_istituzione_id = public.current_istituzione_id(), false)) then
    raise exception 'non_autorizzato';
  end if;

  -- ── Eventi: gli approvati dell'ente. Passato vuol dire finito davvero
  -- (la fine effettiva, la stessa regola di ogni «è finito?»).
  with ev as (
    select e.id, e.titolo, e.data_inizio, e.tipo::text as tipo,
           coalesce(public.fine_effettiva_evento(e.id), e.data_inizio) < now() as passato,
           public.durata_vera_minuti(e.id) as durata,
           (e.domanda_consegna is not null) as domanda_posta
      from public.eventi e
     where e.organizzatore_id = p_istituzione_id and e.stato = 'approvato'
  ),
  riga as (
    select ev.*,
           (select count(*) from public.iscrizioni_eventi ie where ie.evento_id = ev.id) as iscritti,
           case when ev.tipo = 'webinar' then
             (select count(distinct pl.user_id) from public.presenze_live pl where pl.evento_id = ev.id)
           end as collegati,
           (select count(*) from public.iscrizioni_eventi ie where ie.evento_id = ev.id and ie.stato = 'partecipato') as certificate,
           (select count(*) from public.consegne_evento ce where ce.evento_id = ev.id) as risposte
      from ev
  )
  select
    jsonb_build_object(
      'in_programma', count(*) filter (where not r.passato),
      'passati', count(*) filter (where r.passato),
      'iscritti', coalesce(sum(r.iscritti), 0),
      'collegati', coalesce(sum(r.collegati), 0),
      'certificate', coalesce(sum(r.certificate), 0)
    ),
    coalesce(jsonb_agg(jsonb_build_object(
      'evento_id', r.id, 'titolo', r.titolo, 'data_inizio', r.data_inizio, 'tipo', r.tipo,
      'passato', r.passato, 'iscritti', r.iscritti, 'collegati', r.collegati,
      'certificate', r.certificate, 'risposte', r.risposte, 'domanda_posta', r.domanda_posta
    ) order by r.data_inizio desc), '[]'::jsonb)
    into v_eventi, v_lista
    from riga r;

  -- Quanti degli iscritti alle dirette finite si sono collegati, e quanto
  -- sono rimasti in media sulla durata vera (chi si è collegato, non tutti).
  v_eventi := v_eventi || (
    select jsonb_build_object(
      'iscritti_dirette_finite', count(*),
      'iscritti_collegati', count(*) filter (where exists (
        select 1 from public.presenze_live pl where pl.evento_id = ie.evento_id and pl.user_id = ie.student_id))
    )
    from public.iscrizioni_eventi ie
    join public.eventi e on e.id = ie.evento_id
    where e.organizzatore_id = p_istituzione_id and e.stato = 'approvato' and e.tipo = 'webinar'
      and coalesce(public.fine_effettiva_evento(e.id), e.data_inizio) < now()
  ) || (
    select jsonb_build_object(
      'permanenza_media_pct', round(avg(least(pl.ping_totali::numeric / d.durata, 1)) * 100),
      'permanenza_su', count(*)
    )
    from public.presenze_live pl
    join (
      select e.id, public.durata_vera_minuti(e.id) as durata
        from public.eventi e
       where e.organizzatore_id = p_istituzione_id and e.stato = 'approvato' and e.tipo = 'webinar'
         and coalesce(public.fine_effettiva_evento(e.id), e.data_inizio) < now()
    ) d on d.id = pl.evento_id
    where d.durata > 0
  ) || jsonb_build_object('lista', v_lista);

  -- ── Studenti: solo aggregato, con la soglia sulle ripartizioni.
  with gesti as (
    select r.student_id, r.created_at from public.recinto_enti r where r.istituzione_id = p_istituzione_id
    union all
    select s.student_id, s.created_at from public.seguiti s where s.istituzione_id = p_istituzione_id
    union all
    select m.student_id, m.created_at from public.manifestazioni_interesse m
     where m.istituzione_id = p_istituzione_id and m.revocata_il is null
    union all
    select sg.student_id, sg.created_at from public.scaricamenti_guide_enti sg where sg.istituzione_id = p_istituzione_id
  ),
  st as (
    select g.student_id, min(g.created_at) as primo
      from gesti g
      join public.profiles pr on pr.id = g.student_id and pr.ruolo = 'studente'
     group by g.student_id
  ),
  dati as (
    select st.student_id, st.primo, sp.anno_diploma::text as anno, sc.tipo_istituto::text as indirizzo, sc.provincia
      from st
      left join public.student_profiles sp on sp.user_id = st.student_id
      left join public.schools sc on sc.codice_meccanografico = sp.school_code
  ),
  gruppi as (
    select 'area' as dimensione, sai.area_slug as chiave, count(*) as n
      from dati d join public.student_area_interests sai on sai.user_id = d.student_id group by sai.area_slug
    union all select 'anno', d.anno, count(*) from dati d group by d.anno
    union all select 'indirizzo', d.indirizzo, count(*) from dati d group by d.indirizzo
    union all select 'provincia', d.provincia, count(*) from dati d group by d.provincia
  ),
  per_dimensione as (
    select g.dimensione,
           jsonb_build_object(
             'righe', coalesce(jsonb_agg(jsonb_build_object('chiave', g.chiave, 'n', g.n)
                                         order by g.n desc, g.chiave) filter (where g.n >= v_k), '[]'::jsonb),
             'altre', coalesce(sum(g.n) filter (where g.n < v_k), 0)
           ) as tabella
      from gruppi g
     group by g.dimensione
  )
  select jsonb_build_object(
    'totale', (select count(*) from dati),
    'nuovi_mese', (select count(*) from dati where primo >= v_inizio_mese),
    'soglia', v_k,
    'per_area', coalesce((select tabella from per_dimensione where dimensione = 'area'), '{"righe":[],"altre":0}'::jsonb),
    'per_anno_diploma', coalesce((select tabella from per_dimensione where dimensione = 'anno'), '{"righe":[],"altre":0}'::jsonb),
    'per_indirizzo', coalesce((select tabella from per_dimensione where dimensione = 'indirizzo'), '{"righe":[],"altre":0}'::jsonb),
    'per_provincia', coalesce((select tabella from per_dimensione where dimensione = 'provincia'), '{"righe":[],"altre":0}'::jsonb)
  ) into v_studenti;

  -- ── Newsletter.
  select jsonb_build_object(
    'iscritti', (select count(*) from public.newsletter_iscrizioni n where n.istituzione_id = p_istituzione_id),
    'raggiungibili', (select count(*) from public.newsletter_iscrizioni n join public.profiles p on p.id = n.student_id
                       where n.istituzione_id = p_istituzione_id
                         and public.consenso_dato_da_maggiorenne(n.created_at, p.data_nascita)),
    'nuovi_mese', (select count(*) from public.newsletter_iscrizioni n
                    where n.istituzione_id = p_istituzione_id and n.created_at >= v_inizio_mese),
    'persi_mese', (select coalesce(sum(u.uscite), 0) from public.uscite_newsletter_giorno u
                    where u.istituzione_id = p_istituzione_id and u.giorno >= v_mese),
    'persi_contati_dal', public.inizio_conteggio_uscite_newsletter()
  ) into v_newsletter;

  -- ── Guide: ogni guida, anche archiviata, con il suo periodo.
  with g as (
    select g.id, g.titolo, g.created_at, g.archiviata_il,
           (select coalesce(sum(c.scaricamenti), 0) from public.contatore_scaricamenti_guide c where c.guida_id = g.id) as scaricamenti,
           (select coalesce(sum(c.scaricamenti), 0) from public.contatore_scaricamenti_guide c
             where c.guida_id = g.id and c.giorno >= v_mese) as scaricamenti_mese,
           (select count(*) from public.scaricamenti_guide_enti s where s.guida_id = g.id) as studenti
      from public.guide_enti g
     where g.istituzione_id = p_istituzione_id
  )
  select jsonb_build_object(
    'scaricamenti', coalesce(sum(g.scaricamenti), 0),
    'scaricamenti_mese', coalesce(sum(g.scaricamenti_mese), 0),
    'studenti', (select count(distinct s.student_id) from public.scaricamenti_guide_enti s where s.istituzione_id = p_istituzione_id),
    'contati_dal', public.inizio_conteggio_download_guide(),
    'per_guida', coalesce(jsonb_agg(jsonb_build_object(
      'guida_id', g.id, 'titolo', g.titolo, 'caricata_il', g.created_at, 'archiviata_il', g.archiviata_il,
      'scaricamenti', g.scaricamenti, 'studenti', g.studenti
    ) order by g.created_at desc), '[]'::jsonb)
  ) into v_guide
  from g;

  return jsonb_build_object('eventi', v_eventi, 'studenti', v_studenti, 'newsletter', v_newsletter, 'guide', v_guide);
end;
$$;

revoke all on function public.statistiche_ente(uuid) from public, anon;
grant execute on function public.statistiche_ente(uuid) to authenticated;

comment on function public.statistiche_ente(uuid) is
  '20261115100000: le quattro sezioni delle statistiche di un ente (Eventi, Studenti, Newsletter, Guide), per l''ente stesso o per l''admin. Nelle ripartizioni degli Studenti un gruppo sotto soglia_anonimato_statistiche() si somma in «altre»: la soglia sta qui, non nella pagina.';

-- 7) La vista di prima, senza interazioni_stimate. Il resto identico a
-- 20261114100000.
drop view public.stats_istituzione;
create view public.stats_istituzione as
select
  i.id as istituzione_id,
  (select count(distinct r.student_id) from public.recinto_enti r where r.istituzione_id = i.id) as studenti_nel_recinto,
  (select count(*) from public.newsletter_iscrizioni n where n.istituzione_id = i.id) as iscritti_newsletter,
  (select count(*) from public.guide_enti g where g.istituzione_id = i.id and g.archiviata_il is null) as guide_pubblicate,
  (
    select count(distinct s.student_id) from public.scaricamenti_guide_enti s where s.istituzione_id = i.id
  ) as download_guida,
  (
    select count(*)
    from public.newsletter_iscrizioni n
    join public.profiles p on p.id = n.student_id
    where n.istituzione_id = i.id
      and public.consenso_dato_da_maggiorenne(n.created_at, p.data_nascita)
  ) as iscritti_newsletter_raggiungibili
from public.istituzioni i
where i.id = public.current_istituzione_id() or public.current_ruolo() = 'admin';

revoke insert, update, delete on public.stats_istituzione from anon, authenticated;
grant select on public.stats_istituzione to anon, authenticated;

comment on view public.stats_istituzione is
  '20261102110000, 20261107110000, 20261114100000, 20261115100000: aggregati per istituzione (mai righe individuali). La pagina delle statistiche dal 29/10 legge statistiche_ente; questa resta per il codice di prima. interazioni_stimate è uscita (20261115100000): nessuno la mostrava, e non aveva una definizione.';

-- 8) Rilettura.
do $$
begin
  if to_regprocedure('public.statistiche_ente(uuid)') is null
     or to_regprocedure('public.incrementa_scaricamenti_guida(uuid)') is null
     or to_regprocedure('public.inizio_conteggio_uscite_newsletter()') is null then
    raise exception 'una funzione di 20261115100000 non c''è';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'stats_istituzione' and column_name = 'interazioni_stimate') then
    raise exception 'interazioni_stimate è ancora nella vista';
  end if;
  if has_function_privilege('anon', 'public.incrementa_scaricamenti_guida(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.incrementa_scaricamenti_guida(uuid)', 'execute') then
    raise exception 'il client incrementa da sé il contatore degli scaricamenti';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'conta_uscita_newsletter' and not tgisinternal) then
    raise exception 'il trigger delle uscite dalla newsletter non c''è';
  end if;
  if (select count(*) from public.contatore_scaricamenti_guide) <>
     (select count(distinct (guida_id, (created_at at time zone 'Europe/Rome')::date)) from public.scaricamenti_guide_enti) then
    raise exception 'la copia degli scaricamenti di stamattina nel contatore non torna';
  end if;
end $$;
