-- I POST DI UN ENTE NELLA PAGINA DI UN'AREA (Mario, 31/10).
--
-- Un post può portare fino a 2 aree, solo fra quelle che KIREO ha APPROVATO
-- per quell'ente, e compare nella pagina di quell'area anche a chi non segue
-- l'ente. La quota non cambia (3 post ogni 24 ore).
--
-- PERCHÉ SOLO LE APPROVATE (Mario): un'area in attesa di revisione è una
-- richiesta, non un fatto. Se un post potesse entrare in un'area non ancora
-- approvata, l'ente otterrebbe pubblicando quello che non ha ancora ottenuto
-- chiedendo, e la revisione delle aree diventerebbe aggirabile. La regola sta
-- qui (un trigger, su ogni strada) e non solo nel modulo.
--
-- ⚠️ UN'AREA REVOCATA DOPO. Misurato nel codice il 31/10: un'area approvata
-- torna indietro in due modi — l'ente la toglie dal profilo (una DELETE della
-- riga, `ProfiloEnteForm`, policy istituzioni_aree_delete_propria) o KIREO la
-- riporta a `rifiutata` (oggi solo dal SQL Editor: non esiste una schermata
-- che approvi o rifiuti le aree). Né l'una né l'altra toccano i post.
-- Decisione di Mario: il post esce dalla pagina dell'area e resta nella
-- bacheca dell'ente — è l'area a essere stata revocata, non il post a essere
-- sbagliato. Per questo la colonna NON si ripulisce: la pagina dell'area
-- mostra un post solo se, AL MOMENTO DELLA LETTURA, l'area è ancora approvata
-- per quell'ente (lib/app/postArea.ts). Una regola letta, non una scrittura:
-- se l'area torna approvata, il post torna, e nessun trigger deve ricordarselo.
-- Il trigger qui sotto guarda solo il momento in cui il post nasce.

alter table public.post_enti
  add column aree text[] not null default '{}';

alter table public.post_enti
  add constraint post_enti_al_massimo_due_aree check (cardinality(aree) <= 2);

comment on column public.post_enti.aree is
  '20261121100000: le aree (slug) nella cui pagina il post compare, al massimo 2, solo fra le aree approvate dell''ente quando il post nasce (trigger post_enti_aree_approvate). Si mostra solo finché l''area resta approvata: la regola sta nella lettura, la colonna non si ripulisce.';

create or replace function public.post_enti_aree_approvate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_area text;
begin
  if cardinality(new.aree) > 2 then
    raise exception 'troppe_aree_post';
  end if;
  if cardinality(new.aree) <> (select count(distinct a) from unnest(new.aree) a) then
    raise exception 'area_post_ripetuta';
  end if;
  foreach v_area in array new.aree loop
    if not exists (
      select 1 from public.istituzioni_aree ia
      where ia.istituzione_id = new.istituzione_id
        and ia.area_slug = v_area
        and ia.stato = 'approvata'
    ) then
      raise exception 'area_post_non_approvata';
    end if;
  end loop;
  return new;
end;
$$;

create trigger post_enti_aree_approvate
before insert or update of aree on public.post_enti
for each row execute function public.post_enti_aree_approvate();

create index post_enti_aree_idx on public.post_enti using gin (aree);

-- L'ente la scrive all'insert (CreaPostForm); tutti la leggono, come il resto
-- delle colonne pubbliche del post (20261113120000).
-- ⚠️ È UNA COLONNA IN PIÙ APERTA AL CLIENT: il tetto del registro
-- (supabase/colonne-del-client.json) sale da 190 a 191 nello stesso commit,
-- per questa ragione e per nessun'altra.
grant insert (aree) on public.post_enti to authenticated;
grant select (aree) on public.post_enti to anon, authenticated;

do $$
begin
  if not has_column_privilege('authenticated', 'public.post_enti', 'aree', 'INSERT') then
    raise exception 'le aree di un post non si scrivono dal client';
  end if;
  if not has_column_privilege('anon', 'public.post_enti', 'aree', 'SELECT') then
    raise exception 'le aree di un post non si leggono senza accesso';
  end if;
  if has_column_privilege('authenticated', 'public.post_enti', 'aree', 'UPDATE') then
    raise exception 'le aree di un post si aggiornano dal client';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'post_enti_aree_approvate') then
    raise exception 'il trigger delle aree approvate non c''è';
  end if;
end $$;
