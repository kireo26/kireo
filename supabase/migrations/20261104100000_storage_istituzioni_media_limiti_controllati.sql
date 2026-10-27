-- I LIMITI DEL BUCKET `istituzioni-media`, CON IL CONTROLLO CHE MANCAVA
-- (Mario, 27/10). `20261103140000` li ha scritti con un `update` nudo: su zero
-- righe (un bucket con un altro nome) sarebbe passata senza aver fatto niente.
-- In produzione è atterrata (misurato il 27/10: 20971520 e i quattro tipi), ma
-- per caso, non per costruzione.
--
-- ⚠️ La correzione sta QUI e non dentro `20261103140000`, perché quella è
-- applicata: riscriverla non cambierebbe la produzione, cambierebbe il racconto
-- della produzione (vedi «Una migrazione applicata in produzione smette di
-- essere un file e diventa un fatto»). Il 27/10 l'avevo riscritta in place senza
-- sapere che era girata, e l'ho rimessa com'era.
--
-- È idempotente: in produzione riscrive gli stessi valori, e si ferma se non
-- tocca esattamente una riga. Non è provabile sulla replica (`storage` lì non
-- esiste, e il file si salta per nome).
--
-- COME SI VERIFICA APPLICATA: non lascia un oggetto suo, e i valori sono quelli
-- di prima. La prova è che giri senza errore: un `raise` la ferma.

do $$
declare v_righe integer;
begin
  update storage.buckets
  set file_size_limit = 20971520,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  where id = 'istituzioni-media';
  get diagnostics v_righe = row_count;
  if v_righe <> 1 then
    raise exception 'bucket istituzioni-media: % righe aggiornate invece di 1', v_righe;
  end if;
end $$;
