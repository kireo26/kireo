-- KIREO — la parola giusta: `area_signal` e `style_signal` sono MEDIE, non somme.
--
-- SOLO COMMENTI. Nessun cambio di comportamento, nessuna colonna, nessuna
-- funzione ridefinita: si scrive un `comment on function` su due funzioni che
-- ne erano prive. Applicabile in qualunque momento, senza rischio.
--
-- PERCHÉ VALE UNA MIGRAZIONE. I commenti fondativi delle due funzioni dicono
-- entrambi, testualmente, «Ricomputa … dalla SOMMA di TUTTE le prove»
-- (20260810110000 e 20260813100000). Tutte e due calcolano invece una media
-- pesata: round(100 * sum(valore*peso) / nullif(sum(peso),0)).
--
-- Non è un dettaglio di stile. Il 22 agosto una modifica al motore (bc11b15,
-- «una posizione bassa non è interesse») tolse le prove a valore basso con
-- questa giustificazione: «per Σ(valore·peso), che alimenta area_signal, cala
-- poco — si toglie rumore, non segnale». L'inferenza è CORRETTA a partire da
-- quella premessa; la premessa era scritta qui. Nessuno ha ragionato male:
-- hanno letto la documentazione.
--
-- Finché la parola resta «somma», ogni decisione futura su cosa emettere sarà
-- presa da somma — e sarà sbagliata di segno ogni volta. Questa migrazione
-- toglie la premessa dalla circolazione.
--
-- Le due righe finali di ogni commento sono la parte che conta: una definizione
-- corretta ma muta si rilegge come «somma» lo stesso, perché la parola è nel
-- titolo del file. Dicono a chi legge sia cosa fa la funzione, sia quale errore
-- non deve fare.

comment on function public.ricalcola_area_signal(uuid, text) is
$$Ricomputa la riga area_signal di UNA (studente, area) come MEDIA PESATA delle prove: Σ(valore·peso) / Σ(peso), per ognuna delle quattro dimensioni. NON è una somma.

La QUANTITÀ non sta qui: sta in `confidence` (Σpeso, satura a 10) e in `attivita_distinte`/`azioni_distinte`. Questo numero è invariante di scala — dice quanto intensamente in media, mai quante volte.

Regola per chi deciderà se emettere o no una prova, in due righe:
  su una SOMMA una riga a valore basso aggiunge poco → toglierla è ripulire;
  su una MEDIA una riga a valore basso ABBASSA → toglierla è ALZARE il numero.
Togliere le righe basse da qui non ripulisce il profilo: gli alza il voto. È già successo (bc11b15, 22/08/2026, poi ribaltato).$$;

comment on function public.ricalcola_style_signal(uuid, public.escape_asse) is
$$Gemella di ricalcola_area_signal per gli assi di stile: MEDIA PESATA delle prove, Σ(valore·peso) / Σ(peso). NON è una somma.

La QUANTITÀ non sta qui: sta in `confidence` (Σpeso) e nel conteggio delle attività. Questo numero è invariante di scala.

Regola per chi deciderà se emettere o no una prova, in due righe:
  su una SOMMA una riga a valore basso aggiunge poco → toglierla è ripulire;
  su una MEDIA una riga a valore basso ABBASSA → toglierla è ALZARE il numero.$$;
