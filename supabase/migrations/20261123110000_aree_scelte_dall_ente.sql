-- LE AREE L'ENTE SE LE SCEGLIE: L'APPROVAZIONE ESCE, LA REVOCA ENTRA
-- (decisione di Mario, 31/10, leggendo che tre richieste di Davante stavano
-- ferme da due giorni).
--
-- PERCHÉ: non togliamo un controllo, togliamo la finzione di un controllo.
-- Nessuno approvava quelle richieste perché non esisteva un posto dove
-- vederle: smettiamo di scrivere «in approvazione» a un ente che non sarebbe
-- mai stato approvato. KIREO vaglia l'ente quando lo attiva, non l'elenco delle
-- sue materie: in quali aree lavora lo sa lui meglio di noi.
--
-- COSA PRENDE IL POSTO DELL'APPROVAZIONE:
--   a) il TETTO resta, ed è il freno vero (max_aree_istituzione: 3, 6 per
--      un'università; trigger limite_aree_istituzione);
--   b) la REVOCA: `revoca_area_ente`, solo l'admin, con la motivazione
--      obbligatoria e l'avviso all'ente dentro KIREO (il trigger qui sotto) e
--      per email (/api/admin/revoca-area). È la forma dei post tolti: si
--      pubblica subito, si toglie dopo se è sbagliato. La lettura dei post per
--      area (lib/app/postArea.ts) guarda l'area approvata ADESSO, quindi una
--      revoca toglie subito i post di quell'ente da quella pagina, senza
--      toccare un dato;
--   c) il regolamento lo dice (app/ente/regolamento/page.tsx).
--
-- GLI STATI NON SI CANCELLANO: `approvata` diventa lo stato di nascita;
-- `rifiutata` è quello in cui la revoca la mette; `in_approvazione` non lo
-- scrive più nessuno, ma è successo, e le righe che ci sono passate hanno una
-- storia. Le righe ferme lì le porta ad `approvata` una migrazione a parte
-- (20261123120000), DOPO che Mario ha contato quante sono e di chi.
--
-- ⚠️ UNA REVOCA NON SI AGGIRA DAL PROFILO: fino a oggi l'ente poteva cancellare
-- qualunque sua riga, anche una rifiutata, e reinserirla. Da qui la policy di
-- delete non tocca le righe `rifiutata`, e il vincolo unico (istituzione, area)
-- impedisce di reinserirla. Per riaverla l'ente scrive a KIREO.
--
-- ⚠️ `revocata_da` è una colonna di responsabilità verso `profiles`, NO ACTION
-- come le altre: la quindicesima che blocca la cancellazione di un account
-- (vedi «La politica sulla cancellazione degli account»). Chi ha tolto un'area
-- deve restare scritto.

alter table public.istituzioni_aree alter column stato set default 'approvata';

alter table public.istituzioni_aree
  add column revocata_il timestamptz,
  add column revocata_da uuid references public.profiles (id),
  add column motivo_revoca text;

alter table public.istituzioni_aree
  add constraint istituzioni_aree_revoca_completa check (
    revocata_il is null
    or (stato = 'rifiutata' and revocata_da is not null and length(btrim(coalesce(motivo_revoca, ''))) > 0)
  );

drop policy if exists istituzioni_aree_insert_propria on public.istituzioni_aree;
create policy istituzioni_aree_insert_propria
  on public.istituzioni_aree for insert
  to authenticated
  with check (istituzione_id = public.current_istituzione_id() and stato = 'approvata');

drop policy if exists istituzioni_aree_delete_propria on public.istituzioni_aree;
create policy istituzioni_aree_delete_propria
  on public.istituzioni_aree for delete
  to authenticated
  using (istituzione_id = public.current_istituzione_id() and stato <> 'rifiutata');

comment on column public.istituzioni_aree.stato is
  '20261123110000: approvata alla nascita (l''ente sceglie, vale subito); rifiutata = tolta da KIREO con revoca_area_ente; in_approvazione non lo scrive più nessuno, resta per le righe che ci sono passate.';

create or replace function public.revoca_area_ente(p_istituzione_id uuid, p_area_slug text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_mancante';
  end if;
  update public.istituzioni_aree
     set stato = 'rifiutata', revocata_il = now(), revocata_da = auth.uid(), motivo_revoca = btrim(p_motivo)
   where istituzione_id = p_istituzione_id and area_slug = p_area_slug and stato <> 'rifiutata'
  returning id into v_id;
  if v_id is null then
    raise exception 'area_non_trovata';
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function public.revoca_area_ente(uuid, text, text) from public, anon;
grant execute on function public.revoca_area_ente(uuid, text, text) to authenticated;

-- L'avviso all'ente dentro KIREO: un trigger, così vale da qualunque strada
-- (anche dal SQL Editor, purché la revoca porti la sua data).
create or replace function public.notifica_area_revocata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stato = 'rifiutata' and new.revocata_il is not null and old.revocata_il is null then
    insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
    select ip.user_id, 'area_revocata', new.id
    from public.institution_profiles ip
    where ip.istituzione_id = new.istituzione_id;
  end if;
  return new;
end;
$$;

revoke all on function public.notifica_area_revocata() from public, anon, authenticated;

create trigger notifica_area_revocata
  after update on public.istituzioni_aree
  for each row execute function public.notifica_area_revocata();

-- L'esito dell'email all'ente sulla revoca sta dove sta quello delle altre
-- decisioni (20261118100000).
alter table public.avvisi_email_enti drop constraint if exists avvisi_email_enti_cosa_check;
alter table public.avvisi_email_enti add constraint avvisi_email_enti_cosa_check check (cosa in ('evento', 'newsletter', 'area'));

do $$
begin
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'istituzioni_aree' and column_name = 'stato') not like '%approvata%' then
    raise exception 'lo stato di nascita di un''area non è approvata';
  end if;
  if has_function_privilege('anon', 'public.revoca_area_ente(uuid, text, text)', 'execute') then
    raise exception 'un visitatore esegue la revoca';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'notifica_area_revocata') then
    raise exception 'il trigger dell''avviso non c''è';
  end if;
end $$;
