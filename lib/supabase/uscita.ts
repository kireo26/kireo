// ⚠️ «ESCI» CHIUDE SOLO QUI (Mario, 25/10/2026). Fino al 25/10 i sette «Esci»
// del prodotto chiamavano `signOut()` senza argomenti, e in `@supabase/auth-js`
// il default è `scope: 'global'`: revoca TUTTE le sessioni di quell'utente, su
// ogni dispositivo. Il 25/10 un'uscita sul Mac ha buttato fuori lo stesso
// account dall'iPhone durante una diretta, in silenzio, e la sua presenza si è
// fermata due battiti sotto la soglia (il 403 `session_not_found` nei log di
// Auth). L'ipotesi si chiude con un `/logout` DELLO STESSO ACCOUNT nei log:
// un'uscita globale tocca solo le sessioni dello stesso utente.
//
// La decisione, e la ragione: chi preme «Esci» è davanti al dispositivo che
// vuole chiudere. Lo studente che ha lasciato la sessione aperta sul PC della
// scuola è andato via e non sta premendo niente — perché l'uscita globale lo
// protegga deve ricordarsene dopo, da un altro dispositivo, e sapere che quel
// bottone fa anche quello. «Un gesto solo non può servire due intenzioni, e
// quando ci prova serve quella che nessuno ha chiesto.» Il caso del PC di
// scuola è vero e resta: va servito da un comando suo, «Esci da tutti i
// dispositivi», che lo nomina (punto aperto, capitolo della sicurezza
// dell'account) — non dal silenzio di questo.
//
// Un posto solo, perché i sette bottoni non possano tornare a divergere: un
// `signOut()` nuovo senza questa costante lo prende `npm run test:uscita`.
export const USCITA_SOLO_QUI = "local" as const;
