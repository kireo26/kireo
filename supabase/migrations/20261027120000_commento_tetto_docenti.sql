-- Perché `certifica_partecipazione_docente` conserva il tetto delle ore, mentre
-- `certifica_presenza` (la scuola) dal 25/10 non ce l'ha più.
--
-- QUESTA MIGRAZIONE ESISTE PERCHÉ IL SUO CONTENUTO ERA STATO APPESO A
-- 20261027110000 DOPO CHE MARIO L'AVEVA GIÀ APPLICATA (commit b93f2f5): in
-- produzione quel commento non c'era (obj_description → null), su una replica
-- ricostruita dai file sì — cioè replica e produzione avevano smesso di dire la
-- stessa cosa senza che niente lo segnalasse. 20261027110000 è tornata
-- esattamente com'era quando è stata applicata (5b481d9), e il commento arriva
-- da qui. Una migrazione applicata non si riscrive: si aggiunge.
--
-- LA REGOLA, che non riguarda i ruoli: CHI ATTESTA È INDIPENDENTE DALL'EVENTO?
-- Una scuola che certifica i propri studenti attesta un lavoro d'aula che noi
-- non vediamo, e risponde ad altri di quello che firma: lì il tetto cade. Un
-- ente che certifica i partecipanti del proprio evento è giudice e parte — può
-- dichiarare tre ore, trasmetterne venti minuti e attestarle a cinquanta
-- docenti — quindi lì il tetto resta. (Non perché le ore di un docente non
-- finiscano su un documento: ci finiscono, l'aggiornamento si attesta.)
--
-- ⚠️ LA CONDIZIONE CHE LA ROVESCIA: il giorno in cui a certificare un docente è
-- un TERZO (la sua scuola, un ordine professionale, l'ufficio scolastico), quel
-- caso segue la regola della scuola, non quella del tetto.
--
-- Nessun comportamento cambia: solo un `comment on function`. Rieseguibile.

comment on function public.certifica_partecipazione_docente(uuid, uuid) is
  'Conserva il tetto di ore_riconoscibili_evento di proposito: qui attesta l''organizzatore stesso (giudice e parte). La certificazione della scuola (certifica_presenza) non ha tetto perché chi attesta è indipendente dall''evento. Se un giorno a certificare un docente sarà un terzo, quel caso segue la regola della scuola. Vedi 20261027120000.';
