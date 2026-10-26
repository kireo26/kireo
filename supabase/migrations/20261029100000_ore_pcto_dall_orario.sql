-- LE ORE PCTO DI UN EVENTO SI CALCOLANO DALL'ORARIO (Mario, 26/10) — migrazione A di due.
--
-- Fino a oggi `eventi.ore_pcto` era un campo libero del form di creazione: un
-- ente poteva dichiarare due ore su un incontro di venti minuti, e quelle due
-- ore uscivano intere da ogni certificazione manuale di una scuola (che dal
-- 25/10 non ha tetto). Le decisioni:
--
--   1. le ore dichiarate sono la durata della finestra programmata,
--      arrotondata PER DIFETTO a due decimali (20 minuti → 0,33);
--   2. il campo nel form sparisce;
--   3. spostare la finestra ricalcola le ore, in un posto solo;
--   4. l'admin può sempre correggere a mano, in tutte e due le direzioni, e
--      la correzione resta registrata con chi e quando; uno spostamento della
--      finestra la toglie;
--   5. gli eventi già creati restano come sono, e le ore già emesse
--      (`iscrizioni_eventi.ore_riconosciute`) non si toccano mai;
--   6. l'orario di fine diventa obbligatorio per ogni evento NUOVO.
--
-- ⚠️ IL POSTO SOLO È UN TRIGGER, non un'operazione da chiamare (Mario): le
-- strade che scrivono `eventi` sono già quattro — il form, lo spostamento,
-- l'update dell'ente in bozza, l'admin — e la quinta è quella che nessuno ha
-- ancora scritto. «Una regola che sta su una strada vale per chi passa di lì;
-- una regola che sta sul posto vale per tutti quelli che arrivano.»
--
-- ⚠️ IL NUMERO RESTA SCRITTO SULLA RIGA, non derivato: sette lettori lo
-- leggono da lì (`ore_riconoscibili_evento`, `certifica_presenza`, la
-- certificazione docenti, le card, le statistiche della scuola, il CSV), e gli
-- eventi vecchi devono tenere il loro.
--
-- ⚠️ DUE MIGRAZIONI, E L'ORDINE È A → DEPLOY → B (confermato da Mario).
-- Questa (A) va applicata PRIMA del deploy: all'insert il trigger riscrive le
-- ore, quindi il form vecchio — che le manda ancora — continua a funzionare
-- nei minuti prima del deploy, e il form nuovo chiama `ore_dichiarate_da_finestra`,
-- che nasce qui. La B (`20261029110000`) revoca al client l'insert di
-- `ore_pcto` e va applicata DOPO il deploy: prima romperebbe il form vecchio.
-- L'ordine inverso (deploy prima di A) farebbe nascere a 0 ore, in silenzio,
-- gli eventi creati in mezzo — la forma peggiore delle due.
--
-- COME SI VERIFICA APPLICATA: la funzione `ore_dichiarate_da_finestra` esiste,
-- e `obj_description` sul trigger function nomina 20261029100000. In più
-- `has_column_privilege('authenticated','public.eventi','ore_pcto','UPDATE')`
-- è FALSO e la colonna di controllo `stato` (che il client scrive davvero,
-- `AzioneApprovazione`) è VERA.

-- ============ 1) la formula, una sola ============
-- ⚠️ `36.0` e non `36`: con tre interi `/` è una divisione intera, e
-- `floor(1200/36)/100` fa 33/100 = 0 — tutto quello che sta sotto l'ora
-- diventerebbe 0,00 e l'ora esatta resterebbe 1,00, cioè il caso che si prova
-- per primo sarebbe l'unico a funzionare (Mario). `extract(epoch …)` su una
-- differenza fra due `timestamptz` è una durata ASSOLUTA: una finestra che
-- attraversa il cambio dell'ora dura quanto è durata davvero.
--
-- Null quando non c'è una finestra (un estremo mancante, o la fine prima
-- dell'inizio): un numero inventato qui finirebbe su un documento.
create or replace function public.ore_dichiarate_da_finestra(p_inizio timestamptz, p_fine timestamptz)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_inizio is null or p_fine is null or p_fine < p_inizio then null
    else (floor(extract(epoch from (p_fine - p_inizio)) / 36.0) / 100)::numeric(6, 2)
  end
$$;
-- Eseguibile dal client: il form di creazione la chiama per dire all'ente
-- quanto varrà l'incontro, con lo stesso codice che poi scrive il numero.
revoke all on function public.ore_dichiarate_da_finestra(timestamptz, timestamptz) from public, anon;
grant execute on function public.ore_dichiarate_da_finestra(timestamptz, timestamptz) to authenticated;

-- ============ 2) il segno della correzione dell'admin ============
-- ⚠️ `ore_pcto_fissate_da` BLOCCA la cancellazione del profilo, come le altre
-- colonne di responsabilità (`diretta_chiusa_da_user`, `certificata_da_user`,
-- `verificato_da`…): il testo che l'admin legge promette «la correzione resta
-- registrata con il tuo nome», e un `on delete set null` la renderebbe falsa
-- il giorno in cui quell'account sparisce.
alter table public.eventi
  add column if not exists ore_pcto_fissate_il timestamptz,
  add column if not exists ore_pcto_fissate_da uuid references public.profiles (id);

