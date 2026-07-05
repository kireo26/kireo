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
- Logo definitivo (`components/Logo.tsx`): wordmark "KIRE" + O finale sostituita da un'icona bussola SVG (anello aperto in alto con terminali arrotondati, ago a rombo arancione #EF9F27 che punta a NE). Font logo: Poppins 300 (Google Fonts, token `--font-logo`), letter-spacing/gap 0.12em. Due varianti: `dark` (default, K e anello verde #2FA57B, IRE #F0EDE8, per sfondi scuri) e `light` (K e anello verde #0F6E56, IRE #2C2C2A, per sfondi chiari). **Regola inviolabile**: la spaziatura tra E e O deve restare identica a quella fra le altre lettere — nel componente questo è garantito da un flex `gap` uniforme fra tutti i caratteri e l'icona (non da letter-spacing CSS), da NON modificare con margini ad hoc. Lo stroke-width dell'anello (4.5 in un viewBox 80×80) è tarato per pesare otticamente come le aste sottili di Poppins 300: se si cambia il font o il peso, ritarare di conseguenza
- Favicon: generata dalla sola icona bussola (senza lettere) — `app/icon.svg` (vettoriale, tutte le dimensioni) e `app/apple-icon.tsx` (PNG 180×180 via `next/og` `ImageResponse`, sfondo `#2C2C2A`). La geometria è duplicata in questi due file + nel componente Logo: se il disegno cambia, aggiornare in tutti e tre i punti
- Font: Space Grotesk (titoli, Google Fonts) + DM Sans (testi, Google Fonts) — sostituito Syne per via di lettere (es. "g") poco leggibili a corpo piccolo
- Estetica: dark theme, pulita, professionale ma calda

## Regole di business (NON violare)
- Gli studenti NON pagano mai. Le scuole secondarie NON pagano mai.
- I ricavi arrivano SOLO dalle istituzioni formative (piani Base gratuito / Standard / Premium)
- Le istituzioni entrano gratis con profilo base; i piani a pagamento danno visibilità avanzata e statistiche
- La parola "vendere" (e derivati: vendita, venditore, ecc.) e in generale il lessico commerciale sono VIETATI in tutti i testi rivolti a studenti, scuole e docenti — anche in frasi che negano la vendita (es. "non vendiamo percorsi"). Riformulare sempre senza quella parola
- Le CTA del sito non usano mai lessico contrattuale o impegnativo (attiva, sottoscrivi, firma): il primo contatto è sempre leggero (richiedi informazioni, entra, inizia, scopri). Parole come "convenzione" possono restare nei testi descrittivi (spiegano come funziona il servizio) ma non nelle CTA

