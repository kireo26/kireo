// Chi scrive senza passare dalla RLS: la guardia deve scattare, e la porta deve essere chiusa.
//
// Questo file sorveglia una CLASSE: le funzioni SECURITY DEFINER che scrivono.
// Girano come proprietario, quindi la RLS non fa da rete, e due cose separate
// le tengono al riparo — la guardia dentro (chi sta chiamando?) e il permesso
// fuori (chi può chiamare?). Erano due controlli in due momenti; da qui stanno
// insieme, perché sono due metà della stessa domanda.
//
// ── 1 · LA GUARDIA CHE CON NULL NON SCATTA ──────────────────────────────────
// `X <> NULL` non è falso: è NULL, e un `if` su NULL non esegue il ramo. Quindi
// `if mio <> tuo then raise 'non_autorizzato'` **lascia passare esattamente chi
// non ha un'identità** — l'anonimo, o l'utente che non è della categoria che
// quella funzione si aspetta. È il caso che la riga doveva fermare.
//
// È la specie più ricorrente di questo progetto: CLAUDE.md la racconta almeno
// sei volte (`verifica_studente` e le altre dell'area scuola, luglio;
// `approva_richiesta_upgrade`; `blocca_autoescalation_istituzione`;
// `blocca_autoflag_di_prova`). Ogni volta è stata trovata leggendo, e ogni
// volta è ricomparsa da un'altra parte qualche settimana dopo — perché la
// forma sbagliata è quella che viene in mente per prima. LA CURA è sempre
// `is distinct from`, e il messaggio la dice: un test che segnala senza dire
// cosa scrivere fa perdere il tempo che voleva far risparmiare.
//
// ── 2 · LA PORTA APERTA AD ANON ─────────────────────────────────────────────
// Su Supabase una funzione nuova nasce eseguibile da PUBLIC, `anon` e
// `authenticated`: «non l'ho concessa a nessuno» non è mai una frase vera qui
// dentro. Finché una riga non dice il contrario, una definer che scrive è
// chiamabile **anche da chi non è collegato**.
//
// Oggi nessuna di queste è un buco vivo: tutte hanno una guardia che con un
// `auth.uid()` NULL fallisce chiuso (ed è il punto 1 a pretenderlo). Il motivo
// della regola non è il rischio di oggi — è che **la classe non aveva una
// regola leggibile**, e quando una classe non ha una regola la decisione la
// prende ogni volta l'ultimo che passa: su alcune il `revoke` c'è, su altre no,
// e la prossima persona deve indovinare se è una dimenticanza o una scelta.
//
// LA CONDIZIONE, che è nel messaggio e non solo qui: la riga che chiude è
// `from public, anon`, e togliere PUBLIC rompe chiunque passasse SOLO da lì.
// Quindi per ogni funzione si guarda se `authenticated` (o `service_role`) ha
// un grant **esplicito**. Se non ce l'ha, il `revoke` va scritto insieme al
// `grant`, nella stessa migrazione: una funzione che perde l'unica strada che
// aveva non fallisce chiusa, fallisce e basta, su un utente vero.
//
// ── 3 · PERCHÉ IL CONTROLLO DICE QUANTE NE HA SELEZIONATE ───────────────────
// Un controllo ha due metà: **cosa guarda** e **cosa decide**. Le controprove
// che si scrivono esercitano quasi sempre la seconda — «questa forma è fragile,
// quest'altra no» — e non toccano mai la prima. Ma un controllo che non vede
// l'ingresso è verde su tutto, e sembra sano da fuori.
//
// È successo qui, per un mese: il pattern della scrittura pretendeva un confine
// di parola subito dopo UNA lettera, quindi vedeva `update p set …` e NON
// vedeva `update public.tabella set …`, che è la forma che usa tutto il repo.
// **Undici funzioni non venivano guardate**, fra loro `verifica_studente`, cioè
// quella del buco di luglio da cui questo controllo è nato. Non l'ha trovato
// nessuno leggendo il pattern: l'ha trovato un censimento che dava un numero
// impossibile.
//
// Da qui la regola: **ogni controllo che seleziona un insieme dice quanti
// elementi ha selezionato, e quel numero si confronta con un conto fatto in un
// altro modo.** Qui i conti incrociati sono tre, e il secondo e il terzo
// avrebbero preso il punto cieco il giorno in cui è comparso:
//   a. la partizione torna: definer = scrivono + non scrivono;
//   b. i due estrattori — quello dei CORPI (qui sotto) e quello dei PERMESSI
//      (scripts/lib/permessi-funzioni.js) — leggono le migrazioni in due modi
//      indipendenti e devono trovare lo stesso insieme di nomi. Restano due
//      apposta: uniformarli farebbe sparire il confronto;
//   c. il complemento: una funzione classificata «non scrive» che contiene una
//      parola di scrittura fuori dai commenti è un candidato punto cieco.
//
// Esecuzione: `npm run test:guardie`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const {
  applica,
  leggiMigrazioni,
  PREDEFINITI,
  chiusoAdAnon,
  taraModello,
  PROVE_TOTALI,
} = require("./lib/permessi-funzioni");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "supabase", "migrations");

