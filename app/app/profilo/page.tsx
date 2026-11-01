import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import type { Indirizzo } from "@/components/ScuolaCascadeFields";
import { CLASSI } from "@/lib/registrazione";
import ProfiloForm, { BloccoPrivacy, type RifiutoVerifica } from "@/components/app/ProfiloForm";
import { eMotivoRifiuto } from "@/lib/scuola/rifiutoVerifica";
import ListaManifestazioniInteresse, { type ManifestazioneAttiva } from "@/components/app/ListaManifestazioniInteresse";
import ComunicazioniStudente, { type IscrizioneNewsletter, type EnteSeguito } from "@/components/app/ComunicazioniStudente";
import { statoEta } from "@/lib/eta";
import { descriviErrore } from "@/lib/erroreSupabase";
import type { ConsensoKireo } from "@/lib/app/comunicazioniKireo";

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
  let nomeScuolaAttuale: string | null = null;
  if (contesto.schoolCode) {
    const { data: scuola } = await supabase
      .from("schools")
      .select("provincia, tipo_istituto, denominazione")
      .eq("codice_meccanografico", contesto.schoolCode)
      .maybeSingle();
    provincia = scuola?.provincia ?? "";
    indirizzo = (scuola?.tipo_istituto as Indirizzo | undefined) ?? "";
    nomeScuolaAttuale = scuola?.denominazione ?? null;
  }

  // stato_verifica: colonna aggiunta dalla migration dell'area scuola, non
  // ancora applicata al DB reale finché Mario non la esegue — stesso
  // ripiego già usato per il telefono più sopra.
  let statoVerifica: string | null = null;
  const conVerifica = await supabase.from("student_profiles").select("stato_verifica").eq("user_id", contesto.userId).maybeSingle();
  if (!conVerifica.error) {
    statoVerifica = conVerifica.data?.stato_verifica ?? null;
  }

  // Il motivo del rifiuto (passo 3 della scuola, 20261130110000), in una
  // lettura a parte: se le colonne non ci sono ancora, la pagina resta quella
  // di prima invece di perdere la sezione della scuola.
  let rifiuto: RifiutoVerifica | null = null;
  if (statoVerifica === "rifiutato") {
    const conRifiuto = await supabase
      .from("student_profiles")
      .select("rifiuto_motivo, rifiuto_scuola_nome, rifiuto_il")
      .eq("user_id", contesto.userId)
      .maybeSingle();
    const r = conRifiuto.data;
    if (conRifiuto.error) {
      console.error("[profilo] lettura del rifiuto", descriviErrore(conRifiuto.error));
    } else if (r && eMotivoRifiuto(r.rifiuto_motivo) && r.rifiuto_scuola_nome && r.rifiuto_il) {
      rifiuto = { motivo: r.rifiuto_motivo, scuola: r.rifiuto_scuola_nome, il: r.rifiuto_il };
    }
  }

  const { data: righeAree } = await supabase
    .from("student_area_interests")
    .select("area_slug")
    .eq("user_id", contesto.userId);
  const areeInteresseIniziali = (righeAree ?? []).map((r) => r.area_slug);

  const { data: righeManifestazioni } = await supabase
    .from("manifestazioni_interesse")
    .select("id, created_at, istituzioni(nome, slug)")
    .eq("student_id", contesto.userId)
    .is("revocata_il", null)
    .order("created_at", { ascending: false });
  const manifestazioni: ManifestazioneAttiva[] = (righeManifestazioni ?? []).map((r) => {
    const istituzione = Array.isArray(r.istituzioni) ? r.istituzioni[0] : r.istituzioni;
    return { id: r.id, istituzioneNome: istituzione?.nome ?? "Istituzione", istituzioneSlug: istituzione?.slug ?? "", creataIl: r.created_at };
  });

  // Il consenso a KIREO e le newsletter degli enti: due letture a parte, e
  // una che fallisce dice «non letto» (undefined), mai «no» o «nessuna».
  let consensoKireo: ConsensoKireo | undefined;
  const conConsenso = await supabase.from("profiles").select("comunicazioni_kireo").eq("id", contesto.userId).maybeSingle();
  if (conConsenso.error) console.error("Profilo, consenso KIREO:", descriviErrore(conConsenso.error));
  else consensoKireo = (conConsenso.data?.comunicazioni_kireo as boolean | null | undefined) ?? null;

  let iscrizioniNewsletter: IscrizioneNewsletter[] | undefined;
  const conIscrizioni = await supabase
    .from("newsletter_iscrizioni")
    .select("id, created_at, istituzioni(nome, slug)")
    .eq("student_id", contesto.userId)
    .order("created_at", { ascending: false });
  if (conIscrizioni.error) console.error("Profilo, iscrizioni newsletter:", descriviErrore(conIscrizioni.error));
  else
    iscrizioniNewsletter = (conIscrizioni.data ?? []).map((r) => {
      const istituzione = Array.isArray(r.istituzioni) ? r.istituzioni[0] : r.istituzioni;
      return { id: r.id, istituzioneNome: istituzione?.nome ?? "Istituzione", istituzioneSlug: istituzione?.slug ?? "", creataIl: r.created_at };
    });

  // Gli enti seguiti: il quarto canale (Mario, 28/10). Seguire un ente porta i
  // suoi post nella Bacheca e, per alcuni enti, una notifica in KIREO: è un
  // canale aperto da un gesto, quindi sta con gli altri, con la sua uscita.
  let seguiti: EnteSeguito[] | undefined;
  const conSeguiti = await supabase
    .from("seguiti")
    .select("istituzione_id, created_at, istituzioni(nome, slug)")
    .eq("student_id", contesto.userId)
    .order("created_at", { ascending: false });
  if (conSeguiti.error) console.error("Profilo, enti seguiti:", descriviErrore(conSeguiti.error));
  else
    seguiti = (conSeguiti.data ?? []).map((r) => {
      const istituzione = Array.isArray(r.istituzioni) ? r.istituzioni[0] : r.istituzioni;
      return { istituzioneId: r.istituzione_id, istituzioneNome: istituzione?.nome ?? "Istituzione", istituzioneSlug: istituzione?.slug ?? "" };
    });

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
        statoVerifica={statoVerifica}
        nomeScuolaAttuale={nomeScuolaAttuale}
        rifiuto={rifiuto}
      />

      <div id="comunicazioni">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Comunicazioni</h2>
        <div className="mt-4">
          <ComunicazioniStudente
            consensoIniziale={consensoKireo}
            eta={statoEta(dataNascita)}
            iscrizioniIniziali={iscrizioniNewsletter}
            seguitiIniziali={seguiti}
          />
        </div>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Profilo condiviso con</h2>
        <p className="mt-1 text-sm text-kireo-muted">Gli enti a cui hai condiviso il tuo profilo. Puoi revocare in qualsiasi momento.</p>
        <div className="mt-4">
          <ListaManifestazioniInteresse manifestazioni={manifestazioni} />
        </div>
      </div>

      <BloccoPrivacy userId={contesto.userId} />
    </div>
  );
}
