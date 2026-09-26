-- KIREO — il tetto dei workshop: uno attivo per volta, tre in tutto.
--
-- ─────────────────────────────────────────── perché un tetto esiste
-- NON PER LA SPESA (Mario): un workshop costa qualche centesimo di chiamate, e
-- se il tetto fosse un problema di costo la risposta giusta sarebbe un'altra.
-- Il tetto esiste perché IL PROFILO SI DILUISCE.
--
-- Cosa vuol dire, con i numeri di oggi [verificato, non dedotto]: un workshop
-- portato a termine scrive UNA riga `activity_log` (`workshop_pcto`, peso 25,
-- sull'`area_slug` del ruolo — `avanza_fase_workshop`, ramo `p_ultima`), e la
-- vista `score_aree` fa `sum(peso)` per studente e area. Cinque workshop su
-- cinque aree diverse mettono 25 su cinque raggi del radar: il ritratto non
-- diventa più ricco, diventa più piatto — cioè smette di dire da che parte sta
-- andando quella persona, che è l'unica cosa per cui esiste.
--
-- E quando arriverà il cross-feed verso `area_signal` (oggi non c'è: i
-- workshop non scrivono in `evidence`, vedi i punti aperti) la diluizione si
-- sposta là, dove è peggio: `ricalcola_area_signal` fa una MEDIA PESATA, quindi
-- insensibile a quante prove ci sono sotto, e l'eleggibilità delle affinità
-- chiede solo `attivita_distinte >= 2`. Cinque workshop su cinque aree
-- renderebbero cinque aree eleggibili con un colpo ciascuna.
--
-- IL NUMERO 3 È SCELTO, NON MISURATO. Non c'è nessun dato che dica che a
-- quattro il ritratto si rompe e a tre no: è la taglia che sembra giusta per un
-- anno di quinta. La domanda che un giorno il banco potrà misurare è
-- **«a quante aree eleggibili la classifica di affinità smette di
-- distinguere?»** — e il giorno che si saprà, questo numero si cambia in un
-- posto solo (`tetto_iscrizioni_workshop`). Chi legge questa migrazione fra sei
-- mesi non deve ricostruire una decisione che sembra presa e non lo era mai
-- stata: è la lezione del vincolo per ruolo del 30/08.
--
-- ─────────────────────────────────────────── le tre cose decise prima
--
-- 1. LA VIA D'USCITA ESISTE, ed è la precondizione di «uno per volta». Senza,
--    il tetto dei tre da solo sarebbe stato meglio: un solo posto e nessun modo
--    di liberarlo è una porta chiusa a chiave senza serratura.
--    `ritira_iscrizione_workshop` (20260830130000, grant ad authenticated,
--    idempotente) è il gesto, e l'interfaccia c'è: `RitiroIscrizione`, montata
--    in app/app/workshop/[slug]/page.tsx:114 quando l'iscrizione è attiva. Il
--    lavoro non si perde mai [già verificato allora: nessuna policy di lettura
--    di workshop_elaborati / workshop_fasi_stato / workshop_chat_cliente /
--    workshop_consegne nomina lo stato dell'iscrizione].
--    CONSEGUENZA SULLA PAGINA: il bottone per lasciare sta sulla pagina del
--    workshop che si sta facendo, quindi un rifiuto «ne hai già uno attivo»
--    deve NOMINARE QUELLO e portarci — altrimenti è un no che non dice dove si
--    va. Lo fa `stato_tetto_workshop()` qui sotto, che restituisce anche slug e
--    titolo di quello attivo.
--
-- 2. IL CONTEGGIO È SULLE ISCRIZIONI, NON SUI WORKSHOP DISTINTI (Mario). Due
--    ruoli dello stesso workshop sono due esperienze vere, e contare i workshop
--    distinti lascerebbe fare 3 × 5 = 15 ruoli.
--    MA NON TUTTI GLI STATI CONTANO: contano `attivo` e `completato`, non
--    `ritirato`. Tre ragioni, e la prima è il motivo del tetto:
--      · un'iscrizione ritirata non scrive niente in `activity_log` (la riga
--        arriva solo dal ramo `p_ultima`), quindi NON diluisce niente —
--        contarla metterebbe un tetto su una cosa che il tetto non riguarda;
--      · farla contare renderebbe CARO fermarsi, che è l'opposto di quello a
--        cui serve la via d'uscita;
--      · e romperebbe il cambio di ruolo del 30/08 (lascia + iscriviti
--        consumerebbe due posti su tre per restare nello stesso workshop).
--
-- 3. IL ROBOT DEL BANCO È ESENTE, e non è una scorciatoia. Il robot gioca 25
--    ruoli con un account solo, dalla porta, quindi il suo insert passa da
--    questa policy: senza esenzione una passata completa produrrebbe 22 «fermato
--    da un cancello» — rumore nella lista che si legge per prima, esattamente il
--    difetto che il 20/09 ha fatto rifiutare la partenza al robot senza i tre
--    test. E peggio: un ruolo che cade a metà resta `attivo`, quindi UN guasto
--    di rete bloccherebbe a cascata tutti i ruoli successivi.
--    È lo stesso principio già applicato al raffreddamento del cron
--    (`e_profilo_di_prova`): il robot non ha bisogno che il mondo cambi per lui,
--    ha bisogno di essere riconoscibile. Nessuno può marcarsi da sé
--    (`blocca_autoflag_di_prova`), quindi l'esenzione non è aggirabile.

-- ─────────────────────────────────────────── il numero, in un posto solo
create or replace function public.tetto_iscrizioni_workshop()
returns integer
language sql
immutable
as $$
  select 3
$$;

comment on function public.tetto_iscrizioni_workshop() is
  'Quanti workshop può fare in tutto uno studente. SCELTO, non misurato: la domanda che lo deciderebbe è «a quante aree eleggibili la classifica di affinità smette di distinguere?», e nessuno l''ha ancora misurata. Sta in una funzione e non in un literal perché il numero lo legge anche la pagina (via stato_tetto_workshop): due copie diverse direbbero allo studente un tetto e gliene applicherebbero un altro.';

-- ─────────────────────────────────────────── i due predicati
-- `exists` e `count` non tornano MAI null, quindi `not ha_un_workshop_attivo()`
-- non cade nella trappola già pagata più volte qui dentro (un `<>` con null che
-- non scatta). Per un chiamante senza sessione `auth.uid()` è null e il
-- confronto `student_id = auth.uid()` non trova righe: zero e false, cioè il
-- verso innocuo — e comunque la policy è `to authenticated` e queste funzioni
-- sono revocate ad `anon`.
create or replace function public.ha_un_workshop_attivo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workshop_iscrizioni
    where student_id = auth.uid() and stato = 'attivo'
  )
