import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { accessoreDaMappa, getMissione, stepDellaMissione } from "@/lib/escape/config";
import { MIN_AZIONI_PER_CARD } from "@/lib/escape/soglie";
import { costruisciRestituzione, type AreaTop } from "@/lib/escape/restituzione";
import type { Payload } from "@/lib/escape/tipi";
import EscapePlayer from "@/components/escape/EscapePlayer";
import IniziaMissione from "@/components/escape/IniziaMissione";
import EsitoMissione, { type AreaEsito, type StatoRevisore } from "@/components/escape/EsitoMissione";

export const metadata = { title: "Missione — KIREO" };

export default async function MissionePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mission = getMissione(slug);
  if (!mission) notFound();

  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("mission_attempt")
    .select("id, stato, revisore_esito")
    .eq("student_id", contesto.userId)
    .eq("mission_slug", slug)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const Intestazione = (
    <div>
      <Link href="/app/escape" className="text-xs text-kireo-muted hover:text-kireo-light">← Missioni</Link>
      <h1 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">{mission.titolo}</h1>
      <p className="mt-1 text-sm text-kireo-muted">{mission.sottotitolo}</p>
    </div>
  );

  // Nessun tentativo: intro + avvio.
  if (!attempt) {
    return (
      <div className="space-y-6">
        {Intestazione}
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
          <p className="text-sm text-kireo-light/90">{mission.descrizione}</p>
          <div className="mt-5">
            <IniziaMissione missionSlug={slug} />
          </div>
        </div>
      </div>
    );
  }

  // Completata: restituzione narrativa (v2) + profilo aggregato + motivazioni.
  if (attempt.stato === "completata") {
    // Solo le prove d'AREA (categoria='area'): lo STILE vive in style_signal e ha
    // la sua pagina; la QUALITÀ DI MISSIONE va nel blocco «come hai ragionato»
    // (sotto); l'ESPLORAZIONE non ha consumatore. Fix B: inclusione DICHIARATA
    // (categoria) al posto del proxy `.is("asse", null)`, che pescava anche
    // esplorazione e qualita_missione (area+asse entrambi null).
    const { data: prove } = await supabase.from("evidence").select("area_slug, motivazione, peso, step_id").eq("attempt_id", attempt.id).eq("categoria", "area");
    const areeToccate = Array.from(new Set((prove ?? []).map((p) => p.area_slug).filter((a): a is string => Boolean(a))));

    // Bravura NULL: i tre casi ora li distingue il campo autorevole
    // mission_attempt.revisore_esito (letto / letto_senza_credito / non_riuscito),
    // scritto dal route di finalizzazione a partire dall'esito reale del revisore.
    // `propostaValutata` qui sotto resta SOLO come euristica di ripiego per i
    // tentativi antecedenti al campo (revisore_esito null in DB): il conteggio
    // delle prove s4_proposta dice se la proposta era stata valutata. Per i
    // tentativi nuovi il campo ha la precedenza (vedi descrizioneNonMisurata).
    const { count: propostaCount } = await supabase
      .from("evidence")
      .select("*", { count: "exact", head: true })
      .eq("attempt_id", attempt.id)
      .eq("step_id", "s4_proposta");
    const propostaValutata = (propostaCount ?? 0) > 0;

    // "Perché lo diciamo": una riga per AZIONE, non una per coppia azione-area.
    // Le motivazioni degli step strutturati sono indipendenti dall'area (l'area
    // sta in area_slug), quindi righe della stessa azione condividono lo stesso
    // testo e si raggruppano; le aree vengono elencate insieme. Si mostrano solo
    // le 8 più significative (per peso).
    type Gruppo = { testo: string; aree: string[]; areeViste: Set<string>; peso: number; step: string };
    const gruppi = new Map<string, Gruppo>();
    for (const p of prove ?? []) {
      if (!p.motivazione) continue;
      const g: Gruppo = gruppi.get(p.motivazione) ?? { testo: p.motivazione, aree: [], areeViste: new Set<string>(), peso: 0, step: p.step_id ?? "?" };
      const nome = p.area_slug ? getAreaBySlug(p.area_slug)?.nome ?? p.area_slug : null;
      if (nome && !g.areeViste.has(nome)) {
        g.areeViste.add(nome);
        g.aree.push(nome);
      }
      g.peso = Math.max(g.peso, Number(p.peso) || 0);
      gruppi.set(p.motivazione, g);
    }
    // UNA RIGA GARANTITA PER SORGENTE D'AZIONE, poi il resto per peso.
    //
    // Il taglio secco per peso aveva un effetto che nessuno aveva scelto: con
    // UN SOLO ruolo preso i sette slot in cima erano già occupati da mandato,
    // priorità e revisore, e i gettoni sparivano in dieci missioni su undici
    // (misurato). Sparivano anche le voci del budget. Cioè le due stanze in cui
    // lo studente SPENDE — l'unica cosa che gli costa qualcosa — non comparivano
    // quasi mai nel blocco che spiega perché diciamo quello che diciamo. E la
    // curiosità, che la pagina descrive come «cosa scegli di approfondire quando
    // non puoi approfondire tutto», è misurata esattamente dai gettoni.
    //
    // Riservare uno slot ai soli gettoni avrebbe spostato il taglio sul budget:
    // stesso difetto, altra vittima. Qui nessuna categoria di atto può sparire
    // del tutto — la sorgente è lo step, che è il modo in cui lo studente vede
    // la partita (una stanza = un tipo di scelta).
    // ORDINE DI STANZA, non di peso. Il peso serviva a decidere chi veniva
    // tagliato; senza tetto non decide più niente e resta solo a mescolare le
    // sorgenti. Un blocco che si chiama «Perché lo diciamo», dietro un accordion
    // che l'utente ha aperto apposta, si legge come il RACCONTO della partita —
    // mandato, priorità, gettoni, piano, ruoli, revisore — non come la
    // classifica di un numero che non vede. Dentro la stessa stanza l'ordine
    // resta quello di emissione, che è l'ordine in cui ha agito.
    // L'ordine viene dagli STEP DELLA MISSIONE, non dall'ordine in cui il
    // database restituisce le righe: senza un ORDER BY quello non è garantito, e
    // un ordine che «di solito è giusto» è il tipo di cosa che si scopre rotta
    // in produzione.
    const ordineStep = new Map<string, number>();
    for (const st of stepDellaMissione(mission)) ordineStep.set(st.id, ordineStep.size);
    const spiegazioni = Array.from(gruppi.values())
      .map((g, i) => ({ g, i }))
      .sort((a, b) => (ordineStep.get(a.g.step) ?? 99) - (ordineStep.get(b.g.step) ?? 99) || a.i - b.i)
      .map(({ g }) => ({ testo: g.testo, aree: g.aree }));

    let aree: AreaEsito[] = [];
    const azioniPerArea = new Map<string, number>(); // area_slug -> azioni_distinte
    if (areeToccate.length > 0) {
      const { data: segnali } = await supabase
        .from("area_signal")
        .select("area_slug, interest_score, performance_score, self_efficacy_score, curiosity_score, status, azioni_distinte")
        .eq("student_id", contesto.userId)
        .in("area_slug", areeToccate);
      for (const s of segnali ?? []) azioniPerArea.set(s.area_slug, s.azioni_distinte ?? 0);
      aree = (segnali ?? [])
        .map((s) => ({
          slug: s.area_slug,
          nome: getAreaBySlug(s.area_slug)?.nome ?? s.area_slug,
          status: s.status as AreaEsito["status"],
          interest: s.interest_score,
          performance: s.performance_score,
          self_efficacy: s.self_efficacy_score,
          curiosity: s.curiosity_score,
        }))
        // provvisorio: sostituito dalla classifica per eleggibilità (item 3). Un
        // punteggio NULL («non misurato») qui pesa 0 nell'ordinamento — è un
        // ripiego, non la regola: l'item 3 escluderà le aree senza interesse
        // dichiarato invece di ordinarle come se valessero 0.
        .sort((a, b) => (b.interest ?? 0) + (b.curiosity ?? 0) - ((a.interest ?? 0) + (a.curiosity ?? 0)));
    }

    // Card piena vs «area sfiorata»: sul NUMERO DI AZIONI distinte che hanno
    // prodotto l'area (area_signal.azioni_distinte), non sulle celle vuote. Un'area
    // nata da UNA sola azione (un gettone: 2 righe ma 1 step) è sfiorata; serve
    // almeno MIN_AZIONI_PER_CARD azioni per una card. Contare le celle NULL era
    // sbagliato: metteva edilizia (1 azione, conf 0.100) fra le piene ed energia
    // (1 azione, 0.080) fra le sfiorate, benché nate dalla stessa azione.
    // Il finale NON è gated dall'eleggibilità (attività distinte): è un resoconto
    // della partita, non un verdetto sullo studente. Sono cose diverse — attività
    // (item 3, classifica) vs azioni (qui, display) — la stessa nozione a livelli
    // diversi.
    // Motivazione più pesante per area (la prova col peso maggiore): dice, nella
    // riga sfiorata, COSA si è comunque acceso.
    const motPerArea = new Map<string, string>();
    const pesoPerArea = new Map<string, number>();
    for (const p of prove ?? []) {
      if (!p.area_slug || !p.motivazione) continue;
      const peso = Number(p.peso) || 0;
      if (peso > (pesoPerArea.get(p.area_slug) ?? -1)) {
        pesoPerArea.set(p.area_slug, peso);
        motPerArea.set(p.area_slug, p.motivazione);
      }
    }
    const areeCard = aree.filter((a) => (azioniPerArea.get(a.slug) ?? 0) >= MIN_AZIONI_PER_CARD);
    const areeSfiorate = aree
      .filter((a) => (azioniPerArea.get(a.slug) ?? 0) < MIN_AZIONI_PER_CARD)
      .map((a) => ({ nome: a.nome, testo: motPerArea.get(a.slug) ?? "l'hai solo sfiorata in questa missione." }));

    // restituzione: costruita dalle risposte autorevoli (step_response) + le
    // aree principali. Retro-compatibile con un tentativo v1 (blocchi vuoti).
    const { data: righeResp } = await supabase.from("step_response").select("step_id, payload").eq("attempt_id", attempt.id);
    const mappa = new Map<string, Payload>();
    for (const r of righeResp ?? []) mappa.set(r.step_id, r.payload as Payload);
    const areeTop: AreaTop[] = areeCard.slice(0, 3).map((a) => ({ slug: a.slug, nome: a.nome, status: a.status }));
    const restituzione = costruisciRestituzione(slug, accessoreDaMappa(mappa), areeTop);

    // «Come hai ragionato»: SOLO le performance di qualità di missione
    // (categoria 'qualita_missione', dimensione 'performance') — osservazioni sul
    // METODO senza area. Le self_efficacy della stessa categoria («ti sei sentito
    // a tuo agio…», «ti eri dato una fiducia prudente») sono «come si è sentito
    // lui», NON come ha ragionato: sotto l'intestazione «osservazioni sul tuo
    // metodo» sarebbero un'affermazione falsa → escluse.
    //   self_efficacy in qualita_missione: NESSUN CONSUMATORE ATTUALE, in attesa
    //   del Fix C (motivazione per-area, poi tornano evidenza d'area). Restano
    //   scritte in DB ma non mostrate.
    // Motivazioni deduplicate, le 6 di peso maggiore.
    const { data: proveQualita } = await supabase.from("evidence").select("motivazione, peso").eq("attempt_id", attempt.id).eq("categoria", "qualita_missione").eq("dimensione", "performance");
    const ragionamento = Array.from(
      (proveQualita ?? []).reduce((m, p) => {
        if (p.motivazione) m.set(p.motivazione, Math.max(m.get(p.motivazione) ?? 0, Number(p.peso) || 0));
        return m;
      }, new Map<string, number>()),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([testo]) => testo);

    return (
      <div className="space-y-6">
        {Intestazione}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-kireo-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-kireo-muted">
            Hai già completato questa missione. Puoi rigiocarla: le scelte possono cambiare e le tue ipotesi si affinano.
          </p>
          <div className="flex-none">
            <IniziaMissione missionSlug={slug} etichetta="Rigioca la missione" />
          </div>
        </div>
        <EsitoMissione titolo={mission.titolo} restituzione={restituzione} aree={areeCard} areeSfiorate={areeSfiorate} spiegazioni={spiegazioni} ragionamento={ragionamento} revisoreEsito={(attempt.revisore_esito as StatoRevisore) ?? null} propostaValutata={propostaValutata} />
      </div>
    );
  }

  // In corso: player, riprendibile dalle risposte già salvate.
  const { data: righe } = await supabase.from("step_response").select("step_id, payload").eq("attempt_id", attempt.id);
  const risposteIniziali = (righe ?? []).map((r) => ({ step_id: r.step_id, payload: r.payload as Payload }));

  return (
    <div className="space-y-6">
      {Intestazione}
      <EscapePlayer missionSlug={slug} attemptId={attempt.id} risposteIniziali={risposteIniziali} />
    </div>
  );
}