let falliti = 0;
const ok = (cond, msg) => {
  if (!cond) {
    console.error("  ✗ " + msg);
    falliti++;
  } else {
    console.log("  ✓ " + msg);
  }
};

// Gli helper di identità che restituiscono NULL quando chi chiama non è della
// categoria attesa. Chi NON sta qui è perché non può tornare NULL:
// `current_ha_permesso_staff` avvolge il risultato in un `coalesce(…, false)`
// proprio per non cadere qui, ed è documentato in migrazione — includerlo
// produrrebbe un rosso su una funzione scritta bene.
const NULLABILI =
  /(auth\.uid|current_ruolo|current_istituzione_id|current_scuola_id|current_ruolo_staff|current_school_code)\s*\(\)/;

// Un confronto che con NULL non scatta.
const FRAGILE =
  /(<>|!=)\s*(public\.)?(auth\.uid|current_\w+)\s*\(\)|(public\.)?(auth\.uid|current_\w+)\s*\(\)\s*(<>|!=)|\bnot\s+in\s*\(/i;

// Righe note e lette, che restano per una ragione scritta.
const ESENTI = [
  {
    funzione: "peers_workshop",
    contiene: "wi.student_id <> auth.uid()",
    perche:
      "non è una guardia: è il filtro «non mostrare me stesso» dentro una WHERE. " +
      "Con auth.uid() NULL la condizione vale NULL e la riga viene ESCLUSA — fallisce " +
      "chiuso, cioè nella direzione giusta. L'autorizzazione vera di quella funzione è " +
      "un EXISTS separato sulla propria iscrizione.",
  },
];

// ── estrazione dei corpi ────────────────────────────────────────────────────
// L'ULTIMA definizione di un nome è quella viva: i file si leggono in ordine e
// una `create or replace` successiva sostituisce la precedente. Guardare una
// definizione vecchia vorrebbe dire dare rosso su un difetto già riparato.
//
// Questo estrattore è DIVERSO da quello dei permessi (àncora sul corpo
// `$tag$…$tag$`, ammette il nome senza `public.` davanti) e resta diverso
// apposta: il confronto (b) più sotto vale solo se le due letture sono
// indipendenti.
//
// La testa (i parametri, e quello che sta fra `returns` e il corpo) non
// contiene mai un `;` (29/10): senza
// questo limite un `create function` scritto DENTRO una stringa (una funzione
// creata con `execute format`, come `inizio_conteggio_uscite_newsletter`) si
// prendeva per corpo tutto fino al `$$` della definizione dopo, che diventava
// invisibile. L'ha detto il confronto (b) qui sotto: 157 contro 158.
const fn = new Map();
for (const nome of fs.readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort()) {
  const sql = fs.readFileSync(path.join(DIR, nome), "utf8");
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\([^;]*?\)\s*returns([^;]*?)\$(\w*)\$([\s\S]*?)\$\3\$/gi;
  let m;
  while ((m = re.exec(sql))) {
    fn.set(m[1], { nome: m[1], file: nome, testa: m[2], corpo: m[4] });
  }
  // La seconda forma: una funzione creata con `execute format`, per scriverci
  // dentro la data in cui la migrazione gira (`inizio_conteggio_*`). Il corpo
  // è l'argomento del `format` interno.
  const dinamica = /execute\s+format\(\s*'create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\([^;']*?\)\s*returns([^;']*?)as\s+%L'\s*,\s*([^;]*?)\)\s*;/gi;
  while ((m = dinamica.exec(sql))) {
    fn.set(m[1], { nome: m[1], file: nome, testa: m[2], corpo: m[3] });
  }
}

const permesso = applica(leggiMigrazioni(DIR));

console.log("\n═══ Chi scrive fuori dalla RLS: guardia che scatta, porta chiusa ═══\n");

// ── i conti, e i tre riscontri incrociati ───────────────────────────────────
// LA GUARDIA DELL'ESTRATTORE. Se smettesse di riconoscere la forma di una
// definizione, questo file passerebbe verde senza aver guardato niente — che è
// il modo peggiore di fallire, perché somiglia a un successo.
ok(fn.size >= 80, `l'estrattore dei corpi legge ${fn.size} funzioni dalle migrazioni`);

// CHE COSA CONTA COME SCRITTURA (il pattern del punto cieco, vedi §3 in testa).
// L'alias dopo la tabella (`update public.t c set`) è entrato il 30/10: la
// prima funzione che lo usava (`newsletter_da_inviare`) risultava «non scrive»,
// e l'ha presa il complemento (c), come doveva.
const SCRIVE = /\binsert\s+into\b|\bdelete\s+from\b|\bupdate\s+(?:only\s+)?[\w."]+(?:\s+(?:as\s+)?(?!set\b)\w+)?\s+set\b/i;
// Una parola di scrittura qualunque: troppo larga per decidere, buona per
// sospettare. Serve solo al riscontro (c).
const PAROLA_LARGA = /\b(insert|update|delete)\b/i;
// Una copia locale di questo helper c'era, e ora si importa: due copie dello
// stesso spogliatore divergono, e quella che diverge è quella che nessuno
// rilegge. `senzaCommentiSql` fa la stessa cosa e ha la sua ragione scritta
// accanto.
const { senzaCommentiSql: senzaCommenti } = require("./lib/senza-commenti");

const definer = [...fn.values()].filter((f) => /security\s+definer/i.test(f.testa));
// LA CLASSIFICAZIONE GIRA SUL CORPO SPOGLIATO, e non è una rifinitura: una
// funzione il cui unico «insert into» sta in un commento risulterebbe scrivente,
// e da lì le si chiederebbe una guardia che non le serve. Nell'altro verso
// varrebbe lo stesso: un commento che cita un confronto fragile la farebbe
// sospettare per niente. Il riscontro (c) qui sotto spoglia già, quindi prima di
// oggi i due passaggi guardavano due testi diversi.
for (const f of fn.values()) f.corpo = senzaCommenti(f.corpo);
const scrivono = definer.filter((f) => SCRIVE.test(f.corpo));
const nonScrivono = definer.filter((f) => !SCRIVE.test(f.corpo));
const eTrigger = (f) => /\btrigger\b/i.test(f.testa);
// Un trigger non si chiama come RPC: nessun permesso di EXECUTE lo raggiunge,
// quindi il punto 2 non lo riguarda. Si contano e si nominano lo stesso: un
// insieme scartato in silenzio è un insieme che nessuno ricontrolla.
const trigger = scrivono.filter(eTrigger);
const rpc = scrivono.filter((f) => !eTrigger(f));

// (a) la partizione torna.
ok(
  definer.length === scrivono.length + nonScrivono.length,
  `SECURITY DEFINER: ${definer.length} = ${scrivono.length} che scrivono + ${nonScrivono.length} che non scrivono`,
);
console.log(
  `  · di chi scrive, ${trigger.length} sono trigger (non chiamabili come RPC)` +
    (trigger.length ? `: ${trigger.map((f) => f.nome).sort().join(", ")}` : ""),
);
console.log(`  · restano ${rpc.length} funzioni chiamabili come RPC che scrivono fuori dalla RLS`);

// (b) i due estrattori, indipendenti, sullo stesso insieme di nomi.
const soloPermessi = [...permesso.keys()].filter((n) => !fn.has(n));
const soloCorpi = [...fn.keys()].filter((n) => !permesso.has(n));
// Il primi nomi bastano a far capire dove guardare: un messaggio che si scorre
// è un messaggio che nessuno legge.
const primi = (l) => (l.length === 0 ? "—" : l.slice(0, 5).join(", ") + (l.length > 5 ? `, … (${l.length} in tutto)` : ""));
ok(
  soloPermessi.length === 0 && soloCorpi.length === 0,
  soloPermessi.length === 0 && soloCorpi.length === 0
    ? `i due estrattori trovano lo stesso insieme di nomi (${fn.size} = ${permesso.size})`
    : `i due estrattori NON concordano (corpi ${fn.size}, permessi ${permesso.size}):\n` +
      `      viste solo dai permessi: ${primi(soloPermessi)}\n` +
      `      viste solo dai corpi:    ${primi(soloCorpi)}\n` +
      `      → uno dei due ha smesso di vedere una forma di definizione: il numero più basso ha il punto cieco`,
);

// (c) il complemento: un sospetto fra quelle che risultano non scrivere.
// Le esenzioni del complemento, ognuna con la riga che la giustifica e il
// perché. Una funzione esentata qui non è guardata dal punto 1: la ragione
// deve dire perché non ne ha bisogno, non solo che la parola è innocua.
const ESENTI_COMPLEMENTO = [
  {
    funzione: "blocca_autoflag_di_prova",
    contiene: "tg_op = 'INSERT'",
    perche:
      "è un trigger BEFORE: non scrive con un'istruzione, assegna NEW, e la parola è il nome " +
      "dell'operazione (tg_op). La sua guardia è già nella forma sicura: il ramo che lascia " +
      "passare è `auth.uid() is not null and current_ruolo() is distinct from 'admin'` " +
      "negato, e con un auth.uid() NULL vale la connessione privilegiata, come voluto " +
      "(verifica-esente-dai-cancelli.sql 3-5).",
  },
];
const sospette = nonScrivono.filter((f) => {
  const corpo = senzaCommenti(f.corpo);
  if (!PAROLA_LARGA.test(corpo)) return false;
  const e = ESENTI_COMPLEMENTO.find((x) => x.funzione === f.nome);
  if (!e) return true;
  // L'esenzione vale per QUELLA riga: un'altra parola di scrittura nella
  // stessa funzione torna sospetta.
  return corpo.split("\n").some((r) => PAROLA_LARGA.test(r) && !r.includes(e.contiene));
});
for (const e of ESENTI_COMPLEMENTO) {
  if (nonScrivono.some((f) => f.nome === e.funzione)) console.log(`  · esente dal complemento: ${e.funzione} — ${e.perche.split(":")[0]}.`);
}
ok(
  sospette.length === 0,
  sospette.length === 0
    ? `nessuna delle ${nonScrivono.length} «non scrive» contiene una parola di scrittura fuori dai commenti`
    : sospette
        .map(
          (f) =>
            `${f.nome} [${f.file}] risulta «non scrive» ma contiene una parola di scrittura:\n` +
            `      ${(senzaCommenti(f.corpo).split("\n").find((r) => PAROLA_LARGA.test(r)) ?? "").trim().slice(0, 110)}\n` +
            `      → o SCRIVE ha un punto cieco su quella forma, o la funzione va esentata con la ragione scritta`,
        )
        .join("\n    "),
);

// ── 1 · la guardia ──────────────────────────────────────────────────────────
const fragili = [];
for (const f of scrivono) {
  for (const riga of f.corpo.split("\n")) {
    if (!FRAGILE.test(riga) || !NULLABILI.test(riga)) continue;
    const esente = ESENTI.find((e) => e.funzione === f.nome && riga.includes(e.contiene));
    if (esente) continue;
    fragili.push({ nome: f.nome, file: f.file, riga: riga.trim() });
  }
}

ok(
  fragili.length === 0,
  fragili.length === 0
    ? `nessuna delle ${scrivono.length} scrive dietro un confronto che con NULL non scatta`
    : fragili
        .map((g) => `${g.nome} [${g.file}]\n      ${g.riga}\n      → usa «is distinct from»`)
        .join("\n    "),
);

for (const e of ESENTI) {
  if (fn.has(e.funzione)) console.log(`  · esente: ${e.funzione} — ${e.perche.split(".")[0]}.`);
}

// ── 2 · la porta ────────────────────────────────────────────────────────────
const aperte = [];
for (const f of rpc) {
  const p = permesso.get(f.nome) ?? PREDEFINITI();
  if (chiusoAdAnon(p.ruoli)) continue;
  const haGrant = p.espliciti.has("authenticated") || p.espliciti.has("service_role");
  aperte.push({
    nome: f.nome,
    file: p.file,
    firma: p.firma,
    ruoli: [...p.ruoli].sort().join(", "),
    haGrant,
  });
}
aperte.sort((a, b) => (a.nome < b.nome ? -1 : 1));

ok(
  aperte.length === 0,
  aperte.length === 0
    ? `tutte e ${rpc.length} sono chiuse a chi non è collegato (né PUBLIC né anon)`
    : `${aperte.length} su ${rpc.length} restano eseguibili da chi non è nessuno:\n    ` +
      aperte
        .map(
          (a) =>
            `${a.nome} — ruoli: ${a.ruoli} [${a.file}]\n` +
            (a.haGrant
              ? `      → revoke all on function public.${a.nome}(${a.firma}) from public, anon;`
              : `      → ATTENZIONE: nessun grant esplicito ad authenticated/service_role. Il revoke\n` +
                `        va scritto INSIEME al grant, nella stessa migrazione: togliere PUBLIC a una\n` +
                `        funzione che passava solo da lì la rompe su un utente vero.`),
        )
        .join("\n    "),
);

// ── 2bis · le definer che leggono, aperte ad anon ───────────────────────────
// Il punto 2 guarda solo le definer che SCRIVONO. Una definer che legge e
// risponde gira come proprietario anche lei, quindi da aperta ad `anon` dice a
// un visitatore quello che dice al proprietario (04/11: `e_profilo_di_prova`
// diceva a chiunque se un id è un profilo di prova). Qui ogni definer viva
// eseguibile da chi non ha fatto l'accesso o è un trigger (EXECUTE non si
// controlla quando il trigger scatta), o sta in APERTE_AD_ANON con la sua
// ragione. Una nuova nata aperta è rossa; una dichiarata che si chiude è rossa
// finché non si toglie dall'elenco (un elenco che non scende da solo invecchia);
// e quelle «da decidere» hanno un tetto che può solo scendere.
//
// ⚠️ Il modello legge le migrazioni, e una funzione tolta con `drop function`
// non è viva: lo stesso conto sulla replica (has_function_privilege('anon', …))
// il 04/11 dava le stesse 28.
const APERTE_AD_ANON = {
  check_class_code: ["visitatore", "il modulo di registrazione controlla il codice classe prima dell'accesso"],
  verifica_attestato: ["visitatore", "la pagina pubblica di verifica di un attestato"],
  conteggio_follower: ["visitatore", "la pagina pubblica dell'ente mostra quanti la seguono"],
  conteggio_manifestazioni_interesse: ["da_decidere", "la chiamano solo pagine dell'ente, da collegati"],
  conteggio_presenti_live: ["da_decidere", "la chiama solo la console dell'ente, da collegati"],
  current_e_maggiorenne: ["da_decidere", "predicato per le policy di authenticated; nessuna policy di anon la usa"],
  current_ha_permesso_staff: ["da_decidere", "predicato per le policy di authenticated"],
  current_istituzione_id: ["da_decidere", "predicato per le policy di authenticated"],
  current_ruolo: ["da_decidere", "predicato per le policy di authenticated"],
  current_ruolo_staff: ["da_decidere", "predicato per le policy di authenticated"],
  current_school_code: ["da_decidere", "predicato per le policy di authenticated"],
  current_scuola_id: ["da_decidere", "predicato per le policy di authenticated"],
  current_scuola_profilo_id: ["da_decidere", "predicato per le policy di authenticated"],
  e_destinatario_messaggio: ["da_decidere", "predicato per le policy di authenticated"],
  manifestazioni_dettaglio_ente: ["da_decidere", "nessun chiamante dal 28/10 (la sostituisce interessati_ente)"],
  peers_workshop: ["da_decidere", "la chiama solo la pagina del workshop di uno studente"],
  ping_attesi_evento: ["da_decidere", "la chiamano solo altre definer"],
  report_evento_aggregato: ["da_decidere", "la chiama solo il report dell'ente, da collegati"],
  report_evento_distribuzione: ["da_decidere", "la chiama solo il report dell'ente, da collegati"],
  ruoli_occupati_workshop: ["da_decidere", "nessun chiamante dal TypeScript"],
  slug_istituzione_in_uso: ["da_decidere", "la chiamano solo altre definer"],
};
// IL TETTO: può solo scendere. Si abbassa quando una «da decidere» si chiude.
const TETTO_DA_DECIDERE = 18;

const vive = new Map(); // nome -> testa, l'ultima definizione non seguita da un drop
for (const nome of fs.readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort()) {
  const sql = senzaCommenti(fs.readFileSync(path.join(DIR, nome), "utf8"));
  const eventi = [];
  for (const m of sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\([^;]*?\)\s*returns([^;]*?)\$(\w*)\$[\s\S]*?\$\3\$/gi,
  ))
    eventi.push([m.index, "crea", m[1], m[2]]);
  for (const m of sql.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)/gi))
    eventi.push([m.index, "togli", m[1]]);
  eventi.sort((a, b) => a[0] - b[0]);
  for (const [, tipo, n, testa] of eventi) {
    if (tipo === "crea") vive.set(n, testa);
    else vive.delete(n);
  }
}
ok(vive.size >= 150, `le funzioni vive lette dalle migrazioni sono ${vive.size}`);

