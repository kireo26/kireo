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
const fn = new Map();
for (const nome of fs.readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort()) {
  const sql = fs.readFileSync(path.join(DIR, nome), "utf8");
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\([\s\S]*?\)\s*returns([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\3\$/gi;
  let m;
  while ((m = re.exec(sql))) {
    fn.set(m[1], { nome: m[1], file: nome, testa: m[2], corpo: m[4] });
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
const SCRIVE = /\binsert\s+into\b|\bdelete\s+from\b|\bupdate\s+(?:only\s+)?[\w."]+\s+set\b/i;
// Una parola di scrittura qualunque: troppo larga per decidere, buona per
// sospettare. Serve solo al riscontro (c).
const PAROLA_LARGA = /\b(insert|update|delete)\b/i;
const senzaCommenti = (s) => s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const definer = [...fn.values()].filter((f) => /security\s+definer/i.test(f.testa));
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
const sospette = nonScrivono.filter((f) => PAROLA_LARGA.test(senzaCommenti(f.corpo)));
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