alter table public.eventi drop constraint if exists eventi_ore_pcto_fissate_check;
alter table public.eventi
  add constraint eventi_ore_pcto_fissate_check
  check (ore_pcto_fissate_da is null or ore_pcto_fissate_il is not null);

comment on column public.eventi.ore_pcto_fissate_il is
  'Quando l''admin ha fissato a mano ore_pcto (correggi_ore_evento). Null = le ore sono quelle calcolate dall''orario (o, per un evento creato prima del 26/10, quelle scritte dall''ente). Uno spostamento della finestra lo azzera: il trigger eventi_ore_da_orario ricalcola.';
comment on column public.eventi.ore_pcto_fissate_da is
  'Chi ha fissato a mano ore_pcto. La FK blocca la cancellazione del profilo, come le altre colonne di responsabilità: la correzione deve sapere chi l''ha firmata anche dopo.';

-- ============ 3) il trigger: il posto solo ============
create or replace function public.eventi_ore_da_orario()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- ⚠️ La fine obbligatoria la impone il trigger d'insert e NON un CHECK:
    -- un `check … not valid` non guarda le righe vecchie, ma guarda comunque
    -- la PROSSIMA scrittura su una riga vecchia — e la prossima scrittura su
    -- un evento vecchio senza fine è l'admin che lo approva.
    if new.data_fine is null then
      raise exception 'data_fine_obbligatoria';
    end if;
    -- ⚠️ `<=` E NON `<` (Mario, 26/10): una finestra di durata zero varrebbe
    -- 0,00 ore e l'evento si creerebbe — ma un incontro che comincia e finisce
    -- nello stesso istante non è un incontro. Il vincolo `eventi_date_order`
    -- (`data_fine >= data_inizio`) resta com'è: gli eventi vecchi non si
    -- toccano, e un CHECK più stretto guarderebbe la prossima scrittura su di loro.
    if new.data_fine <= new.data_inizio then
      raise exception 'fine_non_dopo_inizio';
    end if;
    -- Il valore che arriva dal client si IGNORA, chiunque sia a scrivere
    -- (anche `postgres`): le fixture che vogliono ore diverse dalla finestra
    -- le fissano con un update dopo l'insert.
    new.ore_pcto := public.ore_dichiarate_da_finestra(new.data_inizio, new.data_fine);
    new.ore_pcto_fissate_il := null;
    new.ore_pcto_fissate_da := null;
  elsif new.data_inizio is distinct from old.data_inizio or new.data_fine is distinct from old.data_fine then
    if new.data_fine is null then
      raise exception 'data_fine_obbligatoria';
    end if;
    if new.data_fine <= new.data_inizio then
      raise exception 'fine_non_dopo_inizio';
    end if;
    -- Uno spostamento toglie la correzione a mano (Mario): il numero si rifà,
    -- non si ricorda. Se la stessa scrittura cambia date e ore insieme, vince
    -- il calcolo — che è la regola, non un caso.
    new.ore_pcto := public.ore_dichiarate_da_finestra(new.data_inizio, new.data_fine);
    new.ore_pcto_fissate_il := null;
    new.ore_pcto_fissate_da := null;
  end if;
  -- Un update che non tocca le date non tocca le ore: è la strada della
  -- correzione dell'admin, e quella di un evento vecchio che si approva.
  return new;
end;
$$;

comment on function public.eventi_ore_da_orario() is
  'Le ore PCTO di un evento dall''orario (20261029100000): all''insert sempre calcolate dalla finestra, e fine obbligatoria; quando cambia la finestra, ricalcolate e correzione a mano tolta. Formula: ore_dichiarate_da_finestra.';

drop trigger if exists eventi_ore_da_orario on public.eventi;
create trigger eventi_ore_da_orario
  before insert or update on public.eventi
  for each row execute function public.eventi_ore_da_orario();

-- ============ 4) il client non scrive più `ore_pcto` ============
-- ⚠️ «UNA REGOLA SU UNA COLONNA SI SCRIVE NEI PRIVILEGI DI COLONNA»: una
-- policy non può dire «questa colonna non cambia», perché `using` vede la riga
-- vecchia e `with check` la nuova, e non si confrontano. Oggi l'ente in bozza
-- (`eventi_update_propria_non_revisionato`) e l'admin (`eventi_admin_tutto`)
-- possono riscriversi le ore dal client; da qui solo `correggi_ore_evento`,
-- che è SECURITY DEFINER e scavalca i privilegi del client.
--
-- ⚠️ L'ELENCO È STATICO, ED È SCRITTO APPOSTA COSÌ: una colonna aggiunta a
-- `eventi` dopo oggi NON sarà aggiornabile dal client finché qualcuno non la
-- aggiunge qui. È il verso rumoroso — un `permission denied` al primo update —
-- e non quello muto. Chi aggiunge una colonna che il client deve scrivere
-- aggiunge una riga di grant nella stessa migrazione.
--
-- `revoke` anche da `anon`: non ha nessuna policy di update, quindi non cambia
-- niente oggi, e non lascia un privilegio di tabella che nessuno ha deciso.
revoke update on public.eventi from authenticated, anon;
grant update (
  id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, sede, link, posti,
  stato, created_at, updated_at, cta_esterna_url, cta_esterna_approvata, note_revisione,
  in_evidenza, in_evidenza_dal, pubblico, filone, hosting_diretta, youtube_video_id,
  checklist_diretta, checklist_diretta_accettata_il, proposta_incontro_id, domanda_consegna,
  incorporamento_sonda, diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_da_user,
  diretta_chiusa_presenti, diretta_chiusa_certificati, diretta_durata_minuti
) on public.eventi to authenticated;

