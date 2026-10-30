-- La newsletter degli enti: i piani a due, l'approvazione, la coda dello
-- studente, l'invio una riga per destinatario, l'uscita dalla posta (30/10).
--
-- ⚠️ DA APPLICARE PRIMA DEL DEPLOY, e DOPO 20261117100000 (le parole). Il
-- codice nuovo chiama queste funzioni; con la migrazione applicata il codice di
-- prima funziona come oggi (non legge niente di nuovo).
--
-- ═══ LE REGOLE, TUTTE IN UN POSTO ═══
--   per ente      1 al mese (del giorno scelto), più il tetto del piano per anno
--                 accademico (settembre → agosto): 3 free, 12 premium.
--   per KIREO     al massimo 5 newsletter con lo stesso giorno di partenza.
--   per studente  al massimo 1 email di newsletter al giorno; le altre in coda.
--   il posto      si prende con «Manda in approvazione» (in_approvazione,
--                 approvata, inviata occupano il giorno) e si libera con un
--                 rifiuto. Spostare la data su un giorno pieno è respinto.
--   il testo      dopo l'approvazione non si cambia senza una nuova lettura:
--                 cambiare una parola la riporta in approvazione (il posto
--                 resta). Spostare il giorno no: non cambia quello che l'admin
--                 ha letto.
--
-- ═══ LA SCADENZA, E PERCHÉ NON BASTA LA CODA ═══
-- L'ente dice fino a quando la newsletter vale: di partenza 3 giorni, cioè il
-- giorno scelto e i due successivi. Nel form il consiglio è «per un evento,
-- manda almeno 4 giorni prima». ⚠️ I due numeri sono legati, e non come
-- sembra: NON è la coda a garantire che arrivi prima dell'evento. Ogni giorno
-- possono entrare nella coda di uno studente fino a 5 newsletter e ne esce una,
-- quindi la coda si può allungare senza limite. Garantisce solo la SCADENZA:
-- una newsletter arriva entro la sua finestra o non arriva per email. Con 4
-- giorni di anticipo e 3 di validità l'ultimo giorno possibile è due giorni
-- prima dell'evento. Chi cambia uno dei due valori rifà questo conto.
-- (La versione di prima, «4 + 3 garantisce l'arrivo», era sbagliata: non la
-- garantiva niente.)
--
-- ═══ I DUE CANALI ═══
-- La notifica dentro KIREO arriva a tutti i destinatari il giorno scelto,
-- senza coda: non è invadente e non riempie niente. L'email passa dalla coda.
-- Quindi «non l'ha ricevuta» si dice sempre «per email».
--
-- ═══ CHI LA RICEVE, E COSA NON PUÒ RICEVERLA ═══
-- I destinatari si leggono SOLO da `newsletter_iscrizioni`, con il cancello
-- dell'età: `consenso_dato_da_maggiorenne(iscrizione.created_at, data_nascita)`
-- — era maggiorenne quando si è iscritto. Mai il ruolo di oggi. Per
-- costruzione quindi:
--   * l'indirizzo di chi scarica una guida senza accesso non è raggiungibile:
--     non lo salviamo in nessuna tabella (lib/guide/scaricamento.ts);
--   * `comunicazioni`, con la newsletter approvata del 18/10, non la legge
--     nessuno: il motore nasce su una tabella sua (vedi 20261108100000).
-- Al momento dell'email si ricontrolla che l'iscrizione ci sia ancora: chi
-- esce dalla newsletter non riceve quelle già in coda.
--
-- ═══ UNA RIGA PER DESTINATARIO ═══
-- Il nostro codice manda una chiamata a Brevo per destinatario: un invio è
-- centinaia di cose che possono fallire una per una, e l'unica forma che regge
-- è che ognuna sappia da sola a che punto è. `newsletter_consegne`:
-- da_inviare · inviata · fallita · scaduta. Un invio che si ferma a metà (il
-- tetto di Brevo finito, una funzione che scade) riprende al giro dopo, non
-- rimanda niente due volte, e non dice «inviata a 120» se 40 sono fallite.
-- Una consegna fallita si riprova il giorno dopo, finché è nella finestra.

