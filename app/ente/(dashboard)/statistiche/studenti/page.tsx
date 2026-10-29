import { T, presentaRipartizioni } from "@/lib/ente/statistiche";
import { caricaStatisticheEnte } from "@/lib/ente/caricaStatistiche";
import { NonLetto, Riquadro, Tabella, TestaSezione } from "@/components/ente/statistiche/Parti";

// La sezione Studenti: solo aggregato. La soglia di anonimato la applica
// `statistiche_ente`: qui un gruppo sotto i 5 arriva già sommato in `altre`,
// quindi questa pagina non può mostrarlo per sbaglio. Come si dice quello che
// la soglia nasconde lo decide `presentaRipartizioni` (una forma sola per
// tutti sotto, tutti sopra e misto). Solo account con
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
          <Ripartizioni p={presentaRipartizioni(stats.studenti, oggi)} />
        </>
      )}
    </div>
  );
}

function Ripartizioni({ p }: { p: ReturnType<typeof presentaRipartizioni> }) {
  if (p.tipo !== "gruppi") return <p className="rounded-2xl border border-white/5 bg-kireo-card p-4 text-sm text-kireo-muted">{p.testo}</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-kireo-muted">{p.ragione}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {p.mostrate.map((r) => (
          <Tabella key={r.chiave} titolo={r.titolo} nota={r.nota} righe={r.righe} resto={r.resto} />
        ))}
      </div>
      {p.nascoste && <p className="text-sm text-kireo-muted">{p.nascoste}</p>}
    </div>
  );
}
