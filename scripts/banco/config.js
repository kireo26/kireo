// Configurazione del banco: letta da un file locale, MAI dal repository.
//
// Il file è `.banco.local.json` nella radice del progetto, ignorato da git.
// Contiene segreti veri (il segreto del cron, la chiave service role, il token
// Vercel): se finisse in un commit sarebbe pubblicato, e revocarlo dopo non
// cancella la cronologia.
//
// REGOLA DI QUESTO FILE: il banco si rifiuta di partire quando manca qualcosa,
// e dice COSA metterci e DOVE prenderlo. Uno stack trace su `undefined` è il
// modo in cui uno strumento pensato per far risparmiare tempo ne fa perdere.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");

const PERCORSO = path.join(__dirname, "..", "..", ".banco.local.json");

// Ogni chiave con: a cosa serve, e dove si trova. Il testo qui sotto è quello
// che Mario legge quando manca qualcosa, quindi è scritto per essere seguito
// senza sapere niente di questo file.
const CHIAVI = {
  sitoUrl: {
    cosa: "L'indirizzo del sito in produzione, con www e senza barra finale.",
    dove: 'Di solito "https://www.kireo.it". Metti la forma con www: senza, Vercel risponde con un redirect e il cron non parte.',
  },
  cronSecret: {
    cosa: "Il segreto che protegge la route del cron.",
    dove: "Vercel → progetto kireo → Settings → Environment Variables → CRON_SECRET. Se non riesci a rileggerlo (è marcato Secret) rigeneralo: vedi `npm run banco aiuto-segreto`.",
  },
  supabaseUrl: {
    cosa: "L'indirizzo del progetto Supabase.",
    dove: "Supabase → Project Settings → Data API → Project URL (finisce in .supabase.co).",
  },
  supabaseServiceRoleKey: {
    cosa: "La chiave service_role di Supabase: legge tutto scavalcando la RLS.",
    dove: "Supabase → Project Settings → API keys → service_role. NON è la chiave anon: quella non vede le righe degli studenti.",
  },
  vercelToken: {
    cosa: "Un token personale Vercel, per leggere i log e lo stato dei deploy.",
    dove: "Vercel → foto profilo in alto a destra → Account Settings → Tokens → Create. Scope: il team che possiede il progetto. Sola lettura basta.",
  },
  vercelProjectId: {
    cosa: "L'identificativo del progetto su Vercel.",
    dove: 'Vercel → progetto kireo → Settings → General → Project ID (comincia per "prj_").',
  },
};

function esci(messaggio) {
  console.error("\n" + messaggio + "\n");
  process.exit(1);
}

function leggiConfig() {
  if (!fs.existsSync(PERCORSO)) {
    esci(
      `Manca il file di configurazione del banco:\n  ${PERCORSO}\n\n` +
        `Copia il file di esempio e riempi i campi:\n  cp .banco.local.json.esempio .banco.local.json\n\n` +
        `È già ignorato da git: i segreti che ci metti non finiscono in un commit.`,
    );
  }
  let dati;
  try {
    dati = JSON.parse(fs.readFileSync(PERCORSO, "utf8"));
  } catch (errore) {
    esci(`Il file ${PERCORSO} non è JSON valido:\n  ${errore.message}\n\nControlla virgole e virgolette.`);
  }
  return dati;
}

// Restituisce la config verificando che ci siano SOLO le chiavi che servono a
// questo comando: chi vuole solo far girare il motore non deve procurarsi un
// token Vercel per iniziare.
function config(chiaviRichieste) {
  const dati = leggiConfig();
  const mancanti = chiaviRichieste.filter((k) => !dati[k] || String(dati[k]).trim() === "");
  if (mancanti.length > 0) {
    const elenco = mancanti
      .map((k) => `  · ${k}\n      ${CHIAVI[k]?.cosa ?? ""}\n      Dove: ${CHIAVI[k]?.dove ?? "—"}`)
      .join("\n\n");
    esci(`Per questo comando servono valori che in .banco.local.json non ci sono:\n\n${elenco}`);
  }
  // Una barra finale nell'URL raddoppierebbe le barre in ogni chiamata.
  if (dati.sitoUrl) dati.sitoUrl = String(dati.sitoUrl).replace(/\/+$/, "");
  if (dati.supabaseUrl) dati.supabaseUrl = String(dati.supabaseUrl).replace(/\/+$/, "");
  return dati;
}

module.exports = { config, CHIAVI, PERCORSO, esci };
