import Link from "next/link";
import AreeSfiorate from "@/components/escape/AreeSfiorate";
import type { AffinitaHome } from "@/lib/percorso/stato";

// Sezione «Le tue affinità» in cima alla home — l'unica superficie che parla di
// CHI È lo studente a partire da come agisce (area_signal), distinta dal radar
// «Dove hai esplorato finora» (un tally di clic) e da «Le mie aree» (gli
// interessi dichiarati). Tre lenti dichiarate per quello che sono.
//
// Tre stati (la barra di eleggibilità = ≥2 attività distinte, vedi leggiAffinita):
//   - aree eleggibili → classifica per interesse;
//   - nessuna eleggibile e 0 attività → «Le tue affinità appaiono qui»;
//   - nessuna eleggibile e ≥1 attività → «Sei a metà strada» + aree sfiorate.
// Con una missione sola nessuna area è eleggibile: è la condizione NORMALE dei
// primi giorni di ogni studente, non un caso limite — perciò lo stato non-vuoto
// mostra comunque le aree sfiorate (qualcosa di suo, e cosa la 2ª attività
// confermerà o smentirà).

const STATUS: Record<AffinitaHome["eleggibili"][number]["status"], { testo: string; classe: string }> = {
  emergente: { testo: "Sta emergendo", classe: "border-white/15 text-kireo-muted" },
  confermata: { testo: "Si va confermando", classe: "border-kireo-green/40 text-kireo-green-light" },
  // L'etichetta INTERA, come nella pagina di missione. Troncata a «Da
  // verificare» diceva un'altra cosa: accanto alla barra più lunga si legge
  // come un'avvertenza, mentre lo stato è il segnale più prezioso che abbiamo —
  // la fiducia che uno si dà e come gli è andata divergono di trenta punti.
  // Talento che lo studente non vede in sé, o insicurezza su una cosa in cui è
  // bravo. La nota sotto la lista dice cosa significa: un badge da solo non può.
  da_verificare: { testo: "Da verificare — segnali contrastanti", classe: "border-kireo-orange/40 text-kireo-orange" },
};

function Cta({ testo }: { testo: string }) {
  return (
    <Link href="/app/escape" className="mt-4 inline-block rounded-full bg-kireo-green px-5 py-2 text-sm font-semibold text-white hover:bg-kireo-green-light">
      {testo}
    </Link>
  );
}

export default function SezioneAffinita({ affinita }: { affinita: AffinitaHome }) {
  const { eleggibili, sfiorate, haAttivita } = affinita;
  const contrastanti = eleggibili.filter((a) => a.status === "da_verificare").map((a) => a.nome);
  const vociSfiorate = sfiorate.map((s) => ({ nome: s.nome, testo: s.motivazione ?? "un segnale c'è, ma serve un'altra attività in quest'area." }));

  // Caso pieno: aree eleggibili → classifica per interesse.
  if (eleggibili.length > 0) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-kireo-green/20 bg-kireo-card p-6">
          <h2 className="font-heading text-lg font-semibold text-kireo-light">Le tue affinità</h2>
          <p className="mt-1 text-sm text-kireo-muted">Le aree che emergono da come agisci — non da quello che hai dichiarato, ma da cosa fai davvero.</p>
          <ul className="mt-4 space-y-3">
            {eleggibili.map((a) => (
              <li key={a.slug} className="rounded-xl border border-white/5 bg-kireo-dark p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/aree/${a.slug}`} className="font-heading text-sm font-semibold text-kireo-light hover:text-kireo-green-light">{a.nome}</Link>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS[a.status].classe}`}>{STATUS[a.status].testo}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-kireo-green" style={{ width: `${a.interest}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {contrastanti.length > 0 && (
            <p className="mt-4 rounded-lg border border-kireo-orange/30 bg-kireo-orange/5 px-3 py-2 text-sm text-kireo-light/90">
              Su {contrastanti.join(", ")} la fiducia che ti dai e come te la cavi davvero non vanno nella stessa direzione. Non è un problema da correggere: è il segnale più utile che abbiamo, perché capita spesso di essere in gamba in una cosa senza sentirsi così.
            </p>
          )}
        </section>
        <AreeSfiorate titolo="Aree che stai sfiorando" sottotitolo="Un segnale c'è, ma serve una seconda attività in quest'area prima che diventi un'affinità." voci={vociSfiorate} />
      </div>
    );
  }

  // Stato vuoto — 0 attività. Nessun CTA: l'unica cosa che chiede qualcosa in
  // home è la card «Il tuo percorso» (guida-first). Qui il blocco spiega solo
  // COME nasce il ritratto (test + missioni), senza spingere alla missione —
  // così l'ordine consigliato (guida → test → missioni) non viene scavalcato.
  if (!haAttivita) {
    return (
      <section className="rounded-2xl border border-white/5 bg-kireo-card p-6">
        <h2 className="font-heading text-lg font-semibold text-kireo-light">Le tue affinità appaiono qui.</h2>
        <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">
          Qui comparirà il tuo ritratto: verso quali aree ti orienti, e quanta prova ne abbiamo. Si costruisce con i test e con le missioni — per ora non c&apos;è ancora niente da mostrare.
        </p>
      </section>
    );
  }

  // Stato vuoto — 1 attività (+ aree sfiorate = le piste della prima missione).
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/5 bg-kireo-card p-6">
        <h2 className="font-heading text-lg font-semibold text-kireo-light">Sei a metà strada.</h2>
        <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">
          Nella missione che hai fatto qualcosa si è già acceso: lo trovi nel suo riepilogo. Ma quello racconta QUELLA partita. Un&apos;affinità è una cosa che diciamo su di te, e la diciamo solo quando un segnale ritorna in una situazione diversa. Fanne un&apos;altra e cominciamo a metterle in fila.
        </p>
        <Cta testo="Fai un'altra missione" />
      </section>
      <AreeSfiorate titolo="Quello che hai già acceso" sottotitolo="Sono le piste della tua prima missione: la prossima attività dirà quali reggono." voci={vociSfiorate} />
    </div>
  );
}
