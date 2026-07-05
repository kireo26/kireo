// Le 16 aree di orientamento di KIREO. Contenuto centralizzato: menu,
// pagine /aree/[slug] e ogni altro punto del sito che le elenca leggono
// da qui, così i testi si aggiornano in un punto solo.

export type Area = {
  slug: string;
  nome: string;
  icona: string; // monogramma breve mostrato nel badge circolare
  descrizioneBreve: string; // una riga, usata nel mega-menu
  descrizioneEstesa: string; // 3-4 frasi, usata nell'hero della pagina area
  direzioni: string[]; // strade generiche post-diploma, senza nomi di enti
};

export const AREE: Area[] = [
  {
    slug: "informatica-digitale",
    nome: "Informatica & Digitale",
    icona: "{ }",
    descrizioneBreve: "Sviluppo, dati, cybersecurity, AI: i mestieri che costruiscono il mondo digitale.",
    descrizioneEstesa:
      "Il digitale attraversa ormai ogni settore: chi lavora qui progetta software, analizza dati, protegge sistemi o costruisce intelligenze artificiali. È un'area che premia la logica, la curiosità tecnica e la voglia di imparare in fretta, perché gli strumenti cambiano continuamente. Le competenze richieste vanno dalla programmazione alla gestione delle infrastrutture, fino all'analisi dei dati e alla sicurezza informatica.",
    direzioni: [
      "Corsi di laurea in informatica, ingegneria informatica o data science",
      "Percorsi ITS Academy per tecnico sviluppatore software o cybersecurity specialist",
      "Accademie e bootcamp di programmazione intensivi",
      "Corsi di formazione professionale su specifici linguaggi o strumenti",
      "Inserimento diretto in azienda come junior developer o tecnico IT, spesso tramite apprendistato",
    ],
  },
  {
    slug: "salute-professioni-sanitarie",
    nome: "Salute & Professioni sanitarie",
    icona: "+",
    descrizioneBreve: "Medicina, infermieristica, professioni sanitarie e del benessere.",
    descrizioneEstesa:
      "Le professioni della salute uniscono conoscenza scientifica e cura della persona: dalla medicina alle professioni sanitarie tecniche, fino alle attività di supporto al benessere psicofisico. È un'area adatta a chi ha sensibilità relazionale, tenuta emotiva e interesse per il corpo umano e la scienza applicata alla cura. Molti percorsi prevedono accesso programmato e una parte consistente di formazione pratica sul campo.",
    direzioni: [
      "Corsi di laurea in medicina, professioni sanitarie o scienze infermieristiche (spesso ad accesso programmato)",
      "Percorsi ITS Academy in ambito biomedicale o tecnologie sanitarie",
      "Scuole e corsi per professioni del benessere e dell'assistenza",
      "Corsi di formazione professionale per operatore socio-sanitario",
      "Inserimento diretto in strutture sanitarie o socio-assistenziali dopo qualifica specifica",
    ],
  },
  {
    slug: "ristorazione-turismo",
    nome: "Ristorazione & Turismo",
    icona: "RT",
    descrizioneBreve: "Cucina, ospitalità, accoglienza e valorizzazione del territorio.",
    descrizioneEstesa:
      "Ristorazione e turismo sono settori che vivono di relazione, precisione tecnica e conoscenza del territorio: dalla cucina alla sala, dall'accoglienza alla gestione di strutture ricettive. È un ambito che premia chi lavora bene sotto pressione, ha gusto estetico e sa mettere a proprio agio le persone. L'Italia, in particolare, offre uno sbocco naturale in questi settori grazie al patrimonio enogastronomico e culturale.",
    direzioni: [
      "Corsi di laurea in scienze del turismo, economia del turismo o scienze gastronomiche",
      "Percorsi ITS Academy in ambito turistico-alberghiero",
      "Accademie e scuole di alta cucina o ospitalità",
      "Corsi di formazione professionale per cuoco, sala-bar o operatore turistico",
      "Inserimento diretto in ristorazione, hotellerie o agenzie di viaggio",
    ],
  },
  {
    slug: "meccanica-meccatronica",
    nome: "Meccanica & Meccatronica",
    icona: "MM",
    descrizioneBreve: "Progettare, costruire e automatizzare: dall'officina all'industria 4.0.",
    descrizioneEstesa:
      "La meccanica e la meccatronica riguardano la progettazione, costruzione e manutenzione di macchine, veicoli e sistemi automatizzati. È un'area molto pratica e insieme tecnologicamente avanzata, dove il lavoro manuale si integra sempre più con sensori, robotica e software di controllo. Chi la sceglie ha spesso manualità, precisione e interesse per il funzionamento concreto delle cose.",
    direzioni: [
      "Corsi di laurea in ingegneria meccanica, meccatronica o automazione",
      "Percorsi ITS Academy per tecnico di automazione o manutenzione industriale",
      "Scuole tecniche specializzate in settori come l'automotive",
      "Corsi di formazione professionale per operatore meccanico o manutentore",
      "Inserimento diretto in officina o in produzione, spesso tramite apprendistato",
    ],
  },
  {
    slug: "agrifood-ambiente",
    nome: "Agri-food & Ambiente",
    icona: "AF",
    descrizioneBreve: "Agricoltura innovativa, filiera alimentare e tutela dell'ambiente.",
    descrizioneEstesa:
      "Questa area unisce la produzione agricola e alimentare alla cura dell'ambiente naturale, con un peso crescente di innovazione tecnologica e sostenibilità. Si va dalla coltivazione e allevamento alla trasformazione alimentare, fino al monitoraggio e alla tutela degli ecosistemi. È adatta a chi ha interesse per le scienze naturali e per un rapporto diretto con il territorio, oggi sempre più mediato da tecnologie precise.",
    direzioni: [
      "Corsi di laurea in scienze agrarie, scienze alimentari o scienze ambientali",
      "Percorsi ITS Academy in agrifood o gestione del territorio",
      "Scuole tecniche specializzate in enologia o trasformazione alimentare",
      "Corsi di formazione professionale per operatore agricolo o tecnico ambientale",
      "Inserimento diretto in aziende agricole, cooperative o enti di tutela ambientale",
    ],
  },
  {
    slug: "arte-design-moda",
    nome: "Arte, Design & Moda",
    icona: "AD",
    descrizioneBreve: "Creatività applicata: design, moda, arti visive e artigianato d'eccellenza.",
    descrizioneEstesa:
      "Arte, design e moda trasformano la creatività in oggetti, spazi e collezioni concrete: dal disegno di prodotto alla progettazione di abiti, dalle arti visive all'artigianato di alta qualità. È un'area che richiede sensibilità estetica, ma anche disciplina tecnica e capacità di lavorare dentro vincoli reali — materiali, costi, tempi. L'Italia ha una tradizione riconosciuta a livello internazionale in questi settori.",
    direzioni: [
      "Corsi di laurea in design, belle arti o discipline della moda",
      "Percorsi ITS Academy in design e moda made in Italy",
      "Accademie di belle arti, moda o design",
      "Corsi di formazione professionale per tecniche artigianali specifiche",
      "Inserimento diretto in atelier, studi di design o botteghe artigiane",
    ],
  },
  {
    slug: "musica-spettacolo",
    nome: "Musica & Spettacolo",
    icona: "MS",
    descrizioneBreve: "Palco, produzione, audiovisivo: le professioni della scena e dietro le quinte.",
    descrizioneEstesa:
      "Il mondo della musica e dello spettacolo comprende sia chi sta sul palco sia le tante professionalità che lo rendono possibile: regia, produzione, tecnica del suono e delle luci, audiovisivo. È un ambito competitivo che premia costanza, disciplina di studio e capacità di lavorare in squadra sotto scadenze precise, oltre al talento artistico.",
    direzioni: [
      "Corsi di laurea in DAMS, discipline musicali o cinema e audiovisivo",
      "Percorsi ITS Academy per tecnico audio-video o produzione dello spettacolo",
      "Conservatori, accademie di musica, teatro o cinema",
      "Corsi di formazione professionale per tecnico del suono, delle luci o di scena",
      "Inserimento diretto in produzioni, compagnie o studi di registrazione",
    ],
  },
  {
    slug: "energia-sostenibilita",
    nome: "Energia & Sostenibilità",
    icona: "EN",
    descrizioneBreve: "Rinnovabili, efficienza, transizione ecologica: l'energia di domani.",
    descrizioneEstesa:
      "Questa area riguarda la produzione, gestione ed efficientamento dell'energia, con un focus crescente sulle fonti rinnovabili e sulla transizione ecologica. Chi vi lavora si occupa di impianti, reti, materiali e tecnologie per ridurre l'impatto ambientale dei consumi energetici. È un settore in forte crescita, a cavallo tra ingegneria, tecnologia e sostenibilità.",
    direzioni: [
      "Corsi di laurea in ingegneria energetica, ambientale o delle fonti rinnovabili",
      "Percorsi ITS Academy in efficienza energetica e impianti da fonti rinnovabili",
      "Scuole tecniche specializzate in impiantistica",
      "Corsi di formazione professionale per installatore di impianti energetici",
      "Inserimento diretto in aziende energetiche o installazione impianti",
    ],
  },
  {
    slug: "edilizia-architettura",
    nome: "Edilizia & Architettura",
    icona: "EA",
    descrizioneBreve: "Progettare e costruire spazi: dal cantiere alla rigenerazione urbana.",
    descrizioneEstesa:
      "Edilizia e architettura riguardano la progettazione, costruzione e trasformazione degli spazi in cui viviamo, dagli edifici alle infrastrutture fino alla rigenerazione delle città. È un'area che combina creatività progettuale, competenze tecniche e conoscenza normativa, con un ruolo sempre più importante di sostenibilità e digitalizzazione del cantiere.",
    direzioni: [
      "Corsi di laurea in architettura, ingegneria civile o edile",
      "Percorsi ITS Academy in tecnologie per il costruire o gestione del cantiere",
      "Istituti tecnici superiori per geometra o tecniche di costruzione",
      "Corsi di formazione professionale per operatore edile specializzato",
      "Inserimento diretto in cantiere o studi tecnici, spesso tramite apprendistato",
    ],
  },
  {
    slug: "economia-management",
    nome: "Economia & Management",
    icona: "EM",
    descrizioneBreve: "Impresa, finanza, marketing e gestione: i numeri che muovono le idee.",
    descrizioneEstesa:
      "Economia e management riguardano il funzionamento di imprese, mercati e organizzazioni: dalla contabilità alla finanza, dal marketing alla gestione delle risorse. È un'area trasversale, utile in ogni settore, che premia il ragionamento analitico, la capacità di leggere i numeri e di tradurli in decisioni concrete.",
    direzioni: [
      "Corsi di laurea in economia, management o scienze bancarie e finanziarie",
      "Percorsi ITS Academy in gestione d'impresa, marketing o logistica",
      "Scuole di formazione manageriale e commerciale",
      "Corsi di formazione professionale per amministrazione e contabilità",
      "Inserimento diretto in azienda in ruoli amministrativi, commerciali o di segreteria",
    ],
  },
  {
    slug: "giurisprudenza-pa",
    nome: "Giurisprudenza & PA",
    icona: "GP",
    descrizioneBreve: "Diritto, giustizia e pubblica amministrazione: le regole della convivenza.",
    descrizioneEstesa:
      "Quest'area riguarda le regole che governano la convivenza civile: il diritto, la giustizia, l'amministrazione pubblica. Chi vi lavora interpreta norme, tutela diritti o gestisce servizi pubblici, con un ruolo che richiede rigore, capacità di analisi e attenzione al bene comune. È un ambito con molti sbocchi diversi, dal libero professionista al dipendente pubblico.",
    direzioni: [
      "Corsi di laurea in giurisprudenza, scienze politiche o servizi giuridici",
      "Percorsi ITS Academy in servizi per la pubblica amministrazione",
      "Scuole di formazione per concorsi pubblici",
      "Corsi di formazione professionale per operatore amministrativo",
      "Inserimento diretto nella pubblica amministrazione tramite concorso, dopo diploma o qualifica",
    ],
  },
  {
    slug: "mobilita-sostenibile",
    nome: "Mobilità Sostenibile",
    icona: "MB",
    descrizioneBreve: "Trasporti, logistica e nuova mobilità: muovere persone e merci, meglio.",
    descrizioneEstesa:
      "La mobilità sostenibile riguarda il trasporto di persone e merci ripensato in chiave più efficiente e meno impattante: dalla logistica ai nuovi mezzi elettrici, dalla gestione delle reti di trasporto alla pianificazione urbana. È un'area in trasformazione, che unisce competenze tecniche, organizzative e di innovazione.",
    direzioni: [
      "Corsi di laurea in ingegneria dei trasporti, logistica o mobilità sostenibile",
      "Percorsi ITS Academy in logistica e mobilità",
      "Scuole tecniche per la gestione di reti e sistemi di trasporto",
      "Corsi di formazione professionale per conducente professionale o operatore logistico",
      "Inserimento diretto in aziende di trasporto, logistica o spedizioni",
    ],
  },
  {
    slug: "scienze-educazione",
    nome: "Scienze dell'Educazione",
    icona: "SE",
    descrizioneBreve: "Insegnare, educare, accompagnare la crescita: le professioni della formazione.",
    descrizioneEstesa:
      "Le scienze dell'educazione riguardano l'accompagnamento alla crescita delle persone, in particolare bambini e ragazzi: insegnamento, pedagogia, educazione. È un'area che richiede pazienza, empatia e responsabilità, insieme a solide basi teoriche su come si apprende e si comunica. Molti percorsi richiedono un titolo abilitante specifico per l'insegnamento.",
    direzioni: [
      "Corsi di laurea in scienze della formazione primaria, pedagogia o scienze dell'educazione",
      "Percorsi ITS Academy in servizi educativi e formativi",
      "Scuole di formazione per educatori professionali",
      "Corsi di formazione professionale per assistenza educativa",
      "Inserimento diretto in servizi educativi per l'infanzia o attività di doposcuola",
    ],
  },
  {
    slug: "comunicazione-media",
    nome: "Comunicazione & Media",
    icona: "CM",
    descrizioneBreve: "Giornalismo, social, contenuti: raccontare il mondo con tutti i linguaggi.",
    descrizioneEstesa:
      "Comunicazione e media riguardano il racconto della realtà attraverso linguaggi diversi: scrittura, immagini, video, contenuti digitali. Dal giornalismo ai social media, dalla comunicazione d'impresa alla produzione di contenuti, è un'area in continua evoluzione che richiede curiosità, capacità di sintesi e padronanza degli strumenti digitali.",
    direzioni: [
      "Corsi di laurea in scienze della comunicazione, giornalismo o media digitali",
      "Percorsi ITS Academy in comunicazione digitale e social media",
      "Scuole di giornalismo o comunicazione",
      "Corsi di formazione professionale per content creator o social media management",
      "Inserimento diretto in redazioni, agenzie di comunicazione o uffici stampa",
    ],
  },
  {
    slug: "scienze-ricerca",
    nome: "Scienze & Ricerca",
    icona: "SR",
    descrizioneBreve: "Fisica, chimica, biologia, matematica: capire il mondo per cambiarlo.",
    descrizioneEstesa:
      "Le scienze di base — fisica, chimica, biologia, matematica — studiano i meccanismi fondamentali della natura e sono alla radice di gran parte dell'innovazione tecnologica. È un'area per chi ha curiosità analitica, rigore metodologico e piacere nel capire il «perché» delle cose prima ancora del «come si usa». Molti percorsi proseguono naturalmente verso la ricerca o l'insegnamento.",
    direzioni: [
      "Corsi di laurea in fisica, chimica, biologia, matematica o scienze naturali",
      "Percorsi ITS Academy in ambito biotecnologico o chimico-farmaceutico",
      "Scuole tecniche di laboratorio specializzate",
      "Corsi di formazione professionale per tecnico di laboratorio",
      "Inserimento diretto in laboratori di analisi o aziende del settore chimico-farmaceutico",
    ],
  },
  {
    slug: "sicurezza-difesa",
    nome: "Sicurezza & Difesa",
    icona: "SD",
    descrizioneBreve: "Forze armate, forze dell'ordine, protezione civile e sicurezza.",
    descrizioneEstesa:
      "Quest'area riguarda la tutela della sicurezza collettiva: forze armate, forze dell'ordine, protezione civile e sicurezza privata. Sono percorsi che richiedono disciplina, senso del dovere e tenuta fisica e psicologica, con un forte legame tra formazione tecnica e servizio alla comunità. Molti percorsi prevedono selezioni specifiche e concorsi pubblici.",
    direzioni: [
      "Corsi di laurea in scienze della sicurezza, scienze strategiche o giurisprudenza",
      "Accademie militari e scuole delle forze dell'ordine",
      "Percorsi ITS Academy in sicurezza e protezione civile",
      "Corsi di formazione professionale per operatore della sicurezza",
      "Arruolamento diretto nelle forze armate o nei corpi di polizia tramite concorso",
    ],
  },
];

export function getAreaBySlug(slug: string): Area | undefined {
  return AREE.find((a) => a.slug === slug);
}
