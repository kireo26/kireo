// KIREO — Etichettatura di STILE delle opzioni delle 11 missioni (Fase 2).
//
// Le missioni osservano GIÀ i comportamenti che i 4 assi descrivono: qui si
// aggiunge solo il tag, ACCANTO alle aree (che restano dove sono). Nessuna
// logica di gioco nuova, nessuna AI.
//
// PRINCIPIO NON NEGOZIABILE (correzioni di Mario): si tagga SOLO dove il segnale
// è genuino — scegliere quella cosa è davvero muoversi da analitico/relazionale/
// creativo/operativo. Mai un tag inventato per far tornare un numero. Le aree
// possono essere sbilanciate per missione; gli assi no, ma il vincolo vero è
// sull'INSIEME delle 11 missioni (test di roster: nessun asse > 1,5× il più
// basso), non sulla singola (dove lo squilibrio onesto è ammesso e solo
// segnalato). Due sorgenti d'asse sono UNIFORMI e non stanno in questa mappa:
//  - consultare una persona (le consulenze) → relazionale (in consulenza());
//  - comporre un piano che sta nei vincoli → operativo (dalla performance del
//    budget/piano, dipende dalla qualità del piano non dall'aver compilato).
// Anche l'ordinamento per affidabilità (03, 08) → analitico è comportamentale
// (dipende da quanto bene ordini), non un tag qui.
//
// La mappa è per-tipo-di-step perché gli id si riusano tra tipi diversi nella
// stessa missione (es. in 04 «accessibilita» è mandato, lavoro, scarto e passo).

import type { AsseStile, TagAsse } from "./tipi";

const T = (asse: AsseStile, valore: number): TagAsse[] => [{ asse, valore }];
const A = (v: number) => T("analitico", v);
const R = (v: number) => T("relazionale", v);
const C = (v: number) => T("creativo", v);
const O = (v: number) => T("operativo", v);

type Tag = Record<string, TagAsse[]>;
type MissioneAssi = {
  mandati?: Tag;
  materiali?: Tag;
  voci?: Tag;
  lavori?: Tag;
  ruoli?: Tag;
  compiti?: Tag;
  scarto?: Tag;
  passi?: Tag;
};

