# Come si assegna un'area a un elemento di missione

Questo documento è la regola di riferimento per taggare (o non taggare) con
un'area di orientamento un elemento di una missione KIREO Escape — un
mandato, una priorità, un materiale, una voce di budget, un lavoro, uno
scarto, un ruolo, una consulenza.

## Il principio, prima di ogni regola

Ogni cosa che KIREO afferma su uno studente deve essere **riconducibile a
un'azione che lo studente ha davvero compiuto, con una motivazione che lui
riconoscerebbe**. Dove non c'è prova, KIREO dice che non c'è prova — non
riempie il vuoto con un tag plausibile.

Un tag d'area su un elemento significa: *scegliere / leggere / fare questa
cosa accredita interesse (o performance, o autoefficacia, o curiosità) verso
quel campo.* Se quella lettura non regge davanti a un professionista di quel
campo, il tag è un'affermazione falsa sullo studente. Va tolto.

## Il test

> **Un professionista di quel campo riconoscerebbe questa cosa come il
> proprio lavoro quotidiano?**

- «Trasmettere una segnalazione al servizio sociale» → un'assistente sociale
  la riconosce → **salute-professioni-sanitarie**.
- «Leggere e valutare un preventivo di lavori» → chi sta in cantiere la
  riconosce → **edilizia-architettura** (non economia: non è contabilità).
- «Leggere l'edizione dell'anno scorso di un festival» → chi organizza eventi
  la riconosce → **musica-spettacolo**.
- «Accorgersi che metà del gruppo non parla mai» → un insegnante la riconosce
  → **scienze-educazione**.

Se **due** aree stanno sullo stesso elemento, sono entrambe legittime solo se
un professionista di **ciascuno** dei due campi riconosce quella cosa come
proprio lavoro. «Vincolo della Soprintendenza» è legittimamente beni
culturali **e** giurisprudenza. «Il precedente dell'anno scorso» non è
legittimamente nessuna delle due: è un dato storico.

## Le tre operazioni (più una)

Gli elementi portano **più aree contemporaneamente**: le liste-contenitore
sono grandi perché usate come secondo o terzo tag su elementi che hanno già
l'area giusta. Quindi le operazioni sono tre, non una.

| operazione | quando |
|---|---|
| **RIMAPPA → X** | il tag punta all'area sbagliata e non ne esiste una giusta sull'elemento. Se l'elemento porta già X, si degrada a RIMUOVI |
| **RIMUOVI** | l'elemento ha già l'area giusta e questo è un doppione tematico — oppure l'elemento non dice nulla di nessun campo ma un altro suo tag regge |
| **LASCIA** | il tag regge |

**RIMUOVI_DEL_TUTTO** è il caso limite di RIMUOVI: l'elemento non ha alcuna
area che regga (un fatto, una logistica, uno scoping senza mestiere
identificabile). Ogni RIMUOVI_DEL_TUTTO deve avere una motivazione reale, mai
un default. Prima di rimuovere l'ultimo tag, **guarda cosa resta**: se ciò
che resta è peggio di ciò che togli, la rimozione va fatta insieme alla
correzione dell'altro tag, non prima.

## Mandati e priorità: tre nature diverse

Un mandato non è sempre un campo. Distingui a occhio:

- **mandato-ipotesi** («il problema è X», un'ipotesi tecnica) → **può portare
  aree**. «Il sistema si racconta una bugia» → le sue aree hanno senso.
- **mandato-valore** («prima viene X», una posizione morale) → **non porta
  aree**. «Prima che nessuno si faccia male» dice qualcosa dello studente ma
  non che vuole entrare in polizia. Il segnale, se esiste, vive nell'**asse
  di stile** (analitico/relazionale/creativo/operativo), non nell'area.
- **mandato-lente** («è un problema di X», un angolo da cui guardi) → **non
  porta aree**. «È un problema di diritti» non è giurisprudenza: è un modo di
  ragionare. Un insegnante, un'assistente sociale e un avvocato possono tutti
  sceglierlo. Il segnale vive nell'asse.

**Una priorità è un'altra cosa ancora.** È un **fatto che ordini**. Metterlo
in cima non è scegliere un angolo: è dire che quel fatto conta di più — cioè
interesse, che è esattamente ciò che quello step misura. «Due gruppi non
riescono a stare nello stesso spazio», notato per primo, è sguardo educativo:
la priorità **porta l'area** (a meno che non sia un giudizio di valore
travestito da fatto — «una mediateca che fa pagare tradisce quello che è» —
che allora si tratta come un valore).

## La tassonomia del lavoro sociale e di cura

