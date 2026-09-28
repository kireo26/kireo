import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { getOreCertificate } from "@/lib/app/pcto";
import { getValoriRadar } from "@/lib/app/radarData";
import { getProssimiEventi, getProssimiEventiPerAree } from "@/lib/app/eventi";
import { getMessaggiScuolaStudente } from "@/lib/app/messaggi";
import { getConsegneDaFare } from "@/lib/app/consegneDaFare";
import { caricaAffinitaHome } from "@/lib/percorso/stato";
import { getPassoCorrente } from "@/lib/percorso/passoCorrente";
import { cancelloMissioni } from "@/lib/percorso/cancelli";
import HeaderSaluto from "@/components/app/HeaderSaluto";
import CardProssimaTappa from "@/components/app/CardProssimaTappa";
import SezioneAffinita from "@/components/app/SezioneAffinita";
import BarreEsplorazione from "@/components/app/BarreEsplorazione";
import BloccoLeMieAree, { type AreaInteresse } from "@/components/app/BloccoLeMieAree";
import ContatorePCTO from "@/components/app/ContatorePCTO";
import StrisciaProssimoEvento from "@/components/app/StrisciaProssimoEvento";
import CardEventiPerTe from "@/components/app/CardEventiPerTe";
import MessaggiScuola from "@/components/app/MessaggiScuola";
import ConsegneDaFare from "@/components/app/ConsegneDaFare";
import type { VoceChecklist } from "@/components/app/BadgeProfiloPercentuale";

// Cinque voci da 20%: dati anagrafici e scuola/classe sono sempre presenti per
// uno studente registrato (40% di base), telefono e area di interesse si
// compilano dal Profilo, i tre test si fanno.
//
// LA QUINTA VOCE ERA FERMA A UN MONDO CHE NON C'È PIÙ. Fino al 27/09 diceva
// «Test attitudinale completato» ed era **sempre falsa**, con sopra il commento
// «il test attitudinale non esiste ancora (arriva a settembre)». I tre test sono
// vivi da agosto: la conseguenza era che **nessuno poteva arrivare a cento**, e
// che a uno studente che li aveva fatti tutti e tre veniva detto che il test non
// era fatto. È la specie di casa — una frase che dichiara uno stato diverso da
// quello vero — nel posto in cui fa più male: un numero che chiede qualcosa.
//
// E NON SI RICALCOLA QUI SE I TRE TEST SONO FATTI. `t1 && t2 && t3` sarebbe la
// regola scritta una seconda volta, in un'altra lingua rispetto a quella che poi
// apre davvero le missioni: si chiede a chi la definisce (`cancelloMissioni`,
// che passa da `ha_completato_i_tre_test()`). È la stessa scelta già fatta in
// `prossimaTappa.ts`.
function calcolaProfilo({
  telefonoCompilato,
  haAreaInteresse,
  treTestFatti,
}: {
  telefonoCompilato: boolean;
  haAreaInteresse: boolean;
  treTestFatti: boolean;
}): { percentuale: number; voci: VoceChecklist[] } {
  const voci: VoceChecklist[] = [
    { label: "Dati anagrafici", completata: true },
    { label: "Scuola e classe collegate", completata: true },
    { label: "Telefono aggiunto", completata: telefonoCompilato },
    { label: "Un'area di interesse scelta", completata: haAreaInteresse },
    { label: "I tre test fatti", completata: treTestFatti },
  ];
  const percentuale = Math.round((voci.filter((v) => v.completata).length / voci.length) * 100);
  return { percentuale, voci };
}

