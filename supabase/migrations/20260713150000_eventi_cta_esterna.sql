-- Estende eventi (creata in 20260712140000_eventi.sql) con la CTA esterna
-- verso il sito dell'istituzione, e aggiunge le policy che mancavano per
-- permettere a un'istituzione di proporre i propri eventi: prima
-- esisteva solo la lettura pubblica dei soli approvati.

alter table public.eventi
  add column cta_esterna_url text,
  add column cta_esterna_approvata boolean not null default false,
  add column note_revisione text;

comment on column public.eventi.cta_esterna_approvata is
  'Solo un admin KIREO può approvarla (mai l''istituzione stessa, vedi policy sotto), rispettando la quota_cta_esterne del piano — il controllo di quota è applicativo, non nel DB.';

comment on column public.eventi.note_revisione is
  'Nota facoltativa di un admin KIREO alla coda di approvazione (motivo di un rifiuto, richieste di modifica). Stessa colonna già presente su comunicazioni.';

-- L'ente propone (bozza o direttamente in_approvazione), ma non può
-- scrivere stato=approvato/rifiutato né approvare da solo la propria CTA
-- esterna: entrambi i vincoli sono nel WITH CHECK, quindi verificati sul
-- valore scritto, non solo sulla riga esistente.
create policy eventi_insert_propria
  on public.eventi for insert
  to authenticated
  with check (
    organizzatore_id = public.current_istituzione_id()
    and stato in ('bozza', 'in_approvazione')
    and cta_esterna_approvata = false
  );

create policy eventi_update_propria_non_revisionato
  on public.eventi for update
  to authenticated
  using (organizzatore_id = public.current_istituzione_id() and stato in ('bozza', 'in_approvazione'))
  with check (
    organizzatore_id = public.current_istituzione_id()
    and stato in ('bozza', 'in_approvazione')
    and cta_esterna_approvata = false
  );

create policy eventi_admin_tutto
  on public.eventi for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

create policy eventi_aree_insert_propria
  on public.eventi_aree for insert
  to authenticated
  with check (
    exists (
      select 1 from public.eventi e
      where e.id = eventi_aree.evento_id and e.organizzatore_id = public.current_istituzione_id()
    )
  );

create policy eventi_aree_admin_tutto
  on public.eventi_aree for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');
