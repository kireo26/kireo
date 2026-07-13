-- Fix del bug in produzione (diagnosticato il 13/7): la registrazione ente
-- falliva SEMPRE, anche con email mai usate. Causa: finalize_registration_
-- istituzione è SECURITY INVOKER, e il suo insert su istituzioni usava
-- "returning id" — che richiede, per la clausola RETURNING, che chi scrive
-- possa anche leggere la riga appena inserita secondo le policy SELECT su
-- istituzioni. Nessuna delle tre lo permette in questo momento preciso:
-- istituzioni_select_pubblico_attive richiede stato='attiva' (qui è sempre
-- 'in_attesa' al signup), istituzioni_select_admin richiede ruolo admin,
-- istituzioni_select_propria richiede current_istituzione_id() = id — ma
-- institution_profiles (da cui legge current_istituzione_id) non esiste
-- ancora: viene creato DOPO, più avanti nella stessa funzione. Un classico
-- ordinamento circolare: nessun ordine delle 3 insert lo risolve restando
-- SECURITY INVOKER, perché il collegamento utente-istituzione non può
-- esistere prima dell'istituzione stessa. Confermato al 100% delle chiamate
-- riproducendo lo schema completo su un Postgres locale (con lo stesso
-- auth.uid()/ruoli di PostgREST), indipendentemente da email/nome/slug —
-- coerente con il sintomo osservato in produzione.
--
-- Fix: l'id dell'istituzione si genera PRIMA con gen_random_uuid() e si
-- inserisce esplicitamente, eliminando il "returning" — la funzione resta
-- SECURITY INVOKER (stesso principio già documentato per finalize_
-- registration: gli insert restano soggetti alle RLS esistenti), senza
-- bisogno di elevare i privilegi della funzione.
--
-- Approfitta dello stesso intervento per un requisito esplicito rimasto
-- scoperto: lo slug proposto dal client (generato lato UI da generaSlug, sul
-- nome ente) può collidere con uno slug già esistente. Prima di questo fix
-- una collisione avrebbe fatto fallire l'intera registrazione con un errore
-- 23505 sul vincolo unique(slug) — ora la funzione prova suffissi
-- incrementali (-2, -3, ...) finché non trova uno slug libero, quindi lo
-- slug scritto in istituzioni non è mai né null né in collisione. La verifica
-- di disponibilità passa da slug_istituzione_in_uso() (sotto): restando
-- SECURITY INVOKER, una query diretta su istituzioni vedrebbe solo le righe
-- 'attiva' (le altre 'in_attesa', comprese quelle di un altro ente che ha
-- appena scelto lo stesso slug, sono invisibili per RLS a chi si sta
-- registrando ora) — un helper dedicato, sullo stesso principio di
-- current_ruolo()/current_istituzione_id(), verifica l'esistenza bypassando
-- le RLS ma restituisce solo un booleano, non i dati della riga.
--
-- La funzione resta un'unica chiamata PL/pgSQL: un errore in un punto
-- qualsiasi annulla tutti gli insert precedenti nella stessa chiamata
-- (nessuna scrittura parziale possibile), e la guardia iniziale (profilo già
-- esistente => return) rende sicuro un secondo tentativo sulla stessa
-- email/utente — compreso un tentativo interrotto a metà per qualunque
-- motivo (rete, scanner email, timeout): al login successivo l'auto-
-- riparazione già esistente (getEnteContext) richiama questa stessa
-- funzione e completa la registrazione senza bisogno di sapere perché il
-- primo tentativo non è arrivato in fondo.
create or replace function public.slug_istituzione_in_uso(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.istituzioni where slug = p_slug);
$$;

grant execute on function public.slug_istituzione_in_uso(text) to authenticated;

create or replace function public.finalize_registration_istituzione(
  p_nome_ente text,
  p_slug text,
  p_tipo public.istituzione_tipo,
  p_referente_nome text,
  p_referente_cognome text,
  p_sito_ufficiale text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_istituzione_id uuid;
  v_piano_free_id uuid;
  v_slug_base text;
  v_slug text;
  v_tentativo integer := 1;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    return; -- già finalizzato (es. link email aperto due volte)
  end if;

  select id into v_piano_free_id from public.piani where nome = 'free';

  -- Slug mai null: se manca o è vuoto dopo il trim (non dovrebbe succedere,
  -- generaSlug lato client parte sempre da un nome ente obbligatorio, ma la
  -- funzione non deve comunque poter scrivere una riga con slug nullo)
  -- ricade su un prefisso fisso, poi comunque reso univoco sotto.
  v_slug_base := nullif(trim(coalesce(p_slug, '')), '');
  if v_slug_base is null then
    v_slug_base := 'ente';
  end if;

  v_slug := v_slug_base;
  while public.slug_istituzione_in_uso(v_slug) loop
    v_tentativo := v_tentativo + 1;
    v_slug := v_slug_base || '-' || v_tentativo;
  end loop;

  v_istituzione_id := gen_random_uuid();

  insert into public.istituzioni (id, nome, slug, tipo, sito_ufficiale, piano_id, stato)
  values (v_istituzione_id, p_nome_ente, v_slug, p_tipo, p_sito_ufficiale, v_piano_free_id, 'in_attesa');

  insert into public.profiles (id, ruolo, nome, cognome)
  values (v_uid, 'istituzione', p_referente_nome, p_referente_cognome);

  insert into public.institution_profiles (user_id, istituzione_id)
  values (v_uid, v_istituzione_id);
end;
$$;

grant execute on function public.finalize_registration_istituzione(text, text, public.istituzione_tipo, text, text, text) to authenticated;