Il criterio è il **tipo di bisogno**, non il contesto:

- **minori, dimensione educativa** → **scienze-educazione**
- **disagio, servizi alla persona, presa in carico** → **salute-professioni-sanitarie**
- **atti, provvedimenti, procedimenti amministrativi** → **giurisprudenza-pa**

## I cinque errori tipici

1. **Il contesto scambiato per il campo.** «Succede a scuola» → educazione;
   «c'è di mezzo un ente pubblico» → PA. Ma leggere un bilancio resta
   contabilità anche in Comune, e un compito di gruppo a scuola non è
   pedagogia.
2. **«I personaggi si parlano» → comunicazione.** Un dossier come «Cosa ha
   detto davvero Tommaso» non riguarda il giornalismo: riguarda capire una
   persona.
3. **«C'è un ente pubblico» → giurisprudenza/PA**, anche quando l'azione è
   di un altro mestiere (leggere un bilancio, gestire uno spazio).
4. **«Non è un atto formale» scambiato per «non è un mestiere».** Le
   professioni di cura e di relazione lavorano quasi sempre **senza**
   produrre documenti. Un criterio tarato sui documenti le rende invisibili.
   Rispondere a chi soffre è un mestiere anche se non lascia una carta.
5. **Confondere una lente con un campo.** «È un problema di diritti» non è
   giurisprudenza: è un modo di guardare. Una cornice di valore non è
   un'area — il suo segnale, se c'è, è uno stile, non un interesse.

## Le trappole

Se un'opzione è marcata `trappola: true`, il suo tag è **inerte**: le
trappole non emettono interesse, la scelta non accredita nulla. Non serve
spostarne il tag (è già senza effetto); si toglie solo per pulizia. Ma
attenzione: se un'opzione **non** è una trappola, tenere un'area su una mossa
sbagliata accrediterebbe interesse a chi ha sbagliato — lì il tag va tolto,
non spostato.

## Due controlli sui dati puliti

Un tag corretto non basta: l'area deve restare **raggiungibile**.

1. **Totale per area.** Un'area con pochissimi tag è quasi invisibile.
2. **Copertura fra missioni.** I totali non bastano: un'area con venti tag
   tutti in una sola missione è fragile quanto una con un solo tag — la
   incontra solo chi gioca proprio quella. Conta in **quante missioni
   distinte** (su 11) l'area compare. Un'area presente in una o due missioni
   soltanto è fragile, in un modo che i totali non mostrano. È lo stesso
   ragionamento delle «attività distinte»: non conta quanto un segnale è
   denso, conta in quante situazioni diverse può emergere.

Se un'area scende sotto soglia dopo la pulizia, **non si inventano tag per
riempirla**: si registra come una lacuna di contenuto (quel contenuto non è
mai stato scritto) e si annota per un prossimo giro. I tag sbagliati che la
tenevano su erano il sintomo, non la cura.

## Togliere la strada sbagliata, non l'area

Correggere un tag non vuol dire quasi mai rendere un'area irraggiungibile. Il
più delle volte l'area resta — ma la si raggiunge solo attraverso le scelte
che la riguardano davvero. Esempio reale: in `guasto-serra`, arte-design-moda
era alimentata da cinque elementi. Tre erano «spiegare una cosa al pubblico»
(spiegare al pubblico, preparare la spiegazione, dire che è tutto a posto):
comunicazione travestita da design. Due erano genuinamente progettazione (il
mandato «abbiamo progettato male» e la consulenza a un progettista). Dopo la
correzione, i tre passano a comunicazione-media e i due restano: l'area
arte-design-moda **resta raggiungibile** in quella missione, ma solo per chi
compie scelte che parlano davvero di progetto — non perché a qualcuno tocca
spiegare qualcosa. Non abbiamo tolto l'area: abbiamo tolto la strada sbagliata
per arrivarci.

## L'euristica dei tag isolati

Un'area che compare in una missione su **uno o due elementi soltanto**,
mentre nessun altro elemento di quella missione la tocca, è **sospetta**: di
solito è un contesto scambiato per campo, o un refuso di copia-incolla. Il
censimento la segnala automaticamente (`tagIsolati`), da rivedere a occhio —
non è un errore certo, è un posto dove guardare.

## Una nota di metodo

Una regola vale **solo nel dominio in cui è stata data**. «Di quale mestiere
fa parte» vale per gli elementi che descrivono un'azione, non per le cornici
di valore; «lente» vale per i mandati, non per le priorità. Prima di
estendere una regola a una categoria che non era nominata, fermati e chiedi.
