-- La scuola legge i suoi studenti da una funzione, non dalle tabelle
-- (01/11, passo 1 del capitolo della scuola; decisione di Mario).
--
-- IL DIFETTO. `student_profiles_select_scuola` e `profiles_select_scuola_studenti`
-- dicevano QUALI righe la scuola legge, non QUALI colonne: dall'API un referente
-- o un tutor leggeva data di nascita, telefono, consenso alle comunicazioni,
-- `di_prova`, `anno_diploma`, e già per uno studente solo DICHIARATO.
--
-- PERCHÉ NON BASTA STRINGERE LE COLONNE. I privilegi di colonna valgono per
-- RUOLO, e la scuola e lo studente sono tutti e due `authenticated`: togliere
-- `data_nascita` alla scuola la toglierebbe anche allo studente, che la legge
-- nel proprio profilo. Quindi le due policy escono, e la scuola legge da
-- `studenti_della_scuola()`, che restituisce solo le colonne decise:
--   dichiarato  nome, cognome, classe dichiarata, data della dichiarazione,
--               email (Mario, 01/11: senza un elemento che distingua, il
--               referente verifica male; ed è lo studente che ha indicato
--               quella scuola). L'email di un dichiarato serve solo alla
--               verifica: le pagine la mostrano solo sulle righe in attesa.
--   verificato  nome, cognome, email, classe, data della verifica.
--   mai         data di nascita, telefono, consenso alle comunicazioni,
--               `di_prova`, `anno_diploma`, chi ha verificato.
-- È la forma della nota di revisione (20261101100000): un permesso che non
-- esiste è una scelta che resta, una colonna non mostrata è una scelta di oggi.
--
-- LA TABELLA DEI SOGGETTI, misurata prima di togliere (replica, 01/11): le due
-- policy le leggeva anche CHI NON ERA IL CLIENT, cioè tre cose del database che
-- girano con i privilegi di chi chiama. Senza la cura si sarebbero rotte così:
--   1. `iscrizioni_eventi_select_scuola` cerca lo studente in `student_profiles`
--      dentro la propria condizione: la scuola non avrebbe più visto nessuna
--      iscrizione, in silenzio (il registro presenze vuoto).
--   2. `invia_messaggio_scuola` (non definer) sceglie i destinatari leggendo
--      `student_profiles`: un messaggio a tutta la scuola sarebbe arrivato a
--      zero persone, senza errore.
--   3. il trigger `check_studente_verificato_stessa_scuola` su `classi_studenti`
--      (non definer): aggiungere uno studente a una classe sarebbe fallito.
-- I tre passano a una lettura definer. Le due viste `stats_scuola*` girano come
-- proprietario e non dipendevano dalle policy.
--
-- IN PIÙ, per costruzione: `invia_messaggio_scuola` diventa definer, quindi il
-- client non ha più bisogno di inserire in `messaggi_scuola` e
-- `messaggi_scuola_destinatari`. Quelle dieci colonne escono dalle scritture del
-- client (registro: 191 → 181), e con loro la metà «insert» della falla in
-- quarantena `messaggio-scuola-ripuntato` (una scuola che consegnava un messaggio
-- a uno studente non verificato con un insert diretto).
--
-- ESCE ANCHE `email_studenti_scuola`: dava l'email di qualunque studente con quel
-- codice di scuola. La sostituisce la colonna `email` della funzione nuova.

-- 1 · le letture definer --------------------------------------------------