const definerVive = [...vive].filter(([, testa]) => /security\s+definer/i.test(testa));
const apertiAnon = definerVive.filter(([n]) => !chiusoAdAnon((permesso.get(n) ?? PREDEFINITI()).ruoli));
const triggerAperti = apertiAnon.filter(([, testa]) => /\btrigger\b/i.test(testa)).map(([n]) => n);
const rpcAperte = apertiAnon.filter(([, testa]) => !/\btrigger\b/i.test(testa)).map(([n]) => n);
ok(definerVive.length >= 100, `le SECURITY DEFINER vive sono ${definerVive.length}`);
console.log(
  `  · aperte ad anon: ${apertiAnon.length}, di cui ${triggerAperti.length} trigger (EXECUTE non conta quando scattano)`,
);

const nonDichiarate = rpcAperte.filter((n) => !APERTE_AD_ANON[n]).sort();
ok(
  nonDichiarate.length === 0,
  nonDichiarate.length === 0
    ? `tutte le ${rpcAperte.length} definer non trigger aperte ad anon sono dichiarate, con la ragione`
    : `${nonDichiarate.length} definer aperte ad anon e non dichiarate:\n    ` +
        nonDichiarate
          .map((n) => `${n} [${(permesso.get(n) ?? PREDEFINITI()).file ?? "nessun permesso scritto"}]\n      → revoke all on function public.${n}(…) from public, anon; (e il grant a chi la chiama)`)
          .join("\n    "),
);
const stantie = Object.keys(APERTE_AD_ANON).filter((n) => !rpcAperte.includes(n)).sort();
ok(
  stantie.length === 0,
  stantie.length === 0
    ? "nessuna voce dell'elenco è una funzione ormai chiusa o tolta"
    : `voci da togliere da APERTE_AD_ANON (chiuse o tolte): ${stantie.join(", ")}`,
);
const daDecidere = Object.values(APERTE_AD_ANON).filter(([c]) => c === "da_decidere").length;
ok(
  daDecidere <= TETTO_DA_DECIDERE,
  `le «da decidere» sono ${daDecidere} (tetto ${TETTO_DA_DECIDERE}, può solo scendere)`,
);
ok(
  Object.values(APERTE_AD_ANON).every(([c, m]) => (c === "visitatore" || c === "da_decidere") && m.length > 10),
  "ogni voce ha una categoria nota e una ragione",
);
// Con la replica (CONN, la lancia `npm run sql:tutti`) lo stesso insieme si
// legge da Postgres: il modello è una lettura delle migrazioni, e un modello
// che si sbaglia direbbe «dichiarate tutte» su un insieme sbagliato.
if (process.env.CONN) {
  const { execFileSync } = require("child_process");
  const dalDb = execFileSync("psql", [process.env.CONN, "-Atc",
    "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
    "where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') order by 1"],
    { encoding: "utf8" }).split("\n").filter(Boolean);
  const dalModello = apertiAnon.map(([n]) => n).sort();
  ok(
    JSON.stringify(dalDb) === JSON.stringify(dalModello),
    `sulla replica, le definer aperte ad anon sono le stesse del modello (${dalDb.length})` +
      (JSON.stringify(dalDb) === JSON.stringify(dalModello) ? "" :
        `: solo sul db ${dalDb.filter((n) => !dalModello.includes(n)).join(", ") || "—"}; solo nel modello ${dalModello.filter((n) => !dalDb.includes(n)).join(", ") || "—"}`),
  );
} else console.log("  · replica non collegata (CONN): le definer aperte ad anon non confrontate con Postgres");
ok(!rpcAperte.includes("e_profilo_di_prova"), "e_profilo_di_prova non è eseguibile da anon (20261210100000)");

