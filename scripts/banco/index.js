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
// Sola lettura, tranne `azzera-tentativi`, che sta in un file suo e chiede
// conferma mostrando la riga che cambia.
//
// E tranne `robot`, che è il secondo pezzo: quello scrive eccome — gioca i
// workshop come uno studente. Per questo si rifiuta di partire se l'account
// non è marcato `di_prova`, e dice quanto sta per spendere prima di farlo.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { motore } = require("./motore");
const { percorso } = require("./percorso");
const { log, deploy } = require("./vercel");
const { azzeraTentativi } = require("./azzera");
const { robot } = require("./robot");
const { PERCORSO } = require("./config");

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

  npm run banco log [minuti] [dpl_...] [--tutto]
      Le righe di errore dei revisori dai log di produzione (default: 60
      minuti), più cosa fare per ciascun motivo. Consulta TUTTI i deploy che
      coprono la finestra — dopo un redeploy le righe del guasto stanno sul
      deploy di prima — e dice sempre cosa ha potuto guardare e cosa no.
      Con --tutto mostra ogni riga, non solo quelle filtrate.

  npm run banco deploy
      Aspetta che il deploy di produzione sia READY, invece di ricaricare
      una pagina. Esce da solo quando è pronto o se fallisce.

  npm run banco robot [filtro] [--vai]
      IL SECONDO PEZZO: gioca i workshop come uno studente — iscrizione,
      sezioni, chat col cliente, consegna, cron — e alla fine misura i
      testi che i revisori hanno scritto. Dice quanto sta per spendere e
      chiede conferma (--vai la salta). Il filtro è una sottostringa:
      «palestra», «enoteca > food».
      Si rifiuta di partire se l'account non è marcato di_prova.

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
      return log(minuti ? Number(minuti) : 60, { tutto: resto.includes("--tutto"), deployId });
    }
    case "deploy":
      return deploy(true);
    case "robot": {
      const filtro = resto.find((a) => !a.startsWith("--"));
      return robot(filtro, { vai: resto.includes("--vai") });
    }
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
