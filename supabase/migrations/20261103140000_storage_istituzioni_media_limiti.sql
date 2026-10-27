-- I LIMITI DEI FILE DI UN ENTE STANNO ANCHE SUL SERVER (Mario, 27/10).
--
-- Copertina e guida PDF vanno nel bucket `istituzioni-media`
-- (20260713170000), che non aveva né un tetto di dimensione né un elenco di
-- tipi: tipo e dimensione li controllava solo il JavaScript del form, cioè il
-- controllo stava dove chiunque può toglierlo e mancava dove nessuno può.
-- Ora il bucket rifiuta un file oltre i 20 MB e un tipo che non sia
-- un'immagine JPG/PNG/WebP o un PDF. I numeri sono gli stessi di
-- `lib/ente/media.ts`, che li dice al form (`npm run test:statistiche`).
--
-- ⚠️ I LIMITI DICHIARATI, che il bucket non può tenere:
--   - un tetto PER TIPO: il tetto è uno solo, quello della guida (20 MB). La
--     copertina sotto i 5 MB resta una regola del solo client;
--   - il CONTENUTO: il tipo controllato è quello dichiarato da chi carica (il
--     Content-Type), non quello che il file è davvero;
--   - i file già caricati: restano come sono.
--   Niente SVG, e non per caso: un'immagine SVG in un bucket pubblico è un
--   documento che può contenere script.
--
-- ⚠️ NON SI PROVA SULLA REPLICA: lo schema `storage` lì non esiste, e
-- `scripts/replica-locale.sh` salta i file con «storage» nel nome. Si
-- verifica in produzione (sotto).
--
-- COME SI VERIFICA APPLICATA:
--   select file_size_limit, allowed_mime_types from storage.buckets where id = 'istituzioni-media';
--   → 20971520 e {image/jpeg,image/png,image/webp,application/pdf} (prima: null e null).

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'istituzioni-media';
