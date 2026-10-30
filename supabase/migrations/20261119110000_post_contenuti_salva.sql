-- I CONTENUTI DEGLI ENTI: LA SCHEDA DEL LINK, IL FILE ALLEGATO, «SALVA» (30/10).
-- DA APPLICARE PRIMA DEL DEPLOY, DOPO 20261119100000 (il valore `file`).
--
-- Decisioni di Mario del 30/10:
--   (a) un post che rimanda a Instagram, Facebook o TikTok è una SCHEDA che
--       compila l'ente — titolo, una riga, un'immagine, il link — e un bottone
--       che apre il post sulla piattaforma quando lo studente lo vuole. Mai un
--       iframe: Meta e TikTok vedrebbero il minorenne anche senza un clic (o,
--       com'era fino a oggi, al primo clic, con un gesto che nessuno gli aveva
--       detto essere un consenso). E nessuna richiesta verso quelle
--       piattaforme, nemmeno dal nostro server: niente che si rompa quando
--       cambiano le regole, niente immagine che scade;
--   (b) il link social è aperto a TUTTI i piani: con la forma (a) è una foto,
--       un titolo, una riga e un link, cioè un post immagine con un campo in
--       più. «Stavamo facendo pagare un campo in un modulo.»;
--   (c) un post può portare un FILE (un PDF) che lo studente scarica, e lo
--       scaricamento segue la strada della guida: il server scrive la traccia
--       prima di mandare il file;
--   (d) «salva» su tutti i post, senza quote nuove (i post hanno già il tetto
--       di 3 nelle 24 ore). La riga del salvataggio basta a sé stessa: si
--       copia quello che serve a mostrarla, e un post tolto dal flusso o di un
--       ente che se n'è andato resta nell'archivio, con la data e il perché.
--
-- ============ (b) IL CONTROLLO SUL PIANO ESCE: LA TABELLA DEI SOGGETTI ============
-- La regola del 28/10: prima di togliere un controllo lo si fa girare contro
-- tutti i soggetti che possono arrivarci, e si scrive chi fermava. Misurato il
-- 30/10 su una replica con tutte le migrazioni fino a 20261118100000 (il
-- trigger `post_enti_tipo_dal_piano` ancora dentro):
--   ente free dal client:       testo passa · immagine passa · link_social FERMATO
--   ente premium dal client:    link_social passa
--   admin dal client, per un ente free:  link_social FERMATO
--   SQL Editor, ente free:      testo passa · immagine passa · link_social FERMATO
--   SQL Editor, ente premium:   link_social passa
--   il ramo «update of tipo, istituzione_id»: nessun chiamante (il client non
--     ha il privilegio di update su nessuna delle due colonne, misurato).
-- Il trigger faceva UN lavoro solo, ed è quello che la decisione toglie. Nato
-- il 29/10 per salvare il secondo lavoro della policy di insert, esce intero.
-- ⚠️ Una cosa che resta legata al piano, e non c'entra con questo controllo: la
-- NOTIFICA ai follower di un post nuovo parte solo per un ente a pagamento
-- (`notifiche_post_enti`, «Notifiche ai follower» nel listino). Non si tocca.
--
-- ============ (c) IL FILE: UN PERCORSO, NON UN INDIRIZZO ============
-- Il file sta in `istituzioni-media` (lo spazio dell'ente: PDF fino a 20 MB,
-- già sul bucket dal 20261103140000), nella cartella dell'ente. Il post tiene
-- il PERCORSO, non un indirizzo: l'indirizzo lo costruisce la route da quel
-- percorso, quindi un ente non può far scaricare agli studenti un file da un
-- posto qualunque. Il vincolo pretende che il percorso stia nella cartella
-- dell'ente del post e finisca in .pdf.
-- ⚠️ LO SPAZIO DEI FILE È PUBBLICO, e qui lo si nomina senza risolverlo: chi ha
-- il link apre il file, e anche l'immagine della scheda, come ogni immagine dei
-- post. È il punto aperto già noto («Le immagini dei post restano leggibili da
-- chi ha il link»); ora vale anche per i file allegati.
--
-- ============ (d) IL CONSENSO NON SI ALLARGA DA SÉ, DI NUOVO ============
-- Il punto aperto del 28/10 diceva che «ha salvato un suo contenuto» entra
-- negli Interessati il giorno in cui il salvataggio nasce. Ma chi ha condiviso
-- il profilo fino a oggi ha letto un pannello che nominava eventi e guida, non
-- i post salvati né i file scaricati: mostrarglieli adesso sarebbe allargare un
-- consenso già dato, la regola di `copre_attivita` (20261111100000). Quindi una
-- colonna sua, `copre_contenuti`: false per le righe di oggi, true per le nuove
-- (il pannello nuovo li nomina). ⚠️ Fra l'applicazione e il deploy una
-- condivisione nuova nasce true con il pannello di prima: la stessa finestra
-- di copre_attivita, di minuti.

