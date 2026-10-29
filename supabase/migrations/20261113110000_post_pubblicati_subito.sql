-- I POST DEGLI ENTI SI PUBBLICANO SUBITO, E KIREO PUÒ TOGLIERLI (29/10).
--
-- Decisione di Mario. Le parole nuove sono in 20261113100000; qui il resto. I
-- privilegi di lettura sono in 20261113120000, DOPO il deploy: il codice di
-- oggi legge `motivo_rifiuto` dalla tabella, e senza il privilegio la pagina
-- dell'ente fallirebbe nel minuto fra la migrazione e il deploy.
--
-- L'APPROVAZIONE FACEVA TRE LAVORI, NON UNO (Mario), e ognuno ha qui il suo
-- posto:
--   1. decideva COSA È VISIBILE: ora una funzione sola,
--      `post_stato_visibile`, da cui nasce la colonna generata `visibile`. La
--      policy pubblica, la Bacheca e i conteggi leggono quella, invece di
--      ripetere l'elenco degli stati (un elenco scritto in tre punti è un
--      elenco che un giorno sarà aggiornato in due);
--   2. dava LA DATA da cui la Bacheca ordina: ora `visibile_dal`, scritta dal
--      database. Per i due post di oggi è la loro data di approvazione,
--      copiata; per i nuovi è l'istante della pubblicazione. `approvato_il`
--      resta com'è, come storia: non si riusa con un significato nuovo, che
--      sarebbe il §3 applicato a una colonna invece che a una parola;
--   3. era IL FRENO SUL RITMO: una persona. Ora un tetto, 3 post per ente
--      nelle ultime 24 ore (vedi sotto, accanto alla regola).
--
-- ⚠️ LA POLICY DI INSERT FACEVA DUE LAVORI, separati da un AND (Mario): imporre
-- `in_approvazione` — quello che togliamo — e impedire a un ente free di
-- pubblicare un `link_social`. Riscrivere la policy per il primo si sarebbe
-- portato via il secondo senza accorgersene: la falla di `current_e_maggiorenne()`
-- (20261109100000) in un altro punto. Qui il controllo sul piano esce dalla
-- policy e diventa una regola sua, un trigger che vale per ogni strada (il
-- client, il SQL Editor, l'admin): `post_tipo_ammesso_dal_piano`. La tabella dei
-- soggetti è in `scripts/verifica-post-pubblicati.sql`.
--
-- ⚠️ PRIMA DI TUTTO, UNA MISURA: se esiste un post in coda (`in_approvazione`),
-- la migrazione si ferma. Dopo questa migrazione nessuna schermata li mostra
-- più, e restare in una coda che nessuno guarda è peggio di un rifiuto. Il
-- 29/10 Mario ha misurato 2 approvati e nient'altro.

do $$
declare
  v_in_coda int;
begin
  select count(*) into v_in_coda from public.post_enti where stato = 'in_approvazione';
  if v_in_coda > 0 then
    raise exception 'ci sono % post in approvazione: si decide prima cosa farne (select id, istituzione_id, created_at from public.post_enti where stato = ''in_approvazione'')', v_in_coda;
  end if;
end $$;

-- ============ 1. cosa è visibile, in un posto solo ============
create or replace function public.post_stato_visibile(p_stato public.post_ente_stato)
returns boolean
language sql
immutable
as $$
  select p_stato in ('approvato', 'pubblicato')
$$;

comment on function public.post_stato_visibile(public.post_ente_stato) is
  '20261113110000: l''unico posto che dice quali stati di un post sono visibili agli studenti. `approvato` (i post di prima del 29/10, guardati da una persona) e `pubblicato` (dopo). La colonna generata post_enti.visibile nasce da qui.';

alter table public.post_enti
  add column visibile boolean generated always as (public.post_stato_visibile(stato)) stored,
  add column visibile_dal timestamptz,
  add column motivo_rimozione text,
  add column tolto_il timestamptz,
  add column tolto_da uuid references public.profiles (id);

-- ============ 2. la data da cui ordina la Bacheca ============
-- I post visibili di oggi prendono la loro data di approvazione, che il
-- vincolo post_enti_approvato_con_data garantisce presente. Si conta: tutte le
-- righe visibili, o la migrazione si ferma.
do $$
declare
  v_visibili int;
  v_copiate int;
begin
  select count(*) into v_visibili from public.post_enti where visibile;
  update public.post_enti set visibile_dal = approvato_il where visibile and visibile_dal is null;
  get diagnostics v_copiate = row_count;
  if v_copiate <> v_visibili then
    raise exception 'visibile_dal copiata su % righe, ma i post visibili sono %', v_copiate, v_visibili;
  end if;
  if exists (select 1 from public.post_enti where visibile and visibile_dal is null) then
    raise exception 'resta un post visibile senza visibile_dal';
  end if;
end $$;

alter table public.post_enti
  add constraint post_enti_visibile_con_data
    check (not public.post_stato_visibile(stato) or visibile_dal is not null),
  -- Un post tolto porta sempre quando, chi e perché. «Nessuno» non è una
  -- risposta (la lezione della delega, 20261104110000): dal SQL Editor l'autore
  -- si scrive a mano, altrimenti il trigger qui sotto si ferma.
  add constraint post_enti_tolto_completo
    check (
      (stato = 'tolto') = (
        tolto_il is not null and tolto_da is not null
        and motivo_rimozione is not null and btrim(motivo_rimozione) <> ''
      )
    );

alter table public.post_enti alter column stato set default 'pubblicato';

comment on column public.post_enti.visibile_dal is
  'L''istante in cui il post è diventato visibile agli studenti, scritto dal database (20261113110000): la data di approvazione per i post di prima del 29/10, l''istante della pubblicazione dopo. La Bacheca si ordina su questa colonna.';
comment on column public.post_enti.approvato_il is
  'Storia: quando una persona di KIREO ha approvato il post (fino al 29/10). Dal 20261113110000 i post si pubblicano senza approvazione e nessuno la scrive più; l''ordine della Bacheca è visibile_dal.';
comment on column public.post_enti.motivo_rimozione is
  'Perché KIREO ha tolto il post. Obbligatoria quando stato = tolto. Non la legge mai il pubblico (20261113120000): la leggono l''admin e l''ente da motivi_post_enti.';

-- ============ i tempi: chi li scrive è il database ============
create or replace function public.tempi_post_enti()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- `created_at` conta per il tetto qui sotto: lo scrive il database.
    new.created_at := now();
    new.visibile_dal := case when public.post_stato_visibile(new.stato) then now() end;
    return new;
  end if;

  -- Un post tolto non torna visibile: se serve, l'ente lo ripubblica. ⚠️ Scelta
  -- mia, da confermare: riportarlo indietro vorrebbe dire una motivazione che
  -- resta su un post che si legge di nuovo.
  if old.stato = 'tolto' and new.stato is distinct from 'tolto' then
    raise exception 'post_tolto_non_torna';
  end if;

  if new.stato = 'tolto' and old.stato is distinct from 'tolto' then
    if not public.post_stato_visibile(old.stato) then
      raise exception 'post_non_visibile';
    end if;
    new.tolto_il := now();
    new.tolto_da := coalesce(auth.uid(), new.tolto_da);
    if new.tolto_da is null then
      raise exception 'autore_rimozione_mancante';
    end if;
  end if;

  if public.post_stato_visibile(new.stato) and not public.post_stato_visibile(old.stato) then
    new.visibile_dal := now();
  end if;
  return new;
end;
$$;

create trigger post_enti_tempi
  before insert or update on public.post_enti
  for each row execute function public.tempi_post_enti();

-- ============ 3. il tetto: 3 post per ente nelle ultime 24 ore ============
-- ⚠️ IL TETTO NON LIMITA QUANTO UN ENTE PUÒ SCRIVERE: LIMITA QUANTE VOLTE AL
-- GIORNO PUÒ INTERROMPERE LO STESSO STUDENTE (Mario, 29/10). Ogni pubblicazione
-- di un ente con un piano a pagamento manda una notifica a tutti i suoi
-- follower. È questa la cosa che misura se 3 è il numero giusto: le notifiche
-- che uno studente riceve da un ente in un giorno, non i post in Bacheca.
-- 3 è il numero che l'ente leggeva già («al massimo 3 post in attesa»): non è
-- una stretta nuova, è lo stesso numero con un orologio diverso.
-- Contano tutti i post nati nelle ultime 24 ore, anche quelli poi tolti: la
-- notifica di un post tolto è già partita.
-- Lo specchio in TypeScript è MAX_POST_NELLE_24_ORE (lib/ente/post.ts), e
-- `npm run test:bacheca` pretende lo stesso numero.
create or replace function public.max_post_nelle_24_ore()
returns integer
language sql
immutable
as $$
  select 3
$$;

create or replace function public.limite_post_nelle_24_ore()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_conteggio integer;
begin
  -- Due pubblicazioni contemporanee dello stesso ente si mettono in fila.
  perform pg_advisory_xact_lock(hashtext('post_enti:' || new.istituzione_id::text));
  select count(*) into v_conteggio
  from public.post_enti
  where istituzione_id = new.istituzione_id
    and created_at > now() - interval '24 hours';
  if v_conteggio >= public.max_post_nelle_24_ore() then
    raise exception 'troppi_post_nelle_24_ore';
  end if;
  return new;
end;
$$;

drop trigger if exists limite_post_in_approvazione on public.post_enti;
drop function if exists public.limite_post_in_approvazione();

create trigger limite_post_nelle_24_ore
  before insert on public.post_enti
  for each row execute function public.limite_post_nelle_24_ore();

-- ============ il controllo sul piano, come regola sua ============
-- Era il secondo lavoro della policy di insert (vedi la testa). Un trigger, e
-- non una clausola nella policy, perché vale per ogni strada e sopravvive alla
-- prossima riscrittura della policy.
create or replace function public.post_tipo_ammesso_dal_piano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'link_social' and not exists (
    select 1 from public.istituzioni i
    join public.piani p on p.id = i.piano_id
    where i.id = new.istituzione_id and p.nome <> 'free'
  ) then
    raise exception 'link_social_solo_piani_a_pagamento';
  end if;
  return new;
end;
$$;

create trigger post_enti_tipo_dal_piano
  before insert or update of tipo, istituzione_id on public.post_enti
  for each row execute function public.post_tipo_ammesso_dal_piano();

-- ============ le policy ============
drop policy if exists post_enti_insert_propria on public.post_enti;
create policy post_enti_insert_propria
  on public.post_enti for insert
  to authenticated
  with check (
    istituzione_id = public.current_istituzione_id()
    and stato = 'pubblicato'
    -- il piano per `link_social`: trigger post_enti_tipo_dal_piano
  );

drop policy if exists post_enti_select_pubblico_approvati on public.post_enti;
create policy post_enti_select_pubblico_visibili
  on public.post_enti for select
  to anon, authenticated
  using (visibile);

-- ============ le notifiche: ogni passaggio avvisa chi deve sapere ============
-- Sostituisce notifica_follower_post_approvato, che scattava solo su un UPDATE
-- verso «approvato»: un post pubblicato all'insert non avrebbe avvisato
-- nessuno (misurato sulla replica il 29/10).
--   - diventa visibile (insert, o un update da non visibile): i follower di un
--     ente con un piano a pagamento, come prima («Notifiche ai follower» nel
--     listino); all'insert anche ogni admin, che è il posto da cui si toglie;
--   - viene tolto: le persone dell'ente, che leggono il perché nella loro
--     Bacheca.
create or replace function public.notifiche_post_enti()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_divenuto_visibile boolean;
begin
  v_divenuto_visibile := public.post_stato_visibile(new.stato)
    and (tg_op = 'INSERT' or not public.post_stato_visibile(old.stato));

  if v_divenuto_visibile then
    if exists (
      select 1 from public.istituzioni i
      join public.piani p on p.id = i.piano_id
      where i.id = new.istituzione_id and p.nome <> 'free'
    ) then
      insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
      select s.student_id, 'nuovo_post', new.id
      from public.seguiti s
      where s.istituzione_id = new.istituzione_id;
    end if;
    if tg_op = 'INSERT' then
      insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
      select p.id, 'post_pubblicato', new.id
      from public.profiles p
      where p.ruolo = 'admin';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.stato = 'tolto' and old.stato is distinct from 'tolto' then
    insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
    select ip.user_id, 'post_tolto', new.id
    from public.institution_profiles ip
    where ip.istituzione_id = new.istituzione_id;
  end if;
  return new;
end;
$$;

drop trigger if exists notifica_follower_post_approvato on public.post_enti;
drop function if exists public.notifica_follower_post_approvato();

create trigger notifiche_post_enti
  after insert or update on public.post_enti
  for each row execute function public.notifiche_post_enti();

-- ============ togliere un post ============
-- Solo l'admin, con una motivazione, e solo un post visibile. Non cancella:
-- il post esce dal flusso e resta leggibile all'ente e all'admin. Il numero
-- delle notifiche già partite lo mostra la conferma prima del gesto
-- (components/admin/TogliPost.tsx).
create or replace function public.togli_post(p_post uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_toccate int;
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo_mancante';
  end if;
  update public.post_enti
     set stato = 'tolto', motivo_rimozione = btrim(p_motivo)
   where id = p_post and visibile;
  get diagnostics v_toccate = row_count;
  if v_toccate = 0 then
    raise exception 'post_non_visibile';
  end if;
end;
$$;

revoke all on function public.togli_post(uuid, text) from public, anon;
grant execute on function public.togli_post(uuid, text) to authenticated;

-- I due motivi (rifiuto e rimozione) li leggono solo l'admin e l'ente del
-- post. Una riga assente vuol dire «non tuo», non «senza motivo». Stessa forma
-- di note_revisione_eventi (20261101100000).
create or replace function public.motivi_post_enti(p_ids uuid[])
returns table (post_id uuid, motivo_rifiuto text, motivo_rimozione text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.motivo_rifiuto, p.motivo_rimozione
  from public.post_enti p
  where p.id = any(p_ids)
    and (
      public.current_ruolo() = 'admin'
      or p.istituzione_id = public.current_istituzione_id()
    )
$$;

revoke all on function public.motivi_post_enti(uuid[]) from public, anon;
grant execute on function public.motivi_post_enti(uuid[]) to authenticated;

comment on function public.motivi_post_enti(uuid[]) is
  '20261113110000: il motivo del rifiuto e quello della rimozione dei post chiesti, solo per l''admin e per l''ente del post.';

comment on table public.post_enti is
  'Post di bacheca degli enti. Dal 20261113110000 si pubblicano subito (stato pubblicato) e KIREO può toglierli (tolto, con motivo, autore e data); approvato e rifiutato sono la storia di prima del 29/10. Cosa è visibile lo dice post_stato_visibile. tipo = link_social solo con un piano a pagamento (trigger post_enti_tipo_dal_piano).';

-- ============ si rilegge ============
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'notifiche_post_enti' and not tgisinternal
                 and tgtype & 4 = 4 and tgtype & 16 = 16) then
    raise exception 'il trigger notifiche_post_enti non scatta su insert e update';
  end if;
  if exists (select 1 from pg_trigger where tgname in ('notifica_follower_post_approvato', 'limite_post_in_approvazione')) then
    raise exception 'un trigger vecchio dei post è ancora lì';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'post_enti_tipo_dal_piano' and not tgisinternal) then
    raise exception 'il controllo sul piano non è atterrato';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'post_enti' and policyname = 'post_enti_select_pubblico_visibili' and qual = 'visibile') then
    raise exception 'la policy pubblica non legge visibile';
  end if;
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'post_enti' and column_name = 'stato') not like '''pubblicato''%' then
    raise exception 'il valore di partenza di stato non è pubblicato';
  end if;
end $$;
