// KIREO Escape — costruzione della RESTITUZIONE dell'esito. Non un riassunto:
// quattro momenti in linguaggio ipotetico, senza mai numeri grezzi di
// valore/peso. Logica pura (nessuna AI), calcolata dalle risposte autorevoli
// (step_response) + i segnali d'area aggregati. Usata lato server dalla pagina
// di esito. Mission-aware: il blocco "Cosa hai costruito" e le "occasioni"
// (conseguenze di ciò che non hai letto/scelto) sono per-missione; i blocchi
// "Come hai deciso", "Le ipotesi" e la nota da_verificare sono generici.
// Retro-compatibile: su un tentativo senza i nuovi step i blocchi restano
// null/vuoti.

import type { LeggiRisposta, Mandato, PayloadAlloca, PayloadAssegna, PayloadAssegnaPersone, PayloadLavori, PayloadScarta, PayloadSeleziona, StepAllocaBudget, StepPianificaLavori, StepSelezionaInformazioni } from "./tipi";
import { getMissione, mandatoScelto, materialiLetti } from "./config";

export type AreaTop = { slug: string; nome: string; status: "emergente" | "confermata" | "da_verificare" };

export type Restituzione = {
  costruito: string | null;
  metodo: string | null;
  occasioni: string[];
  ipotesi: string | null;
  notaVerifica: string | null;
};

// `ruoli` = le assegnazioni io/altri della Stanza dei ruoli (`assegna_ruoli`),
// distinte da `assegnazioni`, che è il compito→persona della sola Missione 10
// (`assegna_persone`). Sono due step diversi con due payload diversi: tenerli in
// due campi evita che una cornice legga l'uno credendo di leggere l'altro.
type OccasioneCtx = { letti: Set<string>; alloc?: Record<string, number>; pianoSel?: string[]; scartati?: string[]; assegnazioni?: Record<string, string>; ruoli?: Record<string, string>; mandato: Mandato | null };
type OccasioneRule = { quando: (c: OccasioneCtx) => boolean; testo: string };
type Narrativa = { costruito: (mandato: Mandato, topVoce: string | null) => string; occasioni: OccasioneRule[] };

const elenco = (nomi: string[]) => (nomi.length <= 1 ? nomi[0] ?? "" : `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]}`);
const facciataTenuta = (c: OccasioneCtx, trapId: string) => c.scartati !== undefined && !c.scartati.includes(trapId);
const scartato = (c: OccasioneCtx, id: string) => c.scartati !== undefined && c.scartati.includes(id);
const nelPiano = (c: OccasioneCtx, id: string) => c.pianoSel?.includes(id) ?? false;
const speso = (c: OccasioneCtx, id: string) => Number(c.alloc?.[id]) || 0;
const assegnatoA = (c: OccasioneCtx, compito: string, persona: string) => c.assegnazioni?.[compito] === persona;
// Il ruolo preso in prima persona. È false anche quando lo step non è stato
// compilato affatto (`ruoli` undefined): finché nessuna cornice ha bisogno di
// distinguere «l'ha lasciato ad altri» da «non è arrivato a quello step», il
// caso non si separa — un helper senza chiamanti è codice che qualcuno userà
// male prima che serva.
const presoDaTe = (c: OccasioneCtx, ruolo: string) => c.ruoli?.[ruolo] === "io";
// Missione 10: quanti dei 5 abbinamenti compito↔persona "forti" sono azzeccati
// (con il relativo materiale letto).
const ABBINAMENTI_CLASSE: { compito: string; persona: string; richiede: string }[] = [
  { compito: "traduzioni", persona: "amine", richiede: "M4" },
  { compito: "impaginazione", persona: "giada", richiede: "M10" },
  { compito: "testi", persona: "elisa", richiede: "M5" },
  { compito: "mappa", persona: "yuri", richiede: "M11" },
  { compito: "indirizzi", persona: "tommaso", richiede: "M7" },
];
const abbinamentiBuoni = (c: OccasioneCtx) => ABBINAMENTI_CLASSE.filter((a) => assegnatoA(c, a.compito, a.persona) && c.letti.has(a.richiede)).length;

