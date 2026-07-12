import AppShell from "@/components/app/AppShell";
import LogoutButton from "@/components/LogoutButton";
import { getAppContext } from "@/lib/app/studentContext";

// Guardia auth + shell di navigazione per tutta l'area /app. Il middleware
// (proxy.ts) già nega l'accesso senza sessione; qui recuperiamo il contesto
// una sola volta (cache() in getAppContext) per nav + pagina.
//
// Questo cantiere ("Area studente MVP") riguarda solo il ruolo studente: chi
// ha ruolo docente/referente_scuola vede il messaggio minimo di sempre,
// invariato, qualunque sotto-percorso apra — le 5 sezioni non si applicano
// a loro (fuori scope).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const contesto = await getAppContext();

  if (contesto.ruolo !== "studente") {
    return (
      <section className="mx-auto max-w-2xl px-6 py-20 sm:pt-28">
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Area personale</p>
        <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">Ciao {contesto.nome}</h1>
        {contesto.schoolName && <p className="mt-3 text-lg text-kireo-muted">{contesto.schoolName}</p>}
        <p className="mt-6 text-lg text-kireo-light">Il tuo percorso di orientamento sta per iniziare.</p>
        <div className="mt-10">
          <LogoutButton />
        </div>
      </section>
    );
  }

  return <AppShell>{children}</AppShell>;
}
