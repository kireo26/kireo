-- Stesso bug RLS+RETURNING di finalize_registration_istituzione (vedi
-- 20260713190000), scoperto nella creazione eventi: CreaEventoForm fa
-- .insert({...}).select("id").single() su eventi (equivalente lato
-- supabase-js di un "returning"), ma l'unica policy SELECT esistente,
-- eventi_select_approvati, copre solo stato='approvato' — un evento appena
-- proposto da un ente nasce in 'in_approvazione', quindi l'ente non può
-- leggere la riga che ha appena scritto e l'insert fallisce. Lo stesso
-- vincolo bloccava anche "I tuoi eventi" in /ente/eventi (mostra sempre
-- vuoto qualunque evento non ancora approvato, quindi in pratica sempre,
-- perché un evento nuovo parte da 'in_approvazione').
--
-- Fix: una policy SELECT che copre "i propri eventi", qualunque stato —
-- coerente con eventi_insert_propria/eventi_update_propria_non_revisionato
-- (stessa condizione organizzatore_id = current_istituzione_id()), diversa
-- dalla lettura pubblica che resta filtrata su 'approvato'. Stessa aggiunta
-- per eventi_aree, per non lasciare lo stesso buco su chi legge le aree
-- tematiche di un proprio evento non ancora approvato.
create policy eventi_select_propria
  on public.eventi for select
  to authenticated
  using (organizzatore_id = public.current_istituzione_id());

create policy eventi_aree_select_propria
  on public.eventi_aree for select
  to authenticated
  using (
    exists (
      select 1 from public.eventi e
      where e.id = eventi_aree.evento_id and e.organizzatore_id = public.current_istituzione_id()
    )
  );
