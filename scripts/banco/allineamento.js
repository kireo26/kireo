// La produzione sta servendo il commit che ho qui? — la guardia che `npm run
// banco robot` esegue prima di spendere.
//
// IL DIFETTO CHE QUESTO FILE ESISTE PER CHIUDERE, ed è il quarto episodio della
// stessa giornata: si corregge qualcosa, si lancia la passata senza aspettare
// che il deploy finisca, e il robot gioca contro il codice di PRIMA. Il
// rapporto però porta il commit LOCALE, quindi dice che la passata ha girato su
// una cosa che in aria non c'era — e il numero che ne esce si legge come un
// risultato. È peggio di una passata persa: è una passata che mente.
//
// Il banco aveva già tutti e due i dati e non li confrontava mai: il commit
// locale finisce nel rapporto (robot/index.js), e lo stato dei deploy lo sa
// `banco deploy`. Qui si incontrano.
//
// Puro, senza rete: la lista dei deploy arriva da chi chiama. Così si può
// provare (npm run test:banco) senza un token Vercel.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { durata } = require("./finestre");

// Gli stati in cui un deploy sta ancora nascendo. Non è la negazione di READY:
// ERROR e CANCELED non sono in volo, sono finiti male, e non devono bloccare
// niente — chi ha appena visto fallire un deploy può benissimo voler rigiocare
// sul precedente, che sta ancora servendo.
const IN_VOLO = new Set(["BUILDING", "QUEUED", "INITIALIZING"]);

const statoDi = (d) => d.readyState ?? d.state ?? "";
const servito = (d) => statoDi(d) === "READY";
const nascita = (d) => d.createdAt ?? d.ready ?? 0;

// Da quale commit è nato un deploy. Il nome del campo dipende da dove sta il
// repository, e nessuno dei tre è garantito: un progetto non collegato a git
// non ne porta nessuno, e allora la guardia dice che non può verificare invece
// di dedurre.
function shaDi(d) {
  return d?.meta?.githubCommitSha ?? d?.meta?.gitlabCommitSha ?? d?.meta?.bitbucketCommitSha ?? d?.gitSource?.sha ?? null;
}

function messaggioDi(d) {
  return d?.meta?.githubCommitMessage ?? d?.meta?.gitlabCommitMessage ?? d?.meta?.bitbucketCommitMessage ?? null;
}

// Due sha sono lo stesso commit anche se uno dei due è abbreviato: l'API a
// volte accorcia, git no. Il confronto si fa sul più corto dei due, mai
// pretendendo che siano lunghi uguali.
function stessoCommit(a, b) {
  if (!a || !b) return false;
  const x = String(a).toLowerCase();
  const y = String(b).toLowerCase();
  const corto = Math.min(x.length, y.length);
  return corto >= 7 && x.slice(0, corto) === y.slice(0, corto);
}

const breve = (sha) => (sha ? String(sha).slice(0, 10) : "—");

