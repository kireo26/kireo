#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LE COLONNE CHE REGISTRANO «CHI HA FATTO QUESTO» SI CONTANO (Mario, 01/11).
//
// Ogni chiave verso `profiles` che non è in cascata impedisce di cancellare il
// profilo che nomina: è il prezzo di sapere chi ha fatto cosa, non un difetto. Ma
// cresce da sola, una colonna alla volta (10 il 10/10, 12 il 26/10, 15 il 01/11),
// e ognuna è un modo in più in cui qualcuno non potrà più andarsene. Quindi si
// contano: questa è la lista, con chi firma, e una chiave nuova di quel tipo è
// rossa finché qualcuno non la scrive qui. Il giorno in cui si costruisce la
// politica decisa il 01/11 (il nome resta sulle certificazioni, l'account se ne
// va), ogni riga di questa lista è una colonna da trattare.
//
// Il lettore è lo stesso della cascata (scripts/lib/cascata-profili.js). Il
// 01/11 il suo conto (15) è uguale a quello di pg_constraint sulla replica:
//   select count(*) from pg_constraint where contype = 'f'
//     and confrelid = 'public.profiles'::regclass and confdeltype <> 'c';
const { leggiMigrazioni } = require("./lib/cascata-profili");

const DICHIARATE = {
  // tabella: [quante, chi firma]
  school_staff: [2, "chi ha invitato un membro dello staff; chi ha cambiato una delega"],
  student_profiles: [1, "chi ha verificato uno studente"],
  iscrizioni_eventi: [2, "chi ha certificato una presenza; il referente che ha iscritto d'ufficio"],
  iscrizioni_classe_eventi: [1, "il referente che ha iscritto una classe"],
  messaggi_scuola: [1, "chi ha scritto agli studenti"],
  post_enti: [2, "chi ha approvato un post; chi l'ha tolto dal feed"],
  proposte_incontro: [1, "chi ha proposto un incontro"],
  chiavi_trasmissione: [1, "chi ha scritto la chiave"],
  eventi: [2, "chi ha chiuso una diretta; chi ha corretto le ore"],
  newsletter_enti: [1, "chi ha approvato una newsletter"],
  istituzioni_aree: [1, "chi ha revocato un'area"],
};

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? `\n      → ${typeof dettaglio === "string" ? dettaglio : JSON.stringify(dettaglio)}` : ""}`);
  }
}

const { archi } = leggiMigrazioni();
const versoProfili = archi.filter((a) => a.madre === "profiles");
const bloccanti = versoProfili.filter((a) => !a.cascata);
const trovate = {};
for (const a of bloccanti) trovate[a.figlia] = (trovate[a.figlia] ?? 0) + 1;

console.log("\nLe chiavi verso profiles che non sono in cascata\n");
ok(versoProfili.length > 30, `il lettore vede le chiavi verso profiles (${versoProfili.length}, pavimento 30): a zero sarebbe verde su niente`);
const totaleDichiarato = Object.values(DICHIARATE).reduce((s, [n]) => s + n, 0);
ok(bloccanti.length === totaleDichiarato, `bloccano la cancellazione: ${bloccanti.length} (dichiarate ${totaleDichiarato})`);
const tutte = new Set([...Object.keys(DICHIARATE), ...Object.keys(trovate)]);
const diverse = [...tutte].filter((t) => (trovate[t] ?? 0) !== (DICHIARATE[t]?.[0] ?? 0)).map((t) => `${t}: trovate ${trovate[t] ?? 0}, dichiarate ${DICHIARATE[t]?.[0] ?? 0}`);
ok(diverse.length === 0,
  "ogni tabella ha le chiavi che la lista dice: una nuova si scrive qui, con chi firma, e si pensa a cosa succede a chi se ne va",
  diverse);
ok(Object.values(DICHIARATE).every(([, chi]) => chi.trim().length > 0), "ogni riga dice chi firma");

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:responsabilita)`);
process.exit(falliti === 0 ? 0 : 1);
