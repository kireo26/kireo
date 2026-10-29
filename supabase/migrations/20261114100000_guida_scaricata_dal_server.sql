-- LA GUIDA DI UN ENTE: UNA PUBBLICA, LE ALTRE IN ARCHIVIO, E LO SCARICAMENTO
-- LO REGISTRA IL SERVER (29/10). PRIMA DEL DEPLOY.
--
-- ══════ IL DIFETTO, MISURATO ══════
-- Il form pubblico della guida (`GuidaEnteForm`) faceva, in quest'ordine:
-- `window.location.href = pdf`, la richiesta dell'email, un `await
-- getSession()` e solo dopo la scrittura in `recinto_enti`. Quando il PDF
-- sostituisce la pagina (Chrome sul computer con un PDF in linea) la scrittura
-- non parte mai: misurato in simulazione 5 giri su 5, e da Mario in produzione
-- su test11 (studente collegato, email «La tua guida KIREO» arrivata, nessuna
-- riga con origine `guida`). Quindi «Download guida» era zero per costruzione.
-- La cura non è riordinare tre righe nel browser: la traccia la scrive il
-- server, PRIMA di mandare il file (`registra_download_guida`, chiamata dalla
-- route `/api/scarica-guida/ente/[guidaId]`). Il browser non decide più niente.
--
-- ══════ UNA GUIDA PUBBLICA PER ENTE ══════
-- Il prodotto dice «la guida» al singolare dappertutto, e il pannello ne
-- accettava quante ne volevi: una seconda caricata diceva «Salvato.» e il form
-- pubblico ne mostrava una sola, senza che nessuno l'avesse scelta.
-- `archiviata_il` è null sulla guida pubblica. ⚠️ SOSTITUIRE VUOL DIRE «SMETTE
-- DI ESSERE QUELLA PUBBLICA», NON «SPARISCE» (Mario): il file resta, con il
-- suo titolo e la sua data, e chi l'ha scaricata resta legato a quella riga
-- (`scaricamenti_guide_enti.guida_id`). Una guida caricata archivia le altre
-- (trigger); fra quelle che ci sono, la pubblica si sceglie con
-- `scegli_guida_pubblica`.
--
-- ⚠️ NIENTE INDICE UNICO, ANCORA: Davante ne ha due pubbliche, e quale resta
-- lo sceglie l'ente, una volta, dal pannello — non una regola, altrimenti il
-- giorno in cui la si applica sparisce un file senza che nessuno l'abbia
-- chiesto. L'indice parziale `(istituzione_id) where archiviata_il is null`
-- arriva in una migrazione sua, il giorno in cui questa query dà zero righe:
--   select istituzione_id, count(*) from public.guide_enti
--   where archiviata_il is null group by 1 having count(*) > 1;
-- Fino ad allora la pagina pubblica mostra la più recente, come oggi.
--
-- ══════ CHI SCRIVE IN `recinto_enti`: UNO STUDENTE ══════
-- La policy diceva `student_id = auth.uid()`, cioè «chiunque abbia fatto
-- l'accesso, per sé»: un docente o un account d'ente che si iscriveva a un
-- evento o alla newsletter di un altro ente finiva fra gli «studenti
-- raggiunti». La stessa forma di `puo_contattare_enti` (20261109110000): la
-- regola guarda il ruolo. Tabella dei soggetti, prima di stringere (prova 7-10
-- di `scripts/verifica-guida-dal-server.sql`): lo studente passava e passa; il
-- docente, l'ente e l'admin passavano, e da qui no; l'anonimo non passava.
-- Non serve la data di nascita: il recinto conta un gesto, non apre un canale.
--
-- ══════ «DOWNLOAD GUIDA» RIPARTE DA ZERO ══════
-- I download di prima non si recuperano (l'email di accompagnamento sta in
-- Brevo, che non è un posto da cui il prodotto legge). La vista li conta da
-- `scaricamenti_guide_enti`, che nasce vuota, e la data da cui si conta la
-- dice il database (`inizio_conteggio_download_guide()`), così la pagina
-- dell'ente non la scrive a mano. ⚠️ Fra questa migrazione e il deploy il form
-- di prima scrive ancora il solo recinto: quei download (se ce ne sono) non
-- entrano nel conto.
--
-- ⚠️ PRIMA DEL DEPLOY: la route nuova chiama `registra_download_guida`. Con la
-- migrazione applicata il codice di prima funziona come oggi.
-- Come si verifica applicata (la migrazione rilegge da sé, in fondo):
--   select to_regprocedure('public.registra_download_guida(uuid)') is not null;
--   select public.inizio_conteggio_download_guide();

-- 1) La guida pubblica e l'archivio.
alter table public.guide_enti add column archiviata_il timestamptz;

comment on column public.guide_enti.archiviata_il is
  '20261114100000: null sulla guida pubblica dell''ente. Una guida archiviata non sparisce: il file resta, e chi l''ha scaricata resta legato a lei (scaricamenti_guide_enti). La scrivono solo il trigger guide_enti_sostituisce e scegli_guida_pubblica; il client non la scrive.';

drop policy if exists guide_enti_select_pubblico on public.guide_enti;
create policy guide_enti_select_pubblico
  on public.guide_enti for select
  to anon, authenticated
  using (
    archiviata_il is null
    and exists (select 1 from public.istituzioni i where i.id = guide_enti.istituzione_id and i.stato = 'attiva')
  );

create or replace function public.guide_enti_sostituisce()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.guide_enti
     set archiviata_il = now()
   where istituzione_id = new.istituzione_id
     and id <> new.id
     and archiviata_il is null;
  return null;
end;
$$;

revoke all on function public.guide_enti_sostituisce() from public, anon, authenticated;

create trigger guide_enti_sostituisce
  after insert on public.guide_enti
  for each row execute function public.guide_enti_sostituisce();

create or replace function public.scegli_guida_pubblica(p_guida_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ist uuid;
  v_righe integer;
begin
  select istituzione_id into v_ist from public.guide_enti where id = p_guida_id;
  if v_ist is null then
    raise exception 'guida_non_trovata';
  end if;
  if not (public.current_ruolo() = 'admin' or v_ist = public.current_istituzione_id()) then
    raise exception 'non_autorizzato';
  end if;
  update public.guide_enti set archiviata_il = now()
   where istituzione_id = v_ist and id <> p_guida_id and archiviata_il is null;
  update public.guide_enti set archiviata_il = null where id = p_guida_id;
  get diagnostics v_righe = row_count;
  if v_righe <> 1 then
    raise exception 'guida_non_scelta';
  end if;
end;
$$;

revoke all on function public.scegli_guida_pubblica(uuid) from public, anon;
grant execute on function public.scegli_guida_pubblica(uuid) to authenticated;

comment on function public.scegli_guida_pubblica(uuid) is
  '20261114100000: rende pubblica una guida dell''ente che chiama (o di qualunque ente, per l''admin) e archivia le altre. Archiviare non cancella niente.';

-- 2) Chi ha scaricato quale guida. Una riga per studente e guida: la prima
-- volta. Il client la legge (la propria) e non la scrive.
create table public.scaricamenti_guide_enti (
  guida_id uuid not null references public.guide_enti (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guida_id, student_id)
);

comment on table public.scaricamenti_guide_enti is
  '20261114100000: una riga per studente e guida, scritta dal server prima di mandare il file (registra_download_guida). Dice quale guida, e quale versione, lo studente ha preso: una guida sostituita resta qui con il suo id. L''ente non legge le righe, solo i conteggi (stats_istituzione).';

alter table public.scaricamenti_guide_enti enable row level security;

create policy scaricamenti_guide_enti_select_own
  on public.scaricamenti_guide_enti for select
  to authenticated
  using (student_id = auth.uid());

-- 3) La traccia la scrive il server. La chiama la route per chi ha fatto
-- l'accesso, risponde con il file da mandare e scrive solo per uno studente.
-- Gli stessi filtri della lettura pubblica: ente attivo, guida non archiviata.
-- Chi non ha fatto l'accesso non la esegue: la route gli legge la guida con la
-- lettura pubblica, che è la stessa regola, e non c'è niente da scrivere.
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

  return jsonb_build_object('stato', 'ok', 'pdf_url', v_pdf, 'slug', v_slug, 'nome', v_nome, 'registrato', v_registrato);
end;
$$;

revoke all on function public.registra_download_guida(uuid) from public, anon;
grant execute on function public.registra_download_guida(uuid) to authenticated;

comment on function public.registra_download_guida(uuid) is
  '20261114100000: il file della guida pubblica di un ente attivo. Per uno studente collegato scrive, prima di rispondere, la riga del recinto (origine guida) e quella di scaricamenti_guide_enti. registrato dice se ha scritto: per chi non è uno studente è false. Stati: ok, non_pubblica (archiviata: c''è lo slug per tornare alla pagina), non_trovata.';

-- 4) Il recinto: solo uno studente scrive la propria riga.
drop policy if exists recinto_enti_insert_own on public.recinto_enti;
create policy recinto_enti_insert_own
  on public.recinto_enti for insert
  to authenticated
  with check (student_id = auth.uid() and public.current_ruolo() = 'studente');

-- 5) Da quando si contano i download: la data in cui questa migrazione gira,
-- scritta dal database.
do $$
begin
  execute format(
    'create function public.inizio_conteggio_download_guide() returns timestamptz language sql immutable as %L',
    format('select %L::timestamptz', now())
  );
end $$;

grant execute on function public.inizio_conteggio_download_guide() to anon, authenticated;

comment on function public.inizio_conteggio_download_guide() is
  '20261114100000: il momento da cui stats_istituzione.download_guida conta. I download di prima non sono stati registrati.';

-- 6) La vista: stesse colonne nello stesso ordine (create or replace view non
-- ne ammette altre). Cambiano download_guida (dagli scaricamenti, da zero) e
-- guide_pubblicate (le sole non archiviate).
create or replace view public.stats_istituzione as
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
    from public.activity_log al
    where al.student_id in (select r.student_id from public.recinto_enti r where r.istituzione_id = i.id)
      and al.area_slug in (select ea.area_slug from public.eventi e join public.eventi_aree ea on ea.evento_id = e.id where e.organizzatore_id = i.id)
  ) as interazioni_stimate,
  (
    select count(*)
    from public.newsletter_iscrizioni n
    join public.profiles p on p.id = n.student_id
    where n.istituzione_id = i.id
      and public.consenso_dato_da_maggiorenne(n.created_at, p.data_nascita)
  ) as iscritti_newsletter_raggiungibili
from public.istituzioni i
where i.id = public.current_istituzione_id() or public.current_ruolo() = 'admin';

comment on view public.stats_istituzione is
  '20261102110000, 20261107110000, 20261114100000: aggregati per istituzione (mai righe individuali). studenti_nel_recinto = studenti distinti che hanno scaricato una guida, si sono iscritti alla newsletter o a un evento dell''ente; download_guida = studenti distinti che hanno scaricato una guida dell''ente, contati da inizio_conteggio_download_guide(); guide_pubblicate = guide non archiviate; iscritti_newsletter_raggiungibili = iscritti che si sono iscritti da maggiorenni (consenso_dato_da_maggiorenne). interazioni_stimate è una stima best-effort, non un conteggio.';

-- 7) Rilettura.
do $$
begin
  if to_regprocedure('public.registra_download_guida(uuid)') is null
     or to_regprocedure('public.scegli_guida_pubblica(uuid)') is null
     or to_regprocedure('public.inizio_conteggio_download_guide()') is null then
    raise exception 'una funzione di 20261114100000 non c''è';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'guide_enti_sostituisce' and not tgisinternal) then
    raise exception 'il trigger guide_enti_sostituisce non c''è';
  end if;
  if not exists (
    select 1 from pg_policies
     where tablename = 'recinto_enti' and policyname = 'recinto_enti_insert_own'
       and with_check like '%current_ruolo%'
  ) then
    raise exception 'la policy di insert del recinto non guarda il ruolo';
  end if;
  if not exists (
    select 1 from pg_policies
     where tablename = 'guide_enti' and policyname = 'guide_enti_select_pubblico'
       and qual like '%archiviata_il%'
  ) then
    raise exception 'la lettura pubblica delle guide mostra anche le archiviate';
  end if;
  if has_column_privilege('authenticated', 'public.guide_enti', 'archiviata_il', 'UPDATE')
     or has_table_privilege('authenticated', 'public.scaricamenti_guide_enti', 'INSERT') then
    raise exception 'il client scrive l''archivio o gli scaricamenti';
  end if;
end $$;
