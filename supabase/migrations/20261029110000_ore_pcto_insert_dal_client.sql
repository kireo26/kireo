-- LE ORE PCTO DALL'ORARIO — migrazione B di due: il client non manda più le ore.
--
-- ⚠️⚠️ SI APPLICA DOPO IL DEPLOY, NON PRIMA (Mario, 26/10: A → deploy → B).
-- Il form di creazione di prima del deploy manda `ore_pcto` nell'insert: con
-- questa migrazione applicata quell'insert prende `permission denied`, cioè
-- nessun ente riesce a creare un evento finché il deploy non arriva. Dopo il
-- deploy il form non manda più la colonna, e questa riga non rompe niente.
--
-- PERCHÉ ESISTE, se la migrazione A riscrive comunque le ore all'insert: A le
-- IGNORA in silenzio. Un client che le manda ancora — un form dimenticato, una
-- strada nuova — crederebbe di averle scritte. Da qui prende un errore: «fra
-- due finestre di rischio si sceglie quella che fa rumore», e questa può far
-- rumore solo quando non può più rompere niente.
--
-- ⚠️ UN `revoke insert (ore_pcto)` DA SOLO NON FAREBBE NIENTE: un privilegio
-- di colonna non toglie un privilegio di TABELLA, e `authenticated` ha
-- l'insert su tutta la tabella. Quindi si revoca la tabella e si concedono le
-- colonne, come per l'update in A — con lo stesso elenco statico e la stessa
-- conseguenza dichiarata: una colonna aggiunta dopo oggi non è inseribile dal
-- client finché qualcuno non la aggiunge qui (il verso rumoroso).
--
-- COME SI VERIFICA APPLICATA: `has_column_privilege('authenticated',
-- 'public.eventi','ore_pcto','INSERT')` è FALSO e la colonna di controllo
-- `titolo` (che il form inserisce davvero) è VERA.
revoke insert on public.eventi from authenticated, anon;
grant insert (
  id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, sede, link, posti,
  stato, created_at, updated_at, cta_esterna_url, cta_esterna_approvata, note_revisione,
  in_evidenza, in_evidenza_dal, pubblico, filone, hosting_diretta, youtube_video_id,
  checklist_diretta, checklist_diretta_accettata_il, proposta_incontro_id, domanda_consegna,
  incorporamento_sonda, diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_da_user,
  diretta_chiusa_presenti, diretta_chiusa_certificati, diretta_durata_minuti
) on public.eventi to authenticated;