$$;

create or replace function public.iscrizioni_workshop_contate()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.workshop_iscrizioni
  where student_id = auth.uid() and stato in ('attivo', 'completato')
$$;

comment on function public.iscrizioni_workshop_contate() is
  'Quante iscrizioni dello studente contano verso il tetto: attive e completate. Una RITIRATA non conta — non ha scritto niente in activity_log, quindi non diluisce niente, e farla contare renderebbe caro fermarsi e romperebbe il cambio di ruolo.';

-- La condizione intera, che chiamano SIA la policy SIA riprendi_iscrizione_workshop.
-- Una sola definizione: due copie della stessa regola in due punti divergono, è
-- solo questione di quando.
create or replace function public.puo_iscriversi_a_un_workshop()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- `auth.uid() is not null` in testa: senza quella riga un chiamante senza
  -- sessione otterrebbe TRUE (zero iscrizioni, nessuna attiva, 0 < 3), cioè
  -- una funzione che si chiama «può iscriversi» risponderebbe sì a chi non può.
  -- Non era un buco — l'insert cade comunque su `student_id = auth.uid()` e
  -- queste funzioni sono revocate ad `anon` — ma un predicato che fallisce
  -- APERTO è una mina per il prossimo che lo chiama senza sapere cosa gli sta
  -- accanto.
  select auth.uid() is not null
     and (
       public.e_profilo_di_prova(auth.uid())
       or (
         not public.ha_un_workshop_attivo()
         and public.iscrizioni_workshop_contate() < public.tetto_iscrizioni_workshop()
       )
     )
