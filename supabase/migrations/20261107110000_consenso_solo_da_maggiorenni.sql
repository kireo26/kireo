-- UN CONSENSO A UNA COMUNICAZIONE FACOLTATIVA VALE SOLO SE DATO DA MAGGIORENNI
-- (Mario, 28/10, dalla riga dell'informativa trovata il giorno prima).
--
-- L'informativa (/privacy) promette le comunicazioni facoltative «solo previo
-- consenso e solo agli utenti maggiorenni». Vale per quelle di KIREO e per le
-- newsletter degli enti: KIREO è il mittente di tutte e due.
--
-- ⚠️ E IL CONSENSO NON SI ACCENDE DA SOLO. Uno studente di sedici anni che
-- spunta una casella, o si iscrive alla newsletter di un ente, compie diciotto
-- anni e un giorno qualunque comincerebbe a ricevere: per una scelta fatta a
-- sedici anni su un documento che non ricorda. *Un consenso che si accende da
-- solo non è stato dato per il momento in cui comincia a valere.* Decisione di
-- Mario: al compimento dei diciotto anni si chiede, non si eredita. Quindi la
-- regola non è «è maggiorenne adesso», è «era maggiorenne QUANDO ha detto sì».
--
-- Tre pezzi:
--   1. consenso_dato_da_maggiorenne(quando, nascita): la regola, in un posto
--      solo. ⚠️ IL GIORNO IN CUI ESISTERÀ UN INVIO, il cancello sta lì e usa
--      questa funzione, per tutti e due i canali: non sulla casella, non
--      sull'iscrizione, perché l'età cambia da sola e il consenso no.
--   2. imposta_comunicazioni_kireo rifiuta un sì da chi non è maggiorenne
--      (`consenso_solo_maggiorenni`): non si registra un'affermazione che il
--      nostro documento dice non può esistere. Un no si registra.
--   3. stats_istituzione dice quante persone la newsletter può raggiungere
--      (`iscritti_newsletter_raggiungibili`), accanto a quante si sono
--      iscritte: un contatore che conta persone a cui non si può scrivere
--      promette un invio che non succede.
--
-- Le righe esistenti NON si toccano: un sì dato da minorenne prima di oggi resta
-- scritto com'è, e la funzione 1 lo dice non valido. Quanti sono lo misura
-- scripts/diagnostica-consensi-minorenni.sql.

create or replace function public.consenso_dato_da_maggiorenne(p_quando timestamptz, p_data_nascita date)
returns boolean
language sql
immutable
as $$
  select p_quando is not null
     and p_data_nascita is not null
     and p_quando >= (p_data_nascita + interval '18 years');
$$;

comment on function public.consenso_dato_da_maggiorenne(timestamptz, date) is
  'Un consenso a una comunicazione facoltativa vale solo se dato da maggiorenni: al compimento dei 18 anni si chiede, non si eredita. Senza data di nascita non vale. Il cancello di qualunque invio futuro (KIREO e newsletter degli enti) usa questa funzione. 20261107110000.';

create or replace function public.imposta_comunicazioni_kireo(p_consenso boolean, p_origine text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_righe int;
  v_nascita date;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;
  if p_consenso is null then
    raise exception 'consenso_mancante';
  end if;
  if p_origine not in ('registrazione', 'profilo', 'disiscrizione') then
    raise exception 'origine_non_valida';
  end if;

  select data_nascita into v_nascita from public.profiles where id = v_uid;
  if p_consenso and not public.consenso_dato_da_maggiorenne(now(), v_nascita) then
    raise exception 'consenso_solo_maggiorenni';
  end if;

  if p_origine = 'registrazione' then
    update public.profiles
       set comunicazioni_kireo = p_consenso, comunicazioni_kireo_il = now()
     where id = v_uid and comunicazioni_kireo is null;
  else
    update public.profiles
       set comunicazioni_kireo = p_consenso, comunicazioni_kireo_il = now()
     where id = v_uid;
  end if;

  get diagnostics v_righe = row_count;
  if v_righe = 0 and p_origine <> 'registrazione' then
    raise exception 'profilo_non_trovato';
  end if;

  return (select comunicazioni_kireo from public.profiles where id = v_uid);
end;
$$;

comment on function public.imposta_comunicazioni_kireo(boolean, text) is
  'Scrive il consenso alle comunicazioni di KIREO per chi chiama, con la data del server. Dalla registrazione solo se non c''è già una risposta. Un sì da chi non è maggiorenne si rifiuta (consenso_solo_maggiorenni). 20261107100000, 20261107110000.';

-- La vista: una colonna in fondo (create or replace view la ammette solo lì),
-- il resto identico a 20261102110000.
create or replace view public.stats_istituzione as
select
  i.id as istituzione_id,
  (select count(distinct r.student_id) from public.recinto_enti r where r.istituzione_id = i.id) as studenti_nel_recinto,
  (select count(*) from public.newsletter_iscrizioni n where n.istituzione_id = i.id) as iscritti_newsletter,
  (select count(*) from public.guide_enti g where g.istituzione_id = i.id) as guide_pubblicate,
  (
    select count(distinct r.student_id) from public.recinto_enti r where r.istituzione_id = i.id and r.origine = 'guida'
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
  '20261102110000, 20261107110000: aggregati per istituzione (mai righe individuali). studenti_nel_recinto = studenti distinti che hanno scaricato una guida, si sono iscritti alla newsletter o a un evento dell''ente; download_guida = studenti distinti che hanno scaricato almeno una guida da collegati; iscritti_newsletter_raggiungibili = iscritti che si sono iscritti da maggiorenni (consenso_dato_da_maggiorenne), cioè quelli a cui la newsletter può arrivare. interazioni_stimate è una stima best-effort, non un conteggio.';

do $$
begin
  if to_regprocedure('public.consenso_dato_da_maggiorenne(timestamptz, date)') is null then
    raise exception 'consenso_dato_da_maggiorenne non creata';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'stats_istituzione'
       and column_name = 'iscritti_newsletter_raggiungibili'
  ) then
    raise exception 'la vista non ha la colonna dei raggiungibili';
  end if;
end $$;
