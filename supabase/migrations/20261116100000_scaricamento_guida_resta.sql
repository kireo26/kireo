-- LO SCARICAMENTO DI UNA GUIDA È UN GESTO DELLO STUDENTE, E RESTA (29/10).
-- PRIMA DEL DEPLOY.
--
-- ══════ LA DECISIONE (Mario, 29/10) ══════
-- «L'ente fa quello che vuole con i suoi file. Il gesto dello studente resta.»
-- L'ente cancella e sostituisce le sue guide senza chiedere a nessuno: la
-- policy di delete su guide_enti RESTA, e qui non si tocca. Quello che si
-- traccia è l'azione dello studente, che la guida esista ancora o no.
--
-- ══════ IL DIFETTO, MISURATO (replica, 29/10) ══════
-- scaricamenti_guide_enti.guida_id e .istituzione_id erano `on delete
-- cascade` (confdeltype = c): un ente che cancella una guida, o un ente che
-- sparisce, cancellava in silenzio la traccia di ogni studente che l'aveva
-- scaricata. E il contatore degli scaricamenti (contatore_scaricamenti_guide)
-- aveva la stessa cascata: le statistiche dell'ente perdevano i numeri di una
-- guida cancellata. *Una traccia che punta a una cosa che qualcun altro può
-- cancellare non è una traccia: è un riferimento* (Mario).
--
-- ══════ LA CURA: LA COPIA SI FA AL MOMENTO DEL GESTO ══════
-- registra_download_guida copia nella riga dello studente il titolo della
-- guida, il nome dell'ente e la data in cui la guida era stata caricata — nel
-- momento in cui scrive la riga, non dopo. Quindi:
--   1. se l'ente cancella, lo studente legge comunque «titolo — ente, data»;
--   2. se l'ente sostituisce, lo studente vede la guida che ha preso lui;
--   3. le statistiche dell'ente restano giuste anche sulle guide cancellate
--      (il contatore copia titolo, data ed ente, e la guida cancellata compare
--      nel dettaglio come tale).
-- Le cascate su guida_id escono (la riga sopravvive alla guida). Quella su
-- istituzione_id esce da scaricamenti_guide_enti (la riga sopravvive all'ente)
-- e resta sul contatore: i numeri sono dell'ente, e un ente che non c'è più
-- non ha nessuno a cui mostrarli. La cascata da `profiles` (student_id)
-- resta: chi cancella il proprio account cancella le proprie tracce.
--
-- Le righe di prima si riempiono dalle guide di oggi, che ci sono tutte
-- (la cascata cancellava la riga insieme alla guida). La rilettura in fondo si
-- ferma se una riga resta senza copia.
--
-- ══════ IL FILE: MAI UN LINK ROTTO ══════
-- guide_enti_scaricate() dà allo studente le SUE righe e il file solo se la
-- riga della guida esiste ancora (pubblica o archiviata, ente attivo o no).
-- Se la guida è stata cancellata, la riga resta con titolo e data e il file
-- non si offre. ⚠️ IL RESIDUO, DICHIARATO: l'ente può togliere il file dal
-- bucket lasciando la riga (la policy di delete sullo storage, 20260713170000),
-- e lì il link si romperebbe. Nessuna schermata lo fa oggi; la protezione del
-- file non si fa adesso (Mario). Il fatto che la fa costruire: il primo file
-- di una guida che manca mentre la sua riga c'è.
--
-- ⚠️ PRIMA DEL DEPLOY: /app/guide chiama guide_enti_scaricate. Con la
-- migrazione applicata il codice di prima funziona: registra_download_guida
-- ha la stessa firma e la stessa risposta.
-- Come si verifica applicata (la migrazione rilegge da sé, in fondo):
--   select to_regprocedure('public.guide_enti_scaricate()') is not null;
--   select count(*) from pg_constraint
--    where conrelid = 'public.scaricamenti_guide_enti'::regclass and contype = 'f';  -- 1, quella su student_id

-- 1) La copia nella riga dello studente.
alter table public.scaricamenti_guide_enti
  add column titolo_guida text,
  add column ente_nome text,
  add column guida_caricata_il timestamptz;

