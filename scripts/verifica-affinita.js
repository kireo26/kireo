// Il blocco «Sei a metà strada» non può raccontare una missione che non c'è.
//
// PERCHÉ ESISTE. Fino al 20/09 quel blocco aveva un testo solo, e dava per
// scontato che l'unica attività fosse una MISSIONE: «Nella missione che hai
// fatto qualcosa si è già acceso», bottone «Fai un'altra missione». Da quando
// il cancello pretende i tre test prima delle missioni, ogni studente
// attraversa per forza lo stato «test fatti, zero missioni» — quindi quella
// frase non è un caso limite: è quello che legge CHIUNQUE, la prima volta che
// apre la home dopo i test, a proposito di una partita mai giocata.
//
// DUE PEZZI, e servono tutti e due. Il dato — `caricaAffinitaHome` deve dire da
// dove viene il segnale — e il testo, che deve cambiare di conseguenza. Il
// primo si prova con un client finto (nessuna rete: si contano le chiamate e si
// risponde); il secondo è una funzione pura, quindi si legge.
//
// E LA DIREZIONE DELL'ERRORE È DICHIARATA: quando la lettura fallisce il campo
// vale `null`, e il testo di `null` non nomina né i test né una missione. Un
// testo che indovina è peggio di un testo generico, perché quando sbaglia
// afferma una cosa su quello che lo studente ha fatto.
//
// Esecuzione: `npm run test:affinita`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
// I controlli lessicali girano sul sorgente SENZA COMMENTI: il 27/09 uno di loro
// trovava `cache(` dentro il commento che spiegava perché la cache ci doveva
// stare, e restava verde togliendola.
const { senzaCommenti } = require("./lib/senza-commenti");

abilitaTypeScript();

const { caricaAffinitaHome } = require("@/lib/percorso/stato");
const { copiaUnicaAttivita } = require("@/lib/percorso/testoAffinita");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

let falliti = 0;
function ok(cond, testo) {
  console.log(`  ${cond ? "✓" : "✗"} ${testo}`);
  if (!cond) falliti++;
}

console.log("\n═══ IL BLOCCO «SEI A METÀ STRADA» ═══\n");

// ── Un client finto, il minimo che serve ─────────────────────────────────────
// `caricaAffinitaHome` costruisce query e le aspetta: basta un oggetto
// concatenabile che alla fine sia «thenable». Le chiamate si registrano, così
// si può rispondere in base alla tabella e ai filtri invece che all'ordine —
// l'ordine è un dettaglio di implementazione, i filtri sono la domanda.
function clienteFinto(rispondi) {
  return {
    from(tabella) {
      const q = { tabella, filtri: {}, opzioni: null };
      const catena = {
        select(_colonne, opzioni) {
          q.opzioni = opzioni ?? null;
          return catena;
        },
        eq(colonna, valore) {
          q.filtri[colonna] = valore;
          return catena;
        },
        in(colonna, valori) {
          q.filtri[colonna] = valori;
          return catena;
        },
        then(risolvi, rifiuta) {
          return Promise.resolve(rispondi(q)).then(risolvi, rifiuta);
        },
      };
      return catena;
    },
  };
}

// Una riga di area_signal che NON passa la barra (1 attività sola): è
// esattamente lo stato in cui il blocco si accende.
const RIGA_SFIORATA = {
  area_slug: "salute-professioni-sanitarie",
  interest_score: 40,
  confidence: 0.35,
  status: "emergente",
  attivita_distinte: 1,
};

function finto({ missione = 0, test = 0, conteggiRotti = false }) {
  return clienteFinto((q) => {
    if (q.tabella === "area_signal") return { data: [RIGA_SFIORATA], error: null };
    if (q.tabella === "evidence" && q.opzioni && q.opzioni.head) {
      if (conteggiRotti) return { count: null, error: { message: "boom" } };
      return { count: q.filtri.fonte === "mission" ? missione : test, error: null };
    }
    // le motivazioni delle sfiorate
    return { data: [{ area_slug: RIGA_SFIORATA.area_slug, motivazione: "hai messo il minore per primo", peso: 1 }], error: null };
  });
}

// ── 1) Il dato: da dove viene il segnale ─────────────────────────────────────
console.log("1) caricaAffinitaHome dice quale attività ha acceso il segnale");

