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

### `livello` — `"base"` oppure `"trappola"`

Sono due cose diverse e il robot le tratta diversamente.

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
modello. `fiducia_massima` è il tetto oltre il quale il punteggio è troppo
generoso per un lavoro con quel buco dentro.

---

## Il vincolo che vale più di tutti

Il robot passa **dalla porta**: sessione vera, le stesse route, gli stessi gate
(`chatMinima`, `sezioniIncomplete`, il cooldown con l'override, la consegna via
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
venticinque giri che rispondono alla domanda strutturale.

Le `trappola` sono cinque o sei in tutto, non venticinque, e stanno in
`scripts/banco/consegne/trappole/<nome>.json` con la stessa forma — un ruolo
solo per file, così ognuna si può lanciare da sola quando si vuole riprovare
proprio quella.
