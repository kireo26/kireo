-- LA RIGA DI UNA DOMANDA DICE CHI L'HA TOCCATA, E QUANDO (11/10/2026)
--
-- ⚠️ IL DIFETTO, dalla spec di Mario sui due moderatori: l'ente e l'admin
-- vedono la STESSA lista con gli STESSI due bottoni, lo stato è condiviso e si
-- propaga in 15 secondi — ma la riga non dice CHI l'ha toccata. Con un
-- moderatore e un presentatore, al minuto tre rispondono entrambi alla stessa
-- domanda davanti a una classe, e al minuto successivo nessuno risponde a
-- quella dopo perché ognuno crede che ci stia pensando l'altro.
--
-- Nessun lucchetto, di proposito: due persone che leggono le stesse domande non
-- devono chiedersi il turno, devono vedere cosa è già stato fatto. Serve una
-- riga che dica «letta da KIREO · 19:05» invece di «letta».
--
-- COSA FA: due colonne (da che parte, a che ora) su `domande_live`, scritte
-- dall'unica funzione che cambia lo stato, e restituite a chi legge. Nessun
-- dato trasformato: le colonne nascono nulle, quindi una domanda toccata prima
-- di oggi resta «letta» senza autore — e NON si prova a indovinarlo (la stessa
-- scelta della traccia di chiusura: `letta_il` c'è, ma dice soltanto che
-- qualcuno l'ha toccata, non chi).
--
-- ⚠️ IL TIPO E NON LA PERSONA, ed è una scelta: le due parti che moderano sono
-- KIREO e l'ente, e sono esattamente quelle che la spec nomina. Una colonna
-- `_da_user` con la sua FK verso `profiles` sarebbe l'undicesima colonna di
-- responsabilità che BLOCCA la cancellazione di un account (punto aperto in
-- CLAUDE.md) — e qui, a differenza di una certificazione, non c'è nessun valore
-- formale da firmare. Il prezzo: due persone dello stesso ente restano
-- indistinguibili. Il caso della spec regge comunque, perché quello che
-- impedisce la doppia risposta è sapere che QUALCUNO l'ha data, non chi.
--
-- ⚠️ E NON SI RIUSA `letta_il`, che è l'ora del PRIMO tocco
-- (`coalesce(letta_il, now())`, invariato): su una domanda che passa a `letta`
-- alle 19:05 e a `risposta_live` alle 19:07 mostrerebbe «risposta dall'ente ·
-- 19:05», cioè l'ora di un fatto diverso da quello nominato. Un nome che tiene
-- un'altra cosa è la specie di casa. `letta_il` resta com'è — nessuno la legge
-- oggi [verificato: il tipo `Domanda` del componente non la destruttura
-- nemmeno], e toccarla sarebbe un cambiamento che non serve a questo giro.

-- ============ 1) le due colonne ============
alter table public.domande_live
  add column if not exists stato_da_tipo text,
  add column if not exists stato_il timestamptz;

alter table public.domande_live
  drop constraint if exists domande_live_stato_da_tipo_valido;
alter table public.domande_live
  add constraint domande_live_stato_da_tipo_valido
  check (stato_da_tipo is null or stato_da_tipo in ('kireo', 'ente'));

-- Le due stanno insieme o non stanno: «letta da KIREO» senza l'ora e «letta
-- alle 19:05» senza l'autore sono due mezze risposte alla stessa domanda.
alter table public.domande_live
  drop constraint if exists domande_live_stato_tocco_completo;
alter table public.domande_live
  add constraint domande_live_stato_tocco_completo
  check (
    (stato_da_tipo is null and stato_il is null)
    or (stato_da_tipo is not null and stato_il is not null)
  );

-- ⚠️ UNA DOMANDA `nuova` NON PUÒ AVERE UN AUTORE DEL TOCCO: le due colonne
-- descrivono l'ULTIMA transizione, e su una domanda che nessuno ha toccato non
-- c'è nessuna transizione da descrivere. Senza questo vincolo una riga
-- `nuova` con `stato_da_tipo = 'ente'` sarebbe rappresentabile, e la riga a
-- schermo direbbe «letta dall'ente» su una domanda che nessuno ha letto.
alter table public.domande_live
  drop constraint if exists domande_live_nuova_senza_tocco;
alter table public.domande_live
  add constraint domande_live_nuova_senza_tocco
  check (stato <> 'nuova' or stato_da_tipo is null);

comment on column public.domande_live.stato_da_tipo is
  'Da che parte è arrivata l''ULTIMA transizione di stato: kireo (admin) o ente (l''organizzatore). Scritta solo da aggiorna_stato_domanda_live. Null = nessuno l''ha toccata, oppure l''ha toccata prima dell''11/10/2026, quando non si registrava: i due casi non sono distinguibili e non si prova a indovinarlo.';
