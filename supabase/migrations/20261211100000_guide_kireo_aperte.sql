-- 20261211100000 — le guide di KIREO aperte stanno in una tabella loro, scritta
-- dal server; activity_log smette di essere un titolo di accesso (10/11)
--
-- IL DIFETTO (misurato l'08/11). Il cancello delle guide 2 e 3 di un'area
-- (`statoSblocco`, lib/guide/config.ts) apre una guida «già scaricata» senza
-- guardare le condizioni di merito, e «già scaricata» lo leggeva da
-- `activity_log`: una riga `download_guida` con quel livello. Quella riga la
-- scriveva il BROWSER (il bottone «Apri»), e il client poteva inserirne una con
-- il livello che voleva: uno studente collegato si apriva da sé la guida 3.
-- Chiudere la scrittura di activity_log non bastava: `download_guida` con il
-- livello era uno dei tipi che il browser scriveva legittimamente.
--
-- LA REGOLA (Mario, 10/11): un registro di attività non è un titolo di accesso.
-- Il diritto a riaprire una guida sta qui, in una tabella che il browser non
-- scrive; activity_log torna a essere un conteggio (il radar, lo storico).
--
-- CHI SCRIVE QUI: solo `registra_apertura_guida_kireo`, eseguita solo dalla
-- service role, cioè dalle due route che servono una guida:
--   · /api/guide/<area>/<livello> — per i livelli 2 e 3 DOPO il cancello, per
--     il livello 1 prima di rimandare al file pubblico;
--   · /api/scarica-guida/area/<area> — la Panoramica dalla pagina dell'area.
-- La funzione non ricontrolla il cancello (la regola sta in TypeScript, nella
-- route): per questo non la esegue nessun altro.
--
-- E CHI SCRIVE activity_log DAL BROWSER, da qui: solo `registra_attivita`, con
-- quattro tipi e il peso deciso qui. La scrittura diretta si chiude in
-- 20261211110000, DOPO il deploy (il codice di prima inserisce ancora).
--
-- ⚠️ IL RIEMPIMENTO È UN BUCO NELLA CONOSCENZA, DICHIARATO. Le righe di prima si
-- copiano da activity_log (`download_guida`, la prima apertura per area e
-- livello; un livello vuoto è una Panoramica di prima che il livello esistesse).
-- Fra quelle righe una scritta a mano dal client non si distingue da una vera:
-- il riempimento le accetta tutte. Il 10/11 i profili in produzione sono tutti
-- nostri, quindi il buco è teorico; ma questa tabella NON è una verità
-- verificata per le righe con `da_activity_log = true`.

create table public.guide_kireo_aperte (
  student_id uuid not null references public.profiles(id) on delete cascade,
  area_slug text not null check (area_slug = any (array[
    'informatica-digitale', 'salute-professioni-sanitarie', 'ristorazione-turismo',
    'meccanica-meccatronica', 'agrifood-ambiente', 'arte-design-moda', 'musica-spettacolo',
    'energia-sostenibilita', 'edilizia-architettura', 'economia-management', 'giurisprudenza-pa',
    'mobilita-sostenibile', 'scienze-educazione', 'comunicazione-media', 'scienze-ricerca',
    'sicurezza-difesa', 'lingue-relazioni-internazionali', 'studi-umanistici-beni-culturali'
  ])),
  livello smallint not null check (livello between 1 and 3),
  aperta_il timestamptz not null default now(),
  -- vero per le righe copiate da activity_log nel riempimento: vedi il buco
  -- nella conoscenza in testa
  da_activity_log boolean not null default false,
  primary key (student_id, area_slug, livello)
);

comment on table public.guide_kireo_aperte is
  '20261211100000: le guide di KIREO che uno studente ha aperto, una riga per area e livello. Il cancello dei livelli 2 e 3 legge QUI, mai activity_log. La scrive solo registra_apertura_guida_kireo (service role). da_activity_log = copiata nel riempimento, non distinguibile da una riga scritta a mano.';

alter table public.guide_kireo_aperte enable row level security;
create policy guide_kireo_aperte_select_own on public.guide_kireo_aperte
  for select to authenticated using (student_id = auth.uid());
revoke all on public.guide_kireo_aperte from anon, authenticated;
grant select (student_id, area_slug, livello, aperta_il) on public.guide_kireo_aperte to authenticated;

-- ── Il riempimento ────────────────────────────────────────────────────────────
insert into public.guide_kireo_aperte (student_id, area_slug, livello, aperta_il, da_activity_log)
select a.student_id, a.area_slug, coalesce(a.livello, 1)::smallint, min(a.created_at), true
from public.activity_log a
where a.tipo_attivita::text = 'download_guida'
  and coalesce(a.livello, 1) between 1 and 3
group by a.student_id, a.area_slug, coalesce(a.livello, 1)
on conflict do nothing;

-- ── La scrittura del server ──────────────────────────────────────────────────
-- Scrive l'apertura e la riga del conteggio (il radar), con i pesi di
-- PESO_GUIDA (lib/app/activityLog.ts: 1 → 2, 2 → 3, 3 → 5; `npm run
-- test:registroattivita` li confronta). Una guida già aperta resta com'era
-- (la prima apertura è il fatto), e il conteggio ha il suo tetto giornaliero.
-- Risponde se la riga dell'apertura è nuova.
create or replace function public.registra_apertura_guida_kireo(p_student uuid, p_area text, p_livello integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuova boolean;
begin
  if p_livello not between 1 and 3 then
    raise exception 'livello_non_valido';
  end if;
  if not exists (select 1 from public.profiles where id = p_student) then
    raise exception 'profilo_non_trovato';
  end if;

  insert into public.guide_kireo_aperte (student_id, area_slug, livello)
  values (p_student, p_area, p_livello)
  on conflict do nothing;
  v_nuova := found;

  insert into public.activity_log (student_id, area_slug, tipo_attivita, peso, livello)
  values (p_student, p_area, 'download_guida',
          case p_livello when 1 then 2 when 2 then 3 else 5 end, p_livello)
  on conflict do nothing;

  return v_nuova;
end;
$$;

revoke all on function public.registra_apertura_guida_kireo(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.registra_apertura_guida_kireo(uuid, text, integer) to service_role;

-- ── La scrittura del browser ─────────────────────────────────────────────────
-- I quattro tipi che il browser scrive, con il peso deciso qui (PESI_ATTIVITA
-- in lib/app/activityLog.ts, confrontati da `npm run test:registroattivita`).
-- Non c'è `download_guida` (lo scrive il server) né un tipo di workshop o di
-- presenza (li scrivono le funzioni che certificano). L'iscrizione a un webinar
-- conta solo se l'iscrizione c'è, a un evento di quell'area: è l'unico dei
-- quattro che ha un fatto da controllare. Gli altri tre sono visite.
-- Risponde: registrata · gia_oggi (il tetto giornaliero) · senza_iscrizione.
create or replace function public.registra_attivita(p_area text, p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente uuid := auth.uid();
  v_peso integer;
begin
  if v_utente is null then
    raise exception 'non_autenticato';
  end if;
  v_peso := case p_tipo
    when 'visita_area' then 1
    when 'lettura_articolo' then 2
    when 'chat_assistente' then 3
    when 'iscrizione_webinar' then 8
  end;
  if v_peso is null then
    raise exception 'tipo_non_ammesso';
  end if;

  if p_tipo = 'iscrizione_webinar' and not exists (
    select 1
    from public.iscrizioni_eventi i
    join public.eventi_aree ea on ea.evento_id = i.evento_id
    where i.student_id = v_utente and ea.area_slug = p_area
  ) then
    return 'senza_iscrizione';
  end if;

  insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
  values (v_utente, p_area, p_tipo::public.tipo_attivita, v_peso)
  on conflict do nothing;
  return case when found then 'registrata' else 'gia_oggi' end;
end;
$$;

revoke all on function public.registra_attivita(text, text) from public, anon;
grant execute on function public.registra_attivita(text, text) to authenticated, service_role;

do $$
begin
  if to_regclass('public.guide_kireo_aperte') is null then
    raise exception '20261211100000: la tabella non c''è';
  end if;
  if has_table_privilege('authenticated', 'public.guide_kireo_aperte', 'INSERT') then
    raise exception '20261211100000: il client scrive guide_kireo_aperte';
  end if;
  if has_function_privilege('authenticated', 'public.registra_apertura_guida_kireo(uuid, text, integer)', 'execute')
     or has_function_privilege('anon', 'public.registra_apertura_guida_kireo(uuid, text, integer)', 'execute') then
    raise exception '20261211100000: la scrittura delle guide aperte la esegue il client';
  end if;
  if has_function_privilege('anon', 'public.registra_attivita(text, text)', 'execute') then
    raise exception '20261211100000: registra_attivita la esegue anon';
  end if;
  if exists (
    select 1 from public.activity_log a
    where a.tipo_attivita::text = 'download_guida' and coalesce(a.livello, 1) between 1 and 3
      and not exists (select 1 from public.guide_kireo_aperte g
                      where g.student_id = a.student_id and g.area_slug = a.area_slug
                        and g.livello = coalesce(a.livello, 1))
  ) then
    raise exception '20261211100000: il riempimento ha lasciato fuori una guida aperta';
  end if;
end $$;
