-- IL TIPO «LINK SOCIAL» ESCE: RESTA UN CAMPO LINK SU QUALSIASI POST (30/10).
-- DA APPLICARE PRIMA DEL DEPLOY: il form nuovo scrive `link_esterno` e il feed
-- lo legge. 20261119100000 e 20261119110000 sono applicate (misurate dallo
-- schema da Mario il 30/10) e non si toccano: questa è la forma nuova.
--
-- ============ LA DECISIONE (Mario, guardando a schermo il form della scheda) ============
-- «Se non può apparire il post del social è inutile quella sezione.» Se l'ente
-- deve ricaricare la foto, scrivere un titolo e una riga, non sta condividendo
-- un post: sta rifacendo un post normale con un link attaccato, cioè quello che
-- il tipo `immagine` fa già, per tutti. Il campo in più non vale un tipo di
-- post. Quindi:
--   - il tipo `link_social` esce: nessun post nuovo può averlo, e lo dice il
--     database (il vincolo qui sotto), non solo il form. Il VALORE resta nel
--     tipo: una parola che ha una storia non si toglie, anche se la storia è
--     «nessuno l'ha usata»;
--   - escono la scheda (`link_titolo`, `link_riga`) e il trigger che la
--     pretendeva (`contenuto_post_completo`); l'immagine della scheda stava in
--     `immagine_url`, la stessa colonna del tipo `immagine`, che resta;
--   - `embed_url` diventa `link_esterno`: un campo facoltativo su testo,
--     immagine e file, di tutti i piani. Il nome di prima descriveva una cosa
--     che il progetto non fa più (incorporare), e un nome così è una trappola
--     per chi lo legge fra sei mesi;
--   - il link è solo https (niente javascript:, data:, http), e l'etichetta del
--     bottone la decide l'indirizzo, mai l'ente (lib/post/contenuti.ts).
--
-- ============ LA CONVERSIONE CHE NON HA CONVERTITO NIENTE ============
-- Misurato da Mario il 30/10 in produzione: ZERO post `link_social`, in nessuno
-- stato, mai. Il tipo esisteva, era riservato ai piani a pagamento fino al
-- 29/10, e nessun ente l'ha usato. Quindi non c'è niente da convertire, e
-- `embed_url` → `link_esterno` è un rinominamento a tavolino. Lo si scrive
-- perché fra sei mesi un'operazione di conversione che non ha convertito niente
-- non si distingue da una che non è stata fatta. I controlli qui sotto lo
-- ripetono sul database in cui la migrazione gira, e si fermano se non è vero:
-- «nessun post link_social» non è «quelle colonne sono vuote».
--
-- ============ IL TRIGGER DEL PIANO ============
-- `post_enti_tipo_dal_piano` è già uscito con 20261119110000 (la tabella dei
-- soggetti sta in testa a quella migrazione: un `if` solo, fermava un
-- link_social di un ente free da ogni strada, il ramo sugli aggiornamenti non
-- aveva chiamanti). Qui non c'è più niente da togliere; resta legata al piano
-- solo la notifica ai follower, che è un'altra cosa.
--
-- ============ COSA RESTA DI 20261119110000 ============
-- Il file allegato, «salva», l'archivio, la traccia degli scaricamenti, il
-- consenso `copre_contenuti`: tutto invariato. Cambiano solo le colonne della
-- scheda nelle copie dei salvataggi (`post_salvati`), e le due funzioni che le
-- copiano e le leggono.

-- ============ i controlli prima di togliere ============
do $$
declare
  v_social int;
  v_scheda int;
  v_salvati_scheda int;
  v_salvati_social int;
begin
  select count(*) into v_social from public.post_enti where tipo = 'link_social';
  select count(*) into v_scheda from public.post_enti
   where link_titolo is not null or link_riga is not null;
  select count(*) into v_salvati_scheda from public.post_salvati
   where link_titolo is not null or link_riga is not null;
  select count(*) into v_salvati_social from public.post_salvati where tipo = 'link_social';
  if v_social > 0 or v_scheda > 0 or v_salvati_scheda > 0 or v_salvati_social > 0 then
    raise exception 'controllo: post link_social %, post con la scheda %, salvataggi con la scheda %, salvataggi link_social %: attesi tutti 0. Si guardano prima di togliere qualsiasi cosa.',
      v_social, v_scheda, v_salvati_scheda, v_salvati_social;
  end if;
end $$;

-- ============ la scheda esce ============
drop trigger if exists post_enti_contenuto_completo on public.post_enti;
drop function if exists public.contenuto_post_completo();

alter table public.post_enti drop constraint post_enti_coerenza_tipo;
alter table public.post_enti drop constraint post_enti_lunghezze_scheda;