const NARRATIVA: Record<string, Narrativa> = {
  "progetto-quartiere": {
    costruito: (mandato, topVoce) =>
      `Hai immaginato l'ex mercato come ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Quando hai dovuto distribuire il budget, la fetta più grande è andata a «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => c.alloc !== undefined && !c.letti.has("M4"), testo: "Non hai aperto la perizia strutturale, e il tetto è arrivato quando il budget era già distribuito. Succede: nessuno può sapere tutto. Ma è un'informazione su di te — in questa missione hai preferito muoverti piuttosto che sapere prima." },
      { quando: (c) => facciataTenuta(c, "facciata_pannelli") && c.letti.has("M6"), testo: "Hai proposto di rivestire la facciata anche se la perizia della Soprintendenza, che avevi letto, la dava per tutelata: la domanda sarebbe stata respinta. La perizia l'avevi letta, e hai proposto lo stesso." },
      { quando: (c) => facciataTenuta(c, "facciata_pannelli") && !c.letti.has("M6"), testo: "Hai proposto di coprire la facciata. La Soprintendenza l'avrebbe respinta perché la facciata è tutelata: stava in una perizia che non hai aperto." },
      { quando: (c) => c.alloc !== undefined && c.letti.has("M7") && speso(c, "fondo_gestione") === 0, testo: "Sapevi dei costi di gestione dal terzo anno — l'avevi letto — ma non hai lasciato nulla da parte per coprirli. È il tipo di dettaglio che decide se un progetto regge nel tempo." },
    ],
  },

  "crisi-mediateca": {
    costruito: (mandato, topVoce) =>
      `Hai scelto di trattarla come ${mandato.label} ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Delle cinque giornate, la parte più grande è andata a «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "confermare_spiegare") && !c.letti.has("M4"), testo: "Hai tenuto la decisione così com'era. Il regolamento comunale non lo permette: l'area libera scende al 48%, sotto il minimo del 60%. Stava in un documento che non hai aperto." },
      { quando: (c) => facciataTenuta(c, "confermare_spiegare") && c.letti.has("M4"), testo: "Hai tenuto la decisione così com'era anche sapendo, dal regolamento che avevi letto, che l'area libera scende sotto il minimo di legge. Non era solo impopolare: era fuori dal regolamento, e il regolamento l'avevi letto." },
      { quando: (c) => !c.letti.has("M12"), testo: "Non hai chiesto la nota interna dell'assessorato. Diceva che il Comune si sarebbe dissociato pubblicamente entro cinque giorni — ed è successo mentre stavi ancora decidendo." },
      { quando: (c) => !c.letti.has("M7"), testo: "C'era una strada che quasi nessuno aveva visto: la mattina la sala è occupata al 18%, il pomeriggio al 94%. Si poteva dividere il tempo invece dello spazio. Il dato c'era, in un documento che non hai aperto." },
      { quando: (c) => c.alloc !== undefined && c.letti.has("M8") && speso(c, "informare_personale") === 0, testo: "Non hai dedicato tempo a informare chi ci lavora, e loro avevano saputo della decisione dal giornale come tutti gli altri." },
    ],
  },

  "guasto-serra": {
    costruito: (mandato, topVoce) =>
      `Hai iniziato dall'ipotesi ${mandato.label} ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Delle sei ore, ne hai messe di più su «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "raddoppiare") && !c.letti.has("M6"), testo: "Hai tenuto il raddoppio della durata dell'irrigazione. La valvola B, sotto 0,8 bar, non si apre affatto: raddoppiare zero fa zero. Stava nel manuale della pompa, che non hai aperto." },
      { quando: (c) => facciataTenuta(c, "raddoppiare") && c.letti.has("M6"), testo: "Hai tenuto il raddoppio della durata anche sapendo, dal manuale che avevi letto, che sotto 0,8 bar la valvola non apre: raddoppiare zero fa zero. Il dato l'avevi, e in quel momento non è tornato a galla." },
      { quando: (c) => !c.letti.has("M12"), testo: "Non hai chiesto il dato del contatore. Segnava un terzo dell'acqua che il sistema dichiarava di aver usato: la prova che i numeri non corrispondevano alla realtà era lì." },
      { quando: (c) => !(c.letti.has("M4") && c.letti.has("M13")), testo: "C'era una riga di codice che scriveva «irrigato» nell'istante in cui mandava il comando, senza controllare se l'acqua uscisse davvero. Tutto il problema era lì — nel log e nel codice, che non hai letto insieme." },
    ],
  },

  "cantiere-scuola": {
    costruito: (mandato, topVoce) =>
      `Hai aperto il documento con la frase ${mandato.label}.` + (topVoce ? ` Nel tuo piano, il lavoro più impegnativo è stato «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => c.pianoSel !== undefined && !nelPiano(c, "elettrico") && !c.letti.has("M4"), testo: "Il tuo piano stava nei tempi e nel budget, ma l'impianto elettrico era del 1988 e senza rifacimento il collaudo non passa. La palestra non ha riaperto il 12 settembre. C'era una relazione che lo diceva: non l'hai chiesta." },
      { quando: (c) => c.pianoSel !== undefined && !nelPiano(c, "elettrico") && c.letti.has("M4"), testo: "Hai lasciato fuori il rifacimento elettrico anche sapendo, dalla relazione che avevi letto, che senza non si collauda. La palestra non ha riaperto il 12 settembre." },
      { quando: (c) => scartato(c, "accessibilita"), testo: "Hai rimandato l'adeguamento degli spogliatoi. È la scelta che avrebbero fatto in molti. Ma in quell'istituto ci sono quattro studenti che a settembre sono rimasti fuori — e il collaudo poteva rilevarlo comunque." },
      { quando: (c) => c.pianoSel !== undefined && nelPiano(c, "controsoffitto") && !nelPiano(c, "copertura"), testo: "Hai messo un controsoffitto nuovo sotto un tetto che perde da nove anni: la prima pioggia forte se lo riprende. La copertura andava fatta prima." },
      { quando: (c) => !c.letti.has("M13"), testo: "I pannelli del controsoffitto avevano 35 giorni di consegna e nessuno li aveva ordinati. Il ritardo non è nato in cantiere, è nato la prima settimana." },
      { quando: (c) => c.letti.has("M11") && c.pianoSel !== undefined && !nelPiano(c, "fondo_imprevisti"), testo: "Sapevi che una variante in corso d'opera costa venti giorni d'istruttoria, ma non hai lasciato un fondo imprevisti: se qualcosa fosse cambiato, non avevi margine." },
    ],
  },

  "sportello-insieme": {
    costruito: (mandato, topVoce) =>
      `Hai deciso con la regola ${mandato.label}.` + (topVoce ? ` Il tempo più lungo, quando eri alle strette, è andato a «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "chiedi_identita"), testo: "Hai risposto alla mail chiedendo chi fosse. È la domanda che verrebbe a chiunque. Ma sei mesi fa era già successo, e quella persona non ha più scritto. C'era una nota che lo spiegava: non l'hai aperta." },
      { quando: (c) => !c.letti.has("M5"), testo: "La segnalazione della scuola andava trasmessa entro 48 ore, ed erano scadute stamattina. Sembrava la richiesta meno urgente delle cinque: era quella con il termine più stretto." },
      { quando: (c) => !c.letti.has("M4") && speso(c, "compila_kaur") > 0, testo: "Hai dedicato tempo a compilare per intero la domanda Kaur. Bastava protocollarla entro le 12: i documenti si potevano integrare in dieci giorni. Era scritto nel regolamento del bando." },
      { quando: (c) => !c.letti.has("M11"), testo: "Il tuo piano contava su tre operatori. Dalle 11 in poi ne restavano due, e una non poteva gestire un colloquio da sola." },
      // Stessa famiglia della 08: scattava sulla sola lettura di M7. L'atto qui
      // sono i minuti messi (o non messi) sul richiamo. Le due chiuse sono
      // diverse apposta: a chi non l'ha richiamato si corregge una lettura
      // sbagliata («non era un impaziente»), a chi l'ha fatto no — spiegargli
      // una cosa che ha capito da solo sarebbe una lezione, non una
      // restituzione. La chiusa di B è un fatto del registro: due accessi,
      // quattro chiamate, mai un riscontro.
      { quando: (c) => c.letti.has("M7") && speso(c, "richiama_muratori") === 0, testo: "Non hai messo minuti sul richiamo al sig. Muratori. Nel suo fascicolo, che avevi aperto, c'era scritto che nessuno gli aveva detto niente per settantaquattro giorni: non era un impaziente, era uno che aspettava una risposta." },
      { quando: (c) => c.letti.has("M7") && speso(c, "richiama_muratori") > 0, testo: "Hai messo minuti sul richiamo al sig. Muratori. Nel suo fascicolo, che avevi aperto, c'era scritto che nessuno gli aveva detto niente per settantaquattro giorni: la tua telefonata è la prima risposta che riceve." },
    ],
  },

  "filiera-borea": {
    costruito: (mandato, topVoce) =>
      `Hai iniziato dall'idea ${mandato.label}.` + (topVoce ? ` Nel piano, la voce su cui hai speso di più è stata «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "beta_dichiara"), testo: "Hai scelto Beta e l'hai scritto in etichetta. Costava meno ed era più vicino: sulla carta la scelta migliore. Ma il riciclato non era tracciabile, e la responsabilità di quella frase era di Borea. Due anni fa un concorrente distrusse sessantamila confezioni per lo stesso motivo." },
      { quando: (c) => !(c.letti.has("M7") && c.letti.has("M8")), testo: "Il ventuno per cento dell'impatto stava nei trasporti, e quasi tutto in fibbie e zip che arrivavano dalla Cina in aereo. C'era un fornitore europeo a trentacinque centesimi. Guardavi il tessuto e il guadagno più grande era altrove." },
      { quando: (c) => !c.letti.has("M11"), testo: "Eliminare il sacchetto di plastica avrebbe tolto il quattro per cento d'impatto facendoti risparmiare otto centesimi. Era l'unica cosa gratis della missione." },
      { quando: (c) => !c.letti.has("M12"), testo: "L'ordine ad Alfa andava fatto entro il 15 maggio. L'hai saputo quando il commerciale è entrato con il calendario in mano." },
      { quando: (c) => c.pianoSel !== undefined && nelPiano(c, "tessuto_alfa") && !nelPiano(c, "documentazione"), testo: "Hai comprato il materiale migliore e non ti sono rimasti centesimi per documentarlo. Hai fatto la cosa giusta senza poterla provare — che in questo mestiere conta meno di quanto dovrebbe." },
      { quando: (c) => scartato(c, "beta_dichiara") && !scartato(c, "beta_muto"), testo: "Nello scarto hai buttato l'opzione di dichiarare un riciclato che non potevi certificare, e hai tenuto quella di migliorare il prodotto senza scriverlo in etichetta." },
    ],
  },

  "palco-programma": {
    costruito: (mandato, topVoce) =>
      `Hai deciso: ${mandato.label} — ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Della serata, il blocco più lungo l'hai dato a «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "spostare_orari") && !c.letti.has("M4"), testo: "Hai tenuto lo spostamento di un'ora. È la reazione più naturale davanti a un buco, e i soldi per l'ora di service c'erano pure. Ma il permesso della piazza scadeva all'una e per cambiare gli orari servivano quarantotto ore di preavviso: ne mancavano ventiquattro. Stava nel regolamento, che non hai aperto." },
      { quando: (c) => facciataTenuta(c, "spostare_orari") && c.letti.has("M4"), testo: "Hai tenuto lo spostamento di un'ora anche sapendo, dal regolamento che avevi letto, che il permesso scadeva all'una e che per cambiare gli orari servivano quarantotto ore. Ne restavano ventiquattro: quella strada era già chiusa quando l'hai scelta." },
      { quando: (c) => !c.letti.has("M6"), testo: "In paese c'erano duecento ragazzi con diciotto minuti di coro in cinque lingue già pronti. Erano lì da due settimane, non costavano niente, e avrebbero riempito esattamente il buco che stavi cercando di tappare." },
      { quando: (c) => !c.letti.has("M5"), testo: "Hai lasciato la Filarmonica fuori dalla serata. Con ventitré elementi poteva fare quattro pezzi già eseguiti l'anno scorso. Il direttore non l'aveva proposto perché si vergognava: bastava chiederglielo." },
      { quando: (c) => !c.letti.has("M12"), testo: "Nel 2019 la gente non si arrabbiò per il cambio di programma: si arrabbiò per averlo scoperto in piazza. Era un precedente che non hai chiesto." },
      { quando: (c) => c.alloc !== undefined && c.letti.has("M12") && speso(c, "ringraziamento") === 0, testo: "Sapevi del 2019, ma non hai lasciato un minuto per spiegare al pubblico cosa stava succedendo: è esattamente quello che due anni fa fece arrabbiare la gente." },
      // Legge i RUOLI (io/altri), non i compiti→persona della 10. Prima passava
      // da `assegnatoA`, cioè dal campo `assegnazioni`: funzionava solo perché
      // in questa missione lo step dei ruoli si chiama `s3_ruoli` come quello
      // della 10. Spostando i ruoli alla Stanza 4 avrebbe smesso di scattare in
      // silenzio. Ora chiede la cosa che intende.
      { quando: (c) => presoDaTe(c, "direttore"), testo: "Hai preso su di te il compito più scomodo della serata: convincere un uomo che si vergognava a salire lo stesso." },
    ],
  },

  "classe-partecipa": {
    costruito: (mandato, topVoce) =>
      `Hai deciso di muoverti così: ${mandato.label} — ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Delle nove giornate, la fetta più grande l'hai messa su «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "faccio_da_solo") && !c.letti.has("M8"), testo: "Hai deciso di finire la guida per conto tuo. È la scelta più generosa della missione e avrebbe funzionato: la guida sarebbe uscita. Ma la valutazione era sul contributo di ciascuno, e chi fa tutto lascia gli altri senza contributo — compreso sé stesso. L'anno scorso era già andata così." },
      { quando: (c) => facciataTenuta(c, "faccio_da_solo") && c.letti.has("M8"), testo: "Hai scelto di fare tutto per conto tuo anche sapendo, dalla nota della prof che avevi letto, che così lasci gli altri senza un contributo da valutare — e abbassi anche il tuo voto." },
      { quando: (c) => !c.letti.has("M4"), testo: "In quel gruppo c'era una persona che parla tre lingue e non ha mai scritto un messaggio in chat. Non per disinteresse: per paura di sbagliare a scrivere in italiano davanti agli altri. Le traduzioni sono uscite da un traduttore automatico mentre lui era seduto lì." },
      { quando: (c) => !c.letti.has("M5"), testo: "Elisa non si era tirata indietro: assisteva sua nonna tutti i pomeriggi. Poteva lavorare la mattina da casa, e nessuno gliel'ha chiesto." },
      { quando: (c) => !c.letti.has("M6"), testo: "La frase di Tommaso non veniva dal nulla: l'anno prima aveva fatto quasi tutto il lavoro e il voto era stato uguale per tutti. Era memoria, non altro." },
      { quando: (c) => !c.letti.has("M11"), testo: "Undici idee in tre settimane, tutte accolte con «bella idea» e nessuna scelta. Due erano ottime. Non serviva frenare nessuno: serviva che qualcuno decidesse." },
      { quando: (c) => abbinamentiBuoni(c) >= 2, testo: "Hai dato le traduzioni a chi le sapeva fare, un compito con confini a chi si blocca sulle cose vaghe, un lavoro da fare la mattina a chi poteva solo così. Sono cose che nessuno aveva pensato di fare in tre settimane." },
    ],
  },

  "viaggio-impossibile": {
    costruito: (mandato, topVoce) =>
      `Hai scelto il criterio ${mandato.label} — ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Nel piano, la voce su cui hai speso di più è «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "chiedi_nadir") && !(c.letti.has("M10") || c.letti.has("M12")), testo: "Hai chiesto a Nadir se preferiva non venire. Lo aveva detto due volte lui per primo, quindi sembrava la cosa più rispettosa. Due anni fa un altro studente in sedia a rotelle «scelse di non partecipare», e nella relazione c'è scritto che l'ostello non era accessibile e nessuno gliel'aveva detto. Chiedere a qualcuno se vuole restare fuori non è chiederglielo: è dirglielo." },
      { quando: (c) => facciataTenuta(c, "chiedi_nadir") && (c.letti.has("M10") || c.letti.has("M12")), testo: "Hai chiesto a Nadir se preferiva restare a casa anche sapendo — dalla normativa o dal precedente che avevi letto — che una barriera nota e non affrontata rende il viaggio non conforme, e che «per scelta sua» è la formula con cui due anni fa un altro studente restò escluso." },
      { quando: (c) => !c.letti.has("M8"), testo: "C'era un fondo d'istituto che copriva il 40% della quota, riservato, che nessuno in classe avrebbe saputo. Risolveva la situazione di Marco senza che lui dovesse dire niente a nessuno. Quest'anno non l'ha chiesto nessuno perché nessuno sapeva che esistesse." },
      { quando: (c) => !c.letti.has("M13"), testo: "Con un accompagnatore in più l'agenzia faceva quattro euro di sconto a testa: ottantotto euro, quasi metà dell'ostello accessibile. Bastava chiederlo." },
      { quando: (c) => !c.letti.has("M6"), testo: "Il viaggio non costava centosettantotto euro: ne costava più di duecento, contando i pasti. Marco arrivava a centocinquanta." },
      { quando: (c) => c.pianoSel !== undefined && c.letti.has("M4") && !nelPiano(c, "ostello_accessibile"), testo: "Hai speso il margine per rendere il viaggio più bello, e l'ostello accessibile è rimasto fuori: sarebbero partiti in venti su ventidue." },
      { quando: (c) => nelPiano(c, "ostello_accessibile") && (nelPiano(c, "treno_gruppo") || nelPiano(c, "treno_singolo")), testo: "Sono partiti in ventidue. Non era scontato: bisognava sapere dello sconto, del fondo e dell'ostello, e nessuna di queste tre cose era scritta nel preventivo." },
    ],
  },

  "museo-seta": {
    costruito: (mandato, topVoce) =>
      `Hai deciso di reinventare il museo ${mandato.label} — ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Nel tuo piano, la voce più impegnativa è stata «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "mostra_itinerante") && !c.letti.has("M4"), testo: "Hai tenuto la mostra itinerante nelle scuole. Quei tessuti tollerano 50 lux e tre mesi di luce l'anno: spostarli e illuminarli li rovina, e il restauro costerebbe più dell'intero budget. Stava in una nota di conservazione che non hai aperto." },
      { quando: (c) => facciataTenuta(c, "mostra_itinerante") && c.letti.has("M4"), testo: "Hai tenuto la mostra itinerante anche sapendo, dalla nota di conservazione che avevi letto, che alla luce e in movimento quei tessuti si rovinano. La cosa più generosa sul tavolo era anche l'unica irreversibile." },
      { quando: (c) => c.pianoSel !== undefined && nelPiano(c, "fmt_evento") && !["fmt_podcast", "fmt_video", "fmt_pannelli", "fmt_schermi", "fmt_laboratorio"].some((id) => nelPiano(c, id)), testo: "Hai puntato su un evento di una sola sera. Il bando chiede un'iniziativa ripetibile senza nuovi fondi: un colpo a effetto non è rendicontabile, e l'anno dopo non resta niente da mostrare." },
      { quando: (c) => c.pianoSel !== undefined && nelPiano(c, "fmt_schermi") && !c.letti.has("M12"), testo: "Hai puntato sugli schermi senza conoscere il precedente del museo vicino: +180% il primo anno, poi sotto i numeri di partenza quando si guastarono e nessuno aveva i fondi per ripararli. Era un precedente che non hai chiesto." },
      { quando: (c) => c.letti.has("M13") && c.pianoSel !== undefined && !nelPiano(c, "accessibilita_sala3"), testo: "La Sala 3, quella che contiene il registro del 1911, è al primo piano senza ascensore. Il bando premiava l'accessibilità e tu l'hai lasciata fuori dal piano: chi non fa le scale non arriva al pezzo che vale più di tutti." },
      // Terza della famiglia che scattava sulla sola lettura (con la 08 e la 05).
      // L'atto qui è il RUOLO: «Far conoscere l'iniziativa», preso o lasciato.
      // Il piano non andava bene come aggancio — si sovrapponeva alla cornice
      // sull'evento di una sera, e due cornici che dicono quasi la stessa cosa
      // sono rumore che si nota subito.
      //
      // In B non si dice che l'indagine «conferma» la scelta: attribuirebbe allo
      // studente un ragionamento che può non aver fatto — magari quel ruolo l'ha
      // lasciato perché non se la sentiva. Si riporta cosa dice l'indagine e cosa
      // ha scelto lui; il collegamento lo fa lui.
      { quando: (c) => presoDaTe(c, "comunicazione") && c.letti.has("M8"), testo: "Hai preso su di te il far conoscere l'iniziativa. L'indagine che avevi aperto dice che solo il 27% non torna per come comunicate, mentre il 44% non torna perché l'ha già visto da bambino: il lavoro più grosso non era farlo sapere, era dare un motivo nuovo per rientrare." },
      { quando: (c) => !presoDaTe(c, "comunicazione") && c.letti.has("M8"), testo: "Hai lasciato ad altri il far conoscere l'iniziativa. L'indagine che avevi aperto dice che solo il 27% non torna per come comunicate, mentre il 44% non torna perché l'ha già visto da bambino: il pezzo che pesava di più non era quello." },
      // E il caso di chi l'indagine non l'ha aperta: stessa famiglia delle
      // ventidue negative, l'atto è il non aver chiesto. È lo studente che ne ha
      // più bisogno — senza questa cornice, chi salta l'indagine non sente mai
      // il fatto più grosso della missione.
      { quando: (c) => !c.letti.has("M8"), testo: "C'era un'indagine sui visitatori che nessuno aveva più aperto: solo il 27% non torna per come comunicate, mentre il 44% non torna perché l'ha già visto da bambino. Il problema non era farsi sentire: era dare un motivo nuovo per rientrare, e quel numero non l'hai chiesto." },
    ],
  },

  "citta-acqua": {
    costruito: (mandato, topVoce) =>
      `Hai letto l'emergenza così: ${mandato.label} — ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Nel pacchetto di misure, quella che pesa di più è «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "chiusura_notturna") && !c.letti.has("M6"), testo: "Hai tenuto la chiusura della rete di notte, uguale per tutti. Ma a San Rocco l'82% degli alloggi non ha un serbatoio: la chiusura la pagano solo loro, mentre a Colline chi ha l'accumulo non se ne accorge. Stava in uno studio che non hai aperto." },
      { quando: (c) => facciataTenuta(c, "chiusura_notturna") && c.letti.has("M6"), testo: "Hai tenuto la chiusura notturna «uguale per tutti» anche sapendo, dallo studio sui serbatoi che avevi letto, che a San Rocco l'82% resta a secco mentre Colline non se ne accorge. «Uguale per tutti» non vuol dire equo." },
      { quando: (c) => c.pianoSel !== undefined && nelPiano(c, "tariffa"), testo: "Hai contato sulla tariffa progressiva, ma entra in vigore fra tre mesi: a emergenza finita. Serviva qualcosa che valesse da subito, non a ottobre." },
      { quando: (c) => !c.letti.has("M4"), testo: "La perdita reale della rete era al 22%, non al 6% della stima del 2019: più di un quinto dell'acqua non arrivava a nessuno. Il rilievo era di giugno, mai pubblicato, e non l'hai chiesto." },
      { quando: (c) => c.pianoSel !== undefined && c.letti.has("M8") && !nelPiano(c, "consumi_pubblici"), testo: "Sapevi, dal dettaglio sugli edifici pubblici, che scuole vuote, piscina chiusa e fontane accese sprecavano un 5% a costo zero e senza colpire nessuno — e non l'hai messo nel pacchetto." },
      { quando: (c) => !c.letti.has("M8"), testo: "C'era un 5% che usciva per nessuno — scuole vuote con l'irrigazione accesa, piscina chiusa col ricircolo attivo, fontane. Risparmio immediato, a costo zero, senza toccare un cittadino. Era in un dettaglio che non hai chiesto." },
      // Tre cornici al posto di una, e il silenzio come quarto caso. La versione
      // precedente scattava sulla SOLA lettura di M7: non guardava nessuna
      // scelta, quindi commentava un atto che poteva non esserci — e letta di
      // seguito suonava come un rimprovero per una cosa mai fatta. Qui l'atto è
      // in apertura, come nelle altre cornici della missione.
      //
      // Il quarto caso — il taglio né messo nel pacchetto né scartato, cioè
      // lasciato sul tavolo — non ha cornice di proposito: quello che resta in
      // tavola è già riportato dal compositore («Hai scartato: …»), e dire
      // qualcosa qui vorrebbe dire commentare una scelta non fatta.
      { quando: (c) => nelPiano(c, "taglio_agricolo") && c.letti.has("M7"), testo: "Hai messo il taglio dell'acqua agricola nel pacchetto anche sapendo, dal ciclo colturale che avevi letto, che dopo il 20 agosto il fabbisogno crolla dell'80%. Sono tre punti di risparmio chiesti a chi, a metà agosto, aveva quasi finito di irrigare." },
      { quando: (c) => nelPiano(c, "taglio_agricolo") && !c.letti.has("M7"), testo: "Hai messo il taglio dell'acqua agricola nel pacchetto. Dopo il 20 agosto il fabbisogno agricolo crolla dell'80%: erano tre punti chiesti a chi aveva quasi finito di irrigare. Era scritto in un documento che non hai aperto." },
      { quando: (c) => scartato(c, "taglio_agricolo") && c.letti.has("M7"), testo: "Hai scartato il taglio dell'acqua agricola. Il ciclo colturale che avevi letto diceva che dopo il 20 agosto il fabbisogno crolla dell'80%: quei tre punti li avresti chiesti a chi aveva quasi finito di irrigare." },
      // La quarta combinazione, che mancava: scartato SENZA aver letto. Le altre
      // tre c'erano (nel piano con e senza documento, scartato con documento) e
      // chi finiva qui non riceveva niente. Non è il silenzio del caso D — lì
      // non c'era nessun atto; qui l'atto c'è (ha scartato) e c'è l'omissione
      // (non ha aperto il ciclo colturale): sono i due ingredienti della
      // famiglia negativa che vale in tutte e undici le missioni.
      //
      // Non dice «hai fatto bene»: riporta l'atto, l'omissione e il fatto, e
      // lascia la conclusione a chi legge. Una frase che assolve sarebbe
      // l'unica di tutto il finale, e non serve — il ragionamento lo fa lo
      // studente meglio di noi.
      { quando: (c) => scartato(c, "taglio_agricolo") && !c.letti.has("M7"), testo: "Hai scartato il taglio dell'acqua agricola senza aprire il documento che lo riguardava: dopo il 20 agosto il fabbisogno crolla dell'80%, e sarebbero stati tre punti chiesti a chi aveva quasi finito di irrigare." },
    ],
  },
};

export function costruisciRestituzione(slug: string, get: LeggiRisposta, areeTop: AreaTop[]): Restituzione {
  const mandato = mandatoScelto(get);
  const letti = materialiLetti(get);
  const s3 = get("s3_budget") as (PayloadAlloca & PayloadLavori) | undefined;
  const alloc = s3?.allocazioni; // Stanza 3.1 alloca_budget (Missioni 01-03)
  const pianoSel = s3?.selezionati; // Stanza 3.1 pianifica_lavori (Missione 04)
  const scartati = (get("s3_scarto") as PayloadScarta | undefined)?.scartati;
  // Assegnazioni compito→persona (Missione 10: s3_ruoli è un assegna_persone).
  const assegnazioni = (get("s3_ruoli") as PayloadAssegnaPersone | undefined)?.assegnazioni;
  // I ruoli io/altri. L'id dello step cambia stanza da missione a missione
  // (`s3_ruoli` nella 02/03/08/09, `s4_ruoli` nella 01/04/…), e nella Missione
  // 10 lo stesso id `s3_ruoli` ospita un `assegna_persone`, che è un'altra cosa
  // (compito→PERSONA, non io/altri). Quindi lo step non si indovina dal
  // payload: si chiede alla missione risolta di quale tipo è. Così i due canali
  // restano distinti per costruzione invece che per euristica.
  const narr = NARRATIVA[slug];

  // Missione risolta: per leggere le voci del budget / i lavori del piano
  // (etichetta della fetta più grande) e i dossier della Stanza 2.
  const mission = getMissione(slug, get);
  const idStepRuoli = mission?.stanze.flatMap((st) => st.step).find((st) => st.tipo === "assegna_ruoli")?.id;
  const ruoli = idStepRuoli ? (get(idStepRuoli) as PayloadAssegna | undefined)?.assegnazioni : undefined;
  const stepBudget = mission?.stanze.flatMap((s) => s.step).find((s) => s.id === "s3_budget") as StepAllocaBudget | StepPianificaLavori | undefined;
  const stepDossier = mission?.stanze.flatMap((s) => s.step).find((s) => s.id === "s2_informazioni") as StepSelezionaInformazioni | undefined;

  // ── 1. Cosa hai costruito
  let costruito: string | null = null;
  if (mandato && narr) {
    let topLabel: string | null = null;
    let topVal = 0;
    if (stepBudget?.tipo === "alloca_budget") {
      for (const v of stepBudget.voci) {
        const a = Number(alloc?.[v.id]) || 0;
        if (a > topVal) { topVal = a; topLabel = v.label.toLowerCase(); }
      }
    } else if (stepBudget?.tipo === "pianifica_lavori") {
      // A tetto (Missioni 04/06/07): la voce "più grande" è la più costosa. A
      // obiettivo (Missione 08: barra che si riempie), i costi sono quasi tutti
      // zero — la voce che pesa è quella che fa risparmiare di più.
      const fill = stepBudget.obiettivo !== undefined;
      for (const l of stepBudget.lavori) {
        if (!(pianoSel?.includes(l.id) ?? false)) continue;
        const grandezza = fill ? (l.risparmio ?? 0) : l.costo;
        if (grandezza > topVal) { topVal = grandezza; topLabel = l.label.toLowerCase(); }
      }
    }
    costruito = narr.costruito(mandato, topLabel);
  }

  // ── 2. Come hai deciso (focalizzazione vs esplorazione)
  let metodo: string | null = null;
  const selezionati = (get("s2_informazioni") as PayloadSeleziona | undefined)?.selezionati ?? [];
  if (mandato && selezionati.length > 0 && stepDossier) {
    const areeMandato = new Set(mandato.aree);
    const areeToccate = new Set<string>();
    let dentroMandato = 0;
    for (const id of selezionati) {
      const m = stepDossier.dossier.find((d) => d.id === id);
      if (!m) continue;
      m.aree.forEach((a) => areeToccate.add(a));
      if (m.aree.some((a) => areeMandato.has(a))) dentroMandato++;
    }
    // Tre rami paralleli, stessa lunghezza e stesso registro: se uno suonasse
    // più caldo, lo studente capirebbe di aver preso «quello buono» e sarebbe
    // di nuovo un giudizio. Riportano solo dove ha speso gli approfondimenti.
    if (dentroMandato === selezionati.length) {
      metodo = `I ${selezionati.length} approfondimenti che hai speso erano tutti dentro il campo del tuo mandato.`;
    } else if (areeToccate.size >= 4) {
      metodo = `Hai distribuito gli approfondimenti su ${areeToccate.size} aree diverse prima di impegnarti.`;
    } else {
      metodo = "Hai speso qualche approfondimento dentro il campo del tuo mandato e qualcuno fuori.";
    }
  }

  // ── 3. Le occasioni (conseguenze)
  const occasioni: string[] = [];
  if (narr) {
    const ctx: OccasioneCtx = { letti, alloc, pianoSel, scartati, assegnazioni, ruoli, mandato };
    for (const r of narr.occasioni) if (r.quando(ctx)) occasioni.push(r.testo);
  }

  // ── 4. Le ipotesi
  let ipotesi: string | null = null;
  if (areeTop.length > 0) {
    const nomi = areeTop.slice(0, 3).map((a) => a.nome);
    // La provenienza dichiarata deve essere quella VERA. La classifica non esce
    // da questa partita: `areeTop` viene da `area_signal`, che è il profilo
    // cumulativo su tutte le missioni e tutti i test. La frase di prima («da
    // come hai messo in ordine le priorità e da dove hai messo le risorse»)
    // attribuiva alla partita un ordinamento che è del profilo — un «afferma»
    // dentro il blocco che deve «riportare».
    //
    // Non si cambia la fonte: le card sono cumulative per natura (gli stati
    // «emergente»/«da verificare» lo sono), si cambia la frase. E per chi è alla
    // prima missione resta vera lo stesso.
    ipotesi = `Mettendo insieme questa missione e quelle che hai già fatto, le aree con più segnale sono ${elenco(nomi)}. È un'ipotesi, non un verdetto: serve un'altra missione per capire se regge.`;
  }

  // ── nota da_verificare (autoefficacia≠performance)
  let notaVerifica: string | null = null;
  const daVerificare = areeTop.find((a) => a.status === "da_verificare");
  if (daVerificare) {
    notaVerifica = `Su ${daVerificare.nome} c'è un segnale interessante: la fiducia che avevi prima di scrivere e come te la sei cavata davvero non vanno nella stessa direzione. Vale la pena controllare se ti succede spesso — a volte ci si sottovaluta.`;
  }

  return { costruito, metodo, occasioni, ipotesi, notaVerifica };
}
