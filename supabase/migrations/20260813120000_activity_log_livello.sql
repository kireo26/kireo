-- Guide per livello: poter distinguere QUALE guida (1 Panoramica / 2 Le strade /
-- 3 Come partire) apre lo studente, non solo che ha aperto una guida di quell'area.
--
-- Aggiunge activity_log.livello (nullable: le altre attività restano a null) e lo
-- porta nel cap giornaliero tramite coalesce(livello, 0) — NON `livello` nudo:
-- in un indice unico i NULL sono considerati distinti tra loro, quindi
-- `(..., livello)` romperebbe il cap di TUTTE le attività senza livello (chat,
-- visita_area, ecc., che avrebbero livello null). Con coalesce(0) quelle mappano
-- tutte allo slot 0 → cap identico a oggi; le tre guide (1/2/3) → tre slot.
--
-- Nessun ALTER TYPE ADD VALUE qui (solo una colonna + un indice): la regola delle
-- migrazioni isolate non si applica. Retro-compatibile col codice attualmente in
-- produzione: gli insert esistenti (senza livello) restano validi — livello null
-- → coalesce 0 → stesso slot di dedup di prima. Applicare questa migrazione PRIMA
-- di deployare il codice che scrive `livello` evita qualsiasi finestra di regressione.

alter table public.activity_log
  add column livello smallint check (livello between 1 and 3);

drop index if exists public.activity_log_cap_giornaliero_idx;

create unique index activity_log_cap_giornaliero_idx
  on public.activity_log (
    student_id,
    area_slug,
    tipo_attivita,
    ((created_at at time zone 'utc')::date),
    coalesce(livello, 0)
  );

comment on column public.activity_log.livello is
  'Solo per tipo_attivita=download_guida: il livello della guida aperta (1/2/3). Null per ogni altra attività. Nel cap giornaliero entra come coalesce(livello,0): le tre guide di un''area producono tre righe/giorno, le altre attività restano una riga/giorno come prima.';