-- Le concessioni si tolgono a voce alta prima di rinominare e far cadere: un
-- rinominamento porterebbe con sé il privilegio senza che nessuna riga di una
-- migrazione lo dica, e il registro delle colonne (test:colonne) legge le righe.
revoke insert (embed_url, link_titolo, link_riga) on public.post_enti from authenticated;
revoke select (embed_url, link_titolo, link_riga) on public.post_enti from anon, authenticated;

alter table public.post_enti rename column embed_url to link_esterno;
alter table public.post_enti drop column link_titolo;
alter table public.post_enti drop column link_riga;

grant insert (link_esterno) on public.post_enti to authenticated;
grant select (link_esterno) on public.post_enti to anon, authenticated;

-- ============ i vincoli nuovi ============
-- Le righe di oggi li rispettano già (nessun link_social, e i link di testo,
-- immagine e file erano vietati fino a oggi): nascono validati.
alter table public.post_enti
  add constraint post_enti_coerenza_tipo check (
    tipo <> 'link_social'
    and (
      (tipo = 'testo' and immagine_url is null and allegato_percorso is null)
      or (tipo = 'immagine' and immagine_url is not null and allegato_percorso is null)
      or (
        tipo = 'file'
        and allegato_percorso is not null
        and allegato_nome is not null
        and immagine_url is null
        and split_part(allegato_percorso, '/', 1) = istituzione_id::text
        and lower(allegato_percorso) like '%.pdf'
      )
    )
  ),
  -- Solo https, un host con un punto, niente spazi: lo specchio in TypeScript è
  -- SORGENTE_REGEX_LINK_ESTERNO (lib/post/contenuti.ts), e `npm run
  -- test:contenuti` pretende la stessa espressione.
  add constraint post_enti_link_esterno_https check (
    link_esterno is null
    or (
      char_length(link_esterno) <= 2000
      and link_esterno ~* '^https://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]+)?([/?#][^[:space:]]*)?$'
    )
  ),
  add constraint post_enti_lunghezza_allegato check (
    allegato_nome is null or (char_length(btrim(allegato_nome)) between 1 and 200)
  );

comment on column public.post_enti.link_esterno is
  '20261120100000: un link facoltativo su qualsiasi post (testo, immagine, file), di tutti i piani; solo https. Si apre fuori da KIREO, e l''etichetta del bottone la decide l''indirizzo. Era embed_url, il link del tipo link_social, uscito senza che nessun post l''avesse mai usato.';
comment on table public.post_enti is
  'Post di bacheca degli enti. Dal 20261113110000 si pubblicano subito (stato pubblicato) e KIREO può toglierli (tolto, con motivo, autore e data); approvato e rifiutato sono la storia di prima del 29/10. Cosa è visibile lo dice post_stato_visibile. Dal 20261120100000 i tipi sono testo, immagine e file, tutti di tutti i piani, ognuno con un link_esterno facoltativo; link_social resta nel tipo e nessun post nuovo può averlo.';

-- ============ le copie dei salvataggi ============
alter table public.post_salvati rename column link_url to link_esterno;
alter table public.post_salvati drop column link_titolo;
alter table public.post_salvati drop column link_riga;

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
    immagine_url, link_esterno, allegato_nome, pubblicato_il
  )
  select auth.uid(), p.id, p.istituzione_id, i.nome, p.tipo, p.corpo,
         p.immagine_url, p.link_esterno, p.allegato_nome, p.visibile_dal
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

-- La forma della risposta cambia: drop e create (un create or replace non può
-- cambiare le colonne di una returns table).
drop function public.post_salvati_miei();
create function public.post_salvati_miei()
returns table (
  salvataggio_id uuid,
  post_id uuid,
  ente_nome text,
  istituzione_slug text,
  tipo public.post_ente_tipo,
  corpo text,
  immagine_url text,
  link_esterno text,
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
         s.immagine_url, s.link_esterno, s.allegato_nome,
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

-- ============ si rilegge ============
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'post_enti'
               and column_name in ('embed_url', 'link_titolo', 'link_riga')) then
    raise exception 'rilettura: le colonne della scheda o embed_url sono ancora su post_enti';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'post_enti' and column_name = 'link_esterno') then
    raise exception 'rilettura: link_esterno non c''è';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'post_enti_contenuto_completo') then
    raise exception 'rilettura: il trigger della scheda è ancora lì';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'post_enti_link_esterno_https' and convalidated)
     or not exists (select 1 from pg_constraint where conname = 'post_enti_coerenza_tipo' and convalidated) then
    raise exception 'rilettura: i vincoli nuovi non sono validati';
  end if;
  if not has_column_privilege('authenticated', 'public.post_enti', 'link_esterno', 'INSERT')
     or not has_column_privilege('anon', 'public.post_enti', 'link_esterno', 'SELECT') then
    raise exception 'rilettura: link_esterno non è concesso';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'post_salvati'
               and column_name in ('link_url', 'link_titolo', 'link_riga')) then
    raise exception 'rilettura: le colonne vecchie sono ancora nei salvataggi';
  end if;
end $$;
