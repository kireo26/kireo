// Il robot che gioca un ruolo, dall'iscrizione al feedback finale.
//
// OGNI GESTO È QUELLO DEL PRODOTTO, non una scorciatoia equivalente:
//   · iscrizione        → insert su workshop_iscrizioni, come IscrizioneRuolo,
//                         dopo aver CHIESTO cosa c'è già invece di scoprire il
//                         vincolo dall'errore;
//   · lasciare un ruolo → ritira_iscrizione_workshop, la stessa funzione del
//                         bottone «Lascia il workshop»;
//   · apertura tappe    → GET della pagina /progetto, che è ciò che chiama
//                         `inizializza_fasi_workshop` (il robot NON chiama la
//                         funzione SQL: chiama la pagina che la chiama);
//   · compilazione      → upsert su workshop_elaborati, come l'editor;
//   · chat              → POST /api/workshop/cliente-chat;
//   · consegna          → POST /api/workshop/elaborato/consegna-tappa;
//   · avanzamento       → GET del cron, con il segreto.
//
// SE UN GATE BLOCCA, IL ROBOT SI FERMA E LO RIPORTA. Non riempie una sezione
// per farsi passare, non inventa un messaggio per arrivare al minimo, non
// aggira un cooldown. Un blocco è un risultato: è così che il 30 agosto è
// venuta fuori la checklist che obbligava a dichiarare il falso.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { config } = require("../config");
const { interpreta } = require("../motore");

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

// Quanti giri di cron aspettare prima di dichiarare che una tappa non avanza.
// Non è il numero di tentativi del motore (quello è suo): è quante volte il
// robot ripassa a chiedere «è pronta?» prima di smettere.
const GIRI_CRON_MAX = 12;
const ATTESA_FRA_GIRI_MS = 20_000;

// Stesso principio di `conUnRitentativo` in sessione.js: un pacchetto perso
// non è un esito del prodotto.
async function conUnRitentativo(azione) {
  try {
    return await azione();
  } catch (primo) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      return await azione();
    } catch {
      throw primo;
    }
  }
}

async function faiGirareIlCron(c) {
  // `alert=no`: un giro per tappa, un centinaio in una passata. La mail di
  // osservabilità resta al giro programmato, così una mail continua a
  // significare qualcosa.
  const risposta = await conUnRitentativo(() =>
    fetch(`${c.sitoUrl}/api/cron/workshop-motore?alert=no`, {
      headers: { Authorization: `Bearer ${c.cronSecret}` },
      redirect: "follow",
    }),
  );
  const testo = await risposta.text();
  let dati = null;
  try {
    dati = JSON.parse(testo);
  } catch {
    /* non JSON: lo gestisce chi chiama */
  }
  return { status: risposta.status, dati };
}

