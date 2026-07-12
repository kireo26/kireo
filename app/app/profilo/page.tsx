import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import type { Indirizzo } from "@/components/ScuolaCascadeFields";
import { CLASSI } from "@/lib/registrazione";
import ProfiloForm from "@/components/app/ProfiloForm";

export default async function ProfiloAppPage() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  // telefono: colonna aggiunta dalla migration della Fase 6, non ancora
  // applicata al DB reale — proviamo a leggerla, e se la colonna non esiste
  // ancora ripieghiamo senza (nessun errore mostrato allo studente).
  let dataNascita: string | null = null;
  let telefono: string | null = null;
  const conTelefono = await supabase
    .from("profiles")
    .select("data_nascita, telefono")
    .eq("id", contesto.userId)
    .maybeSingle();

  if (!conTelefono.error) {
    dataNascita = conTelefono.data?.data_nascita ?? null;
    telefono = conTelefono.data?.telefono ?? null;
  } else {
    const soloData = await supabase.from("profiles").select("data_nascita").eq("id", contesto.userId).maybeSingle();
    dataNascita = soloData.data?.data_nascita ?? null;
  }

  let provincia = "";
  let indirizzo: Indirizzo | "" = "";
  if (contesto.schoolCode) {
    const { data: scuola } = await supabase
      .from("schools")
      .select("provincia, tipo_istituto")
      .eq("codice_meccanografico", contesto.schoolCode)
      .maybeSingle();
    provincia = scuola?.provincia ?? "";
    indirizzo = (scuola?.tipo_istituto as Indirizzo | undefined) ?? "";
  }

  const { data: righeAree } = await supabase
    .from("student_area_interests")
    .select("area_slug")
    .eq("user_id", contesto.userId);
  const areeInteresseIniziali = (righeAree ?? []).map((r) => r.area_slug);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Profilo</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Il tuo profilo</h1>
      </div>

      <ProfiloForm
        userId={contesto.userId}
        nome={contesto.nome}
        cognome={contesto.cognome}
        dataNascita={dataNascita}
        telefonoIniziale={telefono}
        scuolaValueIniziale={{ provincia, indirizzo, scuola: contesto.schoolCode ?? "", scuolaAltro: "" }}
        classeIniziale={CLASSI.find((c) => c.label === contesto.classe)?.value ?? ""}
        areeInteresseIniziali={areeInteresseIniziali}
      />
    </div>
  );
}
