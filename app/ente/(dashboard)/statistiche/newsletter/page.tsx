import { T } from "@/lib/ente/statistiche";
import { sottoNewsletterEnte } from "@/lib/app/comunicazioniKireo";
import { caricaStatisticheEnte } from "@/lib/ente/caricaStatistiche";
import { NonLetto, Riquadro, TestaSezione } from "@/components/ente/statistiche/Parti";

// La sezione Newsletter. Il numero grande è chi la riceverà: gli iscritti che si
// sono iscritti da maggiorenni (20261107110000). Sotto, gli iscritti in tutto,
// solo quando differiscono. Le uscite le conta un trigger
// (`uscite_newsletter_giorno`), perché un'iscrizione tolta non lascia una riga:
// si contano da quando il trigger esiste. Aperture e clic non si promettono:
// l'invio non esiste ancora.
export default async function StatisticheNewsletterPage() {
  const stats = await caricaStatisticheEnte();
  return (
    <div className="space-y-8">
      <TestaSezione titolo={T.newsletter.titolo} />
      {stats === null ? (
        <NonLetto />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Riquadro
              etichetta="Chi la riceverà"
              valore={stats.newsletter.raggiungibili}
              sotto={sottoNewsletterEnte(stats.newsletter.iscritti, stats.newsletter.raggiungibili)}
            />
            <Riquadro etichetta="Nuove iscrizioni questo mese" valore={stats.newsletter.nuovi_mese} />
            <Riquadro
              etichetta="Uscite questo mese"
              valore={stats.newsletter.persi_mese}
              sotto={stats.newsletter.persi_contati_dal ? T.newsletter.persiDal(stats.newsletter.persi_contati_dal) : null}
            />
          </div>
          <p className="text-sm text-kireo-muted">{T.newsletter.invii}</p>
        </>
      )}
    </div>
  );
}