## Ruoli utente (per l'area riservata, fase 2)
- studente: profilo con interessi, ricerca istituzioni, confronto percorsi, richieste contatto, giustificativi PCTO automatici (PDF)
- istituzione: profilo ente, gestione corsi, ricezione richieste, statistiche (in base al piano)
- docente: accesso webinar (con attestato di partecipazione), risorse scaricabili, newsletter — formazione continua su AI ed EdTech lungo 4 filoni tematici: AI nella didattica quotidiana (esercizi, verifiche, materiali), valutazione nell'era dell'AI (pensiero critico, non solo il prodotto), etica/privacy/normativa (linee guida MIM, AI Act, policy d'istituto), riduzione della burocrazia (programmazioni, relazioni, documentazione)

## Dataset scuole secondarie (condiviso tra /registrazione, /per-le-scuole e /per-i-docenti)
- Fonte: MIM open data, dataset "Anagrafe Scuole Statali" (`DS0400SCUANAGRAFESTAT`) su https://dati.istruzione.it/opendata/opendata/catalogo/elements1/?area=Scuole
- Script di trasformazione: `scripts/transform-scuole.js` — legge un CSV in `scripts/data/anagrafe-scuole-statali.csv` (non versionato, va scaricato/aggiornato a mano seguendo le istruzioni in testa al file) e genera `public/data/scuole-secondarie-superiori.json`, raggruppato per provincia → indirizzo (Liceo/Tecnico/Professionale) → elenco scuole. Il JSON generato (~430 KB) è invece versionato, perché è ciò che l'app consuma davvero
- La tipologia MIM (es. "LICEO SCIENTIFICO", "IST PROF ALBERGHIERO") viene mappata sulle 3 macro-categorie del form; le tipologie non classificabili (scuole infanzia/primaria/medie, istituti comprensivi, istituti superiori generici non ancora scorporati per indirizzo, convitti) vengono escluse
- **Limite noto**: Trento, Bolzano e Valle d'Aosta non compaiono nel dataset MIM perché lì la competenza sull'istruzione è provinciale/regionale autonoma — per queste 3 province il menu scuole resterà vuoto e l'utente dovrà usare "La mia scuola non è in elenco"
- Il menu a cascata provincia → tipo di istituto → scuola è incapsulato nel componente condiviso `components/ScuolaCascadeFields.tsx` (legge il JSON via `fetch` client-side, non è importato nel bundle JS per non appesantirlo), riusato dal form studenti (`RegistrazioneForm`), dal form lead scuole (`RichiestaInformazioniForm`) e dal form docenti (`DocenteForm`) — non duplicare questa logica altrove. L'etichetta del campo è "Tipo di istituto" in tutti e tre i form

## Navigazione
Menu principale (in quest'ordine): Home, Per gli studenti, Per le scuole, Per i docenti, Aree di orientamento (mega-menu), Contatti.
- "Per le istituzioni" e "Come funziona" NON sono nel menu principale ma restano pagine attive, raggiungibili via URL diretto e linkate dal footer (footer nav completa: Home, Per gli studenti, Come funziona, Per le scuole, Per le istituzioni, Per i docenti, Contatti)
- "Aree di orientamento" non è una voce-link semplice: su desktop apre un mega-menu a griglia (16 aree, icona + nome + descrizione breve), su mobile si espande in un accordion verticale. Logica in `components/Header.tsx`, dati in `data/aree.ts`

## Aree di orientamento
16 aree tematiche (Informatica & Digitale, Salute & Professioni sanitarie, Ristorazione & Turismo, Meccanica & Meccatronica, Agri-food & Ambiente, Arte/Design & Moda, Musica & Spettacolo, Energia & Sostenibilità, Edilizia & Architettura, Economia & Management, Giurisprudenza & PA, Mobilità Sostenibile, Scienze dell'Educazione, Comunicazione & Media, Scienze & Ricerca, Sicurezza & Difesa), centralizzate in `data/aree.ts` (slug, nome, icona/monogramma, descrizione breve, descrizione estesa, direzioni possibili generiche — mai nomi di enti specifici).
- Pagina dinamica unica `app/aree/[slug]/page.tsx` (con `generateStaticParams`, tutte e 16 pre-renderizzate staticamente): hero, sezione "Che strade puoi prendere", form lead magnet, CTA finale verso `/registrazione`
- **Meccanismo lead magnet**: ogni pagina area ha un form "Scarica la guida di orientamento" (`components/GuidaAreaForm.tsx`: nome, cognome, email, classe frequentata, privacy) che per ora mostra solo la conferma "La guida sarà disponibile a breve: ti avviseremo via email!" — le guide PDF vere arriveranno in un secondo momento, il form è già predisposto e non salva nulla
- `/per-gli-studenti` (nuova pagina hub, sostituisce la destinazione diretta a `/registrazione` dai CTA studenti di Homepage) include una griglia di link rapidi a tutte le 16 aree

## Fasi del progetto
1. FASE ATTUALE: sito pubblico statico — Homepage, Per gli studenti, Come funziona, Per le scuole (scuole superiori, PCTO), Per le istituzioni (istituzioni formative post-diploma), Per i docenti (formazione AI/EdTech), 16 pagine Aree di orientamento, Registrazione (form studenti, solo UI), Contatti, Privacy
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
- Nuova pagina `/registrazione`: form di registrazione studente (solo UI client-side, nessun salvataggio reale — da collegare a Supabase in Fase 2), con menu a cascata provincia → indirizzo → scuola basato sul dataset MIM (vedi sezione "Dataset scuole secondarie")
- `/per-le-scuole` rivista: la sezione "Il contesto" (monte ore normativo) è stata sostituita da "Il percorso", che racconta il servizio invece dei numeri di legge; la sezione finale di attivazione è stata sostituita da un form lead ("Parla con un esperto KIREO", id `richiedi-informazioni`) con nome/cognome/email/telefono (obbligatorio)/ruolo del referente (Preside, Vice Preside, Referente Orientamento in uscita, Tutor Orientamento) + la stessa cascata scuole di `/registrazione`, tramite `RichiestaInformazioniForm`. Il CTA della hero è "Richiedi informazioni" (mai lessico contrattuale tipo "attiva la convenzione")
- `/per-i-docenti` completata con form di iscrizione (`DocenteForm`, id `entra-in-kireo`): nome/cognome/email/telefono facoltativo/materia di insegnamento/cascata scuola/dichiarazione di essere docente/privacy. Tutte le CTA della pagina (e quella della card docenti in Homepage) sono "Entra in KIREO"
- Navigazione ristrutturata (vedi sezione "Navigazione") e creata la sezione "Aree di orientamento" con 16 pagine dinamiche `/aree/[slug]` e relativo mega-menu; nuova pagina hub `/per-gli-studenti`

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
