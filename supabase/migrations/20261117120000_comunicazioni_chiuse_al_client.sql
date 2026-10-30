-- `comunicazioni` non si scrive più dal client (30/10). ⚠️ DA APPLICARE DOPO
-- IL DEPLOY: il codice di prima scrive ancora qui (il form dell'ente,
-- l'approvazione dell'admin), e senza le colonne quelle scritture fallirebbero
-- nel minuto fra la migrazione e il deploy.
--
-- Dal 30/10 la newsletter nasce in `newsletter_enti` (20261117110000) e il
-- motore non legge mai `comunicazioni`: lì restano le proposte di prima, fra
-- cui la newsletter approvata del 18/10, che non parte. Una tabella che nessun
-- codice scrive più non tiene colonne aperte: una concessione senza scrittore
-- è una porta che nessuno usa (registro: 195 → 188).

revoke insert (istituzione_id, tipo, oggetto, corpo, stato) on public.comunicazioni from authenticated;
revoke update (stato, note_revisione) on public.comunicazioni from authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.comunicazioni', 'INSERT')
     or has_column_privilege('authenticated', 'public.comunicazioni', 'stato', 'UPDATE')
     or has_column_privilege('authenticated', 'public.comunicazioni', 'oggetto', 'INSERT') then
    raise exception 'rilettura: il client scrive ancora comunicazioni';
  end if;
end $$;