comment on column public.domande_live.stato_il is
  'Quando è avvenuta l''ULTIMA transizione. Diversa da letta_il, che è l''ora del PRIMO tocco e resta tale: su una domanda letta alle 19:05 e risposta alle 19:07, questa dice 19:07 — l''ora del fatto che la riga nomina.';

-- ============ 2) chi cambia lo stato lo scrive ============
-- `create or replace`: stessa firma e stesso tipo di ritorno (void), quindi i
-- permessi restano. Il corpo è ripreso TALE E QUALE da
-- `20260726110000_diretta_presenze_domande.sql` con DUE differenze: il tipo
-- deciso nello stesso ramo che autorizza (è lo stesso fatto — un secondo
-- controllo del ruolo più in basso sarebbe una seconda definizione), e le due
-- colonne nell'update.
create or replace function public.aggiorna_stato_domanda_live(p_domanda_id uuid, p_stato text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento_id uuid;
  v_organizzatore_id uuid;
  v_da_tipo text;
begin
  if p_stato not in ('letta', 'risposta_live') then
    raise exception 'stato_non_valido';
  end if;

  select evento_id into v_evento_id from public.domande_live where id = p_domanda_id;
  if v_evento_id is null then
    raise exception 'domanda_non_trovata';
  end if;

  select organizzatore_id into v_organizzatore_id from public.eventi where id = v_evento_id;

  if public.current_ruolo() = 'admin' then
    v_da_tipo := 'kireo';
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    v_da_tipo := 'ente';
  else
    raise exception 'non_autorizzato';
  end if;

  update public.domande_live
  set stato = p_stato,
      letta_il = coalesce(letta_il, now()),
      stato_da_tipo = v_da_tipo,
      stato_il = now()
  where id = p_domanda_id;
end;
$$;

comment on function public.aggiorna_stato_domanda_live(uuid, text) is
  'Segna una domanda come letta o risposta, registrando da che parte e a che ora. Le due colonne servono ai due moderatori (KIREO e l''ente) per vedere il gesto l''uno dell''altro: senza, al minuto tre rispondono entrambi alla stessa domanda e al successivo nessuno.';

-- ============ 3) chi legge le vede ============
-- ⚠️ `DROP` E NON `CREATE OR REPLACE`: il tipo di ritorno guadagna due colonne,
-- e Postgres non permette di cambiarlo in place. Il drop porta via i permessi,
-- quindi sono rimessi in coda — e `revoke` prima di `grant`, perché una
-- funzione nuova nasce eseguibile da `anon` e `authenticated` per i default
-- privileges di Supabase (vedi `20260919120000`).
--
-- Il corpo è ripreso TALE E QUALE dalla definizione viva
-- (`20260726110000`), con le due colonne in più nei due rami e niente altro.
-- ⚠️ L'ANONIMATO STRUTTURALE RESTA: il ramo `pubblico=studenti` non tocca
-- `profiles`, quindi nome e `user_id` non possono trapelare per costruzione.
-- Le due colonne nuove dicono chi ha toccato la domanda DA PARTE NOSTRA, mai
-- chi l'ha scritta.
drop function if exists public.domande_live_organizzatore(uuid);

create function public.domande_live_organizzatore(p_evento_id uuid)
returns table (
  id uuid,
  testo text,
  stato text,
  creata_il timestamptz,
  letta_il timestamptz,
  nome_completo text,
  stato_da_tipo text,
  stato_il timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizzatore_id uuid;
  v_pubblico text;
begin
  select e.organizzatore_id, e.pubblico into v_organizzatore_id, v_pubblico from public.eventi e where e.id = p_evento_id;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  if v_pubblico = 'docenti' then
    return query
      select d.id, d.testo, d.stato, d.creata_il, d.letta_il, (p.nome || ' ' || p.cognome), d.stato_da_tipo, d.stato_il
      from public.domande_live d
      join public.profiles p on p.id = d.user_id
      where d.evento_id = p_evento_id
      order by d.creata_il;
  else
    return query
      select d.id, d.testo, d.stato, d.creata_il, d.letta_il, null::text, d.stato_da_tipo, d.stato_il
      from public.domande_live d
      where d.evento_id = p_evento_id
      order by d.creata_il;
  end if;
end;
$$;

comment on function public.domande_live_organizzatore(uuid) is
  'Le domande di una diretta per l''organizzatore: anonime per pubblico=studenti (il ramo non tocca profiles, quindi l''anonimato è strutturale), con nome per pubblico=docenti. stato_da_tipo/stato_il dicono chi ha toccato la riga DA PARTE NOSTRA e quando — mai chi l''ha scritta.';

revoke all on function public.domande_live_organizzatore(uuid) from public, anon;
grant execute on function public.domande_live_organizzatore(uuid) to authenticated;
