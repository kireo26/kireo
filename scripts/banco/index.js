// IL BANCO DI PROVA — primo pezzo.
//
// Non fa giudizi e non chiama nessuna AI: fa i gesti che il 30 agosto 2026
// sono stati fatti a mano otto, due, tre e quattro volte — lanciare il cron,
// guardare dove sta un percorso, cercare l'errore di un revisore nei log,
// aspettare che un deploy sia pronto. Due ore di manovalanza su tre di
// sessione.
//
// LA PARTE CHE VALE non sono i comandi: è che stampano l'INTERPRETAZIONE e non
// solo i numeri. «{"processate":0,"errori":1}» non dice se rilanciare o
// fermarsi; «sei al tentativo 1 di 3, guarda perché prima di rilanciare» sì.
//
// Un punto d'ingresso solo — `npm run banco <comando>` — perché quattro script
// sparsi sono quattro cose da ricordare.
//
// Sola lettura, tranne i due `azzera-*`, che stanno in file loro e chiedono
// conferma mostrando cosa cambiano.
//
// E tranne `robot`, che è il secondo pezzo: quello scrive eccome — gioca i
// workshop come uno studente. Per questo si rifiuta di partire se l'account
// non è marcato `di_prova`, e dice quanto sta per spendere prima di farlo.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { motore } = require("./motore");
const { percorso } = require("./percorso");
const { log, deploy } = require("./vercel");
const { azzeraTentativi } = require("./azzera");
const { azzeraPercorsi } = require("./azzera-percorsi");
const { robot } = require("./robot");
const { iscrizioni } = require("./iscrizioni");
const { guasti } = require("./guasti");
const { confronta } = require("./confronta");
const { PERCORSO, flag } = require("./config");

const AIUTO = `
BANCO DI PROVA — i gesti manuali, fatti dal terminale

  npm run banco motore
      Fa girare il cron del workshop e dice cosa vuol dire l'esito:
      se una tappa è avanzata, se sta raffreddando, se la generazione è
      fallita e a che tentativo sei prima che la tappa avanzi vuota.

  npm run banco percorso [filtro]
      Dove sta ogni percorso: tappa, stato, quanto è passato dalla consegna,
      tentativi spesi, esito della revisione, fiducia accumulata.
      Il filtro è una sottostringa (slug del workshop, del ruolo, o id).

  npm run banco guasti [ore]
      QUELLO CHE IL MOTORE SA DI NON AVER FATTO (default: ultime 24 ore).
      Una tabella nostra, che resta: per ogni cosa che non è successa per
      qualcuno, una riga che dice QUANDO, DOVE, e soprattutto COSA non è
      arrivato — una revisione mancante è una tappa da rigiocare, un
      feedback finale mancante è la pagina di chiusura di un progetto.
      Dice sempre se sta rispondendo «zero guasti» o «non ho guardato».
      Non è «banco log»: quello legge la build su Vercel, e dura poche ore.

  npm run banco -- log [minuti] [dpl_...] [--tutto]
      GLI EVENTI DEL DEPLOY su Vercel — in pratica, la build (default: 60
      minuti). Consulta TUTTI i deploy che coprono la finestra — dopo un
      redeploy le righe stanno su quello di prima — e dice sempre cosa ha
      potuto guardare e cosa no. NON è il posto dove si cercano i guasti del
      motore: quelli stanno in «banco guasti».
      Con --tutto mostra ogni riga, non solo quelle filtrate. Il «--» dopo
      «banco» serve a npm per non mangiarsi i flag (funziona anche senza:
      il banco li rilegge da npm, ma con «--» funziona ovunque).

  npm run banco deploy
      Aspetta che il deploy di produzione sia READY, invece di ricaricare
      una pagina. Esce da solo quando è pronto o se fallisce.

  npm run banco iscrizioni
      Chi sta facendo cosa nei workshop: ruolo per ruolo, quante iscrizioni
      in corso, finite e lasciate. Nessuno è in coda — un ruolo lo possono
      fare quanti vogliono — quindi è un'informazione, non una scarsità.
      Segnala le iscrizioni che dicono «in corso» su un progetto già chiuso.

  npm run banco robot [filtro]
      IL SECONDO PEZZO: gioca i workshop come uno studente — iscrizione,
      sezioni, chat col cliente, consegna, cron — e alla fine misura i
      testi che i revisori hanno scritto. Dice quanto sta per spendere e
      chiede sempre conferma: è l'unico comando che spende, e non c'è un
      modo per saltarla. Il filtro è una sottostringa:
      «palestra», «enoteca > food».
      Senza filtro gioca le consegne BASE, venticinque ruoli. Gli altri due
      livelli girano sullo stesso ruolo con un corpo di risposte diverso e
      si chiamano per nome: «defibrillatore» (una trappola: c'è un difetto
      noto, il revisore lo vede?), «debole» (una consegna di qualità
      volutamente bassa: il punteggio distingue?). Una passata ne gioca uno
      solo — se il filtro ne prende due, il robot si ferma e lo dice.
      Si rifiuta di partire se l'account non è marcato di_prova.

  npm run banco studente
      LA PASSATA DALL'INIZIO ALLA FINE: i tre test attitudinali e poi la
      missione che ne esce. È il pezzo che mancava — fino a oggi il banco
      sapeva giocare solo i workshop, cioè l'ultimo gradino del percorso.
      I test non fanno nessuna chiamata AI, la missione ne fa tre: due o
      tre centesimi in tutto. La missione è FISSATA nel banco e confrontata
      con quella che il prodotto suggerisce: se divergono lo dice, invece
      di seguire il suggerimento e giocare una missione per cui i testi
      scritti non sono risposte.
      Chiede conferma e non parte su un account non di_prova, come robot.

  npm run banco confronta <rapporto-a> <rapporto-b>
      Due passate a confronto: quanto si muove il punteggio (per ruolo e per
      tappa), quante coppie di ruoli si INVERTONO, lingua e registro
      affiancati per genere di testo, e i commit che stanno in mezzo.
      I rapporti li scrive «npm run banco robot» alla fine di ogni passata.

  npm run banco azzera-percorsi
      Riporta i profili DI PROVA a prima della passata: cancella le loro
      iscrizioni ai workshop, e con quelle elaborati, tappe, chat e
      consegne. Senza, il banco è monouso — alla seconda passata tutti i
      ruoli risultano già completati. Mostra cosa cancella e chiede sempre
      conferma, senza modo di saltarla: è l'unico comando che cancella.
      Non parte su nessun account che non sia di prova.

  npm run banco azzera-tentativi <id-iscrizione> <id-fase>
      L'UNICO comando che scrive. Rimette a zero i tentativi di una tappa
      dopo che il guasto che li aveva bruciati è stato riparato.
      Mostra la riga e chiede conferma.

  npm run banco aiuto-segreto
      Come rigenerare CRON_SECRET, passo per passo.

CONFIGURAZIONE
  ${PERCORSO}
  (ignorato da git; parti da .banco.local.json.esempio)
  Ogni comando chiede solo le chiavi che gli servono.
`;