-- ============ (b) via il controllo sul piano ============
drop trigger if exists post_enti_tipo_dal_piano on public.post_enti;
drop function if exists public.post_tipo_ammesso_dal_piano();

-- ============ le colonne della scheda e del file ============
alter table public.post_enti
  add column link_titolo text,
  add column link_riga text,
  add column allegato_percorso text,
  add column allegato_nome text;

-- Il vincolo di coerenza si riscrive: il link_social può avere un'immagine (la
-- scheda), accetta Facebook, e c'è il tipo `file`. Le righe di oggi lo
-- rispettano già (il vecchio era più stretto su tutti i rami): nasce validato.
alter table public.post_enti drop constraint post_enti_coerenza_tipo;
alter table public.post_enti
  add constraint post_enti_coerenza_tipo check (
    (tipo = 'testo' and immagine_url is null and embed_url is null and allegato_percorso is null)
    or (tipo = 'immagine' and immagine_url is not null and embed_url is null and allegato_percorso is null)
    or (
      tipo = 'link_social'
      and embed_url is not null
      -- Lo specchio in TypeScript è REGEX_LINK_SOCIALE (lib/ente/post.ts), e
      -- `npm run test:contenuti` pretende la stessa espressione.
      and embed_url ~* '^https://([a-z0-9-]+\.)*(instagram\.com|facebook\.com|fb\.watch|tiktok\.com)/'
      and allegato_percorso is null
    )
    or (
      tipo = 'file'
      and allegato_percorso is not null
      and allegato_nome is not null
      and immagine_url is null
      and embed_url is null
      and split_part(allegato_percorso, '/', 1) = istituzione_id::text
      and lower(allegato_percorso) like '%.pdf'
    )
  ),
  add constraint post_enti_lunghezze_scheda check (
    (link_titolo is null or char_length(link_titolo) <= 120)
    and (link_riga is null or char_length(link_riga) <= 200)
    and (allegato_nome is null or (char_length(btrim(allegato_nome)) between 1 and 200))
  );

-- La scheda completa si pretende su ogni post NUOVO: i link_social di prima
-- non hanno titolo, riga né immagine, e restano leggibili come un link con il
-- nome della piattaforma (FeedPost). Un vincolo sulla tabella li renderebbe
-- falsi, e `togli_post` (che aggiorna lo stato) fallirebbe su di loro.
create or replace function public.contenuto_post_completo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tipo = 'link_social' and (
    coalesce(btrim(new.link_titolo), '') = ''
    or coalesce(btrim(new.link_riga), '') = ''
    or coalesce(btrim(new.immagine_url), '') = ''
  ) then
    raise exception 'scheda_link_incompleta';
  end if;
  return new;
end;
$$;

create trigger post_enti_contenuto_completo
  before insert on public.post_enti
  for each row execute function public.contenuto_post_completo();

