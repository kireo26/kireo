// Il tetto dei workshop, lato TypeScript: quello che legge chi non può
// cominciarne un altro.
//
// PERCHÉ ESISTE, E COSA NON PROVA. Il tetto vero è in SQL, e lo provano le
// tredici proprietà di `scripts/verifica-tetto-workshop.sql` contro un Postgres
// reale — un `with check` non si controlla da qui. Questo file prova l'altra
// metà: che il no arrivi allo studente dicendo QUALE dei due muri è e DOVE si
// va, invece di «new row violates row-level security policy» tradotto in
// «Riprova».
//
// LA PROPRIETÀ CHE CONTA DI PIÙ è che il caso «ne hai già uno attivo» NOMINI
// quel workshop e ci porti: il bottone per lasciarlo sta sulla pagina di quel
// workshop (`RitiroIscrizione`), quindi un no che non lo nomina manda a cercare.
//
// E LA DIREZIONE DELL'ERRORE È DICHIARATA: se la lettura fallisce (`null`) il
// testo è `null`, cioè la scelta del ruolo si mostra e sarà il database a dire
// no. Nascondere la scelta per un errore di rete direbbe a chi ha un posto
// libero che non ce l'ha.
//
// Esecuzione: `npm run test:tetto`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");

abilitaTypeScript();

const { avvisoTetto, leggiTettoWorkshop } = require("@/lib/workshop/tetto");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

let falliti = 0;
function ok(cond, testo) {
  console.log(`  ${cond ? "✓" : "✗"} ${testo}`);
  if (!cond) falliti++;
}