const AIUTO_SEGRETO = `
RIGENERARE CRON_SECRET — passo per passo

Perché. In questo momento il segreto in produzione è una parola indovinabile,
messa lì il 30 agosto per poter lanciare il cron a mano quando il valore vero
non era più rileggibile. Protegge una route che spende chiamate a pagamento:
chi la indovina può farle spendere. Ora che il banco legge il segreto da un
file locale, non c'è più ragione che sia comodo da digitare.

1. GENERA un valore nuovo, sul tuo computer. Nel Terminale:

       openssl rand -base64 32

   (oppure, se preferisci:  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" )

   Copia la riga che esce. Non incollarla in una chat: da qui in poi vive solo
   fra il tuo computer e Vercel.

2. METTILA SU VERCEL.
   · vercel.com → progetto kireo → Settings (in alto) → Environment Variables
   · cerca CRON_SECRET nell'elenco → i tre puntini a destra → Edit
   · incolla il valore nuovo nel campo Value
   · lascia spuntato SOLO Production (Preview e Development non servono)
   · Save

3. FAI UN REDEPLOY. È il passo che si dimentica: le variabili sono legate al
   deploy, quindi finché non ne fai uno nuovo il sito in aria continua a usare
   il valore vecchio.
   · Deployments (in alto) → il primo della lista, quello Production
   · i tre puntini a destra → Redeploy → conferma
   · aspetta con:  npm run banco deploy

4. METTILA NEL FILE LOCALE. Apri .banco.local.json e sostituisci il valore di
   "cronSecret" con lo stesso identico valore.

5. VERIFICA:  npm run banco motore
   Se risponde 401, il valore nei due posti non combacia: quasi sempre è uno
   spazio o un a-capo incollato per sbaglio in fondo.
`;

async function main() {
  const [comando, ...resto] = process.argv.slice(2);

  // `--vai` è esistito e non è mai arrivato fin qui (npm se lo mangiava). Ora
  // non c'è più: chi lo scrive per abitudine se lo sente dire, invece di
  // vedere la conferma e non capire perché. Ignorarlo in silenzio sarebbe di
  // nuovo uno strumento che indica una porta e non la apre.
  if (flag("vai", resto)) {
    console.log("\nNota: «--vai» non esiste più. La conferma si chiede sempre su robot e");
    console.log("azzera-percorsi — sono l'unico comando che spende e l'unico che cancella.\n");
  }
  switch (comando) {
    case "motore":
      return motore();
    case "percorso":
      return percorso(resto[0]);
    case "log": {
      // `--tutto` mostra ogni riga, non solo quelle filtrate: il filtro è una
      // comodità, non l'unico modo di vedere cosa è successo.
      const minuti = resto.find((a) => /^\d+$/.test(a));
      const deployId = resto.find((a) => a.startsWith("dpl_"));
      return log(minuti ? Number(minuti) : 60, { tutto: flag("tutto", resto), deployId });
    }
    case "guasti":
      return guasti(resto[0]);
    case "deploy":
      return deploy(true);
    case "iscrizioni":
      return iscrizioni();
    case "robot": {
      const filtro = resto.find((a) => !a.startsWith("--"));
      return robot(filtro);
    }
    case "studente": {
      // Caricato qui e non in testa: tira dentro il TypeScript del prodotto
      // (i test, le missioni), e non c'è ragione di compilarlo per chi scrive
      // «npm run banco motore».
      const { studente } = require("./studente");
      return studente();
    }
    case "confronta":
      return confronta(resto[0], resto[1]);
    case "azzera-percorsi":
      return azzeraPercorsi();
    case "azzera-tentativi":
      return azzeraTentativi(resto[0], resto[1]);
    case "aiuto-segreto":
      console.log(AIUTO_SEGRETO);
      return;
    default:
      console.log(AIUTO);
      if (comando) {
        console.error(`Comando sconosciuto: «${comando}».\n`);
        process.exit(1);
      }
  }
}

main().catch((errore) => {
  console.error("\n✗ " + (errore?.message ?? errore) + "\n");
  process.exit(1);
});
