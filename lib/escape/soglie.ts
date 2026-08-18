// KIREO Escape — soglie di display, tarabili in un punto solo (come TOP_N_AFFINITA).

// Numero minimo di AZIONI distinte (area_signal.azioni_distinte) perché un'area
// meriti una card piena nell'esito. Sotto questa soglia l'area è «sfiorata» e va
// nell'elenco, non fra le card: la sua presenza nel profilo nasce da troppo poco.
//
// ⚠️ PROVVISORIO, NON TARATO. Prima ipotesi, non una soglia validata sui dati.
// Con studenti veri ci saranno aree a 2 azioni, e potremmo scoprire che 2 è
// ancora poco per una card piena — o abbastanza. Rivedere quando il campione è
// significativo, non prima. Finché è così, non trattarlo come una soglia solida.
export const MIN_AZIONI_PER_CARD = 2;