update public.scaricamenti_guide_enti s
   set titolo_guida = g.titolo, ente_nome = i.nome, guida_caricata_il = g.created_at
  from public.guide_enti g join public.istituzioni i on i.id = g.istituzione_id
 where g.id = s.guida_id;

do $$
begin
  if exists (select 1 from public.scaricamenti_guide_enti where titolo_guida is null or ente_nome is null or guida_caricata_il is null) then
    raise exception 'una riga di scaricamenti_guide_enti è rimasta senza copia: % righe', (select count(*) from public.scaricamenti_guide_enti where titolo_guida is null);
  end if;
end $$;

alter table public.scaricamenti_guide_enti
  alter column titolo_guida set not null,
  alter column ente_nome set not null,
  alter column guida_caricata_il set not null;

alter table public.scaricamenti_guide_enti drop constraint scaricamenti_guide_enti_guida_id_fkey;
alter table public.scaricamenti_guide_enti drop constraint scaricamenti_guide_enti_istituzione_id_fkey;

comment on table public.scaricamenti_guide_enti is
  '20261114100000, 20261116100000: una riga per studente e guida, scritta dal server prima di mandare il file (registra_download_guida). È il gesto dello studente, e sopravvive alla guida e all''ente: titolo, ente e data della guida sono copiati al momento dello scaricamento, e guida_id/istituzione_id non hanno più una chiave esterna. Lo studente la legge da guide_enti_scaricate(); l''ente solo i conteggi.';
comment on column public.scaricamenti_guide_enti.titolo_guida is
  '20261116100000: il titolo della guida nel momento in cui lo studente l''ha scaricata. Non segue la guida: se l''ente la cancella o la sostituisce, resta questo.';

-- 2) La copia nel contatore, e la cascata sulla guida che esce.
alter table public.contatore_scaricamenti_guide
  add column istituzione_id uuid references public.istituzioni (id) on delete cascade,
  add column titolo text,
  add column caricata_il timestamptz;

update public.contatore_scaricamenti_guide c
   set istituzione_id = g.istituzione_id, titolo = g.titolo, caricata_il = g.created_at
  from public.guide_enti g
 where g.id = c.guida_id;

do $$
begin
  if exists (select 1 from public.contatore_scaricamenti_guide where istituzione_id is null or titolo is null or caricata_il is null) then
    raise exception 'una riga del contatore è rimasta senza copia';
  end if;
end $$;

alter table public.contatore_scaricamenti_guide
  alter column istituzione_id set not null,
  alter column titolo set not null,
  alter column caricata_il set not null;

alter table public.contatore_scaricamenti_guide drop constraint contatore_scaricamenti_guide_guida_id_fkey;

comment on table public.contatore_scaricamenti_guide is
  '20261115100000, 20261116100000: quante volte una guida di un ente è stata scaricata, per giorno (ora italiana), da chiunque. Nessuna identità. Titolo, data ed ente sono copiati al momento dello scaricamento, così i numeri di una guida cancellata restano. Il client non lo legge né lo scrive.';

