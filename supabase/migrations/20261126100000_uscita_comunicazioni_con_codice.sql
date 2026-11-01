-- L'USCITA DALLE COMUNICAZIONI DI KIREO VALE PER CHI HA RICEVUTO L'EMAIL (01/11).
--
-- Il caso, misurato da Mario: dal piè di pagina della newsletter di Davante,
-- arrivata a test11, «Disiscriviti dalle comunicazioni facoltative» ha scritto
-- `comunicazioni_kireo = false` su test7, l'account collegato in quel browser
-- (07:40:58 UTC). Nella stessa email «Non voglio più riceverla» aveva
-- funzionato: quella porta un codice legato all'iscrizione, questa si fidava
-- della sessione. Decisione di Mario: anche questo consenso viaggia con un
-- codice nel link, e la sessione non c'entra.
--
-- *Un link di disiscrizione dentro un'email vale per chi quell'email l'ha
-- ricevuta, chiunque sia collegato su quel telefono.* E chi non è collegato
-- non deve fare l'accesso per ritirare un consenso: ritirarlo deve essere
-- facile quanto darlo.
--
-- ⚠️ Il codice serve SOLO a ritirare. Dire sì da un link non si può: un sì vale
-- solo da maggiorenni (consenso_dato_da_maggiorenne), e lo dà la persona
-- collegata, dal profilo, sapendo chi è.
--
-- ⚠️ Il codice sta in una tabella sua, non in `profiles`, perché `profiles` la
-- leggono anche altri (l'ente nelle conversazioni, la scuola per i suoi
-- studenti): chi legge il codice di un altro può ritirargli il consenso. Il
-- client non legge e non scrive questa tabella; la leggono solo le funzioni,
-- eseguite dal server.

create table public.codici_consenso_kireo (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  codice uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint codici_consenso_codice_unico unique (codice)
);

comment on table public.codici_consenso_kireo is
  '20261126100000: il codice del link «Disiscriviti dalle comunicazioni facoltative» in fondo alle email a uno studente. Identifica chi ha ricevuto l''email, non chi è collegato. Solo per ritirare il consenso. Nessun accesso dal client.';

alter table public.codici_consenso_kireo enable row level security;
revoke all on table public.codici_consenso_kireo from public, anon, authenticated;

-- Ogni profilo ne ha uno: quelli di oggi qui, i nuovi dal trigger.
insert into public.codici_consenso_kireo (profile_id) select id from public.profiles
on conflict (profile_id) do nothing;

create or replace function public.crea_codice_consenso_kireo()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.codici_consenso_kireo (profile_id) values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end $$;
revoke execute on function public.crea_codice_consenso_kireo() from public, anon, authenticated;

create trigger profiles_codice_consenso_kireo
after insert on public.profiles
for each row execute function public.crea_codice_consenso_kireo();

-- Cosa dice la pagina: lo stato di oggi del consenso, e niente su chi sia.
-- Una riga se il codice c'è, nessuna se no. `consenso` è vero/falso/NULL (mai
-- chiesto), come la colonna.
create or replace function public.consenso_kireo_con_codice_info(p_codice uuid)
returns table (consenso boolean)
language sql stable security definer set search_path = public as $$
  select p.comunicazioni_kireo
    from public.codici_consenso_kireo c join public.profiles p on p.id = c.profile_id
   where c.codice = p_codice
$$;
revoke execute on function public.consenso_kireo_con_codice_info(uuid) from public, anon, authenticated;
grant execute on function public.consenso_kireo_con_codice_info(uuid) to service_role;

