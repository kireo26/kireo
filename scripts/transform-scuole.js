// Trasforma l'anagrafe delle scuole statali del Ministero dell'Istruzione
// (open data) in un JSON compatto usato dal form di registrazione studenti
// per il menu a cascata provincia -> indirizzo -> scuola.
//
// Fonte dati: https://dati.istruzione.it/opendata/opendata/catalogo/elements1/?area=Scuole
// Dataset: "Anagrafe Scuole Statali" (DS0400SCUANAGRAFESTAT)
//
// Per rigenerare il JSON con un dataset aggiornato:
//   1. Scarica il CSV più recente dalla pagina del dataset sopra (link "Scarica in formato CSV")
//   2. Salvalo come scripts/data/anagrafe-scuole-statali.csv (il file scaricato è in
//      encoding ISO-8859-1: convertilo con `iconv -f ISO-8859-1 -t UTF-8 input.csv -o scripts/data/anagrafe-scuole-statali.csv`)
//   3. Esegui: node scripts/transform-scuole.js
//   4. Il risultato viene scritto in public/data/scuole-secondarie-superiori.json

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "data", "anagrafe-scuole-statali.csv");
const OUT = path.join(__dirname, "..", "public", "data", "scuole-secondarie-superiori.json");

function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        result.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  result.push(cur);
  return result;
}

// Mappa la tipologia MIM su Liceo / Tecnico / Professionale. Le altre
// tipologie (infanzia/primaria/medie, istituti comprensivi, istituti
// superiori generici non ancora scorporati per indirizzo, convitti) vengono
// escluse perché non classificabili in una delle tre categorie del form.
function classifica(tipo) {
  const t = tipo.toUpperCase();
  if (t.startsWith("LICEO") || t === "ISTITUTO MAGISTRALE" || t === "SCUOLA MAGISTRALE" || t === "ISTITUTO D'ARTE") {
    return "Liceo";
  }
  if (t.startsWith("ISTITUTO TECNICO") || t.startsWith("IST TEC")) {
    return "Tecnico";
  }
  if (t.startsWith("IST PROF") || t.startsWith("ISTITUTO PROFESSIONALE")) {
    return "Professionale";
  }
  return null;
}

// Normalizza il nome provincia MIM (maiuscolo, talvolta con vecchie
// sub-province sarde) sul nome ufficiale delle 107 province attuali usate
// nel form. Le 4 vecchie sub-province sarde vengono riaccorpate secondo la
// riforma 2016 (approssimazione ragionevole, non un confine amministrativo
// esatto).
const PROVINCIA_OVERRIDE = {
  "FORLI'-CESENA": "Forlì-Cesena",
  "GALLURA NORD-EST SARDEGNA": "Sassari",
  "MEDIO CAMPIDANO": "Sud Sardegna",
  "OGLIASTRA": "Nuoro",
  "SULCIS IGLESIENTE": "Sud Sardegna",
};

function titleCase(s) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function normalizzaProvincia(raw) {
  if (PROVINCIA_OVERRIDE[raw]) return PROVINCIA_OVERRIDE[raw];
  return titleCase(raw);
}

const raw = fs.readFileSync(SRC, "utf8");
const lines = raw.split("\n").filter((l) => l.trim().length > 0);
const header = parseCSVLine(lines[0]).map((h) => h.trim());

const idx = {
  provincia: header.indexOf("PROVINCIA"),
  codice: header.indexOf("CODICESCUOLA"),
  nome: header.indexOf("DENOMINAZIONESCUOLA"),
  tipo: header.indexOf("DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA"),
};

// { [provincia]: { [indirizzo]: [{codice, nome}] } }
const grouped = {};
const codiciVisti = new Set();
let totali = 0;
let inclusi = 0;

for (let i = 1; i < lines.length; i++) {
  const f = parseCSVLine(lines[i]);
  if (f.length < header.length) continue;
  totali++;

  const indirizzo = classifica(f[idx.tipo]);
  if (!indirizzo) continue;

  const codice = f[idx.codice].trim();
  if (codiciVisti.has(codice)) continue; // evita duplicati (stesso codice su più righe)
  codiciVisti.add(codice);

  const provincia = normalizzaProvincia(f[idx.provincia].trim());
  const nome = f[idx.nome].trim();

  grouped[provincia] ??= {};
  grouped[provincia][indirizzo] ??= [];
  grouped[provincia][indirizzo].push({ codice, nome });
  inclusi++;
}

for (const provincia of Object.keys(grouped)) {
  for (const indirizzo of Object.keys(grouped[provincia])) {
    grouped[provincia][indirizzo].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(grouped));

console.log("Righe totali nel CSV:", totali);
console.log("Scuole incluse (secondarie II grado classificate):", inclusi);
console.log("Province presenti nel JSON:", Object.keys(grouped).length);
console.log("Dimensione file JSON:", (fs.statSync(OUT).size / 1024 / 1024).toFixed(2), "MB");
