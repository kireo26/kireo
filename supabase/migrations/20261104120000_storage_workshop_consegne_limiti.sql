-- I LIMITI DEL BUCKET `workshop-consegne`, CHE IN PRODUZIONE NON SONO MAI
-- ATTERRATI (Mario, 27/10). `20260807140000` li scriveva nell'`insert` del
-- bucket con `on conflict (id) do nothing`: il bucket esisteva già, e la riga
-- non è stata toccata. Misurato in produzione il 27/10: `public` false,
-- `file_size_limit` null, `allowed_mime_types` null — cioè il server accetta
-- qualunque file di qualunque dimensione, nella cartella dello studente.
-- ⚠️ Il 27/10 avevo scritto che quel bucket «ha già i limiti» leggendo il file:
-- era dedotto, non misurato, ed era sbagliato.
--
-- I LIMITI SONO QUELLI DEL CLIENT, NON DI PIÙ (Mario). L'unico punto del
-- prodotto che carica in questo bucket oggi è `ImmagineInput` in
-- `components/workshop/elaborato/SezioneEditor.tsx` (sezioni `tipo:
-- "immagine"` dell'elaborato): `TIPI_IMMAGINE_CONSENTITI` = image/png,
-- image/jpeg, `MAX_IMMAGINE_MB` = 5. Il vecchio caricamento della v1 (PDF, PPTX,
-- DOCX fino a 10 MB, i valori scritti nel 20260807140000) non ha più un
-- ingresso: `/api/workshop/consegna` risponde 410 dal 29/08 e
-- `ConsegnaUpload` non è montato da nessuna pagina. I file v1 già caricati
-- restano leggibili: i limiti di un bucket valgono solo per i caricamenti nuovi.
-- ⚠️ La condizione: il giorno in cui il client accetta un tipo o una dimensione
-- in più, questi numeri cambiano nello stesso lotto, con una migrazione nuova.
--
-- Non è provabile sulla replica (`storage` lì non esiste, il file si salta per
-- nome). Si ferma se non tocca esattamente una riga, e rilegge i valori.
--
-- COME SI VERIFICA APPLICATA: `select id, public, file_size_limit,
-- allowed_mime_types from storage.buckets where id = 'workshop-consegne'` dà
-- false, 5242880 e {image/png,image/jpeg}.

do $$
declare
  v_righe integer;
  v_limite bigint;
  v_tipi text[];
begin
  update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/png', 'image/jpeg']
  where id = 'workshop-consegne';
  get diagnostics v_righe = row_count;
  if v_righe <> 1 then
    raise exception 'bucket workshop-consegne: % righe aggiornate invece di 1', v_righe;
  end if;

  select file_size_limit, allowed_mime_types into v_limite, v_tipi
  from storage.buckets where id = 'workshop-consegne';
  if v_limite is distinct from 5242880
     or v_tipi is distinct from array['image/png', 'image/jpeg'] then
    raise exception 'bucket workshop-consegne: riletti % e %, non i limiti scritti', v_limite, v_tipi;
  end if;
end $$;