create or replace function public.e_studente_verificato_della_scuola(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_scuola_id() is not null
     and exists (
       select 1 from public.student_profiles sp
       where sp.user_id = p_student_id
         and sp.stato_verifica = 'verificato'
         and sp.school_code = public.current_scuola_id()
     );
$$;

revoke all on function public.e_studente_verificato_della_scuola(uuid) from public, anon;
grant execute on function public.e_studente_verificato_della_scuola(uuid) to authenticated, service_role;

create or replace function public.studenti_della_scuola()
returns table (
  user_id uuid,
  nome text,
  cognome text,
  classe text,
  stato_verifica public.stato_verifica_studente,
  dichiarato_il timestamptz,
  verificato_il timestamptz,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.user_id,
         p.nome,
         p.cognome,
         sp.classe,
         sp.stato_verifica,
         sp.created_at,
         case when sp.stato_verifica = 'verificato' then sp.verificato_il end,
         u.email::text
  from public.student_profiles sp
  join public.profiles p on p.id = sp.user_id and p.ruolo = 'studente'
  left join auth.users u on u.id = sp.user_id
  where public.current_ruolo_staff() in ('referente', 'tutor')
    and public.current_scuola_id() is not null
    and sp.school_code = public.current_scuola_id()
    and sp.stato_verifica in ('dichiarato', 'verificato');
$$;

revoke all on function public.studenti_della_scuola() from public, anon;
grant execute on function public.studenti_della_scuola() to authenticated, service_role;

comment on function public.studenti_della_scuola() is
  '20261128100000: l''unica lettura degli studenti da parte della scuola. Mai data di nascita, telefono, consenso, di_prova, anno_diploma, chi ha verificato. L''email di un dichiarato serve alla verifica.';

-- 2 · le tre cose che dipendevano dalle policy ----------------------------

drop policy if exists iscrizioni_eventi_select_scuola on public.iscrizioni_eventi;
create policy iscrizioni_eventi_select_scuola
  on public.iscrizioni_eventi for select
  to authenticated
  using (
    public.current_ruolo_staff() in ('referente', 'tutor')
    and public.e_studente_verificato_della_scuola(student_id)
  );

alter function public.invia_messaggio_scuola(text, text, text, uuid, uuid[], text) security definer;
alter function public.check_studente_verificato_stessa_scuola() security definer;

revoke all on function public.invia_messaggio_scuola(text, text, text, uuid, uuid[], text) from public, anon;
grant execute on function public.invia_messaggio_scuola(text, text, text, uuid, uuid[], text) to authenticated, service_role;

revoke insert (id, scuola_profilo_id, mittente_user, destinatari, classe_id, oggetto, corpo, canale) on public.messaggi_scuola from authenticated;
revoke insert (messaggio_id, student_id) on public.messaggi_scuola_destinatari from authenticated;

-- 3 · le due policy e la funzione dell'email escono -----------------------

drop policy if exists student_profiles_select_scuola on public.student_profiles;
drop policy if exists profiles_select_scuola_studenti on public.profiles;
drop function if exists public.email_studenti_scuola(uuid[]);

-- 4 · si rilegge ----------------------------------------------------------

do $$
declare
  v_policy int;
  v_definer int;
  v_insert boolean;
begin
  select count(*) into v_policy from pg_policies
  where schemaname = 'public'
    and policyname in ('student_profiles_select_scuola', 'profiles_select_scuola_studenti');
  if v_policy <> 0 then
    raise exception '20261128100000: le policy della scuola su profiles e student_profiles ci sono ancora (%)', v_policy;
  end if;

  select count(*) into v_definer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and p.proname in ('invia_messaggio_scuola', 'check_studente_verificato_stessa_scuola',
                      'studenti_della_scuola', 'e_studente_verificato_della_scuola');
  if v_definer <> 4 then
    raise exception '20261128100000: le funzioni definer attese sono 4, ne risultano %', v_definer;
  end if;

  v_insert := has_column_privilege('authenticated', 'public.messaggi_scuola_destinatari', 'student_id', 'INSERT')
           or has_column_privilege('authenticated', 'public.messaggi_scuola', 'corpo', 'INSERT');
  if v_insert then
    raise exception '20261128100000: il client inserisce ancora i messaggi della scuola';
  end if;

  if to_regprocedure('public.email_studenti_scuola(uuid[])') is not null then
    raise exception '20261128100000: email_studenti_scuola c''è ancora';
  end if;
end $$;
