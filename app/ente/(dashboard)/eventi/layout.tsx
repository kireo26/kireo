import SchedeEventi, { SCHEDE_ENTE } from "@/components/ente/SchedeEventi";

// La sezione «Eventi» dell'ente: un titolo e tre schede. Le tre pagine sotto
// sono viste di una stessa lettura (`lib/ente/caricaEventiEnte.ts`); la plancia
// di un evento sta nella sua pagina (`/diretta/[id]`).
export default function EventiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Eventi</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">I tuoi eventi</h1>
      </div>
      <SchedeEventi schede={SCHEDE_ENTE} />
      {children}
    </div>
  );
}