$$;

comment on function public.puo_iscriversi_a_un_workshop() is
  'Il tetto dei workshop: nessuno già attivo, e meno di tetto_iscrizioni_workshop() fra attive e completate. I profili di prova sono esenti (il robot del banco gioca 25 ruoli con un account solo). Chiamata sia dalla policy di insert sia da riprendi_iscrizione_workshop: riprendere porta un''iscrizione a «attivo» senza passare da un insert, quindi senza questa la regola avrebbe avuto una via d''uscita.';

-- ─────────────────────────────────────────── quello che legge la pagina
-- Perché una funzione e non una query dal client: la pagina deve poter dire
-- QUANTI su QUANTI e DOVE andare, e ricalcolare qui la regola darebbe due
-- definizioni in due lingue che nessun test può riconciliare (è la stessa
-- ragione di `lib/percorso/cancelli.ts`). Esposizione minima: solo le proprie
-- righe, e di quella attiva solo quello che serve per nominarla.
create or replace function public.stato_tetto_workshop()
returns table (
  usate integer,
  tetto integer,
  puo boolean,
  esente boolean,
  attivo_slug text,
  attivo_titolo text,
  attivo_ruolo text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.iscrizioni_workshop_contate(),
    public.tetto_iscrizioni_workshop(),
    public.puo_iscriversi_a_un_workshop(),
    public.e_profilo_di_prova(auth.uid()),
    w.slug,
    w.titolo,
    r.titolo
  from (select 1) _
  left join public.workshop_iscrizioni wi
    on wi.student_id = auth.uid() and wi.stato = 'attivo'
  left join public.workshop w on w.id = wi.workshop_id
  left join public.workshop_ruoli r on r.id = wi.ruolo_id
  limit 1
$$;

comment on function public.stato_tetto_workshop() is
  'Cosa la pagina dice allo studente sul tetto dei workshop: quante iscrizioni ha usate, su quante, se può cominciarne un''altra, e — se ne ha una attiva — quale, per poterla nominare e portarci. Solo le proprie righe.';

-- ─────────────────────────────────────────── il cancello
-- La policy si ricrea per intero: le condizioni che c'erano restano parola per
-- parola (comprese quelle del cancello del percorso, 20260920100000), il tetto
-- è l'ultima riga.
--
-- NOTA sul rapporto fra il tetto e la clausola «oppure sei già dentro»:
-- `e_gia_entrato_in_un_workshop()` scavalca il requisito del PERCORSO, non il
-- tetto. Sono due `and` distinti, ed è il verso giusto: una clausola «chi è già
-- dentro passa» applicata al tetto lo annullerebbe per tutti quelli a cui è
-- destinato. Il cambio di ruolo continua a funzionare perché la riga lasciata
-- diventa `ritirato`, che non conta e non è attiva.
drop policy if exists workshop_iscrizioni_insert_own on public.workshop_iscrizioni;
create policy workshop_iscrizioni_insert_own
  on public.workshop_iscrizioni for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and stato = 'attivo'
    and exists (select 1 from public.workshop w where w.id = workshop_id and w.attivo)
    and exists (select 1 from public.workshop_ruoli r where r.id = ruolo_id and r.workshop_id = workshop_id)
    and (public.ha_esperienza_percorso() or public.e_gia_entrato_in_un_workshop())
    and public.puo_iscriversi_a_un_workshop()
  );

