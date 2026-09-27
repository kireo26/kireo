-- Aggiunge il valore 'evento' a escape_fonte: le prove che nascono dalla
-- CONSEGNA di un evento in diretta (vedi la migrazione successiva).
--
-- MIGRAZIONE ISOLATA, per il vincolo Postgres già noto in questo progetto: un
-- valore enum appena creato non si può usare nella stessa transazione in cui è
-- stato aggiunto (stesso trattamento di 20260812100000_test_fonte_enum.sql,
-- 20260713100000, 20260722110000, 20260727210000).
--
-- ═══ PERCHÉ UN VALORE NUOVO E NON 'activity', CHE ESISTE E NON LO USA NESSUNO ═══
-- 'activity' è il posto riservato al cross-feed di activity_log → evidence (le
-- guide lette, i webinar, i follow): un cantiere a sé, dichiarato nei punti
-- aperti di CLAUDE.md e non ancora acceso. Riusarlo qui renderebbe le righe
-- della consegna INDISTINGUIBILI da quelle di quel cross-feed il giorno in cui
-- verrà accesso — e chi lo accenderà non potrebbe più dire quali righe sono
-- sue. Un valore in più costa una migrazione isolata; due sorgenti dentro lo
-- stesso nome costano la possibilità di separarle.

alter type public.escape_fonte add value if not exists 'evento';