async function prove() {
  const soloTest = await caricaAffinitaHome(finto({ test: 12 }), "s1");
  ok(soloTest.origine === "test", "solo prove dai test → origine «test»");
  ok(soloTest.eleggibili.length === 0 && soloTest.haAttivita === true, "…nello stato giusto: nessuna eleggibile, un segnale c'è");
  ok(soloTest.sfiorate.length === 1, "…e la sfiorata resta, con la sua prova");

  const conMissione = await caricaAffinitaHome(finto({ test: 12, missione: 5 }), "s2");
  ok(conMissione.origine === "missione", "con anche una missione → origine «missione» (un testo che la nomina resta vero)");

  const soloMissione = await caricaAffinitaHome(finto({ missione: 5 }), "s3");
  ok(soloMissione.origine === "missione", "solo prove da una missione → origine «missione»");

  const nessuna = await caricaAffinitaHome(finto({}), "s4");
  ok(nessuna.origine === null, "nessuna delle due fonti → «non lo so», non una delle due a caso");

  const rotto = await caricaAffinitaHome(finto({ test: 12, conteggiRotti: true }), "s5");
  ok(rotto.origine === null, "lettura fallita → «non lo so», anche se i test ci sarebbero");

  const senzaRighe = await caricaAffinitaHome(
    clienteFinto(() => ({ data: [], error: null })),
    "s6",
  );
  ok(senzaRighe.haAttivita === false && senzaRighe.origine === null, "profilo vuoto: il campo c'è e vale null (nessun undefined in giro)");
}

// ── 2) Il testo: quello che lo studente legge ────────────────────────────────
function affermaUnaMissioneGiocata(t) {
  return /(missione|partita)\s+che\s+hai\s+fatto/i.test(t) || /un'altra\s+missione/i.test(t) || /(della|nella)\s+tua\s+prima\s+missione/i.test(t);
}
function nominaITest(t) {
  return /\btest\b/i.test(t);
}

// LE PAROLE DELLA REGOLA VECCHIA, quella a CONTEGGIO (`attivita_distinte >= 2`).
// Dal 27/09 la barra è `confidence >= 0,40`: un'affinità non chiede una SECONDA
// attività, chiede che quello che si è fatto PESI. «Fanne un'altra e cominciamo
// a metterle in fila» era sopravvissuto alla riscrittura della clausola che lo
// giustificava, tre righe più su — un consiglio orfano non si vede rileggendo la
// frase appena corretta, perché quella è giusta.
//
// SI CERCA NEL CORPO E NEL SOTTOTITOLO, MAI NELLA `cta`: «Fai un'altra missione»
// è un bottone, e farne un'altra resta la strada giusta per accendere un segnale
// che pesa. Un controllo che gridasse anche lì è un controllo che qualcuno
// disattiva. Limite dichiarato: «un'altra» è una parola comune, quindi un testo
// futuro legittimo potrebbe inciamparci — il divieto è tarato sul difetto vero,
// non su una famiglia di frasi.
const REGOLA_A_CONTEGGIO = [
  /in\s+fila/i,
  /un'altra\b/i,
  /due\s+attivit/i,
  /seconda\s+attivit/i,
  /\baltra\s+volta\b/i,
];
function consigliaIlConteggio(t) {
  return REGOLA_A_CONTEGGIO.filter((re) => re.test(t)).map((re) => String(re));
}