-- ============ 5) l'anteprima dello spostamento ============
-- ⚠️ «UN AVVISO CALCOLATO DA QUALCUNO DI DIVERSO DA CHI POI AGISCE NON È UN
-- AVVISO: È UNA PREVISIONE» (Mario). Il numero che il form mostra prima del
-- clic è calcolato con la stessa funzione che il trigger usa per scriverlo:
-- nessuna copia della formula in TS, perché due implementazioni divergono
-- esattamente dove nessuno ha pensato (il cambio dell'ora, per esempio).
--
-- Stesse autorizzazioni di `sposta_finestra_evento`: chi non può spostare non
-- ha niente da vedere in anteprima.
create or replace function public.anteprima_spostamento_finestra(
  p_evento_id uuid,
  p_data_inizio timestamptz,
  p_data_fine timestamptz
)
returns table (ore_attuali numeric, ore_nuove numeric, fissate_a_mano boolean, aveva_fine boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizzatore uuid;
  v_ore numeric;
  v_fissate timestamptz;
  v_fine timestamptz;
begin
  select e.organizzatore_id, e.ore_pcto, e.ore_pcto_fissate_il, e.data_fine
    into v_organizzatore, v_ore, v_fissate, v_fine
  from public.eventi e where e.id = p_evento_id;

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

  return query select
    v_ore,
    public.ore_dichiarate_da_finestra(p_data_inizio, p_data_fine),
    v_fissate is not null,
    v_fine is not null;
end;
$$;

revoke all on function public.anteprima_spostamento_finestra(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.anteprima_spostamento_finestra(uuid, timestamptz, timestamptz) to authenticated;

-- ============ 6) la correzione dell'admin ============
-- Qualunque valore, in tutte e due le direzioni (Mario): sopra la durata
-- l'admin legge che la certificazione automatica resta limitata e quella
-- manuale della scuola no. Anche a diretta chiusa: non si vieta, si dice —
-- e le ore già emesse restano quelle di allora, perché nessuno le riscrive
-- (`iscrizioni_eventi` non è toccata da questa funzione né dal trigger).
--
-- Due decimali al massimo, come il campo: la colonna li tiene, un terzo
-- decimale verrebbe arrotondato in silenzio (la regola del 18/10).
create or replace function public.correggi_ore_evento(p_evento_id uuid, p_ore numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;
  if p_ore is null or p_ore < 0 then
    raise exception 'ore_non_valide';
  end if;
  if p_ore <> round(p_ore, 2) then
    raise exception 'ore_troppi_decimali';
  end if;

  update public.eventi
  set ore_pcto = p_ore, ore_pcto_fissate_il = now(), ore_pcto_fissate_da = auth.uid()
  where id = p_evento_id;

  if not found then
    raise exception 'evento_non_trovato';
  end if;
end;
$$;

revoke all on function public.correggi_ore_evento(uuid, numeric) from public, anon;
grant execute on function public.correggi_ore_evento(uuid, numeric) to authenticated;

-- Il massimo che la CHIUSURA AUTOMATICA riconoscerà, per i testi dell'admin:
-- la stessa espressione di `ore_riconoscibili_evento` con le ore dichiarate
-- tolte di mezzo, sulla stessa durata (`durata_vera_minuti`: chiusa → scritta,
-- non chiusa → programmata, senza fine → ignota).
create or replace function public.anteprima_correzione_ore(p_evento_id uuid)
returns table (durata_minuti numeric, massimo numeric, chiusa boolean, ore_attuali numeric, fissate_il timestamptz, ha_fine boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  return query
  select
    public.durata_vera_minuti(e.id),
    (floor(public.durata_vera_minuti(e.id) / 60.0 * 100) / 100)::numeric(6, 2),
    e.diretta_chiusa_il is not null,
    e.ore_pcto,
    e.ore_pcto_fissate_il,
    -- Senza una fine, e mai chiuso, l'evento cade nel ramo «durata ignota» di
    -- `ore_riconoscibili_evento`: le ore dichiarate, SENZA tetto. È l'unico
    -- caso in cui quello che l'admin scrive arriva intero, e il testo lo dice.
    e.data_fine is not null
  from public.eventi e
  where e.id = p_evento_id;

  if not found then
    raise exception 'evento_non_trovato';
  end if;
end;
$$;

revoke all on function public.anteprima_correzione_ore(uuid) from public, anon;
grant execute on function public.anteprima_correzione_ore(uuid) to authenticated;
