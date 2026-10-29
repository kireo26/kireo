-- I POST DEGLI ENTI SI PUBBLICANO SUBITO: LE PAROLE NUOVE, DA SOLE (29/10).
--
-- Decisione di Mario: via l'approvazione dai post. L'ente pubblica, l'admin
-- riceve una notifica e può togliere un post con una motivazione obbligatoria,
-- che arriva all'ente.
--
-- Questa migrazione aggiunge SOLO le parole, e sta da sola per una ragione
-- tecnica: un valore nuovo di un enum non si può usare nella transazione che
-- lo aggiunge. Il resto è in 20261113110000.
--
-- ⚠️ LE PAROLE VECCHIE NON SI RIUSANO CON UN SIGNIFICATO NUOVO (Mario, §3).
-- `approvato` vuol dire «l'ha guardato una persona prima che uscisse», ed è
-- vero dei due post di oggi: restano `approvato`. Un post nuovo è
-- `pubblicato`, che non afferma nessuna revisione. `tolto` è un post che era
-- visibile e che KIREO ha tolto dal flusso: non è un rifiuto (`rifiutato` è
-- una proposta mai uscita) e non è una cancellazione (la riga resta, con chi
-- l'ha tolto, quando e perché).
--
-- E due tipi di notifica: `post_pubblicato` (all'admin, a ogni post nuovo) e
-- `post_tolto` (all'ente, con la motivazione da leggere nella sua Bacheca).

alter type public.post_ente_stato add value if not exists 'pubblicato';
alter type public.post_ente_stato add value if not exists 'tolto';

alter type public.notifica_tipo add value if not exists 'post_pubblicato';
alter type public.notifica_tipo add value if not exists 'post_tolto';
