-- LE ISCRIZIONI D'UFFICIO DICONO QUANTI SONO ENTRATI (Mario, 27/10: «è il primo
-- difetto del capitolo scuola, e non abbiamo ancora cominciato»).
--
-- `iscrivi_studenti_evento` e `iscrivi_classe_evento` rispondevano `void`. La
-- prima scartava in silenzio gli studenti non verificati o di un'altra scuola
-- (il `where`) e quelli già iscritti (`on conflict do nothing`); la seconda i
-- già iscritti. Il referente leggeva «Fatto ✓» e non sapeva quanti erano
-- entrati: quelli rimasti fuori non avrebbero seguito l'incontro, non avrebbero
-- avuto le ore, e nella dashboard della scuola sarebbero risultati come
-- studenti che non hanno partecipato. *Un dato mancante non arriva mai con
-- l'etichetta «mancante»: arriva come uno zero.*
--
-- Ora rispondono un jsonb con il risultato dell'operazione — non un messaggio
-- d'errore: il risultato, che prima non esisteva. Le chiavi, una per esito:
--   iscritti          righe nuove scritte adesso
--   gia_iscritti      avevano già un'iscrizione a questo evento
--   non_verificati    (solo studenti) della tua scuola ma non verificati
--   altra_scuola      (solo studenti) non risultano della tua scuola
--   gruppo            (solo classe) true in modalità dad: nessuna riga
--                     individuale, la classe è iscritta come gruppo
-- La somma delle chiavi di conto è il numero degli studenti chiesti (distinti),
-- così una categoria nuova dimenticata si vede.
--
-- Il tipo di ritorno cambia, quindi drop e create (un `create or replace` non
-- può cambiarlo). Gli argomenti sono gli stessi: il codice di prima, che non
-- legge il risultato, continua a funzionare. Privilegi rimessi come in
-- 20260926110000.
--
-- COME SI VERIFICA APPLICATA: `select pg_get_function_result('public.iscrivi_studenti_evento(uuid, uuid[])'::regprocedure)`
-- dà `jsonb` (prima `void`).

drop function public.iscrivi_studenti_evento(uuid, uuid[]);
drop function public.iscrivi_classe_evento(uuid, uuid, public.iscrizione_classe_modalita);

create function public.iscrivi_studenti_evento(p_evento_id uuid, p_student_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chiesti uuid[];
  v_scuola text;
  v_iscritti integer;
  v_gia integer;
  v_non_verificati integer;
  v_altra integer;
begin
  -- Delegabile al tutor via puo_gestire_classi (vedi
  -- current_ha_permesso_staff in 20260715110000); il referente ha sempre
  -- tutto.
  if not public.current_ha_permesso_staff('gestione_classi') then
    raise exception 'non_autorizzato';
  end if;

  if not exists (select 1 from public.eventi where id = p_evento_id and stato = 'approvato') then
    raise exception 'evento_non_disponibile';
  end if;

  v_scuola := public.current_scuola_id();
  select coalesce(array_agg(distinct x), '{}') into v_chiesti from unnest(coalesce(p_student_ids, '{}')) x;

  select count(*) into v_altra
  from unnest(v_chiesti) c
  where not exists (select 1 from public.student_profiles sp where sp.user_id = c and sp.school_code = v_scuola);

  select count(*) into v_non_verificati
  from public.student_profiles sp
  where sp.user_id = any (v_chiesti) and sp.school_code = v_scuola and sp.stato_verifica is distinct from 'verificato';

  select count(*) into v_gia
  from public.student_profiles sp
  join public.iscrizioni_eventi ie on ie.student_id = sp.user_id and ie.evento_id = p_evento_id
  where sp.user_id = any (v_chiesti) and sp.school_code = v_scuola and sp.stato_verifica = 'verificato';

  insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, iscritto_da)
  select sp.user_id, p_evento_id, 'iscritto', 'scuola', auth.uid()
  from public.student_profiles sp
  where sp.user_id = any (v_chiesti)
    and sp.stato_verifica = 'verificato'
    and sp.school_code = v_scuola
  on conflict (student_id, evento_id) do nothing;
  get diagnostics v_iscritti = row_count;

  return jsonb_build_object(
    'iscritti', v_iscritti,
    'gia_iscritti', v_gia,
    'non_verificati', v_non_verificati,
    'altra_scuola', v_altra
  );
end;
$$;

create function public.iscrivi_classe_evento(
  p_classe_id uuid,
  p_evento_id uuid,
  p_modalita public.iscrizione_classe_modalita
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scuola_profilo_id uuid;
  v_iscritti integer := 0;
  v_gia integer := 0;
begin
  -- Delegabile al tutor via puo_gestire_classi (vedi
  -- current_ha_permesso_staff in 20260715110000); il referente ha sempre
  -- tutto.
  if not public.current_ha_permesso_staff('gestione_classi') then
    raise exception 'non_autorizzato';
  end if;

  select scuola_profilo_id into v_scuola_profilo_id from public.classi where id = p_classe_id;
  if v_scuola_profilo_id is null or v_scuola_profilo_id <> public.current_scuola_profilo_id() then
    raise exception 'classe_non_trovata';
  end if;

  if not exists (select 1 from public.eventi where id = p_evento_id and stato = 'approvato') then
    raise exception 'evento_non_disponibile';
  end if;

  insert into public.iscrizioni_classe_eventi (classe_id, evento_id, modalita, iscritto_da)
  values (p_classe_id, p_evento_id, p_modalita, auth.uid())
  on conflict (classe_id, evento_id) do update set modalita = excluded.modalita;

  -- Solo in modalità individuale: una riga per studente, subito. In dad la
  -- classe risulta iscritta come gruppo, niente righe individuali finché
  -- non si certifica la presenza (vedi certifica_presenza).
  if p_modalita = 'individuale' then
    select count(*) into v_gia
    from public.classi_studenti cs
    join public.iscrizioni_eventi ie on ie.student_id = cs.student_id and ie.evento_id = p_evento_id
    where cs.classe_id = p_classe_id;

    insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, iscritto_da)
    select cs.student_id, p_evento_id, 'iscritto', 'scuola', auth.uid()
    from public.classi_studenti cs
    where cs.classe_id = p_classe_id
    on conflict (student_id, evento_id) do nothing;
    get diagnostics v_iscritti = row_count;

    return jsonb_build_object('iscritti', v_iscritti, 'gia_iscritti', v_gia, 'gruppo', false);
  end if;

  return jsonb_build_object('iscritti', 0, 'gia_iscritti', 0, 'gruppo', true);
end;
$$;

revoke all on function public.iscrivi_studenti_evento(uuid, uuid[]) from public, anon;
revoke all on function public.iscrivi_classe_evento(uuid, uuid, public.iscrizione_classe_modalita) from public, anon;
grant execute on function public.iscrivi_studenti_evento(uuid, uuid[]) to authenticated;
grant execute on function public.iscrivi_classe_evento(uuid, uuid, public.iscrizione_classe_modalita) to authenticated;
