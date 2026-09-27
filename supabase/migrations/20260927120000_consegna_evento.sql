-- La consegna della diretta: l'ente pone una domanda durante il webinar, lo
-- studente risponde in KIREO, e QUELLA RISPOSTA è la prova.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- IL BUCO CHE CHIUDE, in una riga
-- ═══════════════════════════════════════════════════════════════════════════
-- La diretta è in repo dal 26 luglio e funziona: presenze via heartbeat,
-- domande in diretta, certificazione automatica al 75%, ore PCTO, attestati.
-- Quello che NON succedeva è che una diretta dicesse qualcosa su VERSO COSA SI
-- ORIENTA quello studente: né presenze_live, né domande_live, né
-- iscrizioni_eventi producono una riga di `evidence`. La partecipazione conta
-- già in un altro registro (ore, certificato, `stato = 'partecipato'`), e
-- quello resta dov'è.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ LA PRESENZA NON PRODUCE UN SEGNALE D'AREA, ED È DELIBERATO
-- ═══════════════════════════════════════════════════════════════════════════
-- Sta scritto qui perché è QUI che la prima persona che passa verrebbe a
-- «completare il lavoro»: c'è una funzione che scrive prove da un evento, e
-- accanto una tabella di presenze che non ne scrive. Sembra un lavoro lasciato
-- a metà. Non lo è.
--
-- IL NUMERO CHE LO DECIDE. Un'area entra nella classifica delle affinità a
-- `confidence >= 0,40` (lib/percorso/stato.ts), e
-- `confidence = least(1, Σpeso / 10)` — quindi la barra è **Σp >= 4**. Se la
-- presenza valesse ~1,0, QUATTRO DIRETTE basterebbero a creare un'affinità. E
-- la presenza è, alla lettera, *aver tenuto una scheda aperta e visibile per il
-- 75% del tempo*: i limiti di quel rilevamento sono già scritti in CLAUDE.md
-- («nessun segnale che distingua "video effettivamente in riproduzione" da
-- "scheda aperta"»). Un'affinità costruita su quattro schede aperte è
-- un'affermazione su una persona che nessuna sua scelta sostiene.
--
-- Quindi: la presenza resta ore PCTO + certificato + credito di ESPLORAZIONE
-- (una riga in `activity_log` per ogni area dell'evento, peso 15 o 25: il
-- radar), e non tocca `evidence`. Non è «non lascia niente»: lascia la cosa che
-- la home dichiara — *dove hai messo piede*, non un'attitudine. Se un giorno si
-- volesse cambiare, il numero da rifare è quello sopra — non è una questione di
-- gusto, è aritmetica.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- IL PESO DELLA CONSEGNA È SCELTO E NON MISURATO
-- ═══════════════════════════════════════════════════════════════════════════
-- ~1,0 per area riconosciuta (il valore vive in lib/eventi/consegna.ts, accanto
-- al prompt che lo giustifica). Più di una risposta a un questionario (0,35),
-- molto meno di una missione (una missione intera porta un'area a
-- confidence 1,000), MAI sufficiente da sola. Il vincolo che lo limita è lo
-- stesso di sopra: con 1,0 servono QUATTRO consegne sulla stessa area per
-- entrare in classifica — quattro dirette diverse, su quella stessa area, ognuna
-- con un testo scritto e giudicato. È una soglia che si attraversa lavorando,
-- non presenziando.
-- Il numero non è tarato su dati: il giorno in cui ci saranno abbastanza
-- consegne vere, si guarda quante aree entrano in classifica per questa strada
-- e si ritara. Fino a quel giorno resta una scelta, e sta scritto che lo è.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LE AREE NON SONO OBBLIGATORIE SU UN EVENTO — e non lo erano nemmeno prima
-- ═══════════════════════════════════════════════════════════════════════════
-- [verificato, non dedotto] `eventi_aree` ha PK (evento_id, area_slug) e nessun
-- minimo; il suo `comment on table` dichiara che il limite di 2 è applicativo;
-- l'unico trigger (`blocca_aree_su_eventi_docenti`) VIETA le righe sugli eventi
-- docenti, non ne impone. E `CreaEventoForm` scrive `if (!perDocenti &&
-- aree.length > 0)`: zero aree è una strada aperta, non un caso limite.
--
-- CONSEGUENZA GIÀ VIVA, e non è di questa migrazione: `chiudi_diretta_evento`
-- (20260726110000) scrive il credito in activity_log con un
-- `insert … select … from eventi_aree where evento_id = …`. Su un evento senza
-- aree quell'insert scrive ZERO RIGHE e riporta successo; `v_certificati` si
-- alza comunque. Cioè: oggi uno studente può seguire un webinar intero, essere
-- certificato, vedersi contare le ore — e il credito sul radar va nel nulla
-- senza che niente lo dica. Per la partecipazione è un effetto collaterale (il
-- registro principale sono le ore, e funziona); per la consegna sarebbe il
-- contrario: l'area È lo scopo, quindi una consegna su un evento senza aree
-- sarebbe un testo scritto e una chiamata AI pagata per non produrre niente.
-- Quella funzione NON si tocca in questa migrazione (era una decisione, non una
-- riparazione) — ed è stata presa subito dopo: la porta è chiusa dove nasce
-- (`CreaEventoForm`: almeno un'area su un evento per studenti) e l'allarme sta
-- in 20260927130000_allarme_evento_senza_aree.sql, che fa suonare un guasto
-- quando una partecipazione certificata non ha nessuna area a cui accreditarsi.
-- Per la consegna, invece, la porta è chiusa in TRE punti, ognuno con un
-- mestiere diverso:
--   1. `imposta_domanda_consegna` — il più a monte: l'ente lo sa nel momento in
--      cui pone la domanda, non dopo;
--   2. `puo_consegnare_evento` — lo studente non vede mai un campo da riempire
--      che non produrrebbe niente;
--   3. `registra_evidenze_consegna_evento` — il terminale che nessuno aggira, e
--      solleva rumorosamente invece di scrivere una prova senza area.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LA FINESTRA, E PERCHÉ È CHIUSA
-- ═══════════════════════════════════════════════════════════════════════════
-- Si apre alla fine della diretta e si chiude 48 ore dopo. Una consegna aperta
-- per sempre è peso su una cosa che non è successa lì: il senso è rispondere a
-- caldo, con la diretta ancora in testa. 48 ore è scelto (copre la sera dopo e
-- quella successiva), non misurato.
-- La DOMANDA invece si pone solo mentre la diretta è aperta
-- (`evento_in_finestra_diretta`, la finestra che esiste già — nessuna seconda
-- copia): è il momento in cui l'ente è lì e sa cosa è stato detto. E una volta
-- che la consegna è aperta la domanda NON si cambia più: cambiarla sotto a chi
-- sta già scrivendo è peggio che non averla posta.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- APPLICAZIONE: via SQL Editor, DOPO 20260927110000_evento_fonte_enum.sql
-- (usa il valore 'evento', che un enum non lascia usare nella stessa
-- transazione in cui è stato creato). Dopo, `scripts/verifica-consegna-evento.sql`
-- prova le proprietà in una transazione con ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════

-- ════════════════════════ la domanda, sull'evento ════════════════════════
alter table public.eventi add column domanda_consegna text
  check (domanda_consegna is null
         or (char_length(btrim(domanda_consegna)) >= 10 and char_length(domanda_consegna) <= 500));

comment on column public.eventi.domanda_consegna is
  'La domanda che l''organizzatore pone in diretta e a cui si risponde in KIREO (vedi consegne_evento). NULL = questo evento non ha una consegna, ed è il caso normale. Si imposta solo da imposta_domanda_consegna(), mentre la diretta è aperta.';

-- ════════════════════════ da quale evento viene una prova ════════════════════════
-- Terza colonna di provenienza accanto ad attempt_id (missioni) e
-- test_attempt_id (test): la forma è già quella, non la invento adesso.
alter table public.evidence add column evento_id uuid references public.eventi (id) on delete cascade;

comment on column public.evidence.evento_id is
  'L''evento la cui consegna ha prodotto questa prova (fonte = ''evento''). NULL per ogni altra fonte, come attempt_id/test_attempt_id per le loro.';

create index evidence_evento_idx on public.evidence (evento_id);

-- ════════════════════════ la consegna dello studente ════════════════════════
-- Il TESTO si salva PRIMA di essere giudicato, ed è una scelta pagata altrove:
-- se il giudizio e la scrittura fossero un gesto solo, un fallimento dell'AI
-- farebbe perdere allo studente anche il testo che ha scritto. Così un
-- fallimento lascia la consegna salvata e `valutata_il` a null — un secondo
-- tentativo lo fa una PERSONA (la regola del 19/09: rigiudicare costa una
-- chiamata, quindi nessun ritentativo automatico).
create table public.consegne_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventi (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  testo text not null check (char_length(btrim(testo)) >= 200 and char_length(testo) <= 4000),
  valutata_il timestamptz,
  created_at timestamptz not null default now(),
  constraint consegne_evento_unica unique (evento_id, student_id)
);

comment on table public.consegne_evento is
  'La risposta di uno studente alla domanda posta in diretta dall''organizzatore. Una per (evento, studente), non modificabile dopo l''invio (nessuna policy update, come domande_live). `valutata_il` null = il giudizio non è ancora arrivato: la consegna resta valida e si può rigiudicare.';

create index consegne_evento_student_idx on public.consegne_evento (student_id);

alter table public.consegne_evento enable row level security;

create policy consegne_evento_select_own
  on public.consegne_evento for select
  to authenticated
  using (student_id = auth.uid());

-- ════════════════════════ la finestra della consegna ════════════════════════
-- SECURITY INVOKER di proposito, come evento_in_finestra_diretta: legge solo
-- eventi approvati, che il chiamante può già leggere da sé — non c'è niente da
-- bypassare. La fine della diretta è `data_fine`, o `data_inizio + 3 ore` quando
-- manca: lo stesso ripiego di evento_in_finestra_diretta, così le due finestre
-- non possono divergere sul significato di «fine».
create or replace function public.consegna_evento_aperta(p_evento_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = p_evento_id
      and e.stato = 'approvato'
      and e.domanda_consegna is not null
      and now() >= coalesce(e.data_fine, e.data_inizio + interval '3 hours')
      and now() <  coalesce(e.data_fine, e.data_inizio + interval '3 hours') + interval '48 hours'
  );
$$;

comment on function public.consegna_evento_aperta(uuid) is
  'La finestra della consegna: dalla fine della diretta a 48 ore dopo, e solo se una domanda è stata posta. 48 ore è un numero scelto, non misurato (vedi la testa di questa migrazione).';

-- ════════════════════════ la porta dello studente ════════════════════════
-- LE DUE CONDIZIONI SULLA PERSONA, e perché non sono tre.
--
-- Serve l'ISCRIZIONE (come per domande_live) e serve ALMENO UN PING, cioè aver
-- aperto la pagina della diretta. NON serve la presenza CERTIFICATA, e la
-- delega su questo punto è stata decisa così per due ragioni che non sono di
-- severità:
--   (a) la certificazione dipende da un GESTO MANUALE dentro una finestra: la
--       scrive `chiudi_diretta_evento`, che qualcuno deve chiamare («Concludi
--       diretta e certifica presenze»). Se nessuno lo fa, NESSUNO è certificato
--       e la consegna resta chiusa per tutti per 48 ore, senza che niente lo
--       dica. Una porta la cui chiave è in mano a un terzo, a tempo.
--   (b) la soglia del 75% ha limiti già catalogati in CLAUDE.md: chi si unisce
--       dopo il 25% della durata non può strutturalmente raggiungerla, e la Page
--       Visibility API si comporta in modo non uniforme sui browser mobili.
--       Chiedere la certificazione vorrebbe dire negare la consegna a chi ha
--       seguito tutto, per una ragione che non lo riguarda.
-- Un ping invece è un fatto che lo studente produce da sé al primo istante
-- (l'heartbeat parte al mount), quindi distingue «c'era» da «ha letto la
-- domanda dopo» e sbaglia nella direzione giusta.
--
-- `auth.uid() is not null` in testa anche se gli `exists` fallirebbero comunque
-- su un uid nullo: un predicato che si chiama «può» non deve rispondere sì a chi
-- non può, nemmeno per caso (la lezione di puo_iscriversi_a_un_workshop).
create or replace function public.puo_consegnare_evento(p_evento_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select auth.uid() is not null
    and public.consegna_evento_aperta(p_evento_id)
    and exists (select 1 from public.eventi_aree ea where ea.evento_id = p_evento_id)
    and exists (
      select 1 from public.iscrizioni_eventi ie
      where ie.evento_id = p_evento_id and ie.student_id = auth.uid()
    )
    and exists (
      select 1 from public.presenze_live pl
      where pl.evento_id = p_evento_id and pl.user_id = auth.uid()
    );
$$;

comment on function public.puo_consegnare_evento(uuid) is
  'La porta della consegna: finestra aperta, l''evento ha almeno un''area, il chiamante è iscritto e ha almeno un ping di presenza. NON richiede la presenza certificata (vedi la ragione nel corpo della migrazione: dipenderebbe da un gesto manuale dentro la finestra).';

create policy consegne_evento_insert_own
  on public.consegne_evento for insert
  to authenticated
  with check (student_id = auth.uid() and public.puo_consegnare_evento(consegne_evento.evento_id));

-- ════════════════════════ l'ente pone la domanda ════════════════════════
-- SECURITY DEFINER perché nessuna policy di update su `eventi` copre un evento
-- già approvato (`eventi_update_propria_non_revisionato` si ferma prima, di
-- proposito): la domanda si pone durante la diretta, quindi su un evento
-- approvato per definizione.
--
-- Autorizzazione a RAMI AFFERMATIVI con `else raise`, come
-- certifica_partecipazione_docente: un ruolo o un'istituzione NULL non entra in
-- nessun ramo positivo, quindi è NULL-safe per costruzione senza bisogno di
-- `is distinct from`.
create or replace function public.imposta_domanda_consegna(p_evento_id uuid, p_domanda text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizzatore uuid;
  v_aree integer;
begin
  select organizzatore_id into v_organizzatore from public.eventi where id = p_evento_id;
  if not found then
    raise exception 'evento_non_trovato';
  end if;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore is not null and v_organizzatore = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  -- La finestra: solo mentre la diretta è aperta. Dopo, la consegna è già
  -- aperta e cambiare la domanda la cambierebbe sotto a chi sta scrivendo.
  if not public.evento_in_finestra_diretta(p_evento_id) then
    raise exception 'fuori_finestra_diretta';
  end if;

  -- Il punto più a monte in cui l'assenza di aree si può dire a qualcuno che
  -- può rimediare: l'ente, mentre la diretta è ancora aperta.
  select count(*) into v_aree from public.eventi_aree where evento_id = p_evento_id;
  if v_aree = 0 then
    raise exception 'evento_senza_aree';
  end if;

  update public.eventi set domanda_consegna = p_domanda, updated_at = now() where id = p_evento_id;
end;
$$;

-- ════════════════════════ le prove ════════════════════════
-- Quarta sorella di registra_evidence (missioni) e registra_evidenze_test: la
-- forma è la loro, non una nuova. Differenze, tutte necessarie:
--   - lo studente si legge da auth.uid(), non da una riga di tentativo: qui il
--     tentativo non esiste, esiste la consegna;
--   - la finestra NON viene ricontrollata. Il testo è stato consegnato in tempo
--     (lo garantisce il `with check` dell'insert); se il giudizio arriva un
--     minuto dopo la chiusura, il credito è comunque suo. Ricontrollarla
--     significherebbe perdere una consegna valida per la lentezza di una
--     chiamata AI.
--
-- LA GUARDIA SULL'ARRAY VUOTO. Sulle gemelle (19/09) una seconda finalizzazione a
-- vuoto non lasciava il profilo com'era, glielo SVUOTAVA — e con le prove usciva
-- anche la riga di area_signal.
--
-- ⚠️ QUELLO CHE PORTA IL PESO È CHE LA GUARDIA CI SIA, non che stia prima del
-- delete: [verificato sulla replica, non dedotto] spostandola DOPO il delete le
-- prove sopravvivono comunque, perché un `raise` dentro la funzione annulla la
-- sottotransazione e con lei il delete. Il difetto del 19/09 era una guardia
-- ASSENTE — la funzione tornava con successo, e il successo è il modo in cui un
-- profilo si svuota senza che nessuno se ne accorga. Provato togliendola: un
-- array vuoto non solleva più e le prove che c'erano passano da 1 a 0.
-- Resta scritta prima del delete perché è il posto in cui si legge (e perché un
-- domani un handler dentro la funzione potrebbe inghiottire il raise), ma la
-- proprietà da non perdere è la sua esistenza.
create or replace function public.registra_evidenze_consegna_evento(p_evento_id uuid, p_evidenze jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_consegna uuid;
  v_aree_evento text[];
  v_fuori text[];
  v_aree text[];
  v_area text;
begin
  if v_student is null then
    raise exception 'non_autorizzato';
  end if;

  -- Prima di toccare qualunque riga: niente prove, niente scrittura.
  if p_evidenze is null or jsonb_typeof(p_evidenze) <> 'array' or jsonb_array_length(p_evidenze) = 0 then
    raise exception 'nessuna_prova';
  end if;

  select id into v_consegna
  from public.consegne_evento
  where evento_id = p_evento_id and student_id = v_student;
  if v_consegna is null then
    raise exception 'non_autorizzato';
  end if;

  select array_agg(area_slug) into v_aree_evento from public.eventi_aree where evento_id = p_evento_id;
  if v_aree_evento is null then
    raise exception 'evento_senza_aree';
  end if;

  -- Ogni prova deve portare un'area DI QUESTO EVENTO. Solleva invece di
  -- filtrare: un filtro silenzioso nasconderebbe un difetto del chiamante, e
  -- una prova senza area (o con l'area di un altro evento) è precisamente la
  -- riga che non serve a nessuno e di cui non si accorge nessuno.
  select array_agg(a) into v_fuori from (
    select coalesce(nullif(e->>'area_slug',''), '(assente)') as a
    from jsonb_array_elements(p_evidenze) e
    where nullif(e->>'area_slug','') is null
       or not (nullif(e->>'area_slug','') = any (v_aree_evento))
  ) t;
  if v_fuori is not null then
    raise exception 'prova_fuori_aree: %', array_to_string(v_fuori, ', ');
  end if;

  select array_agg(distinct a) into v_aree from (
    select area_slug as a from public.evidence
      where evento_id = p_evento_id and student_id = v_student and area_slug is not null
    union
    select nullif(e->>'area_slug','') as a from jsonb_array_elements(p_evidenze) e
  ) t;

  delete from public.evidence where evento_id = p_evento_id and student_id = v_student;

  insert into public.evidence
    (student_id, evento_id, area_slug, categoria, dimensione, valore, peso, fonte, step_id, motivazione)
  select
    v_student, p_evento_id,
    e->>'area_slug',
    'area'::public.evidence_categoria,
    (e->>'dimensione')::public.escape_dimensione,
    (e->>'valore')::numeric,
    (e->>'peso')::numeric,
    'evento'::public.escape_fonte,
    null,
    e->>'motivazione'
  from jsonb_array_elements(p_evidenze) as e;

  foreach v_area in array coalesce(v_aree, '{}') loop
    perform public.ricalcola_area_signal(v_student, v_area);
  end loop;

  update public.consegne_evento set valutata_il = now() where id = v_consegna;
end;
$$;

-- ════════════════════════ permessi ════════════════════════
-- `revoke … from public, anon` e non solo `from public`: i default privileges di
-- Supabase concedono EXECUTE ad anon e authenticated su ogni funzione nuova
-- dello schema public, e una revoca da PUBLIC non li tocca (verificato sul DB
-- live il 19/09).
revoke all on function public.imposta_domanda_consegna(uuid, text) from public, anon;
revoke all on function public.registra_evidenze_consegna_evento(uuid, jsonb) from public, anon;
grant execute on function public.imposta_domanda_consegna(uuid, text) to authenticated;
grant execute on function public.registra_evidenze_consegna_evento(uuid, jsonb) to authenticated;

-- Le due di sola lettura restano leggibili a chi è collegato (le chiama la
-- pagina dello studente); `anon` non ne ha bisogno e non le riceve.
revoke all on function public.consegna_evento_aperta(uuid) from public, anon;
revoke all on function public.puo_consegnare_evento(uuid) from public, anon;
grant execute on function public.consegna_evento_aperta(uuid) to authenticated;
grant execute on function public.puo_consegnare_evento(uuid) to authenticated;