-- 3) Le due scritture copiano. Stesse firme e stesse risposte.
create or replace function public.incrementa_scaricamenti_guida(p_guida_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ist uuid;
  v_titolo text;
  v_caricata timestamptz;
begin
  -- Si conta solo una guida pubblica di un ente attivo: la stessa regola della
  -- lettura pubblica, così un id inventato non crea righe.
  select g.istituzione_id, g.titolo, g.created_at into v_ist, v_titolo, v_caricata
    from public.guide_enti g join public.istituzioni i on i.id = g.istituzione_id
   where g.id = p_guida_id and g.archiviata_il is null and i.stato = 'attiva';
  if v_ist is null then
    return false;
  end if;
  insert into public.contatore_scaricamenti_guide (guida_id, giorno, scaricamenti, istituzione_id, titolo, caricata_il)
    values (p_guida_id, (now() at time zone 'Europe/Rome')::date, 1, v_ist, v_titolo, v_caricata)
    on conflict (guida_id, giorno) do update set scaricamenti = contatore_scaricamenti_guide.scaricamenti + 1;
  return true;
end;
$$;

revoke all on function public.incrementa_scaricamenti_guida(uuid) from public, anon, authenticated;
grant execute on function public.incrementa_scaricamenti_guida(uuid) to service_role;

comment on function public.incrementa_scaricamenti_guida(uuid) is
  '20261115100000, 20261116100000: uno scaricamento in più per una guida pubblica, senza sapere di chi, con titolo, data ed ente copiati. La chiama registra_download_guida per chi ha fatto l''accesso e la route con la service-role per chi no. Falso se la guida non è pubblica.';

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
  v_titolo text;
  v_caricata timestamptz;
  v_registrato boolean := false;
begin
  select g.pdf_url, g.istituzione_id, g.archiviata_il, i.slug, i.stato::text, i.nome, g.titolo, g.created_at
    into v_pdf, v_ist, v_archiviata, v_slug, v_stato_ist, v_nome, v_titolo, v_caricata
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
    -- La copia si fa qui, nel momento del gesto: la riga non dipende più
    -- dall'esistenza della guida. Un secondo scaricamento della stessa guida
    -- non la riscrive: conta il primo.
    insert into public.scaricamenti_guide_enti (guida_id, student_id, istituzione_id, titolo_guida, ente_nome, guida_caricata_il)
      values (p_guida_id, auth.uid(), v_ist, v_titolo, v_nome, v_caricata)
      on conflict do nothing;
    v_registrato := true;
  end if;

  perform public.incrementa_scaricamenti_guida(p_guida_id);

  return jsonb_build_object('stato', 'ok', 'pdf_url', v_pdf, 'slug', v_slug, 'nome', v_nome, 'registrato', v_registrato);
end;
$$;

comment on function public.registra_download_guida(uuid) is
  '20261114100000, 20261115100000, 20261116100000: il file della guida pubblica di un ente attivo. Conta lo scaricamento (contatore_scaricamenti_guide) per chiunque abbia fatto l''accesso; per uno studente scrive anche la riga del recinto (origine guida) e quella di scaricamenti_guide_enti, con titolo, ente e data copiati. registrato dice se ha scritto quelle due. Stati: ok, non_pubblica, non_trovata.';

-- 4) L'archivio dello studente.
create or replace function public.guide_enti_scaricate()
returns table (
  guida_id uuid,
  titolo text,
  ente_nome text,
  guida_caricata_il timestamptz,
  scaricata_il timestamptz,
  stato text,
  pdf_url text
)
language sql
stable
security definer
set search_path = public
as $$
  -- Solo le righe di chi chiede. Lo stato: «pubblica» se la guida è ancora
  -- quella pubblica di un ente attivo, «archiviata» se c'è ancora ma non lo è
  -- più (sostituita, o l'ente non è più attivo), «cancellata» se la riga della
  -- guida non c'è più. Il file solo se la riga della guida c'è.
  select s.guida_id, s.titolo_guida, s.ente_nome, s.guida_caricata_il, s.created_at,
         case
           when g.id is null then 'cancellata'
           when g.archiviata_il is null and i.stato = 'attiva' then 'pubblica'
           else 'archiviata'
         end,
         g.pdf_url
    from public.scaricamenti_guide_enti s
    left join public.guide_enti g on g.id = s.guida_id
    left join public.istituzioni i on i.id = g.istituzione_id
   where s.student_id = auth.uid()
   order by s.created_at desc, s.guida_id;
$$;

revoke all on function public.guide_enti_scaricate() from public, anon;
grant execute on function public.guide_enti_scaricate() to authenticated;

comment on function public.guide_enti_scaricate() is
  '20261116100000: le guide degli enti che chi chiede ha scaricato, con il titolo e l''ente di quel momento. pdf_url solo se la guida esiste ancora: mai un link a un file cancellato. Non apre guide_enti a nessun altro.';

-- 5) Le statistiche dell'ente: le guide cancellate restano nel conto. Il resto
-- identico a 20261115100000.
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

  -- ── Guide: ogni guida, anche archiviata, e (dal 20261116100000) anche
  -- cancellata. Una guida cancellata non c'è più in guide_enti: titolo e data
  -- vengono dal contatore, che li ha copiati al momento dello scaricamento.
  with g as (
    select g.id, g.titolo, g.created_at, g.archiviata_il, false as cancellata
      from public.guide_enti g
     where g.istituzione_id = p_istituzione_id
    union all
    (select distinct on (c.guida_id) c.guida_id, c.titolo, c.caricata_il, null::timestamptz, true
       from public.contatore_scaricamenti_guide c
      where c.istituzione_id = p_istituzione_id
        and not exists (select 1 from public.guide_enti x where x.id = c.guida_id)
      order by c.guida_id, c.giorno)
  ), gc as (
    select g.*,
           (select coalesce(sum(c.scaricamenti), 0) from public.contatore_scaricamenti_guide c where c.guida_id = g.id) as scaricamenti,
           (select coalesce(sum(c.scaricamenti), 0) from public.contatore_scaricamenti_guide c
             where c.guida_id = g.id and c.giorno >= v_mese) as scaricamenti_mese,
           (select count(*) from public.scaricamenti_guide_enti s where s.guida_id = g.id) as studenti
      from g
  )
  select jsonb_build_object(
    'scaricamenti', coalesce(sum(gc.scaricamenti), 0),
    'scaricamenti_mese', coalesce(sum(gc.scaricamenti_mese), 0),
    'studenti', (select count(distinct s.student_id) from public.scaricamenti_guide_enti s where s.istituzione_id = p_istituzione_id),
    'contati_dal', public.inizio_conteggio_download_guide(),
    'per_guida', coalesce(jsonb_agg(jsonb_build_object(
      'guida_id', gc.id, 'titolo', gc.titolo, 'caricata_il', gc.created_at, 'archiviata_il', gc.archiviata_il,
      'cancellata', gc.cancellata, 'scaricamenti', gc.scaricamenti, 'studenti', gc.studenti
    ) order by gc.created_at desc), '[]'::jsonb)
  ) into v_guide
  from gc;

  return jsonb_build_object('eventi', v_eventi, 'studenti', v_studenti, 'newsletter', v_newsletter, 'guide', v_guide);
