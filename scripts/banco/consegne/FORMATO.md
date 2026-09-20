# Il formato delle consegne del robot

Un file per workshop, con dentro tutti e cinque i ruoli.
Percorso: `scripts/banco/consegne/<workshop-slug>.json`

I file sono **dati, non codice**: JSON, così si scrivono senza toccare niente
e un errore di battitura lo trova il validatore invece del robot a metà giro.

---

## La forma

```jsonc
{
  "workshop": "palestra-popolare",

  "ruoli": {
    "salute": {
      "livello": "base",

      "tappe": {
        "quartiere_programma": {
          "sezioni": {
            "ricognizione": "Le madri con bambini piccoli non vengono…",
            "programma_settimanale": [
              ["Lunedì 17-18", "Bambini 6-10", "Gioco-boxe"],
              ["Martedì 19-20", "Adulti", "Boxe base"]
            ],
            "priorita": ["programma_donne", "orari_pomeriggio", "costo_zero"]
          },
          "chat": [
            "Tonino, quante persone entrano oggi in palestra in un giorno normale?",
            "E le donne del quartiere, ci sono già o è tutta roba da costruire?",
            "Se metto un corso il pomeriggio presto, la sala è libera?"
          ]
        }
      }
    }
  }
}
```

### `sezioni` — indicizzate per **id**, come `contenuto`

La chiave è l'`id` della sezione in `lib/workshop/elaborato-config.ts`, non il
titolo: è quello che finisce in `workshop_elaborati.contenuto`, ed è quello che
il revisore riceve.

Il valore ha la forma che il tipo della sezione si aspetta — le stesse cinque
di `ValoreSezione`:

