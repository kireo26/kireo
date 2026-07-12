import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { getOreCertificate } from "@/lib/app/pcto";
import { getValoriRadar } from "@/lib/app/radarData";
import { getProssimoWebinar } from "@/lib/app/webinars";
import HeaderSaluto from "@/components/app/HeaderSaluto";
import CardProssimaTappa from "@/components/app/CardProssimaTappa";
import RadarAttitudinale from "@/components/app/RadarAttitudinale";
import BloccoLeMieAree, { type AreaInteresse } from "@/components/app/BloccoLeMieAree";
import ContatorePCTO from "@/components/app/ContatorePCTO";
import StrisciaProssimoWebinar from "@/components/app/StrisciaProssimoWebinar";

// Segnaposto onesto, 5 voci da 20%: dati anagrafici e scuola/classe sono
// sempre presenti per uno studente registrato (40% di base). Telefono e
// test attitudinale non sono ancora raccolti da nessun flusso reale, quindi
// restano falsi finché non lo saranno davvero (vedi Fase 6 per il telefono,
// il test attitudinale arriva a settembre). Le aree di interesse sono un
// dato reale da student_area_interests.
function calcolaPercentualeProfilo({ haAreaInteresse }: { haAreaInteresse: boolean }) {
  let punti = 40;
  if (haAreaInteresse) punti += 20;
  return punti;
}

export default async function AreaPersonaleHome() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  const [{ data: righeAree }, oreCertificate, valoriRadar, prossimoWebinar] = await Promise.all([
    supabase.from("student_area_interests").select("area_slug").eq("user_id", contesto.userId),
    getOreCertificate(supabase, contesto.userId),
    getValoriRadar(supabase, contesto.userId),
    getProssimoWebinar(supabase),
  ]);

  const areeInteresse: AreaInteresse[] = (righeAree ?? [])
    .map((r) => getAreaBySlug(r.area_slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({ slug: a.slug, nome: a.nome, icona: a.icona }));

  const percentualeProfilo = calcolaPercentualeProfilo({ haAreaInteresse: areeInteresse.length > 0 });

  return (
    <div className="space-y-6">
      <HeaderSaluto
        nome={contesto.nome}
        schoolName={contesto.schoolName}
        classe={contesto.classe}
        percentualeProfilo={percentualeProfilo}
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
          <ContatorePCTO oreCertificate={oreCertificate} />
        </div>
      </div>

      <StrisciaProssimoWebinar webinar={prossimoWebinar} />
    </div>
  );
}
