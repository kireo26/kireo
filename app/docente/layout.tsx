import DocenteShell from "@/components/docente/DocenteShell";
import { getDocenteContext } from "@/lib/docente/context";

export default async function DocenteLayout({ children }: { children: React.ReactNode }) {
  const contesto = await getDocenteContext();

  return <DocenteShell nome={`${contesto.nome} ${contesto.cognome}`}>{children}</DocenteShell>;
}