-- ═══ 1. I PIANI DIVENTANO DUE ═══
-- Mario (30/10): solo free e premium. Prima di togliere il plus si guarda chi
-- lo usa: se un ente ci fosse sopra, il suo piano smetterebbe di esistere
-- mentre lo sta usando. Si FERMA a voce alta, non decide da sola.
do $$
declare
  v_plus uuid;
  v_enti int;
  v_richieste int;
begin
  select id into v_plus from public.piani where nome = 'plus';
  if v_plus is not null then
    select count(*) into v_enti from public.istituzioni where piano_id = v_plus;
    select count(*) into v_richieste from public.richieste_upgrade where piano_richiesto_id = v_plus;
    if v_enti > 0 or v_richieste > 0 then
      raise exception 'piano plus ancora in uso: % enti, % richieste di upgrade. Nessuna modifica fatta.', v_enti, v_richieste;
    end if;
    delete from public.piani where id = v_plus;
  end if;
end $$;

-- Il valore dell'enum resta: un tipo con una storia non perde una parola. Il
-- vincolo dice che una riga di piano può essere solo free o premium.
alter table public.piani add constraint piani_solo_due check (nome in ('free', 'premium'));

-- Le tre newsletter gratuite sono l'assaggio (Mario): «mi serve all'inizio
-- dare possibilità agli enti di entrare gratis e capirne le potenzialità».
do $$
declare v int;
begin
  update public.piani set quota_newsletter = 3 where nome = 'free';
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'quota del piano free: aggiornate % righe invece di 1', v; end if;
end $$;

-- ═══ 2. LE COSTANTI ═══
create or replace function public.max_newsletter_al_giorno() returns integer
language sql immutable as $$ select 5 $$;
create or replace function public.giorni_validita_newsletter() returns integer
language sql immutable as $$ select 3 $$;
comment on function public.giorni_validita_newsletter() is
  'Di partenza una newsletter vale 3 giorni: quello scelto e i due successivi. Legata al consiglio «manda almeno 4 giorni prima» (lib/newsletter/regole.ts): vedi la testa di 20261117110000.';

-- Il giorno in Italia, non in UTC: l'invio parte alle 7:30 ora italiana.
create or replace function public.oggi_in_italia() returns date
language sql stable as $$ select (now() at time zone 'Europe/Rome')::date $$;

-- L'inizio dell'anno accademico che contiene un giorno (settembre → agosto),
-- lo stesso conto di `annoAccademicoCorrente` (lib/ente/quote.ts).
create or replace function public.inizio_anno_accademico(p_giorno date) returns date
language sql immutable as $$
  select make_date(case when extract(month from p_giorno) >= 9 then extract(year from p_giorno)::int
                        else extract(year from p_giorno)::int - 1 end, 9, 1)
$$;

-- ═══ 3. LE TABELLE ═══
create table public.newsletter_enti (
  id uuid primary key default gen_random_uuid(),
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  oggetto text not null,
  corpo text not null,
  giorno date not null,
  ultimo_giorno date not null,
  stato text not null default 'bozza'
    check (stato in ('bozza', 'in_approvazione', 'approvata', 'rifiutata', 'inviata')),
  nota_revisione text,
  approvata_il timestamptz,
  -- Chi ha approvato: una colonna di responsabilità, blocca la cancellazione
  -- dell'account come le altre (vedi «La politica sulla cancellazione»).
  approvata_da uuid references public.profiles (id),
  inviata_il timestamptz,
  destinatari integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_enti_finestra check (ultimo_giorno >= giorno and ultimo_giorno <= giorno + 13),
  constraint newsletter_enti_rifiuto_motivato check (stato <> 'rifiutata' or length(btrim(coalesce(nota_revisione, ''))) > 0),
  constraint newsletter_enti_approvata_completa check (stato not in ('approvata', 'inviata') or approvata_il is not null)
);

