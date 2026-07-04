# KIREO — Piattaforma di orientamento post-diploma

## Cosa è KIREO
KIREO (kireo.it) è una piattaforma di **orientamento**, non un marketplace di percorsi post-diploma: non deve mai passare l'idea che "vendiamo percorsi". Posizionamento orientamento-first: guida gli studenti a scoprire le proprie attitudini (verso lo studio o il lavoro) con percorsi di orientamento personalizzati e test attitudinali, e offre alle scuole secondarie superiori un servizio PCTO automatizzato (giustificativi generati automaticamente, dashboard con statistiche per i docenti).
Tre tipologie di utenti: studenti, scuole superiori (PCTO, non pagano — vedi "Regole di business"), istituzioni formative post-diploma (università, ITS Academy, accademie, corsi professionalizzanti — sole a pagare, tramite i piani Base/Standard/Premium).
Il tono verso studenti e scuole non deve MAI essere commerciale (niente linguaggio da "vendita" o da marketplace): sempre guida e orientamento. Il linguaggio commerciale (piani, prezzi, visibilità) è riservato esclusivamente alle istituzioni formative post-diploma.
Claim: "Orientamento. Direzione. Futuro."

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase: database PostgreSQL, auth, storage
- Deploy su Vercel, dominio kireo.it
- Lingua del sito: italiano

## Brand
- Verde primario: #0F6E56 (CTA, link, accenti)
- Verde chiaro: #14906F (hover)
- Arancione accento: #EF9F27 (highlight, badge, punto nord della bussola nel logo)
- Sfondo scuro: #2C2C2A / card: #353533
- Testo chiaro: #F0EDE8 / testo muted: #9A9890
- Logo: K grande in verde petrolio (#5DCAA5), IREO in bianco, la O contiene una bussola con punto nord arancione
- Font: Space Grotesk (titoli, Google Fonts) + DM Sans (testi, Google Fonts) — sostituito Syne per via di lettere (es. "g") poco leggibili a corpo piccolo
- Estetica: dark theme, pulita, professionale ma calda

## Regole di business (NON violare)
- Gli studenti NON pagano mai. Le scuole secondarie NON pagano mai.
- I ricavi arrivano SOLO dalle istituzioni formative (piani Base gratuito / Standard / Premium)
- Le istituzioni entrano gratis con profilo base; i piani a pagamento danno visibilità avanzata e statistiche

## Ruoli utente (per l'area riservata, fase 2)
- studente: profilo con interessi, ricerca istituzioni, confronto percorsi, richieste contatto, giustificativi PCTO automatici (PDF)
- istituzione: profilo ente, gestione corsi, ricezione richieste, statistiche (in base al piano)
- docente: accesso webinar (con attestato di partecipazione), risorse scaricabili, newsletter — formazione continua su AI ed EdTech lungo 4 filoni tematici: AI nella didattica quotidiana (esercizi, verifiche, materiali), valutazione nell'era dell'AI (pensiero critico, non solo il prodotto), etica/privacy/normativa (linee guida MIM, AI Act, policy d'istituto), riduzione della burocrazia (programmazioni, relazioni, documentazione)

## Fasi del progetto
1. FASE ATTUALE: sito pubblico statico a 7 pagine — Homepage, Come funziona, Per le scuole (scuole superiori, PCTO), Per le istituzioni (istituzioni formative post-diploma), Per i docenti (formazione AI/EdTech), Contatti, Privacy
2. Fase 2 (lug-ago 2026): auth Supabase con 3 ruoli + catalogo istituzioni
3. Fase 3 (set 2026): profili studente + generazione PDF giustificativi PCTO

## Stato attuale
Aggiornato al 2026-07-04.

**Completato (Fase 1):**
- Scaffold Next.js (App Router, TypeScript, Tailwind CSS v4) con font Google e colori brand configurati come token Tailwind (`kireo-green`, `kireo-orange`, `kireo-dark`, ecc.)
- 7 pagine pubbliche, testi definitivi sulla maggior parte: Homepage, Come funziona, Per le scuole, Per le istituzioni, Per i docenti, Contatti (testi provvisori), Privacy (testi provvisori)
- Componenti condivisi in `/components`: Header (con nav mobile), Footer, Logo, Button, Card, SectionHeading, ContactForm (solo UI, nessun invio reale)
- Dev server verificato e funzionante su http://localhost:3000
- Homepage e Come funziona riposizionate in chiave orientamento-first (vedi sezione "Cosa è KIREO")
- `/per-le-scuole` sdoppiata in due pagine con pubblici e toni opposti: `/per-le-scuole` per le scuole superiori (servizio PCTO gratuito, tono di servizio pubblico) e `/per-le-istituzioni` per le istituzioni formative post-diploma (unica pagina con piani a pagamento)
- Homepage ristrutturata: la vecchia sezione doppia studenti/scuole e la sezione docenti sono state sostituite da un'unica sezione "Per chi è KIREO" con tre card fratelle di pari dignità (studenti, scuole, docenti); i contenuti tematici approfonditi sui docenti (AI in classe, valutazione, etica/privacy, burocrazia) sono stati spostati sulla nuova pagina `/per-i-docenti`. Nav aggiornata a 6 voci, CTA verde nell'header è "Inizia ora" → home

**Problema font risolto:** i titoli (font Syne) mostravano lettere accentate e discendenti apparentemente tagliate. Causa: `line-height` troppo stretto (il font richiede un rapporto ascendenti+discendenti di almeno ~1.2, mentre diversi titoli non avevano `line-height` esplicito o usavano valori troppo bassi). Risolto impostando `line-height: 1.25` + padding verticale di sicurezza su tutti i titoli del sito, e rimuovendo l'unico `overflow-hidden` rimasto (tabella piani, sostituito con arrotondamento solo sulle celle d'angolo). In un secondo momento, per una lettera "g" dal design particolare di Syne (percepita come "tagliata" ma in realtà solo uno stile distintivo del font), si è deciso di sostituire il font titoli con **Space Grotesk**, più leggibile mantenendo comunque un look distintivo.

**Nota tecnica ambiente:** in locale Turbopack (bundler di default di Next 16) va in errore in modalità dev per un problema di spawn processi nel sandbox; il dev server è configurato per usare `--webpack` (vedi `package.json` e `scripts/dev.sh`). La build di produzione con Turbopack funziona regolarmente.

**Prossimi interventi previsti sulla struttura:**
- Sostituire tutti i testi provvisori con i testi definitivi
- Fase 2 (lug-ago 2026): autenticazione Supabase con i 3 ruoli utente (studente, istituzione, docente) + catalogo istituzioni consultabile
- Fase 3 (set 2026): profili studente completi + generazione automatica PDF dei giustificativi PCTO
- Da rivalutare in futuro: rimuovere il workaround `--webpack` se un aggiornamento di Next.js risolve il crash di Turbopack in dev

## Convenzioni
- Commenti nel codice in italiano
- Componenti riutilizzabili in /components
- Mobile-first: gli studenti navigano da smartphone
- Accessibilità: contrasti AA, alt text, navigazione da tastiera
- Commit piccoli e frequenti con messaggi in italiano