export default async function AreaPersonaleHome() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  const conTelefono = await supabase.from("profiles").select("telefono").eq("id", contesto.userId).maybeSingle();
  const telefonoCompilato = !conTelefono.error && Boolean(conTelefono.data?.telefono);

  const [{ data: righeAree }, oreCertificate, valoriRadar, prossimoEvento, messaggiScuola, affinita, passoCorrente, gateMissioni, consegneDaFare] =
    await Promise.all([
      supabase.from("student_area_interests").select("area_slug").eq("user_id", contesto.userId),
      getOreCertificate(supabase, contesto.userId),
      getValoriRadar(supabase, contesto.userId),
      getProssimiEventi(supabase, 1).then((e) => e[0] ?? null),
      getMessaggiScuolaStudente(supabase, contesto.userId),
      caricaAffinitaHome(supabase, contesto.userId),
      // In `cache()`: il layout l'ha già chiesto per il segno nella barra, qui
      // non costa un'altra lettura.
      getPassoCorrente(contesto.userId),
      cancelloMissioni(supabase),
      getConsegneDaFare(supabase, contesto.userId),
    ]);
  const prossimaTappa = passoCorrente.tappa;

  const areeInteresse: AreaInteresse[] = (righeAree ?? [])
    .map((r) => getAreaBySlug(r.area_slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({ slug: a.slug, nome: a.nome, icona: a.icona }));

  const eventiPerTe = await getProssimiEventiPerAree(
    supabase,
    areeInteresse.map((a) => a.slug),
  );

  const { percentuale, voci } = calcolaProfilo({
    telefonoCompilato,
    haAreaInteresse: areeInteresse.length > 0,
    treTestFatti: gateMissioni.aperto,
  });

  // IL PRIMO INCONTRO: quando non c'è NIENTE, la home diceva «vuoto» tre volte
  // in tre modi diversi — «per ora non c'è ancora niente da mostrare» nelle
  // affinità, «Non hai ancora aperto niente» nell'esplorazione, e il percorso
  // che parte da zero. Per chi entra la prima volta erano le uniche tre frasi
  // che leggeva, e due delle tre non dicono cosa fare.
  //
  // Quindi: se il quadro è vuoto del tutto, restano il saluto e la card del
  // percorso — che è l'unica che dice da dove si comincia — e i due blocchi non
  // dicono «vuoto»: non ci sono.
  //
  // LA CONDIZIONE È «TUTTI E DUE VUOTI», E NON È PRUDENZA. Se le affinità ci
  // sono e l'esplorazione è vuota, la contraddizione fra i due ritratti è vera e
  // deve restare visibile — è l'esempio più chiaro che abbiamo del fatto che i
  // due blocchi contano cose diverse (vedi il commento in `BarreEsplorazione`, e
  // «Punti aperti» in CLAUDE.md). Nascondere il blocco vuoto in quel caso
  // cancellerebbe la prova.
  const nessunaEsplorazione = Object.values(valoriRadar).every((v) => v <= 0);
  const primoIncontro = !affinita.haAttivita && nessunaEsplorazione;

  return (
    <div className="space-y-6">
      <HeaderSaluto
        nome={contesto.nome}
        schoolName={contesto.schoolName}
        classe={contesto.classe}
        percentualeProfilo={percentuale}
        vociProfilo={voci}
      />

      {/*
        Sopra tutto il resto, e non per importanza: per DURATA. La finestra è di
        due giorni — quello che si perde in fondo alla pagina non si recupera,
        mentre un'affinità che sta un blocco più in basso resta lì.
      */}
      <ConsegneDaFare consegne={consegneDaFare} />

      {!primoIncontro && <SezioneAffinita affinita={affinita} />}

      <CardProssimaTappa tappa={prossimaTappa} />

      <MessaggiScuola messaggiIniziali={messaggiScuola} />

      <div className={primoIncontro ? "" : "grid gap-6 lg:grid-cols-2"}>
        {!primoIncontro && (
          <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
            <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
              Dove hai esplorato finora
            </h2>
            <p className="mt-1 text-xs text-kireo-muted">Conta le attività che hai fatto in ogni area (guide, pagine, eventi) — dove hai messo piede, non le tue attitudini.</p>
            <div className="mt-4">
              <BarreEsplorazione valori={valoriRadar} />
            </div>
          </div>
        )}

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
