-- Esplora: filtro provincia richiede un dato di localizzazione sull'ente
-- che non esisteva ancora (istituzioni non ha mai avuto una colonna
-- geografica, a differenza di schools). Testo libero self-service
-- (istituzioni_update_propria copre già la scrittura, nessuna nuova RLS
-- necessaria): un ente può avere sedi in più province, un vincolo rigido
-- non avrebbe senso qui. Il filtro "regione" richiesto dal compito è stato
-- lasciato fuori da questa build: nessuna mappatura provincia->regione
-- esiste nel progetto (il dataset MIM copre le scuole, non le istituzioni
-- post-diploma) e costruirne una è fuori scope per questo cantiere.
alter table public.istituzioni
  add column provincia text;

comment on column public.istituzioni.provincia is
  'Testo libero, facoltativo, impostato dall''ente nel proprio profilo. Alimenta il filtro provincia di /app/esplora e /scuola/esplora. NULL per gli enti che non l''hanno ancora impostato (nessun backfill possibile, nessun dato di origine).';