comment on table public.newsletter_enti is
  'Le newsletter degli enti, dal 30/10 (20261117110000). Il motore legge solo questa tabella e mai `comunicazioni`. Il client la legge (l''ente le sue, l''admin tutte) e non la scrive: ogni scrittura passa da salva_newsletter / decidi_newsletter.';

create index newsletter_enti_giorno_idx on public.newsletter_enti (giorno) where stato in ('in_approvazione', 'approvata', 'inviata');
create index newsletter_enti_istituzione_idx on public.newsletter_enti (istituzione_id, giorno);

alter table public.newsletter_enti enable row level security;
revoke insert, update, delete on public.newsletter_enti from anon, authenticated;

create policy newsletter_enti_select_propria
  on public.newsletter_enti for select to authenticated
  using (istituzione_id = public.current_istituzione_id());
create policy newsletter_enti_select_admin
  on public.newsletter_enti for select to authenticated
  using (public.current_ruolo() = 'admin');

create table public.newsletter_consegne (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.newsletter_enti (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  stato text not null default 'da_inviare' check (stato in ('da_inviare', 'inviata', 'fallita', 'scaduta')),
  tentativi integer not null default 0,
  tentata_il timestamptz,
  -- Il giorno (italiano) del giro che l'ha presa: è lui a dire «oggi questo
  -- studente ha già avuto la sua email», non l'ora del server.
  tentata_giorno date,
  inviata_il timestamptz,
  ultimo_errore text,
  created_at timestamptz not null default now(),
  constraint newsletter_consegne_unica unique (newsletter_id, student_id),
  constraint newsletter_consegne_inviata_con_data check (stato <> 'inviata' or inviata_il is not null)
);

comment on table public.newsletter_consegne is
  'Una riga per destinatario di una newsletter (20261117110000): l''email ha uno stato suo. Lo studente legge le sue; nessuno la scrive dal client.';

create index newsletter_consegne_da_fare_idx on public.newsletter_consegne (student_id) where stato in ('da_inviare', 'fallita');

alter table public.newsletter_consegne enable row level security;
revoke insert, update, delete on public.newsletter_consegne from anon, authenticated;
create policy newsletter_consegne_select_own
  on public.newsletter_consegne for select to authenticated
  using (student_id = auth.uid());

-- Il codice nel link di uscita: dalla posta non si è collegati. Il client non
-- lo scrive (nasce dal valore di partenza).
alter table public.newsletter_iscrizioni
  add column codice_uscita uuid not null default gen_random_uuid();
alter table public.newsletter_iscrizioni
  add constraint newsletter_iscrizioni_codice_unico unique (codice_uscita);

-- ═══ 4. I GIORNI PIENI ═══
-- Il form li legge PRIMA del clic: «Giovedì 5: completo».
create or replace function public.giorni_newsletter_pieni(p_da date, p_a date)
returns table (giorno date, occupati integer)
language sql stable security definer set search_path = public as $$
  select n.giorno, count(*)::int
    from public.newsletter_enti n
   where n.stato in ('in_approvazione', 'approvata', 'inviata')
     and n.giorno between p_da and least(p_a, p_da + 120)
   group by n.giorno
  having count(*) >= public.max_newsletter_al_giorno()
$$;
revoke execute on function public.giorni_newsletter_pieni(date, date) from public, anon;
grant execute on function public.giorni_newsletter_pieni(date, date) to authenticated;

-- ═══ 5. L'ENTE SALVA, MANDA IN APPROVAZIONE, SPOSTA ═══
-- Una funzione sola per tutte le strade dell'ente: le regole dei posti si
-- controllano in un punto, e una strada nuova non nasce senza.
create or replace function public.salva_newsletter(
  p_id uuid, p_oggetto text, p_corpo text, p_giorno date, p_ultimo_giorno date, p_manda boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ist uuid := public.current_istituzione_id();
  r public.newsletter_enti;
  v_oggetto text := btrim(coalesce(p_oggetto, ''));
  v_corpo text := btrim(coalesce(p_corpo, ''));
  v_ultimo date := coalesce(p_ultimo_giorno, p_giorno + public.giorni_validita_newsletter() - 1);
  v_stato text;
  v_testo_cambiato boolean := true;
  v_occupa boolean;
  v_n int;
  v_quota int;
begin
  if v_ist is null then raise exception 'non_autorizzato'; end if;
  if length(v_oggetto) = 0 or length(v_oggetto) > 150 then raise exception 'oggetto_non_valido'; end if;
  if length(v_corpo) < 20 or length(v_corpo) > 10000 then raise exception 'corpo_non_valido'; end if;
  if p_giorno is null or p_giorno <= public.oggi_in_italia() then raise exception 'giorno_passato'; end if;
  if v_ultimo < p_giorno or v_ultimo > p_giorno + 13 then raise exception 'scadenza_non_valida'; end if;

  -- Un posto alla volta per giorno, e un ente alla volta: due enti che
  -- prendono l'ultimo posto dello stesso giorno non passano tutti e due.
  perform pg_advisory_xact_lock(hashtext('newsletter_giorno'), (p_giorno - date '2000-01-01'));
  perform pg_advisory_xact_lock(hashtext('newsletter_ente'), hashtext(v_ist::text));

  if p_id is not null then
    select * into r from public.newsletter_enti where id = p_id and istituzione_id = v_ist for update;
    if not found then raise exception 'non_autorizzato'; end if;
    if r.stato = 'inviata' then raise exception 'gia_inviata'; end if;
    if r.stato in ('approvata', 'in_approvazione') and r.giorno <= public.oggi_in_italia() then
      raise exception 'gia_partita';
    end if;
    v_testo_cambiato := r.oggetto is distinct from v_oggetto or r.corpo is distinct from v_corpo;
  end if;

  v_stato := case
    when p_id is null then case when p_manda then 'in_approvazione' else 'bozza' end
    when r.stato = 'approvata' and not v_testo_cambiato then 'approvata'
    when r.stato = 'approvata' then 'in_approvazione'
    when r.stato = 'in_approvazione' then 'in_approvazione'
    when p_manda then 'in_approvazione'
    else 'bozza'
  end;
  v_occupa := v_stato in ('in_approvazione', 'approvata');

  if v_occupa then
    select count(*) into v_n from public.newsletter_enti
     where giorno = p_giorno and stato in ('in_approvazione', 'approvata', 'inviata') and id is distinct from p_id;
    if v_n >= public.max_newsletter_al_giorno() then raise exception 'giorno_completo'; end if;

    select count(*) into v_n from public.newsletter_enti
     where istituzione_id = v_ist and stato in ('in_approvazione', 'approvata', 'inviata') and id is distinct from p_id
       and date_trunc('month', giorno) = date_trunc('month', p_giorno);
    if v_n >= 1 then raise exception 'una_al_mese'; end if;

    select p.quota_newsletter into v_quota from public.istituzioni i join public.piani p on p.id = i.piano_id where i.id = v_ist;
    select count(*) into v_n from public.newsletter_enti
     where istituzione_id = v_ist and stato in ('in_approvazione', 'approvata', 'inviata') and id is distinct from p_id
       and public.inizio_anno_accademico(giorno) = public.inizio_anno_accademico(p_giorno);
    if v_n >= coalesce(v_quota, 0) then raise exception 'quota_piano'; end if;
  end if;

  if p_id is null then
    insert into public.newsletter_enti (istituzione_id, oggetto, corpo, giorno, ultimo_giorno, stato)
    values (v_ist, v_oggetto, v_corpo, p_giorno, v_ultimo, v_stato)
    returning * into r;
  else
    update public.newsletter_enti
       set oggetto = v_oggetto, corpo = v_corpo, giorno = p_giorno, ultimo_giorno = v_ultimo, stato = v_stato,
           nota_revisione = case when v_stato = 'approvata' then nota_revisione when v_stato = 'bozza' and r.stato = 'rifiutata' then nota_revisione else null end,
           approvata_il = case when v_stato = 'approvata' then approvata_il else null end,
           approvata_da = case when v_stato = 'approvata' then approvata_da else null end,
           updated_at = now()
     where id = p_id
     returning * into r;
  end if;

  return jsonb_build_object('id', r.id, 'stato', r.stato, 'riletta', r.stato = 'in_approvazione' and p_id is not null and v_testo_cambiato);
end $$;
revoke execute on function public.salva_newsletter(uuid, text, text, date, date, boolean) from public, anon;
grant execute on function public.salva_newsletter(uuid, text, text, date, date, boolean) to authenticated;

-- ═══ 6. L'ADMIN DECIDE ═══
create or replace function public.decidi_newsletter(p_id uuid, p_approva boolean, p_nota text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.newsletter_enti;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  if public.current_ruolo() is distinct from 'admin' then raise exception 'non_autorizzato'; end if;
  select * into r from public.newsletter_enti where id = p_id for update;
  if not found then raise exception 'non_trovata'; end if;
  if r.stato <> 'in_approvazione' then raise exception 'non_in_approvazione'; end if;
  if p_approva then
    if r.giorno <= public.oggi_in_italia() then raise exception 'giorno_passato'; end if;
    update public.newsletter_enti
       set stato = 'approvata', nota_revisione = v_nota, approvata_il = now(), approvata_da = auth.uid(), updated_at = now()
     where id = p_id returning * into r;
  else
    if v_nota is null then raise exception 'motivo_mancante'; end if;
    update public.newsletter_enti
       set stato = 'rifiutata', nota_revisione = v_nota, updated_at = now()
     where id = p_id returning * into r;
  end if;
  return jsonb_build_object('id', r.id, 'stato', r.stato, 'istituzione_id', r.istituzione_id);
end $$;
revoke execute on function public.decidi_newsletter(uuid, boolean, text) from public, anon;
grant execute on function public.decidi_newsletter(uuid, boolean, text) to authenticated;

-- ═══ 7. L'AVVISO ALL'ENTE, SUL POSTO ═══
-- Fino al 30/10 l'ente non riceveva NIENTE quando un suo evento veniva
-- approvato: lo scopriva riaprendo la pagina. Un trigger sul cambio di stato
-- vale da qualunque strada (la coda, il SQL Editor). L'email la manda il
-- server dopo la decisione (lib/ente/avvisoDecisione.ts), con lo stesso testo
-- per gli eventi e le newsletter.
create or replace function public.avvisa_ente_della_decisione()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ist uuid;
  v_tipo public.notifica_tipo;
begin
  if new.stato is not distinct from old.stato then return new; end if;
  if tg_table_name = 'eventi' then
    v_ist := new.organizzatore_id;
    v_tipo := case new.stato::text when 'approvato' then 'evento_approvato'::public.notifica_tipo
                                   when 'rifiutato' then 'evento_rifiutato'::public.notifica_tipo end;
  else
    v_ist := new.istituzione_id;
    v_tipo := case new.stato when 'approvata' then 'newsletter_approvata'::public.notifica_tipo
                             when 'rifiutata' then 'newsletter_rifiutata'::public.notifica_tipo end;
  end if;
  if v_tipo is null or v_ist is null then return new; end if;
  insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
  select ip.user_id, v_tipo, new.id from public.institution_profiles ip where ip.istituzione_id = v_ist;
  return new;
end $$;
revoke execute on function public.avvisa_ente_della_decisione() from public, anon, authenticated;

create trigger eventi_avvisa_ente
after update of stato on public.eventi
for each row execute function public.avvisa_ente_della_decisione();
create trigger newsletter_avvisa_ente
after update of stato on public.newsletter_enti
for each row execute function public.avvisa_ente_della_decisione();

-- ═══ 8. IL GIORNO DELLA PARTENZA ═══
-- Chiamata dal cron (service_role) alle 7:30 italiane. Per ogni newsletter
-- approvata il cui giorno è arrivato: una consegna per destinatario, una
-- notifica dentro KIREO per tutti, e lo stato «inviata». Le consegne nate
-- quando la finestra è già chiusa (un cron saltato) nascono «scaduta».
create or replace function public.prepara_newsletter_del_giorno(p_oggi date)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n record;
  v_tot int := 0;
  v_dest int;
begin
  for n in
    select * from public.newsletter_enti where stato = 'approvata' and giorno <= p_oggi for update
  loop
    insert into public.newsletter_consegne (newsletter_id, student_id, stato)
    select n.id, ni.student_id, case when n.ultimo_giorno < p_oggi then 'scaduta' else 'da_inviare' end
      from public.newsletter_iscrizioni ni
      join public.profiles p on p.id = ni.student_id
     where ni.istituzione_id = n.istituzione_id
       and public.consenso_dato_da_maggiorenne(ni.created_at, p.data_nascita)
    on conflict (newsletter_id, student_id) do nothing;

    select count(*) into v_dest from public.newsletter_consegne where newsletter_id = n.id;

    insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
    select c.student_id, 'newsletter_ente'::public.notifica_tipo, n.id
      from public.newsletter_consegne c
     where c.newsletter_id = n.id
       and not exists (select 1 from public.notifiche_studenti s
                        where s.student_id = c.student_id and s.tipo = 'newsletter_ente' and s.riferimento_id = n.id);

    update public.newsletter_enti set stato = 'inviata', inviata_il = now(), destinatari = v_dest, updated_at = now()
     where id = n.id;
    v_tot := v_tot + 1;
  end loop;
  return v_tot;
end $$;
revoke execute on function public.prepara_newsletter_del_giorno(date) from public, anon, authenticated;
grant execute on function public.prepara_newsletter_del_giorno(date) to service_role;

-- ═══ 9. LA CODA DELLO STUDENTE ═══
-- Le email del giorno: al più una per studente. Prima si chiude quello che è
-- scaduto (o il cui destinatario è uscito, o non ha più un consenso valido),
-- poi a ogni studente che oggi non ha ancora avuto un tentativo si assegna la
-- più vecchia ancora valida, e la si segna «tentata» nella stessa istruzione:
-- due giri lo stesso giorno non la prendono due volte.
create or replace function public.newsletter_da_inviare(p_oggi date, p_limite integer)
returns table (consegna_id uuid, email text, nome text, oggetto text, corpo text, ente_nome text,
               codice_uscita uuid, newsletter_id uuid)
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
  select s.id, u.email::text, p.nome, n.oggetto, n.corpo, i.nome, ni.codice_uscita, n.id
    from segnate s
    join public.newsletter_enti n on n.id = s.newsletter_id
    join public.istituzioni i on i.id = n.istituzione_id
    join public.profiles p on p.id = s.student_id
    join auth.users u on u.id = s.student_id
    join public.newsletter_iscrizioni ni on ni.student_id = s.student_id and ni.istituzione_id = n.istituzione_id;
end $$;
revoke execute on function public.newsletter_da_inviare(date, integer) from public, anon, authenticated;
grant execute on function public.newsletter_da_inviare(date, integer) to service_role;

create or replace function public.segna_consegna_newsletter(p_id uuid, p_ok boolean, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.newsletter_consegne
     set stato = case when p_ok then 'inviata' else 'fallita' end,
         inviata_il = case when p_ok then now() else inviata_il end,
         ultimo_errore = case when p_ok then null else left(p_motivo, 300) end
   where id = p_id and stato in ('da_inviare', 'fallita');
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'consegna_non_trovata'; end if;
end $$;
revoke execute on function public.segna_consegna_newsletter(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.segna_consegna_newsletter(uuid, boolean, text) to service_role;

-- ═══ 10. COM'È ANDATA, PER L'ENTE E PER L'ADMIN ═══
-- Solo conteggi, mai chi.
create or replace function public.esito_newsletter(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_ist uuid;
begin
  select istituzione_id into v_ist from public.newsletter_enti where id = p_id;
  if v_ist is null then return null; end if;
  if public.current_ruolo() is distinct from 'admin' and v_ist is distinct from public.current_istituzione_id() then
    return null;
  end if;
  return (select jsonb_build_object(
      'destinatari', count(*),
      'inviate', count(*) filter (where stato = 'inviata'),
      'in_coda', count(*) filter (where stato = 'da_inviare'),
      'fallite', count(*) filter (where stato = 'fallita'),
      'scadute', count(*) filter (where stato = 'scaduta'))
    from public.newsletter_consegne where newsletter_id = p_id);
end $$;
revoke execute on function public.esito_newsletter(uuid) from public, anon;
grant execute on function public.esito_newsletter(uuid) to authenticated;

-- ═══ 11. LA NEWSLETTER DENTRO KIREO, PER CHI L'HA RICEVUTA ═══
create or replace function public.newsletter_per_me(p_id uuid)
returns table (oggetto text, corpo text, ente_nome text, ente_slug text, giorno date)
language sql stable security definer set search_path = public as $$
  select n.oggetto, n.corpo, i.nome, i.slug, n.giorno
    from public.newsletter_consegne c
    join public.newsletter_enti n on n.id = c.newsletter_id
    join public.istituzioni i on i.id = n.istituzione_id
   where c.newsletter_id = p_id and c.student_id = auth.uid()
$$;
revoke execute on function public.newsletter_per_me(uuid) from public, anon;
grant execute on function public.newsletter_per_me(uuid) to authenticated;

-- ═══ 12. L'USCITA DALLA POSTA ═══
-- Il codice dice quale iscrizione, e niente di più: la pagina mostra solo il
-- nome dell'ente. ⚠️ La pagina NON disiscrive aprendosi: i filtri antispam
-- aprono i link da soli. Si esce premendo un bottone (o con la POST di
-- `List-Unsubscribe-Post`, che un filtro non manda).
-- Le due funzioni le chiama SOLO il server (la pagina e la route, con la
-- service role): chi non ha fatto l'accesso non le esegue dal client, e dalla
-- richiesta arriva solo il codice, che la funzione ricontrolla.
create or replace function public.uscita_newsletter_info(p_codice uuid)
returns table (ente_nome text)
language sql stable security definer set search_path = public as $$
  select i.nome from public.newsletter_iscrizioni ni join public.istituzioni i on i.id = ni.istituzione_id
   where ni.codice_uscita = p_codice
$$;
revoke execute on function public.uscita_newsletter_info(uuid) from public, anon, authenticated;
grant execute on function public.uscita_newsletter_info(uuid) to service_role;

create or replace function public.esci_newsletter_con_codice(p_codice uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  delete from public.newsletter_iscrizioni where codice_uscita = p_codice;
  get diagnostics v = row_count;
  return v = 1;
end $$;
revoke execute on function public.esci_newsletter_con_codice(uuid) from public, anon, authenticated;
grant execute on function public.esci_newsletter_con_codice(uuid) to service_role;

-- ═══ 13. LA RILETTURA ═══
do $$
begin
  if exists (select 1 from public.piani where nome not in ('free', 'premium')) then
    raise exception 'rilettura: un piano diverso da free e premium';
  end if;
  if (select quota_newsletter from public.piani where nome = 'free') <> 3 then
    raise exception 'rilettura: quota newsletter del piano free';
  end if;
  if has_table_privilege('authenticated', 'public.newsletter_enti', 'INSERT')
     or has_table_privilege('authenticated', 'public.newsletter_enti', 'UPDATE')
     or has_table_privilege('authenticated', 'public.newsletter_consegne', 'INSERT')
     or has_table_privilege('authenticated', 'public.newsletter_consegne', 'UPDATE') then
    raise exception 'rilettura: il client scrive le tabelle della newsletter';
  end if;
  if has_function_privilege('authenticated', 'public.newsletter_da_inviare(date, integer)', 'execute')
     or has_function_privilege('anon', 'public.prepara_newsletter_del_giorno(date)', 'execute') then
    raise exception 'rilettura: le funzioni del motore sono eseguibili dal client';
  end if;
  if exists (select 1 from public.newsletter_iscrizioni where codice_uscita is null) then
    raise exception 'rilettura: un''iscrizione senza codice di uscita';
  end if;
end $$;