// Restituisce { esito, righe }. Gli esiti sono quattro, e chi chiama li tratta
// in due modi soltanto:
//   · "in-volo" e "disallineato" fermano la passata;
//   · "incerto" e "allineato" la lasciano passare — il primo dicendo che non
//     ha potuto verificare, che è diverso dal tacere.
//
// «incerto» NON blocca di proposito: un progetto senza git collegato, un token
// senza permessi o Vercel irraggiungibile renderebbero il robot inutilizzabile
// per un difetto che non è del prodotto. Su questo comando c'è già una conferma
// umana, e il posto giusto per un dubbio è davanti agli occhi di chi conferma.
function allineamento({ locale, deploys, perche = null }) {
  if (!Array.isArray(deploys)) {
    return {
      esito: "incerto",
      righe: [
        `⚠  Non posso verificare che la produzione stia servendo questo commit.`,
        `   ${perche ?? "lo stato dei deploy non è leggibile"}`,
        `   La passata parte lo stesso, ma se il rapporto dirà un commit diverso da quello`,
        `   che il sito sta eseguendo, i numeri non valgono.`,
      ],
    };
  }

  const serviente = deploys.filter(servito).sort((a, b) => nascita(b) - nascita(a))[0] ?? null;

  // Un deploy in costruzione PIÙ RECENTE di quello che serve: il sito sta per
  // cambiare sotto i piedi della passata. Uno in volo più vecchio di quello che
  // serve è invece un residuo, e bloccare su quello sarebbe gridare su una cosa
  // giusta — il modo migliore per far disattivare una guardia.
  const inVolo = deploys.filter((d) => IN_VOLO.has(statoDi(d)) && (!serviente || nascita(d) > nascita(serviente)));
  if (inVolo.length > 0) {
    const d = inVolo.sort((a, b) => nascita(b) - nascita(a))[0];
    return {
      esito: "in-volo",
      righe: [
        `✗ UN DEPLOY È IN CORSO (${statoDi(d)}, nato ${durata(Date.now() - nascita(d))} fa).`,
        `  Vercel spegne le vecchie funzioni mentre accende le nuove: una richiesta in volo`,
        `  non trova più nessuno, e il robot cade su un 500 che non è un difetto del prodotto.`,
        `  Aspetta con:  npm run banco deploy`,
      ],
    };
  }

  if (!serviente) {
    return {
      esito: "incerto",
      righe: [
        `⚠  Nessun deploy di produzione risulta aver servito: non posso dire cosa c'è in aria.`,
        `   Guarda con:  npm run banco deploy`,
      ],
    };
  }

  const shaProd = shaDi(serviente);
  if (!shaProd) {
    return {
      esito: "incerto",
      righe: [
        `⚠  Il deploy in produzione (${serviente.uid}) non porta il commit da cui è nato,`,
        `   quindi non posso confrontarlo con questo. Succede quando il progetto non è`,
        `   collegato a un repository git.`,
      ],
    };
  }

  if (!locale?.sha) {
    return {
      esito: "incerto",
      righe: [
        `⚠  git non risponde qui, quindi non so su quale commit sto.`,
        `   In produzione c'è ${breve(shaProd)}.`,
      ],
    };
  }

  if (!stessoCommit(locale.sha, shaProd)) {
    const titoloProd = messaggioDi(serviente);
    return {
      esito: "disallineato",
      righe: [
        `✗ LA PRODUZIONE NON STA SERVENDO QUESTO COMMIT.`,
        `    qui:         ${breve(locale.sha)}  ${locale.titolo ?? ""}`,
        `    in aria:     ${breve(shaProd)}  ${titoloProd ? titoloProd.split("\n")[0] : ""}`,
        `                 (${serviente.uid}, pronto ${durata(Date.now() - nascita(serviente))} fa)`,
        ``,
        `  Il robot gioca contro il sito, non contro questa cartella: partirebbe adesso`,
        `  provando il codice in aria, e il rapporto scriverebbe il commit di qui. Un numero`,
        `  attribuito al commit sbagliato è peggio di nessun numero.`,
        `  Se le modifiche sono qui:  committa, spingi, poi  npm run banco deploy`,
        `  Se è la produzione a essere avanti:  allinea questa cartella e rilancia.`,
      ],
    };
  }

  const righe = [`✓ la produzione sta servendo questo commit (${breve(shaProd)})`];
  if (locale.sporco) {
    // NON blocca: un albero sporco può essere solo uno script o un appunto, e
    // una guardia che ferma una passata da quattro dollari per un file
    // gitignorato verrebbe disattivata il giorno dopo. Ma va detto, perché la
    // differenza è invisibile: le modifiche non committate NON sono sotto prova.
    righe.push(`⚠  ma qui ci sono modifiche non committate: quelle in aria non ci sono,`);
    righe.push(`   quindi la passata non le prova. Se sono il motivo per cui la lanci, fermati.`);
  }
  return { esito: "allineato", righe };
}

module.exports = { allineamento, stessoCommit, shaDi };