// ── controprove ─────────────────────────────────────────────────────────────
// Senza, «zero fragili» direbbe solo che la lista letta era vuota. Le prime tre
// forme sono quelle vere trovate il 19/09, più quelle già corrette in passato.
const PROVE = [
  ["if v_istituzione_id <> public.current_istituzione_id() then", true],
  ["if v_student is null or v_student <> auth.uid() then", true],
  ["if public.current_ruolo() <> 'admin' then", true],
  ["if v_student is null or v_student is distinct from auth.uid() then", false],
  ["if v_istituzione_id is distinct from public.current_istituzione_id() then", false],
  ["if public.current_ha_permesso_staff('x') then", false],
];
let tarature = 0;
for (const [riga, atteso] of PROVE) {
  const visto = FRAGILE.test(riga) && NULLABILI.test(riga);
  if (visto !== atteso) {
    console.error(`  ✗ taratura: «${riga.trim()}» ${atteso ? "doveva" : "non doveva"} essere vista`);
    tarature++;
  }
}
ok(tarature === 0, `…e il controllo distingue la forma fragile da «is distinct from» (${PROVE.length} prove)`);

// LA TARATURA DELL'INGRESSO, che mancava e per questo il punto cieco è vissuto
// un mese: le prove qui sopra provano se una GUARDIA è riconosciuta, nessuna se
// una SCRITTURA lo è. Un pattern che non vede la scrittura esclude la funzione
// prima di arrivare alla guardia, quindi il controllo resta verde senza aver
// guardato — e le sei prove passavano comunque.
const PROVE_SCRITTURA = [
  ["  update public.workshop_iscrizioni\n  set stato = 'ritirato'", true, "la forma che usa tutto il repo"],
  ["  update workshop_iscrizioni set stato = 'attivo' where id = x;", true, "senza lo schema davanti"],
  ["  update p set x = 1 from t p", true, "con un alias di una lettera (l'unica che il pattern di prima vedeva)"],
  ["  insert into public.activity_log (student_id) values (x)", true, "insert"],
  ["  delete from public.evidence where attempt_id = x", true, "delete"],
  ["  select 1 from public.workshop_iscrizioni where id = x", false, "una lettura non è una scrittura"],
  ["  -- aggiorna lo stato dell'iscrizione", false, "una parola in un commento non è una scrittura"],
];
let tarSc = 0;
for (const [riga, atteso, perche] of PROVE_SCRITTURA) {
  if (SCRIVE.test(riga) !== atteso) {
    console.error(`  ✗ taratura scrittura: ${perche} — ${atteso ? "doveva" : "non doveva"} contare`);
    tarSc++;
  }
}
ok(
  tarSc === 0,
  `…e riconosce una scrittura in tutte le forme che il repo usa (${PROVE_SCRITTURA.length} prove)`,
);

// La taratura del modello dei permessi viaggia col modello: se si sposta, ogni
// suo lettore diventa rosso, non solo quello che qualcuno ricorda di guardare.
const rotte = taraModello();
for (const r of rotte) console.error(`  ✗ taratura permessi: ${r}`);
ok(
  rotte.length === 0,
  `…e il modello dei permessi riproduce quello che fa Postgres (${PROVE_TOTALI} prove)`,
);

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(
    `✗ ${falliti} controlli falliti.\n` +
      "  Una SECURITY DEFINER gira come proprietario: la RLS non fa da rete. Serve la\n" +
      "  guardia dentro («is distinct from», non «<>») e la porta chiusa fuori («revoke\n" +
      "  all … from public, anon» — revocare dal solo anon lascia PUBLIC, e revocare dal\n" +
      "  solo public lascia anon).\n",
  );
  process.exit(1);
}
console.log("✓ Chi scrive fuori dalla RLS controlla chi chiama, e non lo chiama chi non è nessuno.\n");