function leggi(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// Un commento può contenere qualunque cosa: le guardie lessicali guardano il
// codice, non quello che ci abbiamo scritto intorno.
function senzaCommenti(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

console.log("\n═══ IL TETTO DEI WORKSHOP (lato pagina) ═══\n");

const APERTO = { usate: 1, tetto: 3, puo: true, esente: false, attivoSlug: null, attivoTitolo: null, attivoRuolo: null };
const UNO_ATTIVO = {
  usate: 1,
  tetto: 3,
  puo: false,
  esente: false,
  attivoSlug: "palestra-popolare",
  attivoTitolo: "Apri una palestra popolare",
  attivoRuolo: "Salute e sicurezza",
};
const PIENO = { usate: 3, tetto: 3, puo: false, esente: false, attivoSlug: null, attivoTitolo: null, attivoRuolo: null };

// ── 1. chi può non legge niente ──────────────────────────────────────────────
console.log("Chi può cominciarne un altro:");
ok(avvisoTetto(APERTO) === null, "nessun avviso: la scelta del ruolo si mostra");

// ── 2. la lettura fallita degrada verso l'aperto ─────────────────────────────
console.log("\nQuando non si è potuto leggere:");
ok(avvisoTetto(null) === null, "nessun avviso — il no lo dirà il database, non una nostra ipotesi");

// ── 3. uno attivo: il caso che deve nominare un posto ────────────────────────
console.log("\nCon un workshop già attivo:");
const a = avvisoTetto(UNO_ATTIVO);
ok(a !== null, "c'è un avviso");
ok(a.corpo.includes("Apri una palestra popolare"), "il corpo NOMINA il workshop attivo");
ok(a.corpo.includes("Salute e sicurezza"), "e nomina il ruolo");
ok(a.cta?.href === "/app/workshop/palestra-popolare", "la CTA porta alla pagina di QUEL workshop (dove sta il bottone per lasciarlo)");
ok(/lascia|lasciarlo|lasciare/i.test(a.corpo), "dice che si può lasciare, non solo che si deve finire");
ok(/resta|dov'è|dove/i.test(a.corpo), "e dice che il lavoro non si perde: senza questo, nessuno clicca");
ok(!/\b3\b|\btre\b/.test(a.titolo), "il titolo non parla del tetto: questo muro è un altro");
// NESSUNA DURATA DICHIARATA. «dura settimane» c'era e l'ha tolta Mario: nessuno
// studente vero ne ha ancora finito uno, quindi era una cifra travestita da
// frase — la specie che togliamo dai testi degli altri.
ok(!/settiman|giorni|mesi/i.test(a.corpo), "non dichiara quanto dura un workshop: non lo sappiamo");

// Il ruolo può mancare (una riga senza ruolo non dovrebbe esistere, ma se
// esistesse il testo non deve uscire storto).
const senzaRuolo = avvisoTetto({ ...UNO_ATTIVO, attivoRuolo: null });
ok(!senzaRuolo.corpo.includes("nel ruolo"), "senza il ruolo la frase non lascia «nel ruolo» a vuoto");
ok(!/ {2}/.test(senzaRuolo.corpo) && !/ \./.test(senzaRuolo.corpo), "e non lascia doppi spazi o uno spazio prima del punto");

// ── 4. il tetto pieno: un muro diverso, e non ha un passo da fare ────────────
console.log("\nCon il tetto pieno:");
const p = avvisoTetto(PIENO);
ok(p !== null, "c'è un avviso");
ok(p.titolo.includes("3"), "il titolo dice quanti ne ha fatti");
ok(p.corpo.includes("3"), "e il corpo dice quanti se ne possono fare");
// L'ANCORA ERA `includes("lascia")` E PESCAVA UNA COSA GIUSTA: il testo dice
// «sei lasciati a metà», che è la ragione del tetto, non un invito a lasciare
// qualcosa. La proprietà vera è che qui NON compaia il passo dell'altro caso —
// non c'è niente di attivo da chiudere, quindi né «lascialo» né «finisci quello».
ok(!/lascialo|finisci quello/i.test(p.corpo), "non manda a chiudere un workshop attivo: qui non ce n'è nessuno");
ok(!/«/.test(p.corpo), "e non nomina nessun workshop, perché nessuno è in corso");
ok(/resta|tuo/i.test(p.corpo), "dice che il lavoro resta suo");
// NON si cerca «non è una punizione»: quella frase è stata TOLTA di proposito
// (nominare l'obiezione la pianta in testa a chi non ce l'aveva). Quello che
// deve restare è la ragione, e la ragione è la diluizione del ritratto.
ok(!/punizione/i.test(p.corpo), "non nomina la punizione: l'obiezione non si suggerisce a chi non ce l'ha");
ok(/ritratto/i.test(p.corpo) && /appiatt|a metà/i.test(p.corpo), "e dice PERCHÉ il tetto esiste: il ritratto si appiattisce");

// ── 4b. IL TETTO SI PUÒ CONTESTARE, e non è cortesia ────────────────────────
// Il numero è scelto e non misurato, e si rivedrà quando qualcuno ne finirà tre
// e ne chiederà un quarto. Se il muro non invita a chiedere, quell'informazione
// non arriva mai e il provvisorio diventa definitivo per silenzio.
ok(p.invito !== undefined, "il tetto pieno offre una strada per contestarlo");
ok(/scrivic|scriv/i.test(p.invito.testo), "l'invito dice di scrivere");
ok(/scelto|abbiamo scelto/i.test(p.invito.testo), "e ammette che il numero l'abbiamo scelto noi");
ok(p.invito.href.startsWith("/"), `porta a un recapito interno reale (${p.invito.href})`);
// Sull'altro muro NON ci va: lì non c'è niente da contestare, c'è un progetto
// da chiudere.
ok(a.invito === undefined, "«ne hai uno attivo» invece non offre di contestare: lì non c'è una decisione nostra da discutere");

// I NUMERI VENGONO DAL DATABASE, non da una costante di qui: se il tetto
// cambiasse in SQL, il testo deve seguirlo da solo.
const diverso = avvisoTetto({ ...PIENO, usate: 5, tetto: 5 });
ok(diverso.titolo.includes("5") && diverso.corpo.includes("5"), "un tetto diverso si riflette nel testo senza toccare questo file");

// ── 5. la lingua non conosce il genere di chi legge ──────────────────────────
console.log("\nLingua invariante:");
for (const [nome, avv] of [["uno attivo", a], ["tetto pieno", p]]) {
  const testi = [avv.titolo, avv.corpo, avv.cta?.testo ?? "", avv.invito?.testo ?? ""].join(" ");
  const accordi = trovaAccordi(testi);
  ok(accordi.length === 0, `«${nome}»: nessuna forma accordata${accordi.length ? ` — ${accordi.map((x) => x.cattura ?? x).join(", ")}` : ""}`);
}

// ── 6. il testo è un VALORE, non tre rami nel JSX ────────────────────────────
console.log("\nDove vive il testo:");
const comp = senzaCommenti(leggi("components/workshop/TettoRaggiunto.tsx"));
ok(/avviso\.titolo/.test(comp) && /avviso\.corpo/.test(comp), "il componente rende l'avviso che riceve");
ok(/avviso\.invito/.test(comp), "…e rende anche l'invito a contestare: un testo che nessuno mostra non esiste");
ok(!/Stai già lavorando|punizione|Hai già fatto|scrivici/.test(comp), "e non ricompone nessuna di quelle frasi al suo interno");

const pagina = senzaCommenti(leggi("app/app/workshop/[slug]/page.tsx"));
ok(/avvisoTetto\(/.test(pagina), "la pagina chiama avvisoTetto invece di riscrivere la regola");
ok(/leggiTettoWorkshop\(/.test(pagina), "e legge il tetto dal database");
ok(/TettoRaggiunto/.test(pagina), "e monta il componente");

// IL TETTO VIENE PRIMA DEL RIPRENDI. Anche riprendere porta un'iscrizione ad
// «attivo», quindi passa dal tetto: mostrare «Riprendi» per poi farlo fallire
// sarebbe un no dato due volte.
const posTetto = pagina.indexOf("TettoRaggiunto avviso");
const posRiprendi = pagina.indexOf("IscrizioneLasciata iscrizioneId");
ok(posTetto > 0 && posRiprendi > 0 && posTetto < posRiprendi, "l'avviso del tetto sta PRIMA del bottone «Riprendi»");
ok(/!avviso/.test(pagina), "e la scelta del ruolo è condizionata all'assenza dell'avviso");

// ── 7. i motivi che la funzione SQL sa nominare arrivano a chi legge ─────────
// La pagina li intercetta prima, ma una corsa (due schede) li fa arrivare al
// client: per nessuno dei due «Riprova» sarebbe un consiglio vero.
console.log("\nI motivi del database, tradotti:");
const lasciata = senzaCommenti(leggi("components/workshop/IscrizioneLasciata.tsx"));
for (const motivo of ["workshop_gia_attivo", "tetto_workshop_raggiunto"]) {
  ok(lasciata.includes(motivo), `«${motivo}» ha un suo messaggio in IscrizioneLasciata`);
}
const ruolo = senzaCommenti(leggi("components/workshop/IscrizioneRuolo.tsx"));
ok(ruolo.includes("42501"), "il rifiuto della policy ha un suo messaggio in IscrizioneRuolo");
// LA FINESTRA È IL RAMO, non un numero di caratteri: alla prima stesura erano
// 400, e ci finiva dentro il ramo generico — dove «Riprova» è giusto. Un
// controllo che grida su codice corretto è un controllo che qualcuno disattiva.
const da42501 = ruolo.slice(ruolo.indexOf("42501"));
const ramo42501 = da42501.slice(0, da42501.indexOf("} else"));
ok(ramo42501.length > 0 && ramo42501.includes("setErrore"), "il ramo del 42501 si legge (se questo cade, la finestra è tarata male, non il codice)");
ok(!/Riprova/.test(ramo42501), "e quel messaggio non dice «Riprova»: riprovare non cambierebbe niente");

// ── 8. il numero non è copiato in TypeScript ─────────────────────────────────
// Il tetto è 3 in un posto solo (`tetto_iscrizioni_workshop()` in SQL). Un 3
// scritto qui direbbe allo studente un tetto e il database gliene applicherebbe
// un altro il giorno che cambia.
console.log("\nIl numero:");
// LA PRIMA STESURA CERCAVA `= 3` ED ERA MUTA: la sabotatura scrive `tetto: 3,`,
// che in un oggetto letterale usa i due punti. Un controllo lessicale tarato su
// una forma sola è cieco su tutte le altre — quindi qui si guardano tutte e due
// le forme, E si prova la cosa vera un pezzo più sotto (il valore letto dal
// database arriva fino in fondo).
const libTetto = senzaCommenti(leggi("lib/workshop/tetto.ts"));
ok(/tetto:\s*Number\(r\.tetto\)/.test(libTetto), "il tetto si legge da `r.tetto`");
ok(!/\btetto\s*[:=]\s*\d/.test(libTetto), "e non è scritto come numero da nessuna parte nel lato TypeScript");

// ── 9. il dato: `puo` si legge, non si ricalcola ─────────────────────────────
console.log("\nLa lettura:");
let chiamata = null;
const finto = {
  rpc: (nome) => {
    chiamata = nome;
    // `tetto: 7`, non 3, DI PROPOSITO: è la prova che il numero attraversa
    // davvero la lettura invece di essere riscritto qui. Con un 3 la guardia
    // sarebbe passata anche su `tetto: 3` cablato a mano — il caso che la
    // controprova F ha trovato muto.
    return Promise.resolve({
      data: [{ usate: 2, tetto: 7, puo: false, esente: false, attivo_slug: "s", attivo_titolo: "T", attivo_ruolo: "R" }],
      error: null,
    });
  },
};
leggiTettoWorkshop(finto).then((st) => {
  ok(chiamata === "stato_tetto_workshop", "chiama la funzione SQL, una volta");
  ok(st.puo === false && st.usate === 2 && st.attivoSlug === "s", "e riporta quello che il database ha detto");
  ok(st.tetto === 7, "il tetto attraversa la lettura: 7 dal database resta 7, non diventa 3");

  const rotto = { rpc: () => Promise.resolve({ data: null, error: { message: "giù" } }) };
  return leggiTettoWorkshop(rotto);
}).then((st) => {
  ok(st === null, "una lettura fallita vale null, non un tetto inventato");

  console.log(falliti === 0 ? "\n✓ Il tetto dice quale muro è, e dove si va.\n" : `\n✗ ${falliti} problemi.\n`);
  process.exit(falliti === 0 ? 0 : 1);
});
