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

// ── 4) Controprove ───────────────────────────────────────────────────────────
function controprove() {
  console.log("\n4) Controprove: il controllo si accorge davvero");
  ok(affermaUnaMissioneGiocata("Nella missione che hai fatto qualcosa si è già acceso"), "il vecchio testo, dato all'origine «test», verrebbe segnalato");
  ok(affermaUnaMissioneGiocata("Sono le piste della tua prima missione: la prossima attività dirà quali reggono."), "…e anche il vecchio sottotitolo delle sfiorate");
  ok(!affermaUnaMissioneGiocata("La prima missione è quella situazione."), "…mentre una missione al FUTURO non è un'affermazione su cosa ha fatto");
}

(async () => {
  await prove();
  proveTesto();
  proveCollegamento();
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
