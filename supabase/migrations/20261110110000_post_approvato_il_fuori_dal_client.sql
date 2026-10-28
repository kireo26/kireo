-- `approvato_il` ESCE DALLE SCRITTURE DEL CLIENT (28/10). Si applica DOPO il
-- deploy del codice che non la manda più (AzioneApprovazionePost): prima,
-- ogni approvazione dell'admin fallirebbe per un privilegio mancante.
--
-- La data la scrive il database dal 20261110100000 (trigger
-- post_enti_data_approvazione); da qui nessuno può più scriverne un'altra dal
-- client. Registro delle colonne: 199 → 198 (`supabase/colonne-del-client.json`).

revoke update (approvato_il) on public.post_enti from authenticated;

do $$
begin
  if has_column_privilege('authenticated', 'public.post_enti', 'approvato_il', 'UPDATE') then
    raise exception 'il client scrive ancora approvato_il';
  end if;
  if not has_column_privilege('authenticated', 'public.post_enti', 'stato', 'UPDATE') then
    raise exception 'il revoke ha tolto anche stato: l''admin non approverebbe più';
  end if;
end $$;