-- Il ritiro: `false` con la data del server, sul profilo del codice. Vero se ha
-- toccato una riga, falso se il codice non corrisponde a niente.
create or replace function public.ritira_consenso_kireo_con_codice(p_codice uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.profiles p
     set comunicazioni_kireo = false, comunicazioni_kireo_il = now()
    from public.codici_consenso_kireo c
   where c.codice = p_codice and p.id = c.profile_id;
  get diagnostics v = row_count;
  return v = 1;
end $$;
revoke execute on function public.ritira_consenso_kireo_con_codice(uuid) from public, anon, authenticated;
grant execute on function public.ritira_consenso_kireo_con_codice(uuid) to service_role;

-- La coda della newsletter porta anche il codice del consenso, per il piè di
-- pagina. Cambia la forma del ritorno: drop e create, con gli stessi permessi.
-- Il corpo è quello di 20261117110000, con la colonna in più in fondo.
drop function public.newsletter_da_inviare(date, integer);
create function public.newsletter_da_inviare(p_oggi date, p_limite integer)
returns table (consegna_id uuid, email text, nome text, oggetto text, corpo text, ente_nome text,
               codice_uscita uuid, newsletter_id uuid, codice_consenso uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  update public.newsletter_consegne c set stato = 'scaduta'
    from public.newsletter_enti n
   where n.id = c.newsletter_id and c.stato in ('da_inviare', 'fallita')
     and (n.ultimo_giorno < p_oggi
          or not exists (select 1 from public.newsletter_iscrizioni ni join public.profiles p on p.id = ni.student_id
                          where ni.student_id = c.student_id and ni.istituzione_id = n.istituzione_id
                            and public.consenso_dato_da_maggiorenne(ni.created_at, p.data_nascita)));

  return query
  with scelte as (
    select distinct on (c.student_id) c.id
      from public.newsletter_consegne c
      join public.newsletter_enti n on n.id = c.newsletter_id
     where c.stato in ('da_inviare', 'fallita')
       and not exists (select 1 from public.newsletter_consegne o
                        where o.student_id = c.student_id and o.tentata_giorno = p_oggi)
     order by c.student_id, n.giorno, n.approvata_il, n.id
     limit greatest(p_limite, 0)
  ), segnate as (
    update public.newsletter_consegne c set tentata_il = now(), tentata_giorno = p_oggi, tentativi = c.tentativi + 1
      from scelte s where c.id = s.id
    returning c.id, c.student_id, c.newsletter_id
  )
  select s.id, u.email::text, p.nome, n.oggetto, n.corpo, i.nome, ni.codice_uscita, n.id, cc.codice
    from segnate s
    join public.newsletter_enti n on n.id = s.newsletter_id
    join public.istituzioni i on i.id = n.istituzione_id
    join public.profiles p on p.id = s.student_id
    join auth.users u on u.id = s.student_id
    join public.newsletter_iscrizioni ni on ni.student_id = s.student_id and ni.istituzione_id = n.istituzione_id
    -- LEFT: una consegna già segnata come tentata non deve sparire dal ritorno
    -- per un codice che manca (resterebbe tentata e mai spedita, in silenzio).
    -- Il codice c'è per ogni profilo (trigger e rilettura); se mancasse, il
    -- motore manda il link generico e lo registra come guasto.
    left join public.codici_consenso_kireo cc on cc.profile_id = s.student_id;
end $$;
revoke execute on function public.newsletter_da_inviare(date, integer) from public, anon, authenticated;
grant execute on function public.newsletter_da_inviare(date, integer) to service_role;

-- La rilettura.
do $$
begin
  if exists (select 1 from public.profiles p where not exists (select 1 from public.codici_consenso_kireo c where c.profile_id = p.id)) then
    raise exception 'rilettura: un profilo senza codice delle comunicazioni';
  end if;
  if has_table_privilege('authenticated', 'public.codici_consenso_kireo', 'SELECT')
     or has_table_privilege('anon', 'public.codici_consenso_kireo', 'SELECT')
     or has_table_privilege('authenticated', 'public.codici_consenso_kireo', 'INSERT') then
    raise exception 'rilettura: il client legge o scrive i codici delle comunicazioni';
  end if;
  if has_function_privilege('anon', 'public.ritira_consenso_kireo_con_codice(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.ritira_consenso_kireo_con_codice(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.newsletter_da_inviare(date, integer)', 'execute') then
    raise exception 'rilettura: le funzioni del codice sono eseguibili dal client';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'profiles_codice_consenso_kireo') then
    raise exception 'rilettura: manca il trigger dei codici';
  end if;
end $$;
