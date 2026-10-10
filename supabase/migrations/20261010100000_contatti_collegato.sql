-- /contatti si collega al canale che esiste già (10/10/2026).
--
-- IL DIFETTO CHE QUESTA MIGRAZIONE SERVE A CHIUDERE non è nel database: è in
-- `components/ContactForm.tsx`, dove `handleSubmit` faceva `preventDefault()`
-- e `setInviato(true)`, e la pagina rispondeva «Messaggio inviato!». Nessuna
-- rete, nessuna riga, nessuna email. Dal giorno in cui quella pagina esiste,
-- ogni persona che ha scritto a KIREO da lì ha letto una conferma e non ha
-- mandato niente.
--
-- E non era solo quella pagina. Nelle settimane scorse cinque testi scritti
-- APPOSTA per non mentire finiscono con «scrivici da Contatti»: l'export che
-- non riesce, la consegna che il revisore non ha letto, il rifiuto delle
-- guide, l'errore di `delete_own_account`. Erano tutti appoggiati a una porta
-- che non si apriva.
--
-- Il canale invece c'era tutto: `richieste_contatto` (25/07), l'insert
-- pubblico, il limite di cortesia per email, le due email, la coda su
-- /admin. Mancava il filo.
--
-- Qui dentro, due cose:
--
--   1. `contatti` come quarta origine. Drop+add sul CHECK, come ha già fatto
--      `20260727170000` per `enti`: non è una funzione, ma lo stesso
--      principio di non lasciare residui si applica.
--      ⚠️ Il vincolo VIVO ha tre valori, non due: `enti` lo ha aggiunto
--      quella migrazione. Il CHECK qui sotto li riporta tutti e quattro.
--
--   2. `istituto` diventa nullable. Chi scrive da /contatti può essere uno
--      studente, e un istituto non ce l'ha nel senso in cui lo intendono le
--      landing. Costringerlo a scriverne uno per poterci mandare un
--      messaggio sarebbe una barriera sul contatto più leggero che abbiamo —
--      e riempire la colonna con un «—» sarebbe un dato falso in una colonna
--      che si chiama `istituto`.
--      Il database dice «può mancare»; la route continua a pretenderlo per
--      le tre origini che lo hanno sempre avuto. I due livelli dicono due
--      cose diverse apposta.

alter table public.richieste_contatto
  drop constraint richieste_contatto_origine_check;

alter table public.richieste_contatto
  add constraint richieste_contatto_origine_check
  check (origine in ('dirigenti', 'scuole', 'enti', 'contatti'));

alter table public.richieste_contatto
  alter column istituto drop not null;

comment on column public.richieste_contatto.origine is
  'dirigenti/scuole: landing del funnel scuole (/dirigenti, /scuole), notifica a mario.izzo@hotmail.it. enti: form "Richiedi informazioni" su /istituzioni, notifica a info@kireo.it. contatti: form pubblico di /contatti, notifica a tutti e due. Vedi app/api/richiesta-contatto/route.ts.';

comment on column public.richieste_contatto.istituto is
  'Nullable dal 10/10/2026: obbligatorio per le tre origini delle landing (lo pretende la route), assente per origine=contatti, dove chi scrive può essere uno studente senza un istituto da dichiarare. Un «—» al suo posto sarebbe un dato falso in una colonna che si chiama istituto.';