function proveTesto() {
  console.log("\n2) Il testo cambia con l'origine, e non afferma cose non fatte");

  const t = copiaUnicaAttivita("test");
  const m = copiaUnicaAttivita("missione");
  const n = copiaUnicaAttivita(null);

  ok(!affermaUnaMissioneGiocata(t.corpo + t.sfiorateSottotitolo), "con i soli test, nessuna frase dice che una missione è stata giocata");
  ok(nominaITest(t.corpo), "…e il testo parla dei test, che è quello che ha fatto davvero");
  ok(t.cta === "Fai una missione", "…il bottone dice «Fai una missione»: la prima, non un'altra");

  ok(affermaUnaMissioneGiocata(m.corpo), "con una missione, il testo la nomina (invariato)");
  ok(/un'altra missione/i.test(m.cta), "…e il bottone ne chiede un'altra");

  ok(!affermaUnaMissioneGiocata(n.corpo + n.sfiorateSottotitolo), "quando non lo sappiamo, nessuna missione viene affermata");
  ok(!nominaITest(n.corpo + n.sfiorateSottotitolo), "…e nemmeno i test: si parla del segnale, mai di come è nato");
  ok(n.cta.length > 0 && !/un'altra/i.test(n.cta), "…e il bottone non dà per scontato che ce ne sia già stata una");

  for (const [nome, c] of [["test", t], ["missione", m], ["null", n]]) {
    const conteggio = consigliaIlConteggio(c.corpo + " " + c.sfiorateSottotitolo);
    ok(
      conteggio.length === 0,
      `«${nome}»: il corpo non manda a fare una SECONDA attività — la barra guarda quanto pesa` +
        (conteggio.length ? ` (trovato: ${conteggio.join(", ")})` : ""),
    );
    // La metà positiva: non basta che il consiglio a conteggio sia sparito, il
    // corpo deve dire cosa il segnale guarda DAVVERO. Ancorata al PESO e non a
    // «abbastanza forte»: quella frase c'è in tutti e tre da prima della
    // riscrittura, quindi un assert su di lei sarebbe verde qualunque cosa si
    // togliesse — la regola delle due metà, vista dal lato di ciò che decide.
    ok(/\bpes(a|i|ano)\b/i.test(c.corpo), `«${nome}»: …e dice che il segnale cresce col PESO di quello che si fa`);

    const campi = [c.titolo, c.corpo, c.cta, c.sfiorateTitolo, c.sfiorateSottotitolo];
    ok(campi.every((s) => typeof s === "string" && s.trim().length > 0), `«${nome}»: nessun campo vuoto`);
    const accordi = campi.flatMap((s) => trovaAccordi(s));
    ok(accordi.length === 0, `«${nome}»: lingua invariante${accordi.length ? ` — ${accordi.join(", ")}` : ""}`);
  }
}

// ── 3) Il collegamento, sul sorgente ─────────────────────────────────────────
// Un testo giusto in un file che nessuno rende non serve a niente: è il difetto
// del parametro con il default, visto abbastanza volte da meritarsi una riga.
function proveCollegamento() {
  console.log("\n3) Il componente usa questo testo, e non ne tiene una copia");
  const src = fs.readFileSync(path.join(ROOT, "components/app/SezioneAffinita.tsx"), "utf8");
  ok(/copiaUnicaAttivita\(origine\)/.test(src), "SezioneAffinita chiede il testo a copiaUnicaAttivita, passandogli l'origine");
  ok(!/Fai un'altra missione/.test(src), "…e la vecchia stringa del bottone non è più nel componente");
  ok(!/Nella missione che hai fatto/.test(src), "…né quella del corpo");

  const stato = fs.readFileSync(path.join(ROOT, "lib/percorso/stato.ts"), "utf8");
  ok(/origine: OrigineSegnale/.test(stato), "AffinitaHome porta l'origine");
  ok(/origineSegnale\(supabase, studentId\)/.test(stato), "…e caricaAffinitaHome la riempie davvero");
}

// ── 4) LA BARRA: confidence, non il conteggio delle attività ─────────────────
// Dal 27/09 un'area entra in classifica se `confidence >= 0,40`, non se ha ≥2
// attività distinte. La misura che l'ha deciso sta in CLAUDE.md; qui si tengono
// ferme le proprietà, perché una regola scritta in un commento è un'intenzione.
//
// L'INVARIANTE CHE TIENE TUTTO: `attivita_distinte` non compare in NESSUNA
// condizione di visibilità. È la cosa che si rompe per prima se qualcuno rimette
// la vecchia barra «per sicurezza» accanto a quella nuova — due definizioni della
// stessa cosa, che è il modo in cui divergono.
function riga(area, { conf, interest = 40, status = "emergente" }) {
  return { area_slug: area, interest_score: interest, confidence: conf, status, attivita_distinte: 1 };
}
function conRighe(righe) {
  return clienteFinto((q) => {
    if (q.tabella === "area_signal") return { data: righe, error: null };
    if (q.tabella === "evidence" && q.opzioni && q.opzioni.head) return { count: 1, error: null };
    return { data: [], error: null };
  });
}

async function proveBarra() {
  console.log("\n4) La barra guarda confidence, e attivita_distinte non entra più in nessuna condizione");

  const { SOGLIA_AFFINITA, eleggibilePerAffinita } = require("@/lib/percorso/stato");
  ok(SOGLIA_AFFINITA === 0.4, `la soglia è 0,40 (letta: ${SOGLIA_AFFINITA})`);

  // il predicato, sui casi al bordo
  ok(eleggibilePerAffinita({ confidence: 0.4, interest_score: 10 }), "esattamente 0,40 entra (la soglia è inclusiva)");
  ok(!eleggibilePerAffinita({ confidence: 0.39, interest_score: 90 }), "0,39 no, nemmeno con un interesse altissimo");
  ok(eleggibilePerAffinita({ confidence: "0.85", interest_score: 10 }), "una confidence che arriva come STRINGA (numeric di Postgres) viene letta come numero");
  ok(!eleggibilePerAffinita({ confidence: null, interest_score: 10 }), "confidence assente → fuori: fallisce chiuso, non aperto");
  ok(!eleggibilePerAffinita({ confidence: 1, interest_score: null }), "senza interesse resta fuori anche con confidence 1,000: l'affinità È l'interesse");

  // il caso reale che ha deciso il cambio, con i numeri del profilo misurato
  const profiloVero = conRighe([
    riga("edilizia-architettura", { conf: 1.0, interest: 62 }),
    riga("giurisprudenza-pa", { conf: 0.81, interest: 66 }),
    riga("meccanica-meccatronica", { conf: 0.8, interest: 64 }),
    riga("salute-professioni-sanitarie", { conf: 1.0, interest: 71, status: "confermata" }),
    riga("informatica-digitale", { conf: 0.335, interest: 71 }),
    riga("comunicazione-media", { conf: 0.12, interest: 71 }),
    riga("lingue-relazioni-internazionali", { conf: 0.15, interest: 59 }),
  ]);
  const vero = await caricaAffinitaHome(profiloVero, "s-vero");
  const dentro = vero.eleggibili.map((a) => a.slug);
  ok(dentro.length === 4, `il profilo misurato dà 4 aree in classifica (${dentro.length})`);
  ok(dentro[0] === "salute-professioni-sanitarie", "…prima salute (71)");
  ok(dentro.includes("edilizia-architettura"), "…e edilizia ENTRA: confidence 1,000, diciassette prove, prima era fuori");
  ok(!dentro.includes("comunicazione-media"), "…mentre comunicazione (0,120) esce: era dentro con la barra vecchia");
  ok(!dentro.includes("lingue-relazioni-internazionali"), "…e lingue (0,150) pure");

  // il tetto: una rete, non una forma
  const dieci = conRighe(Array.from({ length: 10 }, (_, i) => riga(["informatica-digitale","salute-professioni-sanitarie","ristorazione-turismo","meccanica-meccatronica","agrifood-ambiente","arte-design-moda","musica-spettacolo","energia-sostenibilita","edilizia-architettura","economia-management"][i], { conf: 0.9, interest: 90 - i })));
  const molte = await caricaAffinitaHome(dieci, "s-dieci");
  ok(molte.eleggibili.length === 10, `il DATO non taglia: dieci eleggibili restano dieci (${molte.eleggibili.length})`);

  const src = fs.readFileSync(path.join(ROOT, "components/app/SezioneAffinita.tsx"), "utf8");
  ok(/MAX_BARRE_AFFINITA\s*=\s*5/.test(src), "il tetto è 5, e vive nel componente (è una questione di schermo, non di dato)");
  ok(/const mostrate = eleggibili\.slice\(0, MAX_BARRE_AFFINITA\)/.test(src), "…applicato una volta sola, in una lista sola");
  ok(/const contrastanti = mostrate\./.test(src), "…e la nota sui segnali contrastanti nomina le aree MOSTRATE, non quelle tagliate");
  ok(/\{mostrate\.map\(/.test(src), "…ed è `mostrate` che viene reso, non `eleggibili`");
  ok(!/MAX_BARRE_AFFINITA\s*=\s*TOP_N_AFFINITA/.test(src), "il tetto NON è TOP_N_AFFINITA: due domande diverse nello stesso numero divergono");

  // L'INVARIANTE
  const stato = senzaCommenti(fs.readFileSync(path.join(ROOT, "lib/percorso/stato.ts"), "utf8"));
  ok(!/attivita_distinte/.test(stato), "`attivita_distinte` non compare in nessuna condizione di visibilità (fuori dai commenti)");
  ok(!/eleggibile\(/.test(stato), "…e non è rimasta una seconda copia della regola: un solo predicato, `eleggibilePerAffinita`");
  const quante = (stato.match(/eleggibilePerAffinita\(/g) ?? []).length;
  ok(quante >= 3, `…chiamato da tutti i posti che decidono la visibilità (${quante} chiamate: la definizione più i due lettori)`);
}

// ── 5) Controprove ───────────────────────────────────────────────────────────
function controprove() {
  console.log("\n5) Controprove: il controllo si accorge davvero");
  ok(affermaUnaMissioneGiocata("Nella missione che hai fatto qualcosa si è già acceso"), "il vecchio testo, dato all'origine «test», verrebbe segnalato");
  ok(affermaUnaMissioneGiocata("Sono le piste della tua prima missione: la prossima attività dirà quali reggono."), "…e anche il vecchio sottotitolo delle sfiorate");
  ok(!affermaUnaMissioneGiocata("La prima missione è quella situazione."), "…mentre una missione al FUTURO non è un'affermazione su cosa ha fatto");
}

(async () => {
  await prove();
  proveTesto();
  proveCollegamento();
  await proveBarra();
  controprove();

  console.log("\n═══════════════════════════════════════════\n");
  if (falliti) {
    console.error(
      `✗ ${falliti} controlli falliti.\n` +
        "  Questo blocco è il primo che uno studente legge dopo i tre test, e dal\n" +
        "  cancello in poi nessuno può saltarlo: se torna a nominare una missione,\n" +
        "  lo dice a chi non ne ha mai giocata una.\n",
    );
    process.exit(1);
  }
  console.log("✓ Il blocco nomina solo quello che lo studente ha davvero fatto.\n");
})();
