import Link from "next/link";
import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";
import { leggiStudentiDellaScuola, soloDichiarati, soloVerificati } from "@/lib/scuola/studenti";
import { riepilogoIscrizioniClassi, TESTI_HOME_SCUOLA, type RigaIscrizioneClasse } from "@/lib/scuola/home";

export default async function ScuolaHomePage() {
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  // Tutte le iscrizioni delle classi, senza limite: il numero e l'elenco li
  // decide `riepilogoIscrizioniClassi` (lib/scuola/home.ts).
  const [studenti, { data: righeIscrizioni, error: erroreIscrizioni }] = await Promise.all([
    leggiStudentiDellaScuola(supabase),
    supabase
      .from("iscrizioni_classe_eventi")
      .select("evento_id, eventi(titolo, data_inizio, data_fine, diretta_chiusa_il), classi!inner(nome_visualizzato, scuola_profilo_id)")
      .eq("classi.scuola_profilo_id", contesto.scuolaProfiloId),
  ]);

  // «Non letto» non è zero: null, e la pagina lo dice.
  const daVerificare = studenti ? soloDichiarati(studenti).length : null;
  const verificati = studenti ? soloVerificati(studenti).length : null;
  if (erroreIscrizioni) console.error("[/scuola] lettura delle iscrizioni delle classi:", descriviErrore(erroreIscrizioni));
  const riepilogo = erroreIscrizioni
    ? null
    : riepilogoIscrizioniClassi(
        (righeIscrizioni ?? []).map((r) => {
          const evento = Array.isArray(r.eventi) ? r.eventi[0] : r.eventi;
          const classe = Array.isArray(r.classi) ? r.classi[0] : r.classi;
          return { evento_id: r.evento_id, evento: evento ?? null, classe: classe?.nome_visualizzato ?? null } as RigaIscrizioneClasse;
        }),
      );

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">La tua scuola</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">{contesto.nomeScuola}</h1>
        <p className="mt-2 text-kireo-muted">
          Ciao {contesto.nome} — {contesto.ruoloStaff === "referente" ? "referente" : "tutor"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contesto.puoVerificareStudenti ? (
          <Link href="/scuola/studenti" className="rounded-2xl border border-white/5 bg-kireo-card p-5 transition-colors hover:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Da verificare</p>
            <Numero valore={daVerificare} colore="text-kireo-orange" />
          </Link>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Da verificare</p>
            <Numero valore={daVerificare} colore="text-kireo-muted" />
          </div>
        )}
        <Link href="/scuola/studenti" className="rounded-2xl border border-white/5 bg-kireo-card p-5 transition-colors hover:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Studenti verificati</p>
          <Numero valore={verificati} colore="text-kireo-light" />
        </Link>
        <Link href="/scuola/eventi" className="rounded-2xl border border-white/5 bg-kireo-card p-5 transition-colors hover:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{TESTI_HOME_SCUOLA.eventiInProgramma}</p>
          <Numero valore={riepilogo ? riepilogo.eventiInProgramma : null} colore="text-kireo-light" />
        </Link>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Prossime iscrizioni</h2>
        {riepilogo === null ? (
          <p className="mt-3 text-sm text-kireo-muted">{TESTI_HOME_SCUOLA.iscrizioniNonLette}</p>
        ) : riepilogo.prossime.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">{TESTI_HOME_SCUOLA.nessunaProssima}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {riepilogo.prossime.map((riga, i) => (
              <li key={`${riga.eventoId}-${i}`} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <p className="font-heading text-sm font-semibold text-kireo-light">{riga.titolo}</p>
                <p className="mt-1 text-xs text-kireo-muted">
                  {riga.classe ?? "Classe"} · {formattaData(riga.dataInizio, "long")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Un numero della home: «non letto» si dice, non si scrive come zero.
function Numero({ valore, colore }: { valore: number | null; colore: string }) {
  if (valore === null) {
    return <p className="mt-2 text-sm text-kireo-muted">{TESTI_HOME_SCUOLA.nonLetto}</p>;
  }
  return <p className={`mt-1 font-heading text-3xl font-bold ${colore}`}>{valore}</p>;
}
