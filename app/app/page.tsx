import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { getOreCertificate } from "@/lib/app/pcto";
import { getValoriRadar } from "@/lib/app/radarData";
import { getProssimiEventi, getProssimiEventiPerAree } from "@/lib/app/eventi";
import HeaderSaluto from "@/components/app/HeaderSaluto";
import CardProssimaTappa from "@/components/app/CardProssimaTappa";
import RadarAttitudinale from "@/components/app/RadarAttitudinale";
import BloccoLeMieAree, { type AreaInteresse } from "@/components/app/BloccoLeMieAree";
import ContatorePCTO from "@/components/app/ContatorePCTO";
import StrisciaProssimoEvento from "@/components/app/StrisciaProssimoEvento";
import CardEventiPerTe from "@/components/app/CardEventiPerTe";
import type { VoceChecklist } from "@/components/app/BadgeProfiloPercentuale";

// Segnaposto onesto, 5 voci da 20%: dati anagrafici e scuola/classe sono
// sempre presenti per uno studente registrato (40% di base). Telefono è
// reale (colonna arrivata con la migration della Fase 6 del cantiere
// precedente) ma nullable finché lo studente non lo compila in Profilo.
// Il test attitudinale non esiste ancora (arriva a settembre): resta
// sempre falso.
function calcolaProfilo({
  telefonoCompilato,
  haAreaInteresse,
}: {
  telefonoCompilato: boolean;
  haAreaInteresse: boolean;
}): { percentuale: number; voci: VoceChecklist[] } {
  const voci: VoceChecklist[] = [
    { label: "Dati anagrafici", completata: true },
    { label: "Scuola e classe collegate", completata: true },
    { label: "Telefono aggiunto", completata: telefonoCompilato },
    { label: "Un'area di interesse scelta", completata: haAreaInteresse },
    { label: "Test attitudinale completato", completata: false },
  ];
  const percentuale = Math.round((voci.filter((v) => v.completata).length / voci.length) * 100);
  return { percentuale, voci };
}

export default async function AreaPersonaleHome() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  const conTelefono = await supabase.from("profiles").select("telefono").eq("id", contesto.userId).maybeSingle();
  const telefonoCompilato = !conTelefono.error && Boolean(conTelefono.data?.telefono);

  const [{ data: righeAree }, oreCertificate, valoriRadar, prossimoEvento] = await Promise.all([
    supabase.from("student_area_interests").select("area_slug").eq("user_id", contesto.userId),
    getOreCertificate(supabase, contesto.userId),
    getValoriRadar(supabase, contesto.userId),
    getProssimiEventi(supabase, 1).then((e) => e[0] ?? null),
  ]);

  const areeInteresse: AreaInteresse[] = (righeAree ?? [])
    .map((r) => getAreaBySlug(r.area_slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({ slug: a.slug, nome: a.nome, icona: a.icona }));

  const eventiPerTe = await getProssimiEventiPerAree(
    supabase,
    areeInteresse.map((a) => a.slug),
  );

  const { percentuale, voci } = calcolaProfilo({ telefonoCompilato, haAreaInteresse: areeInteresse.length > 0 });

  return (
    <div className="space-y-6">
      <HeaderSaluto
        nome={contesto.nome}
        schoolName={contesto.schoolName}
        classe={contesto.classe}
        percentualeProfilo={percentuale}
        vociProfilo={voci}
      />

      <CardProssimaTappa />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
            Il tuo radar attitudinale
          </h2>
          <div className="mt-4">
            <RadarAttitudinale valori={valoriRadar} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <BloccoLeMieAree aree={areeInteresse} />
          <CardEventiPerTe eventi={eventiPerTe} />
          <ContatorePCTO oreCertificate={oreCertificate} />
        </div>
      </div>

      <StrisciaProssimoEvento evento={prossimoEvento} />
    </div>
  );
}