// Gioca un ruolo intero. Restituisce un resoconto: cosa è successo, i testi
// raccolti, e — se si è fermato — dove e perché.
async function giocaRuolo({ sessione, workshopSlug, ruoloSlug, consegne, fasi, registra, rigioca = false }) {
  const c = config(["sitoUrl", "cronSecret"]);
  const { supabase, chiama, utente } = sessione;
  const etichetta = `${workshopSlug} > ${ruoloSlug}`;
  const esito = { etichetta, workshopSlug, ruoloSlug, tappe: [], fermato: null, fiduciaFinale: null, feedbackFinale: null };

  const di = (t) => registra(`  ${t}`);

  // ── 1. iscrizione ────────────────────────────────────────────────────────
  const { data: ws } = await supabase.from("workshop").select("id").eq("slug", workshopSlug).eq("attivo", true).maybeSingle();
  if (!ws) return { ...esito, fermato: { dove: "iscrizione", perche: `il workshop «${workshopSlug}» non esiste o non è attivo` } };

  const { data: ruolo } = await supabase.from("workshop_ruoli").select("id").eq("workshop_id", ws.id).eq("slug", ruoloSlug).maybeSingle();
  if (!ruolo) return { ...esito, fermato: { dove: "iscrizione", perche: `il ruolo «${ruoloSlug}» non esiste in questo workshop` } };

  // SI CHIEDE PRIMA DI INSERIRE, non si scopre il vincolo dall'errore. È la
  // regola della porta, e vale anche adesso che il vincolo è più largo di
  // prima: l'unico rimasto è una sola iscrizione IN CORSO per studente e
  // workshop (il ruolo non è più esclusivo dal 2026-08-30).
  const { data: mie } = await supabase
    .from("workshop_iscrizioni")
    .select("id, ruolo_id, stato")
    .eq("workshop_id", ws.id)
    .eq("student_id", utente.id)
    .order("created_at", { ascending: false });

  const righe = mie ?? [];
  const inCorso = righe.find((r) => r.stato === "attivo");
  let iscrizione = null;

  if (inCorso && inCorso.ruolo_id === ruolo.id) {
    iscrizione = inCorso;
    di("già iscritto a questo ruolo (riprende da dove era)");
  } else {
    if (inCorso) {
      // Un altro ruolo di questo stesso workshop è ancora in corso: il robot
      // gioca un ruolo alla volta con un account solo, quindi deve lasciarlo
      // prima. Lo fa con il gesto del prodotto (la stessa funzione che chiama
      // il bottone «Lascia il workshop»), e lo DICE: una transizione di stato
      // fatta in silenzio è una cosa che poi nessuno sa spiegare.
      const { error: erroreLascia } = await supabase.rpc("ritira_iscrizione_workshop", { p_iscrizione_id: inCorso.id });
      if (erroreLascia) {
        return { ...esito, fermato: { dove: "iscrizione", perche: `non è stato possibile lasciare il ruolo precedente: ${erroreLascia.message}` } };
      }
      di("lasciato il ruolo precedente di questo workshop (il suo lavoro resta)");
    }

    const lasciata = righe.find((r) => r.ruolo_id === ruolo.id && r.stato === "ritirato");
    if (lasciata) {
      const { error: erroreRiprendi } = await supabase.rpc("riprendi_iscrizione_workshop", { p_iscrizione_id: lasciata.id });
      if (erroreRiprendi) {
        return { ...esito, fermato: { dove: "iscrizione", perche: `riprendere il ruolo è stato rifiutato: ${erroreRiprendi.message}` } };
      }
      iscrizione = lasciata;
      di("ripreso un ruolo lasciato in una passata precedente");
    } else if (!rigioca && righe.some((r) => r.ruolo_id === ruolo.id && r.stato === "completato")) {
      // Un ruolo già portato a termine non si rigioca da solo: rifarlo
      // conterebbe due volte gli stessi testi nella misura. Una TRAPPOLA sì
      // (`rigioca`): è un'altra consegna sullo stesso ruolo, ed è il punto.
      return { ...esito, fermato: { dove: "iscrizione", perche: "questo ruolo risulta già completato da questo account: niente da rigiocare" } };
    } else {
      const { data: nuova, error } = await supabase
        .from("workshop_iscrizioni")
        .insert({ workshop_id: ws.id, ruolo_id: ruolo.id, student_id: utente.id })
        .select("id, ruolo_id, stato")
        .single();
      if (error) {
        return { ...esito, fermato: { dove: "iscrizione", perche: error.message } };
      }
      iscrizione = nuova;
      di("iscritto");
    }
  }
  esito.iscrizioneId = iscrizione.id;

  // ── 2. apertura delle tappe, chiedendola alla PAGINA ─────────────────────
  // È la pagina del progetto a inizializzare lo stato delle tappe al primo
  // accesso. Il robot la visita invece di chiamare la funzione SQL: così
  // passa anche dalle guardie della pagina, che sono parte della porta.
  const pagina = await chiama(`/app/workshop/${workshopSlug}/progetto`, null, "GET");
  if (pagina.status >= 400) {
    return { ...esito, fermato: { dove: "apertura", perche: `la pagina del progetto ha risposto ${pagina.status}` } };
  }

  // ── 3. le tappe, una alla volta ──────────────────────────────────────────
  for (const fase of fasi) {
    const consegnaTappa = consegne.tappe?.[fase.id];
    const resoconto = { faseId: fase.id, messaggi: 0, revisione: null, reazione: null, esitoRevisione: null, tentativi: 0 };

    if (!consegnaTappa) {
      esito.tappe.push(resoconto);
      return { ...esito, fermato: { dove: fase.id, perche: "nessuna consegna scritta per questa tappa" } };
    }

    // Lo stato REALE: se la tappa non è aperta, non si forza.
    const { data: stato } = await supabase
      .from("workshop_fasi_stato")
      .select("stato, aperta_at")
      .eq("iscrizione_id", iscrizione.id)
      .eq("fase_id", fase.id)
      .maybeSingle();

    if (!stato) {
      return { ...esito, fermato: { dove: fase.id, perche: "la tappa non risulta inizializzata" } };
    }
    if (stato.stato === "revisionata") {
      di(`${fase.id}: già revisionata, si salta`);
      resoconto.giaFatta = true;
      esito.tappe.push(resoconto);
      continue;
    }
    if (stato.stato === "bloccata") {
      return { ...esito, fermato: { dove: fase.id, perche: "la tappa è ancora bloccata: la precedente non è stata revisionata" } };
    }

    // ── compilazione: l'upsert che fa il salvataggio automatico ────────────
    if (stato.stato === "aperta") {
      const { data: elaborato } = await supabase
        .from("workshop_elaborati")
        .select("contenuto")
        .eq("iscrizione_id", iscrizione.id)
        .maybeSingle();
      const contenuto = { ...(elaborato?.contenuto ?? {}), ...consegnaTappa.sezioni };

      const { error: erroreSalva } = await supabase
        .from("workshop_elaborati")
        .upsert({ iscrizione_id: iscrizione.id, contenuto, fase_corrente: fase.id }, { onConflict: "iscrizione_id" });
      if (erroreSalva) {
        return { ...esito, fermato: { dove: fase.id, perche: `salvataggio rifiutato: ${erroreSalva.message}` } };
      }
      di(`${fase.id}: sezioni salvate`);

      // ── chat: solo fino al minimo, mai uno di più ────────────────────────
      const { count: giaMandati } = await supabase
        .from("workshop_chat_cliente")
        .select("id", { count: "exact", head: true })
        .eq("iscrizione_id", iscrizione.id)
        .eq("mittente", "studente")
        .gte("created_at", stato.aperta_at);

      const daMandare = Math.max(0, fase.chatMinima - (giaMandati ?? 0));
      if (daMandare > (consegnaTappa.chat?.length ?? 0)) {
        return {
          ...esito,
          fermato: { dove: fase.id, perche: `servono ${daMandare} messaggi ancora e nel file ce ne sono ${consegnaTappa.chat?.length ?? 0}: il robot non ne inventa` },
        };
      }
      for (let i = 0; i < daMandare; i++) {
        const r = await chiama("/api/workshop/cliente-chat", { iscrizioneId: iscrizione.id, messaggio: consegnaTappa.chat[i] });
        if (r.status >= 400) {
          return { ...esito, fermato: { dove: fase.id, perche: `la chat ha risposto ${r.status}: ${r.dati?.errore ?? r.testo.slice(0, 120)}` } };
        }
        resoconto.messaggi++;
      }
      if (daMandare > 0) di(`${fase.id}: ${daMandare} messaggi al cliente`);

      // ── consegna ─────────────────────────────────────────────────────────
      const r = await chiama("/api/workshop/elaborato/consegna-tappa", {
        iscrizioneId: iscrizione.id,
        workshopSlug,
        ruoloSlug,
        faseId: fase.id,
      });
      if (r.status >= 400) {
        // IL CASO CHE VALE: un gate che morde. Non si aggira, si riporta.
        return {
          ...esito,
          fermato: {
            dove: fase.id,
            perche: `la consegna è stata rifiutata (${r.status}): ${r.dati?.errore ?? r.testo.slice(0, 200)}`,
            gate: true,
            dettaglio: r.dati,
          },
        };
      }
      di(`${fase.id}: consegnata`);
    }

    // ── attesa della revisione, facendo girare il cron ─────────────────────
    let revisionata = false;
    for (let giro = 1; giro <= GIRI_CRON_MAX && !revisionata; giro++) {
      const cron = await faiGirareIlCron(c);
      const lettura = interpreta(cron.status, cron.dati ?? {}, null);

      const { data: dopo } = await supabase
        .from("workshop_fasi_stato")
        .select("stato, revisione, reazione_cliente, revisione_esito, tentativi_revisione")
        .eq("iscrizione_id", iscrizione.id)
        .eq("fase_id", fase.id)
        .maybeSingle();

      if (dopo?.stato === "revisionata") {
        revisionata = true;
        resoconto.revisione = dopo.revisione;
        resoconto.reazione = dopo.reazione_cliente;
        resoconto.esitoRevisione = dopo.revisione_esito;
        resoconto.tentativi = Number(dopo.tentativi_revisione) || 0;
        di(`${fase.id}: revisionata (${resoconto.esitoRevisione}, ${resoconto.tentativi} tentativi)`);
        break;
      }

      if (giro === 1 && /RAFFREDDAMENTO/i.test(lettura.righe.join(" "))) {
        // Per un profilo di prova il cooldown non dovrebbe MAI scattare: il
        // cron lo salta guardando `e_profilo_di_prova`. Se scatta lo stesso,
        // vuol dire che l'account non è marcato o che la migration del
        // raffreddamento non è applicata — e va detto, non aspettato.
        di(`${fase.id}: il cron dice che è in raffreddamento, ma un profilo di prova non dovrebbe averlo. Controlla che l'account sia marcato e che il cron salti il cooldown per i profili di prova.`);
      }
      if (giro < GIRI_CRON_MAX) await attendi(ATTESA_FRA_GIRI_MS);
    }

    if (!revisionata) {
      const { data: ultimo } = await supabase
        .from("workshop_fasi_stato")
        .select("stato, tentativi_revisione")
        .eq("iscrizione_id", iscrizione.id)
        .eq("fase_id", fase.id)
        .maybeSingle();
      esito.tappe.push(resoconto);
      return {
        ...esito,
        fermato: {
          dove: fase.id,
          perche:
            `dopo ${GIRI_CRON_MAX} giri di cron la tappa è ancora «${ultimo?.stato}» (${ultimo?.tentativi_revisione ?? 0} tentativi). ` +
            `Se è ancora «consegnata» senza tentativi spesi, il cron non sta saltando il cooldown per questo profilo; se i tentativi ci sono, il revisore sta fallendo: npm run banco log`,
        },
      };
    }

    esito.tappe.push(resoconto);
  }

  // ── 4. la chiusura del progetto ──────────────────────────────────────────
  const { data: finale } = await supabase
    .from("workshop_elaborati")
    .select("stato, fiducia, feedback_ai")
    .eq("iscrizione_id", iscrizione.id)
    .maybeSingle();
  esito.fiduciaFinale = finale?.fiducia ?? null;
  esito.feedbackFinale = finale?.feedback_ai ?? null;
  esito.chiuso = finale?.stato === "consegnato";
  di(`fiducia ${esito.fiduciaFinale}/100${esito.chiuso ? ", progetto chiuso" : ", progetto NON chiuso"}`);

  return esito;
}

module.exports = { giocaRuolo, GIRI_CRON_MAX };
