import { T, righeMostrate, etichettaArea, etichettaAnnoDiploma, etichettaIndirizzo, etichettaProvincia } from "@/lib/ente/statistiche";
import { caricaStatisticheEnte } from "@/lib/ente/caricaStatistiche";
import { NonLetto, Riquadro, Tabella, TestaSezione } from "@/components/ente/statistiche/Parti";

// La sezione Studenti: solo aggregato. La soglia di anonimato la applica
// `statistiche_ente`: qui un gruppo sotto i 5 arriva già sommato in «Altri
// gruppi», quindi questa pagina non può mostrarlo per sbaglio. Solo account con
// ruolo studente; non scende, per questo «dall'inizio».
export default async function StatisticheStudentiPage() {
  const stats = await caricaStatisticheEnte();
  const oggi = new Date();
  return (
    <div className="space-y-8">
      <TestaSezione titolo={T.studenti.titolo} />
      {stats === null ? (
        <NonLetto />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Riquadro etichetta="Studenti raggiunti dall'inizio" valore={stats.studenti.totale} />
            <Riquadro etichetta="Nuovi questo mese" valore={stats.studenti.nuovi_mese} />
          </div>
          <p className="text-sm text-kireo-muted">{T.studenti.chi}</p>
          {stats.studenti.totale === 0 ? (
            <p className="text-sm text-kireo-muted">{T.studenti.nessuno}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Tabella titolo="Per area" nota={T.notaAree} righe={righeMostrate(stats.studenti.per_area, etichettaArea, stats.studenti.soglia)} />
              <Tabella titolo="Per anno di corso" righe={righeMostrate(stats.studenti.per_anno_diploma, etichettaAnnoDiploma(oggi), stats.studenti.soglia)} />
              <Tabella titolo="Per indirizzo" righe={righeMostrate(stats.studenti.per_indirizzo, etichettaIndirizzo, stats.studenti.soglia)} />
              <Tabella titolo="Per provincia" righe={righeMostrate(stats.studenti.per_provincia, etichettaProvincia, stats.studenti.soglia)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