-- Quattro colonne nuove aperte al client (il form dell'ente le scrive): il
-- tetto del registro (`supabase/colonne-del-client.json`) sale da 188 a 192
-- nello stesso commit, ed è questa la ragione.
grant insert (link_titolo, link_riga, allegato_percorso, allegato_nome) on public.post_enti to authenticated;
grant select (link_titolo, link_riga, allegato_percorso, allegato_nome) on public.post_enti to anon, authenticated;

comment on table public.post_enti is
  'Post di bacheca degli enti. Dal 20261113110000 si pubblicano subito (stato pubblicato) e KIREO può toglierli (tolto, con motivo, autore e data); approvato e rifiutato sono la storia di prima del 29/10. Cosa è visibile lo dice post_stato_visibile. Dal 20261119110000 tutti i tipi sono di tutti i piani: link_social è una scheda compilata dall''ente (titolo, riga, immagine, link), file è un PDF nello spazio dell''ente.';
comment on column public.post_enti.allegato_percorso is
  '20261119110000: il percorso del PDF nel bucket istituzioni-media, nella cartella dell''ente. Non un indirizzo: l''indirizzo lo costruisce /api/scarica-allegato, dopo aver scritto la traccia.';

-- ============ (c) lo scaricamento del file ============
-- Una riga per studente e post: il primo scaricamento. Basta a sé stessa (il
-- nome del file, l'ente, quando il post era uscito): il post può essere tolto
-- o cancellato, e il gesto dello studente resta.
create table public.scaricamenti_allegati_post (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.post_enti (id) on delete set null,
  istituzione_id uuid references public.istituzioni (id) on delete set null,
  ente_nome text not null,
  allegato_nome text not null,
  pubblicato_il timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, post_id)
);

comment on table public.scaricamenti_allegati_post is
  '20261119110000: i file dei post degli enti che uno studente ha scaricato, scritti da registra_download_allegato prima di mandare il file. Il nome del file e dell''ente sono copiati: la riga resta se il post sparisce.';

alter table public.scaricamenti_allegati_post enable row level security;
revoke all on public.scaricamenti_allegati_post from anon, authenticated;
grant select on public.scaricamenti_allegati_post to authenticated;

create policy scaricamenti_allegati_post_select_own
  on public.scaricamenti_allegati_post for select
  to authenticated
  using (student_id = auth.uid());

create or replace function public.registra_download_allegato(p_post uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
begin
  if auth.uid() is null then
    raise exception 'non_autorizzato';
  end if;

  select p.id, p.istituzione_id, p.allegato_percorso, p.allegato_nome, p.visibile_dal, i.nome as ente_nome
    into v_post
  from public.post_enti p
  join public.istituzioni i on i.id = p.istituzione_id
  where p.id = p_post and p.visibile and p.tipo = 'file';
  if not found then
    return jsonb_build_object('stato', 'non_disponibile');
  end if;

  -- La traccia la lascia solo uno studente: un ente o l'admin che aprono il
  -- file per guardarlo non sono un gesto verso l'ente (la regola del recinto,
  -- 20261114100000).
  if public.current_ruolo() = 'studente' then
    insert into public.scaricamenti_allegati_post (student_id, post_id, istituzione_id, ente_nome, allegato_nome, pubblicato_il)
    values (auth.uid(), v_post.id, v_post.istituzione_id, v_post.ente_nome, v_post.allegato_nome, v_post.visibile_dal)
    on conflict (student_id, post_id) do nothing;
  end if;

  return jsonb_build_object('stato', 'ok', 'percorso', v_post.allegato_percorso);
end;
$$;

revoke all on function public.registra_download_allegato(uuid) from public, anon;
grant execute on function public.registra_download_allegato(uuid) to authenticated;

-- ============ (d) «salva» ============
create table public.post_salvati (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.post_enti (id) on delete set null,
  istituzione_id uuid references public.istituzioni (id) on delete set null,
  ente_nome text not null,
  tipo public.post_ente_tipo not null,
  corpo text not null,
  immagine_url text,
  link_url text,
  link_titolo text,
  link_riga text,
  allegato_nome text,
  pubblicato_il timestamptz,
  salvato_il timestamptz not null default now(),
  unique (student_id, post_id)
);

comment on table public.post_salvati is
  '20261119110000: i post degli enti che uno studente ha salvato. Il contenuto è copiato al momento del gesto (salva_post): la riga resta se il post viene tolto dal flusso, se l''ente non è più attivo, o se il post sparisce. Lo stato di oggi lo dice post_salvati_miei.';

alter table public.post_salvati enable row level security;
revoke all on public.post_salvati from anon, authenticated;
grant select, delete on public.post_salvati to authenticated;

create policy post_salvati_select_own
  on public.post_salvati for select
  to authenticated
  using (student_id = auth.uid());

create policy post_salvati_delete_own
  on public.post_salvati for delete
  to authenticated
  using (student_id = auth.uid());

-- Salva un post visibile. La copia la fa il database, mai il client: quello
-- che lo studente ritrova è quello che c'era, non quello che gli è stato
-- mandato.
create or replace function public.salva_post(p_post uuid)
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

  insert into public.post_salvati (
    student_id, post_id, istituzione_id, ente_nome, tipo, corpo,
    immagine_url, link_url, link_titolo, link_riga, allegato_nome, pubblicato_il
  )
  select auth.uid(), p.id, p.istituzione_id, i.nome, p.tipo, p.corpo,
         p.immagine_url, p.embed_url, p.link_titolo, p.link_riga, p.allegato_nome, p.visibile_dal
  from public.post_enti p
  join public.istituzioni i on i.id = p.istituzione_id
  where p.id = p_post and p.visibile
  on conflict (student_id, post_id) do nothing;
  get diagnostics v_toccate = row_count;

  if v_toccate = 1 then
    return jsonb_build_object('stato', 'salvato');
  end if;
  if exists (select 1 from public.post_salvati where student_id = auth.uid() and post_id = p_post) then
    return jsonb_build_object('stato', 'gia_salvato');
  end if;
  return jsonb_build_object('stato', 'non_visibile');
end;
$$;

revoke all on function public.salva_post(uuid) from public, anon;
grant execute on function public.salva_post(uuid) to authenticated;

-- L'archivio dello studente: le SUE righe, con lo stato di oggi. Un post tolto
-- dice quando (non il motivo: quello KIREO lo scrive all'ente, e resta suo,
-- 20261113120000).
create or replace function public.post_salvati_miei()
returns table (
  salvataggio_id uuid,
  post_id uuid,
  ente_nome text,
  istituzione_slug text,
  tipo public.post_ente_tipo,
  corpo text,
  immagine_url text,
  link_url text,
  link_titolo text,
  link_riga text,
  allegato_nome text,
  pubblicato_il timestamptz,
  salvato_il timestamptz,
  stato text,
  tolto_il timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.post_id, s.ente_nome, i.slug, s.tipo, s.corpo,
         s.immagine_url, s.link_url, s.link_titolo, s.link_riga, s.allegato_nome,
         s.pubblicato_il, s.salvato_il,
         case
           when p.id is null then 'cancellato'
           when p.stato = 'tolto' then 'tolto'
           when not p.visibile then 'non_visibile'
           when i.id is null or i.stato <> 'attiva' then 'ente_non_attivo'
           else 'visibile'
         end,
         p.tolto_il
  from public.post_salvati s
  left join public.post_enti p on p.id = s.post_id
  left join public.istituzioni i on i.id = s.istituzione_id
  where s.student_id = auth.uid()
  order by s.salvato_il desc, s.id desc
$$;

revoke all on function public.post_salvati_miei() from public, anon;
grant execute on function public.post_salvati_miei() to authenticated;

-- ============ (d) il consenso che copre i contenuti ============
alter table public.manifestazioni_interesse
  add column copre_contenuti boolean not null default false;
alter table public.manifestazioni_interesse
  alter column copre_contenuti set default true;

comment on column public.manifestazioni_interesse.copre_contenuti is
  '20261119110000: true se lo studente ha condiviso il profilo con il pannello che nomina anche i post salvati e i file scaricati di quell''ente. Le righe di prima nascono false. Il client non la scrive.';

-- interessati_ente cambia il tipo che restituisce: drop e create. Fra le due il
-- codice di prima legge le stesse colonne di prima più tre che ignora.
drop function public.interessati_ente(uuid);
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
  conversazione_id uuid,
  copre_contenuti boolean,
  post_salvati integer,
  allegati_scaricati integer
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
       order by c.created_at desc limit 1),
      mi.copre_contenuti,
      case when mi.copre_contenuti then (
        select count(*)::integer from public.post_salvati ps
        where ps.istituzione_id = p_istituzione_id and ps.student_id = mi.student_id
      ) end,
      case when mi.copre_contenuti then (
        select count(*)::integer from public.scaricamenti_allegati_post sa
        where sa.istituzione_id = p_istituzione_id and sa.student_id = mi.student_id
      ) end
    from public.manifestazioni_interesse mi
    join public.profiles pr on pr.id = mi.student_id
    left join public.student_profiles sp on sp.user_id = mi.student_id
    left join public.schools s on s.codice_meccanografico = sp.school_code
    where mi.istituzione_id = p_istituzione_id and mi.revocata_il is null
    order by mi.created_at desc;
end;
$$;

revoke all on function public.interessati_ente(uuid) from public, anon;
grant execute on function public.interessati_ente(uuid) to authenticated;

create or replace function public.scheda_interessato_ente(p_istituzione_id uuid, p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_copre boolean;
  v_copre_contenuti boolean;
  v_creata timestamptz;
  v_scheda jsonb;
begin
  if not public.ente_vede_interessati(p_istituzione_id) then
    raise exception 'non_autorizzato';
  end if;

  select mi.copre_attivita, mi.copre_contenuti, mi.created_at into v_copre, v_copre_contenuti, v_creata
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
    'copre_contenuti', v_copre_contenuti,
    'conversazione_id', (select c.id from public.conversazioni_enti c
                         where c.istituzione_id = p_istituzione_id and c.student_id = pr.id
                         order by c.created_at desc limit 1)
  ) into v_scheda
  from public.profiles pr
  left join public.student_profiles sp on sp.user_id = pr.id
  left join public.schools s on s.codice_meccanografico = sp.school_code
  where pr.id = p_student_id;

  if v_copre then
    v_scheda := v_scheda || jsonb_build_object(
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
  end if;

  if v_copre_contenuti then
    v_scheda := v_scheda || jsonb_build_object(
      'post_salvati', coalesce((
        select jsonb_agg(jsonb_build_object('corpo', left(ps.corpo, 140), 'salvato_il', ps.salvato_il)
               order by ps.salvato_il desc)
        from public.post_salvati ps
        where ps.istituzione_id = p_istituzione_id and ps.student_id = p_student_id
      ), '[]'::jsonb),
      'allegati_scaricati', coalesce((
        select jsonb_agg(jsonb_build_object('allegato_nome', sa.allegato_nome, 'scaricato_il', sa.created_at)
               order by sa.created_at desc)
        from public.scaricamenti_allegati_post sa
        where sa.istituzione_id = p_istituzione_id and sa.student_id = p_student_id
      ), '[]'::jsonb)
    );
  end if;

  return v_scheda;
end;
$$;

comment on function public.interessati_ente(uuid) is
  '20261119110000 (era 20261111100000): gli studenti che hanno condiviso il profilo con l''ente. Solo il dichiarato più l''attività verso QUESTO ente (eventi e guida se copre_attivita; post salvati e file scaricati se copre_contenuti). Mai test, missioni, workshop, evidence, area_signal.';
comment on function public.scheda_interessato_ente(uuid, uuid) is
  '20261119110000 (era 20261111100000): la scheda di uno studente che ha condiviso il profilo. NULL senza una condivisione attiva. Stesse esclusioni di interessati_ente.';

-- ============ si rilegge ============
do $$
declare
  v_coprono int;
begin
  if exists (select 1 from pg_trigger where tgname = 'post_enti_tipo_dal_piano') then
    raise exception 'rilettura: il controllo sul piano è ancora lì';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'post_enti_contenuto_completo' and not tgisinternal) then
    raise exception 'rilettura: la scheda completa non è pretesa';
  end if;
  if not has_column_privilege('authenticated', 'public.post_enti', 'link_titolo', 'INSERT')
     or not has_column_privilege('anon', 'public.post_enti', 'allegato_nome', 'SELECT') then
    raise exception 'rilettura: le colonne nuove non sono concesse';
  end if;
  if has_table_privilege('authenticated', 'public.post_salvati', 'INSERT')
     or has_table_privilege('authenticated', 'public.post_salvati', 'UPDATE')
     or has_table_privilege('authenticated', 'public.scaricamenti_allegati_post', 'INSERT')
     or has_table_privilege('anon', 'public.post_salvati', 'SELECT') then
    raise exception 'rilettura: il client scrive le copie, o un visitatore le legge';
  end if;
  if has_function_privilege('anon', 'public.salva_post(uuid)', 'execute')
     or has_function_privilege('anon', 'public.registra_download_allegato(uuid)', 'execute') then
    raise exception 'rilettura: un visitatore esegue le funzioni nuove';
  end if;
  select count(*) into v_coprono from public.manifestazioni_interesse where copre_contenuti;
  if v_coprono > 0 then
    raise exception 'rilettura: copre_contenuti: % righe di prima risultano coperte, attese 0', v_coprono;
  end if;
  if has_column_privilege('authenticated', 'public.manifestazioni_interesse', 'copre_contenuti', 'INSERT') then
    raise exception 'rilettura: copre_contenuti è scrivibile dal client';
  end if;
end $$;
