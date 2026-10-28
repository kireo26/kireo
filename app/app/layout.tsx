import AppShell from "@/components/app/AppShell";
import LogoutButton from "@/components/LogoutButton";
import CompletaEtaForm from "@/components/app/CompletaEtaForm";
import { getAppContext } from "@/lib/app/studentContext";
import { getPassoCorrente } from "@/lib/percorso/passoCorrente";
import { redirect } from "next/navigation";
import { casaPerRuolo } from "@/lib/ruoli/casa";

// Guardia auth + shell di navigazione per tutta l'area /app. Il middleware
// (proxy.ts) già nega l'accesso senza sessione; qui recuperiamo il contesto
// una sola volta (cache() in getAppContext) per nav + pagina.
//
// ⚠️ /app È LA CASA DEGLI STUDENTI, E SOLO LORO (Mario, 27/10). Fino al
// 27/10 chi aveva un altro ruolo riceveva qui «Ciao Anna · Il tuo percorso di
// orientamento sta per iniziare»: il prodotto non lo trattava come qualcuno
// che non dovrebbe essere qui, ma come uno studente senza dati — un'altra
// persona. Ora chi ha un ruolo che conosciamo va a casa sua
// (`lib/ruoli/casa.ts`, la stessa mappa di `/dopo-accesso`); chi ne ha uno che
// non conosciamo legge che quest'area non è sua, invece di un benvenuto.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const contesto = await getAppContext();

  if (contesto.ruolo !== "studente") {
    const casa = casaPerRuolo(contesto.ruolo);
    if (casa && casa !== "/app") redirect(casa);
    // ⚠️ Testo mio, provvisorio.
    return (
      <section className="mx-auto max-w-2xl px-6 py-20 sm:pt-28">
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Quest&apos;area è per gli studenti</h1>
        <p className="mt-4 text-kireo-muted">
          Il tuo profilo non è quello di uno studente, e non riconosciamo il ruolo che ha: scrivici da Contatti e lo sistemiamo.
        </p>
        <div className="mt-10">
          <LogoutButton />
        </div>
      </section>
    );
  }

  // Blocco obbligatorio, non aggirabile: senza data di nascita non sappiamo
  // se chi entra ha l'età minima (14 anni), e le regole che la guardano non
  // possono decidere — i gesti verso un ente (puo_contattare_enti,
  // 20261109110000) e le comunicazioni facoltative (i 18 anni dell'informativa). Stesso principio del blocco duro già in uso in
  // app/scuola/(dashboard)/layout.tsx — non renderizza i figli finché la
  // condizione non è soddisfatta.
  if (!contesto.dataNascita) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-20 text-center sm:pt-28">
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Un'ultima cosa</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Completa il tuo profilo</h1>
        <p className="mt-4 text-kireo-muted">
          Ci serve la tua data di nascita per continuare: su KIREO ci si iscrive dai 14 anni, e alcune funzioni dipendono
          dalla tua età.
        </p>
        <CompletaEtaForm userId={contesto.userId} />
        <div className="mt-6">
          <LogoutButton />
        </div>
      </section>
    );
  }

  // Il segno sul passo corrente nella barra. `getPassoCorrente` è in `cache()`,
  // quindi la home che lo chiede a sua volta per la card non fa altre letture.
  const { chiave } = await getPassoCorrente(contesto.userId);

  return (
    <AppShell userId={contesto.userId} passoCorrente={chiave}>
      {children}
    </AppShell>
  );
}