-- ─────────────────────────────────────────── la via d'uscita del tetto
-- RIPRENDERE È LA SECONDA STRADA VERSO 'attivo', e non passa da nessun insert:
-- scrivere il tetto solo nel `with check` della policy — come chiedeva il §2
-- alla lettera — lo avrebbe lasciato aggirabile in tre gesti (comincia A,
-- lascia A, comincia B, riprendi A → due attivi). L'unica guardia che c'era è
-- l'indice unico parziale su (student_id, workshop_id), che è PER WORKSHOP:
-- non vede due workshop diversi.
--
-- Stessa firma, `create or replace` in place: non aggiungere parametri (la
-- trappola dell'overload Postgres già pagata con
-- finalize_registration_istituzione).
create or replace function public.riprendi_iscrizione_workshop(p_iscrizione_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.workshop_iscrizioni
    where id = p_iscrizione_id and student_id = auth.uid()
  ) then
    raise exception 'non_autorizzato';
  end if;

  -- I due motivi separati, e non un «non_autorizzato» per tutto: sono due cose
  -- diverse da leggere e si riparano in modi diversi — una si chiude lasciando
  -- il workshop che si ha in mano, l'altra non si chiude affatto.
  if public.ha_un_workshop_attivo() then
    raise exception 'workshop_gia_attivo';
  end if;
  if not public.puo_iscriversi_a_un_workshop() then
    raise exception 'tetto_workshop_raggiunto';
  end if;

  update public.workshop_iscrizioni
  set stato = 'attivo'
  where id = p_iscrizione_id and stato = 'ritirato';
exception
  when unique_violation then
    raise exception 'iscrizione_gia_attiva';
end;
$$;

-- IL PERMESSO CHE NON C'ERA, e il motivo non è il rischio di oggi.
-- `riprendi_iscrizione_workshop` esiste dal 2026-08-30 con un
-- `grant execute … to authenticated` e **nessun revoke**: quindi dal 30 agosto è
-- eseguibile anche da `anon`, perché i default privileges di Supabase la fanno
-- nascere così e un `create or replace` NON tocca i privilegi [verificato su
-- Postgres 16 in sessione, non dedotto].
--
-- Non è un buco: è `security definer` e la prima cosa che fa è
-- `where student_id = auth.uid()`, che per un anonimo non trova niente e alza
-- `non_autorizzato`. Fallisce chiuso. La riga si mette perché **la prossima
-- persona che legge questo blocco vede cinque funzioni nuove tutte revocate e
-- una vecchia no, e deve indovinare se è una dimenticanza o una scelta.**
--
-- E SI REVOCA DA TUTTI E DUE: `revoke … from anon` da solo NON basta, perché
-- `PUBLIC` ha comunque l'EXECUTE e `anon` passa da lì [verificato: revocato solo
-- da anon, `set role anon; select f()` risponde ancora]. Il gemello è la lezione
-- del 19/09 all'inverso: `revoke … from public` da solo lascia il grant esplicito.
revoke all on function public.riprendi_iscrizione_workshop(uuid) from public, anon;
grant execute on function public.riprendi_iscrizione_workshop(uuid) to authenticated;

comment on function public.riprendi_iscrizione_workshop(uuid) is
  'Riprende un''iscrizione ritirata, sullo stesso ruolo e con il lavoro dov''era. Rispetta il tetto dei workshop (workshop_gia_attivo / tetto_workshop_raggiunto), perché portare una riga a «attivo» senza passare da un insert sarebbe altrimenti la via d''uscita dal tetto. Solleva iscrizione_gia_attiva se nel frattempo lo studente ha già ripreso un altro ruolo di questo workshop.';

-- ─────────────────────────────────────────── i ruoli, nominati
-- Una funzione nasce eseguibile da `anon` e `authenticated` per i default
-- privileges di Supabase, e un `revoke ... from public` NON li tocca: i ruoli
-- si nominano (lezione del 19/09).
revoke all on function public.tetto_iscrizioni_workshop() from public, anon;
revoke all on function public.ha_un_workshop_attivo() from public, anon;
revoke all on function public.iscrizioni_workshop_contate() from public, anon;
revoke all on function public.puo_iscriversi_a_un_workshop() from public, anon;
revoke all on function public.stato_tetto_workshop() from public, anon;

grant execute on function public.tetto_iscrizioni_workshop() to authenticated;
grant execute on function public.ha_un_workshop_attivo() to authenticated;
grant execute on function public.iscrizioni_workshop_contate() to authenticated;
grant execute on function public.puo_iscriversi_a_un_workshop() to authenticated;
grant execute on function public.stato_tetto_workshop() to authenticated;