| `tipo` nel config | cosa scrivere nel JSON |
|---|---|
| `testo`, `testo_lungo` | una stringa (rispetta `minCaratteri`, se c'è) |
| `tabella` | array di righe, ogni riga array di celle nell'ordine di `colonne` |
| `checklist` | `{ "voci": { "Defibrillatore (DAE) in sala": true }, "nota": "" }` |
| `scelta` | `{ "opzione": "…", "motivazione": "…" }` |
| `immagine` | ometti: è sempre facoltativa, e il robot non carica file |

**Una sezione può essere lasciata fuori di proposito** — è il caso della
checklist vuota di oggi. Se il gate la pretende, il robot **si ferma e lo
riporta**: non la riempie per farsi passare. Quel blocco è un risultato.

### `chat` — i messaggi allo stesso cliente, in ordine

Il robot li manda uno per uno dalla chat vera, finché la tappa non raggiunge la
sua `chatMinima`. Se ne dai **meno del minimo**, il robot si ferma e dice quanti
ne servivano: non ne inventa.

Se ne dai **più** del necessario, manda solo quelli che servono — ogni messaggio
è una chiamata a pagamento, e il tetto per tappa è comunque 10.

### `livello` — `"base"`, `"trappola"` oppure `"debole"`

Sono tre cose diverse e il robot le tratta diversamente. **Non sono tre gradi
della stessa scala: sono tre domande.**

| livello | la domanda |
|---|---|
| `base` | funziona per tutti e venticinque? |
| `trappola` | c'è dentro un difetto noto: il revisore lo vede? |
| `debole` | due ingressi di qualità nota: il punteggio distingue? |

**Una passata ne gioca UNO SOLO**, e il rapporto dice quale. Il robot lo
controlla sul piano, prima di spendere: se il filtro ha preso due livelli si
ferma e lo dice. La guardia non sta nei nomi dei file perché un filtro può
prendere due livelli comunque — «salute» prende la base per etichetta e la
consegna debole per nome.

**`base`** risponde a *«funziona per tutti e venticinque?»*. Nessun esito
atteso: il robot registra quello che succede e basta. Serve a trovare i guasti
strutturali — un config rotto, una sezione senza minimo, un ruolo su cui il
revisore fallisce sempre.

**`trappola`** ha in più un `atteso`, e il robot dice se è stato colto:

```jsonc
"salute": {
  "livello": "trappola",
  "nome": "il defibrillatore che non c'è",
  "atteso": {
    "tappa": "sicurezza",
    "deve_comparire": ["defibrillatore", "BLSD"],
    "non_deve_comparire_nei_punti_forza": ["protocollo", "ordine giusto"],
    "fiducia_massima": 18
  }
}
```

I tre campi sono tutti facoltativi e si controllano **sul testo della revisione
di quella tappa**, con un confronto letterale — nessun modello che giudica un
modello (`scripts/banco/robot/atteso.js`, provato da `npm run test:robot`).

- `deve_comparire` si cerca in **tutta** la revisione;
- `non_deve_comparire_nei_punti_forza` **solo** fra i punti di forza: dire
  «l'ordine giusto non basta» fra i *da migliorare* è giusto, è elogiarlo che
  è il difetto;
- `fiducia_massima` è il punteggio **di quella tappa** (`punteggio_fiducia`,
  su 25), non la fiducia totale del progetto.

Se la tappa non viene giocata, o se il revisore si arrende, il verdetto è
**«non lo so»** e non «è andata bene»: una trappola scampata per un guasto non
è una trappola colta.

#### `atteso.dove` — la tappa, o il feedback finale

`dove` assente vuol dire `"tappa"`: le trappole scritte prima valgono ancora.
L'altro valore è `"feedback_finale"`, che **non è una tappa** — niente rubrica,
niente punteggio, quindi né `tappa` né `fiducia_massima`:

```jsonc
"atteso": {
  "dove": "feedback_finale",
  "la_proprieta": "Con domande senza filo, il finale non deve affermare che
                   dallo studente emerge un modo ricorrente di entrare nei
                   problemi. Deve poter dire che non emerge niente.",
  "non_deve_affermare_uno_schema": ["un modo tuo", "hai sempre", "un filo"]
}
```

`deve_comparire` vale anche qui, con lo stesso significato. Le altre due
si cercano in **tutte** le stringhe del finale e non solo nei punti di forza —
la proprietà è «il finale non lo afferma», non «non lo afferma lì». Si guardano
tutte le stringhe invece dei campi nominati uno per uno apposta: `punti_forza`
è già diventato `cosa_regge` una volta, e un controllo ancorato ai nomi
smetterebbe di guardare senza dirlo.

**E sono DUE famiglie, non una lista più lunga:**

| campo | cosa cerca | esempio |
|---|---|---|
| `non_deve_affermare_uno_schema` | una generalizzazione su TUTTE le azioni | «un modo tuo», «hai sempre», «tutte e tredici» |
| `non_deve_attribuire_intenzioni` | un'intenzione su UNA sola azione | «non è una domanda random», «non a caso» |

Il 13/09 la trappola delle domande sparse è passata su tutte e tredici le forme
aggregate — e il modello aveva comunque inventato un'intenzione, su una domanda
sola: *«non è una domanda random: è il vincolo che dà forma a tutto il resto»*,
detto della domanda che era stata messa lì **per costruzione perché non ne
avesse nessuna**. Le forme aggregate non potevano vederlo: cercano una
generalizzazione su tutte le domande, e lì la generalizzazione era su una.

Tenerle nello stesso campo avrebbe fatto stampare «non afferma uno schema con
"non è una domanda random"», che è la frase sbagliata — quello non è uno
schema — e alla prossima passata nessuno avrebbe saputo dire quale delle due
famiglie aveva morso.

#### `atteso.rosso_atteso` — una trappola può essere rossa DI PROPOSITO

Una trappola può chiedere una proprietà che il prodotto **non ha ancora**, e
stare nella suite per renderla visibile *prima* che si costruisca la cosa che
dovrebbe averla. Un test che nasce verde su un comportamento mai scritto non
prova niente.

```jsonc
"rosso_atteso": "il blocco non può ancora tacere: punti_forza è un array
                 obbligatorio di 2-3 elementi, quindi il silenzio non è un
                 esito rappresentabile e il modello riempie."
```

Il campo cambia come si legge il rapporto, non cosa si controlla:

| | senza `rosso_atteso` | con |
|---|---|---|
| controlli falliti | `✗ NON COLTA` — l'allarme | `✗ rossa, come previsto` + il motivo |
| controlli passati | `✓ COLTA` | `★ È DIVENTATA VERDE` — **la notizia** |

Il quarto caso è quello per cui il campo esiste. Quando una trappola attesa
rossa passa, il rapporto lo dice in testa e **senza esultare**: il controllo è
lessicale, quindi parziale, e un modello che dice la stessa cosa con altre
parole lo passa. O la proprietà è arrivata, o il controllo ha smesso di
guardare dove guardava — le due cose si distinguono solo **leggendo**.

*E il motivo è obbligatorio se il campo c'è: «rossa e basta» in un rapporto si
legge come un guasto, e un guasto che non è un guasto è il modo di far smettere
di leggere i rapporti. Una trappola tenuta fuori dalla suite perché fallisce è
una trappola che nessuno rimette dentro.*

*Nota storica, perché non succeda di nuovo: dal primo giorno questo documento
prometeva che «il robot dice se è stato colto», e per una settimana `atteso`
è stato **validato nella forma** ma mai **controllato contro il giro**. Una
trappola sarebbe girata producendo solo del testo da leggere — cioè la cosa
per cui non serviva costruirla.*

### `debole` — una consegna di qualità volutamente bassa

Sta in `scripts/banco/consegne/deboli/<nome>.json`, un ruolo per file, con un
`nome` obbligatorio: si chiama per quello, mai per il ruolo.

**Perché esiste.** Il 20/09 la rubrica del punteggio di tappa è andata in
produzione e la passata di `palestra` ha dato quattro valori distinti su venti
tappe. La lettura giusta non era «la rubrica non funziona»: era che *la
dispersione dei voti era stata misurata su una popolazione che non ne aveva* —
le venti consegne le aveva scritte una persona sola, tutte bene. Con un ingresso
solo, «i numeri sono tutti simili» non separa **la rubrica non distingue** da
**i lavori non erano diversi**. Servono due ingressi di qualità nota.

**Come si scrive, e questa è la parte difficile.** Non è una caricatura: è la
consegna di uno studente che ha fatto il compito. Nomina i problemi giusti, sta
in tema, riempie tutte le sezioni — ma non scende mai su un caso, non ha una
cifra con una provenienza, e dove la sezione chiede una scelta che costa
risponde con un principio. Scritta assurda non servirebbe: un revisore la boccia
e non si impara niente sul confine che interessa.

**È un corpo a sé, non la base con dei buchi.** Se le mancasse una sezione, la
passata proverebbe `sezioniIncomplete` invece della rubrica — e il numero che ne
uscirebbe direbbe «la tappa non si consegna», non «questo lavoro regge meno».
`npm run test:consegne` lo controlla in due modi: la tappa deve consegnarsi (lo
stesso gate delle `base`) e deve riempire **le stesse sezioni della base dello
stesso ruolo**, confrontate col file vero e non con un elenco scritto a mano.

**Il metro si scrive prima**, come per ogni prova di questo banco: quali
punteggi ci si aspetta, e quale risultato vorrebbe dire *smetti*. Per la prima
(`salute`): con le ancore la consegna deve stare in 6-11 su quasi tutte le
tappe; **se prende 16 o più, il numero non distingue** — e allora la strada non
è riscrivere le ancore, è togliere la barra 0-100.

### Come si lancia una trappola

```
npm run banco robot defibrillatore
```

Per **nome**, o per il nome del file — mai per workshop o per ruolo: chi scrive
`palestra` vuole i cinque ruoli base, e trovarsi dentro anche una trappola
sarebbe una sorpresa a pagamento. Vale identico per una consegna debole
(`npm run banco robot debole`). Per lo stesso motivo **solo le `base` entrano
nella passata completa**: tutto il resto gira sullo stesso ruolo di una `base`,
e nella stessa passata sarebbero due iscrizioni sullo stesso workshop per lo
stesso account.

Una trappola e una consegna debole sono i casi in cui il robot rigioca un ruolo
che ha già completato: è un'altra consegna sullo stesso ruolo, ed è il punto.
Costa il
giro intero (22 chiamate per un ruolo da quattro tappe) anche quando la
trappola sta nella terza: le tappe sono gated, la terza si apre solo dopo che
le prime due sono state revisionate.

---

## Il vincolo che vale più di tutti

Il robot passa **dalla porta**: sessione vera, le stesse route, gli stessi gate
(`chatMinima`, `sezioniIncomplete`, il raffreddamento — che il cron salta per i profili di prova — la consegna via
`/api/workshop/elaborato/consegna-tappa`). Mai la service-role, mai le funzioni
SQL chiamate a mano.

Quindi: se un gate blocca il robot, **il robot si ferma e lo riporta come
risultato**. Non lo aggira. La scoperta migliore di oggi — la checklist che
obbligava a spuntare una voce — è venuta da un gate che ha morso, e un robot
entrato dalla porta di servizio avrebbe certificato che andava tutto bene.

---

## Cosa non va nel file

- **niente id, niente uuid**: iscrizioni e tappe le crea il robot;
- **niente punteggi di fiducia attesi** sul livello `base`: è quello che stiamo
  misurando, e scriverlo prima vorrebbe dire deciderlo;
- **niente giudizi sulla qualità della revisione**: quelli li leggete voi.

## Come si verifica un file, prima che il robot lo giri

```
npm run test:consegne
```

Controlla **contro il motore vero**, non contro questo documento: gli id delle
sezioni, i minimi, il numero di colonne e soprattutto `sezioniIncomplete` —
cioè lo stesso identico gate che il robot troverà quando proverà a consegnare.
Un controllo scritto a parte direbbe che va tutto bene fino al giorno in cui il
gate cambia.

Dice anche quello che non è un errore ma costa: i messaggi di chat oltre il
minimo, che il robot non manderà.

## Quanti file servono

Cinque `base`, uno per workshop, con tutti e cinque i ruoli dentro: sono i
venticinque giri che rispondono alla domanda strutturale. **Ci sono tutti e
cinque** (agosto 2026).

Il conto della passata completa, misurato sul motore e non a spanne:
**25 ruoli, 100 tappe, 126 sezioni, 325 messaggi di chat, 550 chiamate AI**
— 2 per tappa (revisione + reazione del cliente) più la chat minima, più un
feedback finale per ruolo. La chat pesa quanto i revisori, ed è la ragione per
cui un messaggio in più nel file non è gratis.

Le `trappola` sono cinque o sei in tutto, non venticinque, e stanno in
`scripts/banco/consegne/trappole/<nome>.json` con la stessa forma — un ruolo
solo per file, così ognuna si può lanciare da sola quando si vuole riprovare
proprio quella.

Le `debole` stanno in `scripts/banco/consegne/deboli/<nome>.json`, stessa forma
e stesso principio. Ce n'è **una** (agosto→settembre 2026: `salute-debole`), e
una basta per la domanda per cui è nata. Ne serviranno altre solo se un giorno
la risposta risultasse ambigua: lì la strada è più ruoli deboli, non ancore
riscritte.