end;
$$;

revoke all on function public.statistiche_ente(uuid) from public, anon;
grant execute on function public.statistiche_ente(uuid) to authenticated;

comment on function public.statistiche_ente(uuid) is
  '20261115100000, 20261116100000: le quattro sezioni delle statistiche di un ente (Eventi, Studenti, Newsletter, Guide), per l''ente stesso o per l''admin. Nelle ripartizioni degli Studenti un gruppo sotto soglia_anonimato_statistiche() si somma in «altre»: la soglia sta qui, non nella pagina. Le guide cancellate restano nel dettaglio (cancellata: true), con titolo e data copiati dal contatore.';

-- 6) Rilettura.
do $$
begin
  if to_regprocedure('public.guide_enti_scaricate()') is null then
    raise exception 'guide_enti_scaricate non c''è';
  end if;
  if has_function_privilege('anon', 'public.guide_enti_scaricate()', 'execute') then
    raise exception 'un visitatore esegue guide_enti_scaricate';
  end if;
  if (select count(*) from pg_constraint where conrelid = 'public.scaricamenti_guide_enti'::regclass and contype = 'f') <> 1
     or not exists (select 1 from pg_constraint where conrelid = 'public.scaricamenti_guide_enti'::regclass and contype = 'f'
                     and confrelid = 'public.profiles'::regclass and confdeltype = 'c') then
    raise exception 'scaricamenti_guide_enti deve avere una sola chiave esterna, su profiles e in cascata';
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.contatore_scaricamenti_guide'::regclass and contype = 'f'
              and confrelid = 'public.guide_enti'::regclass) then
    raise exception 'il contatore dipende ancora dall''esistenza della guida';
  end if;
  if exists (select 1 from public.scaricamenti_guide_enti where titolo_guida is null)
     or exists (select 1 from public.contatore_scaricamenti_guide where titolo is null) then
    raise exception 'una riga è senza copia';
  end if;
end $$;
