-- KIREO — Test attitudinali, Fase 2. Lo stile di lavoro (T2 «Come ti muovi»).
--
-- Struttura GEMELLA di area_signal: i quattro assi (analitico/relazionale/
-- creativo/operativo) vivono in style_signal, alimentati dallo stesso `evidence`
-- ma su una colonna diversa (`asse` invece di `area_slug`). Non entrano in
-- area_signal. Alimentati sia dal test (peso 0,35) sia dalle missioni (peso
-- 1,2-1,5): le azioni pesano tre-quattro volte le dichiarazioni.
--
-- escape_asse è un CREATE TYPE NUOVO: nessun vincolo di transazione (a differenza
-- di ALTER TYPE ADD VALUE), quindi enum + colonna + tabella + funzione stanno in
-- un'unica migrazione.

-- ============ enum ============
create type public.escape_asse as enum ('analitico', 'relazionale', 'creativo', 'operativo');

-- ============ evidence.asse ============
-- Le prove di STILE hanno area_slug null e asse valorizzato; le prove d'AREA il
-- contrario. Una prova non può appartenere insieme a un'area e a un asse — ma
-- non serve un CHECK: il motore emette sempre una cosa sola per riga.
alter table public.evidence add column asse public.escape_asse;
create index evidence_student_asse_idx on public.evidence (student_id, asse);

-- ============ style_signal (profilo di stile, scrittura SOLO via funzione) ============
create table public.style_signal (
  student_id uuid not null references public.profiles (id) on delete cascade,
  asse public.escape_asse not null,
  punteggio smallint not null default 0 check (punteggio between 0 and 100),
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  status public.area_signal_status not null default 'emergente',  -- riusa l'enum di area_signal
  updated_at timestamptz not null default now(),
  primary key (student_id, asse)
);

alter table public.style_signal enable row level security;

-- Solo lettura-own dal client. Scrittura solo via ricalcola_style_signal()
-- (SECURITY DEFINER), stesso pattern di area_signal.
create policy style_signal_select_own on public.style_signal
  for select to authenticated using (student_id = auth.uid());

-- ============ ricalcola_style_signal (interna, ricomputo idempotente) ============
-- Gemella di ricalcola_area_signal: ricomputa la riga di UNO (studente, asse)
-- dalla somma di TUTTE le prove correnti per quell'asse (qualsiasi fonte:
-- test/mission/workshop/activity). Full recompute = idempotente. Interna:
-- revocata da authenticated/anon/public, chiamata solo in contesto definer.
-- Lo stato `da_verificare` per divergenza test↔missione NON si calcola qui
-- (richiede confronto cross-asse/cross-fonte e il conteggio delle missioni
-- completate): è derivato a runtime dalla pagina di esito, dove tutti i dati
-- sono disponibili — stesso approccio dell'assemblaggio dell'esito missione.
create or replace function public.ricalcola_style_signal(p_student_id uuid, p_asse public.escape_asse)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_punteggio smallint;
  v_peso_tot numeric;
  v_confidence numeric;
  v_status public.area_signal_status;
begin
  select
    coalesce(round(100 * sum(valore*peso) / nullif(sum(peso),0)), 0),
    coalesce(sum(peso), 0)
  into v_punteggio, v_peso_tot
  from public.evidence
  where student_id = p_student_id and asse = p_asse;

  if v_peso_tot = 0 then
    delete from public.style_signal where student_id = p_student_id and asse = p_asse;
    return;
  end if;

  v_confidence := least(1.0, v_peso_tot / 10.0);   -- stessa SOGLIA_CONFIDENZA di area_signal
  if v_confidence >= 0.66 then
    v_status := 'confermata';
  else
    v_status := 'emergente';
  end if;

  insert into public.style_signal (student_id, asse, punteggio, confidence, status, updated_at)
  values (p_student_id, p_asse, v_punteggio, v_confidence, v_status, now())
  on conflict (student_id, asse) do update set
    punteggio = excluded.punteggio,
    confidence = excluded.confidence,
    status = excluded.status,
    updated_at = now();
end;
$$;

revoke all on function public.ricalcola_style_signal(uuid, public.escape_asse) from public, authenticated, anon;
