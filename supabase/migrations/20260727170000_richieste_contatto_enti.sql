-- Livello social (8/8): la landing/funnel enti su /istituzioni riusa
-- richieste_contatto (già live da 20260725100000) invece di una tabella
-- nuova — stesso identico schema, solo una nuova origine. 'enti' aggiunta
-- al CHECK esistente (drop+add, mai un CREATE OR REPLACE su un vincolo:
-- non è una funzione, ma lo stesso principio di "non lasciare residui" si
-- applica).

alter table public.richieste_contatto
  drop constraint richieste_contatto_origine_check;

alter table public.richieste_contatto
  add constraint richieste_contatto_origine_check check (origine in ('dirigenti', 'scuole', 'enti'));

comment on column public.richieste_contatto.origine is
  'dirigenti/scuole: landing del funnel scuole (/dirigenti, /scuole). enti: form "Richiedi informazioni" su /istituzioni (pubblica, indicizzata) — notifica interna a info@kireo.it invece che a mario.izzo@hotmail.it, vedi app/api/richiesta-contatto/route.ts.';
