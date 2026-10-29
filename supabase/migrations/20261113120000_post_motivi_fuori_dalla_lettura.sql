-- I MOTIVI DI UN POST NON LI LEGGE IL PUBBLICO, MAI (29/10). DOPO IL DEPLOY.
--
-- `post_enti_select_pubblico_visibili` dice QUALI righe si leggono, non QUALI
-- colonne. Oggi un post tolto non è visibile, quindi la sua motivazione non
-- esce; ma la riga è la stessa, e basta un giorno in cui qualcosa torna
-- visibile perché chiunque legga perché KIREO aveva tolto un post a un ente.
-- Mario: «chiudilo con i privilegi di colonna, non con la fortuna dello
-- stato». Lo stesso vale per `motivo_rifiuto` (era il punto aperto del 27/10,
-- e la cura è quella che c'era scritta: la lettura del client si toglie, e
-- l'admin e l'ente leggono da una funzione che guarda chi chiede,
-- `motivi_post_enti`, 20261113110000). Senza svuotare niente: la storia resta.
--
-- Esce dalla lettura anche `approvato_da` (l'id di una persona di KIREO, che
-- al pubblico non serve) e `tolto_da`, per la stessa ragione.
--
-- ⚠️ DOPO IL DEPLOY: il codice di prima legge `motivo_rifiuto` dalla tabella
-- (la Bacheca dell'ente), e senza il privilegio la pagina fallirebbe.
-- ⚠️ E da qui una `select *` su post_enti dal client fallisce per intero, e una
-- colonna nuova non è leggibile finché qualcuno non la aggiunge al grant (il
-- verso rumoroso). Cercate il 29/10: nessuna `select *` in app/, lib/,
-- components/.
--
-- E le scritture del client sui post sono solo l'insert dell'ente: l'admin
-- toglie con togli_post (definer), e approvare/rifiutare non esistono più.

revoke update (stato, approvato_da, motivo_rifiuto) on public.post_enti from authenticated;

revoke select on public.post_enti from anon, authenticated;
grant select (id, istituzione_id, tipo, corpo, immagine_url, embed_url, stato, visibile, visibile_dal, created_at, approvato_il, tolto_il)
  on public.post_enti to anon, authenticated;

do $$
begin
  if has_column_privilege('anon', 'public.post_enti', 'motivo_rimozione', 'SELECT')
     or has_column_privilege('authenticated', 'public.post_enti', 'motivo_rimozione', 'SELECT')
     or has_column_privilege('authenticated', 'public.post_enti', 'motivo_rifiuto', 'SELECT') then
    raise exception 'i motivi di un post si leggono ancora dal client';
  end if;
  if not has_column_privilege('anon', 'public.post_enti', 'corpo', 'SELECT') then
    raise exception 'il corpo di un post non si legge più: il grant è sbagliato';
  end if;
  if has_column_privilege('authenticated', 'public.post_enti', 'stato', 'UPDATE') then
    raise exception 'il client aggiorna ancora lo stato di un post';
  end if;
end $$;