export const ASSI_MISSIONI: Record<string, MissioneAssi> = {
  // ── 01 · Il progetto per il quartiere
  "progetto-quartiere": {
    mandati: { educativo: R(0.8), economico: A(0.8), ambientale: O(0.8), creativo: C(0.9), comunita: R(0.7) },
    materiali: { M4: A(0.6), M5: A(0.6), M7: A(0.6), M9: A(0.5), M8: R(0.6), M12: R(0.5), M13: R(0.5) },
    voci: { tetto: O(0.6), impianti: O(0.5), adeguamento_vincolo: A(0.5), comunicazione: R(0.6), orto: C(0.85), accessibilita: R(0.5), fondo_gestione: A(0.6), fotovoltaico: O(0.5) },
    ruoli: { conti: A(0.6), scuole: R(0.6), lavori: O(0.6), raccontare: R(0.6), giornate: O(0.5) },
    scarto: { spazio_flessibile: C(0.8), insegna_effetto: C(0.6) },
    passi: { sicurezza: O(0.5), convenzione: O(0.5), lavori: O(0.5), coordinatore: R(0.5), quartiere: R(0.5), attivita: C(0.7), fondi: A(0.5) },
  },
  // ── 02 · La crisi della comunicazione
  "crisi-mediateca": {
    mandati: { trasparenza: A(0.7), ascolto: R(0.8), diritti: A(0.8), identita: C(0.85), convivenza: C(0.85) },
    materiali: { M4: A(0.6), M5: A(0.6), M7: A(0.6), M10: A(0.5), M6: R(0.6), M8: R(0.6), M11: R(0.5), M9: C(0.7) },
    voci: { verificare_fatti: A(0.7), pubblicare_risposta: R(0.6), incontrare_gruppi: R(0.6), rispondere_associazione: R(0.5), rivedere_spazi: C(0.9), concordare_comune: O(0.5), scrivere_regole: O(0.6), informare_personale: R(0.6) },
    ruoli: { stampa: R(0.6), comune: O(0.5), studenti: R(0.6), testo: C(0.6), regolamento: A(0.6) },
    scarto: { rispondere_ognuno: R(0.4) },
    passi: { assoc: R(0.5), regolamento: A(0.5), bilancio: A(0.5), utenti: R(0.5), personale: R(0.5), comunicazione_interna: C(0.6), monitorare: A(0.5) },
  },
  // ── 03 · Il prototipo che non funziona (M5/M9 → analitico: sono dati)
  "guasto-serra": {
    mandati: { sensori: A(0.8), software: A(0.8), idraulica: O(0.8), energia: O(0.8), progetto: C(0.9) },
    materiali: { M4: A(0.6), M7: A(0.6), M12: A(0.6), M5: A(0.6), M9: A(0.6), M6: O(0.6), M10: O(0.6), M13: O(0.6), M8: R(0.5), M11: R(0.5) },
    voci: { tarare_sensori: A(0.7), leggere_codice: A(0.7), misurare_acqua: A(0.7), ripetere_prova: A(0.6), controllare_valvola: O(0.6), correggere_registrazione: O(0.6), spostare_orario: C(0.8), preparare_spiegazione: R(0.7) },
    ruoli: { misurare: A(0.6), codice: A(0.6), registro: A(0.6), smontare: O(0.6), spiegare: R(0.7) },
    scarto: { innaffiare_mano: O(0.4), spostare_piante: C(0.7) },
    passi: { tarare: A(0.5), flusso: A(0.5), fabbisogno: A(0.5), valvola: O(0.5), collaudo: O(0.5), allarme: O(0.5), montaggio: O(0.5), orari: C(0.7) },
  },
  // ── 04 · Il cantiere della scuola (operativo di natura; creativo scarso e onesto)
  "cantiere-scuola": {
    mandati: { sicurezza: O(0.8), acqua: O(0.7), elettrico: A(0.7), gioco: C(0.9), accessibilita: R(0.8) },
    materiali: { M4: A(0.6), M5: A(0.6), M7: A(0.6), M9: R(0.6), M10: O(0.6), M13: O(0.6) },
    lavori: { elettrico: O(0.6), copertura: O(0.6), controsoffitto: O(0.5), parquet: O(0.5), pvc: O(0.4), pompa_calore: O(0.5), accessibilita: R(0.6), fondo_imprevisti: A(0.5), seconda_squadra: C(0.85) },
    ruoli: { ditta: O(0.6), conti: A(0.6), sicurezza: O(0.6), materiali: O(0.5), famiglie: R(0.6) },
    scarto: { pompa_calore: O(0.4) },
    passi: { accessibilita: R(0.5), caldaia: O(0.5), pavimento: O(0.5), registro: A(0.5), controlli: A(0.5), formazione: R(0.5), sensori: A(0.5), documentare: O(0.5) },
  },
  // ── 05 · Il pronto soccorso organizzativo (persone/cura; creativo genuinamente assente)
  "sportello-insieme": {
    mandati: { scadenza: O(0.8), sofferenza: R(0.9), minori: A(0.7), rischio: A(0.7), trascurato: R(0.8) },
    materiali: { M4: A(0.6), M5: A(0.6), M7: A(0.5), M8: R(0.5), M9: R(0.6), M10: R(0.5), M13: R(0.5) },
    voci: { ascolto_colella: R(0.7), spiega_colella: R(0.6), compila_kaur: A(0.6), protocolla_kaur: O(0.6), richiama_muratori: R(0.5), trasmetti_segnalazione: O(0.6), rispondi_mail: R(0.6), registra_contatti: A(0.5), data_per_ciascuno: R(0.6) },
    ruoli: { colella: R(0.6), kaur: A(0.6), muratori: R(0.5), segnalazione: O(0.6), mail: R(0.6) },
    scarto: { segnalazione_qui: O(0.3), traduce_figlio: C(0.6) },
    passi: { colella_esito: R(0.5), kaur_verifica: A(0.5), muratori_chiudi: R(0.5), sociale_alunno: R(0.5), canale_mail: O(0.5), procedura_anonime: A(0.5), segnala_ferme: O(0.5), mediazione: R(0.5) },
  },
  // ── 06 · La filiera trasparente (dati + comporre)
  "filiera-borea": {
    mandati: { materiale: A(0.8), trasporti: A(0.7), prodotto: C(0.9), finevita: C(0.85), racconto: R(0.8) },
    materiali: { M4: A(0.6), M5: A(0.6), M7: A(0.6), M10: A(0.6), M12: O(0.6), M13: R(0.5) },
    lavori: { tessuto_alfa: A(0.5), tessuto_beta: A(0.5), accessori_europei: C(0.8), smontabile: C(0.9), sacchetto: O(0.4), test_resistenza: A(0.5), documentazione: A(0.6), fondo_imprevisti: A(0.4) },
    ruoli: { fornitori: R(0.6), macchine: O(0.5), documentazione: A(0.6), etichetta: R(0.6), test: A(0.6) },
    scarto: { smontabile_comunica: C(0.7) },
    passi: { certifica_italiano: A(0.5), misura_impatto: A(0.5), progetta_smontabile: C(0.8), ritiro_vecchi: O(0.5), spedizioni: O(0.5), durata_scuole: R(0.4), forma_commerciale: O(0.5), pubblica_dati: A(0.5) },
  },
  // ── 07 · Il museo da reinventare (creativo + relazionale)
  "museo-seta": {
    mandati: { residenti: C(0.85), scuole: R(0.7), turisti: O(0.7), esclusi: C(0.85), conservazione: A(0.8) },
    materiali: { M4: A(0.6), M5: A(0.6), M7: A(0.6), M8: A(0.6), M9: R(0.6), M11: R(0.6), M10: C(0.8) },
    lavori: { fmt_podcast: C(0.8), fmt_video: C(0.8), fmt_pannelli: A(0.5), fmt_schermi: O(0.5), fmt_evento: C(0.8), fmt_laboratorio: C(0.85), guida_didattica: R(0.5), traduzioni: R(0.5), sicurezza_telai: O(0.5), digitalizza_registro: A(0.5), accessibilita_sala3: R(0.5), comunicazione_lancio: R(0.5) },
    ruoli: { scuole: R(0.6), contenuti: A(0.6), budget: A(0.6), comunicazione: R(0.6), laboratori: C(0.8) },
    scarto: { podcast_operaie: C(0.7), laboratorio_telai: C(0.7) },
    passi: { formare_volontari: R(0.5), digitalizzare_registro: A(0.5), cercare_discendenti: C(0.6), aprire_sera: C(0.7), misurare_ritorni: A(0.5), ascensore: O(0.5), associazione: R(0.5), bando_grande: O(0.5) },
  },
  // ── 08 · La città senz'acqua (dati; squilibrio analitico onesto)
  "citta-acqua": {
    mandati: { perdite: A(0.8), usofuori: A(0.7), chipaga: R(0.8), misurare: A(0.8), pernessuno: C(0.85) },
    materiali: { M4: A(0.6), M5: A(0.6), M6: A(0.6), M8: A(0.6), M12: O(0.6), M13: R(0.6) },
    lavori: { riparazione: O(0.6), divieto_irrigazione: O(0.5), chiusura_notturna: O(0.4), consumi_pubblici: C(0.85), taglio_agricolo: O(0.4), campagna: R(0.5), tariffa: A(0.5) },
    ruoli: { cantieri: O(0.6), cittadini: R(0.6), controlli: A(0.6), dati: A(0.6), sanitarie: R(0.6) },
    scarto: { rinviare: A(0.3) },
    passi: { mappatura_perdite: A(0.5), sostituire_condotte: O(0.5), misuratori_permanenti: A(0.5), incentivare_serbatoi: O(0.5), rivedere_tariffa: A(0.5), alberi: C(0.85), censire_sanitarie: R(0.5), pubblica_dati: A(0.5) },
  },
  // ── 09 · Il palco cambia programma (creativo/relazionale/operativo)
  "palco-programma": {
    mandati: { serata_comunque: O(0.7), filarmonica_sale: R(0.7), entrano_ragazzi: C(0.9), finisca_bene: A(0.7), diciamo_subito: R(0.7) },
    materiali: { M4: A(0.6), M7: A(0.5), M8: A(0.5), M6: C(0.8), M9: C(0.7), M10: R(0.5), M12: R(0.5), M11: O(0.5) },
    voci: { banda: O(0.4), teatro: R(0.4), teatro_esteso: C(0.7), filarmonica_ridotta: R(0.6), filarmonica_completa: A(0.3), coro_centro: C(0.9), intervallo: O(0.4), ringraziamento: R(0.6), fuochi: O(0.3) },
    ruoli: { avvisare: R(0.6), direttore: R(0.7), ragazzi: C(0.75), tempi: O(0.6), pioggia: O(0.6) },
    scarto: { coro_idea: C(0.85), filarmonica_ridotta_idea: R(0.5) },
    passi: { piano_b: A(0.5), coinvolgere_centro: C(0.7), programma_flessibile: C(0.7), piano_pioggia_veri: A(0.5), piu_volontari: R(0.5), fondo_imprevisti: A(0.5), procedura_annunci: R(0.5) },
  },
  // ── 10 · La classe che non partecipa (relazionale)
  "classe-partecipa": {
    mandati: { capire_perche: R(0.9), compito_preciso: O(0.7), sistemo_lavoro: O(0.7), far_parlare: R(0.8), mettere_regole: A(0.6) },
    materiali: { M4: R(0.7), M5: R(0.7), M6: R(0.6), M9: R(0.6), M10: R(0.6), M7: A(0.6), M8: A(0.5), M11: C(0.85), M12: O(0.5) },
    voci: { verificare_indirizzi: A(0.6), scrivere_testi: A(0.5), fare_mappa: C(0.75), curare_traduzioni: R(0.5), impaginare: O(0.5), parlare_uno_a_uno: R(0.7), rifare_piano: O(0.6), scegliere_idee: C(0.85), compito_elisa: R(0.6) },
    compiti: { indirizzi: A(0.5), testi: A(0.5), mappa: C(0.7), traduzioni: R(0.5), impaginazione: O(0.5) },
    scarto: { parlare_spariti: R(0.5), compiti_scritti: O(0.5) },
    passi: { chiedere_cosa_sa: R(0.5), scadenze_intermedie: O(0.5), scrivere_compiti: O(0.5), modo_partecipare: C(0.75), poche_idee: C(0.8), verificare_fonti: A(0.5), quattrocchi: R(0.5), chiedere_prof: R(0.4) },
  },
  // ── 11 · Il viaggio impossibile (relazionale + operativo)
  "viaggio-impossibile": {
    mandati: { nessuno_resta: R(0.9), viaggio_bello: C(0.85), nessuno_spende: A(0.7), prima_chiediamo: R(0.8), tornare_conti: O(0.7) },
    materiali: { M4: A(0.6), M6: A(0.6), M10: A(0.6), M7: R(0.7), M12: R(0.6), M5: O(0.6), M13: O(0.6) },
    lavori: { ostello_accessibile: R(0.6), treno_gruppo: O(0.5), treno_singolo: O(0.4), pasti_glutine: R(0.5), fondo_marco: R(0.6), secondo_ingresso: C(0.6), laboratorio: C(0.9), battello: C(0.85), fondo_imprevisti: A(0.5) },
    ruoli: { agenzia: O(0.6), fondo: A(0.6), pasti: R(0.5), nadir: R(0.7), conti: A(0.6) },
    scarto: { accompagnatore: A(0.5), rinuncia_ingresso: R(0.5) },
    passi: { esigenze_prima: R(0.5), fondo_a_tutti: R(0.5), verificare_accessibilita: A(0.5), pasti_preventivo: A(0.5), margine_imprevisti: A(0.5), strutture_accessibili: R(0.5), esigenze_riservato: R(0.5), raccontare: R(0.4) },
  },
};
