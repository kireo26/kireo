// LA PRODUZIONE DICE SE È INDIETRO RISPETTO A `main` (04/11).
//
// Il 04/11 Vercel ha smesso di accettare deploy (magazzino delle funzioni
// pieno) e i push su `main` non hanno prodotto niente: nessun errore, nessun
// deploy, nessuno schermo che lo dicesse. Un deploy FALLITO lascia un rosso su
// GitHub; uno MAI NATO lascia un buco, e un buco non lo guarda nessuno.
//
// Questo controllo lo scrive LA PRODUZIONE CHE STA GIRANDO, dal cron di ogni
// mattina: confronta il proprio commit (VERCEL_GIT_COMMIT_SHA) con la testa di
// `main` letta da GitHub (repository pubblico, nessuna chiave). Quando i deploy
// si fermano, la produzione vecchia è proprio l'unica cosa ancora in piedi.
//
// ⚠️ IL LIMITE, scritto e non inseguito: se il cron non gira, questo controllo
// tace con lui. Non si costruisce un secondo guardiano sul primo (Mario, 04/11).
//
// LA SOGLIA (scelta, non misurata): una testa di `main` diversa dalla
// produzione è un allarme, salvo se GitHub mostra per quella testa una
// costruzione di Vercel in corso («pending») cominciata da meno di
// MINUTI_COSTRUZIONE_TOLLERATI. Perché non «qualche ora»: un giorno in cui
// Mario non distribuisce `main` non si muove, quindi i due commit coincidono e
// non c'è niente da tollerare; l'unico caso legittimo di disallineamento è una
// costruzione partita da poco. Il controllo gira una volta al giorno, quindi un
// lotto rimasto fuori si vede al più la mattina dopo.
//
// Non si sa da quando `main` è avanti: GitHub non dice l'ora di un push in modo
// affidabile (l'elenco degli eventi arriva in ritardo e salta), e la data di un
// commit è quella in cui è stato scritto, non spinto. Per questo la soglia sta
// sulla costruzione e non sull'età del lotto.

export const MINUTI_COSTRUZIONE_TOLLERATI = 30;

export type EsitoAllineamento =
  | { esito: "allineato"; sha: string }
  | { esito: "in_costruzione"; sha: string; testa: string; daMinuti: number }
  | {
      esito: "indietro";
      sha: string;
      testa: string;
      avantiDi: number;
      commit: string[];
      // «fallito» se GitHub ha un rosso di Vercel sulla testa, «mai_partito»
      // se non ha niente (il caso del 04/11), «fermo» se c'è uno stato ma non
      // spiega la differenza (una costruzione in corso da troppo, o finita
      // senza arrivare in produzione).
      come: "fallito" | "mai_partito" | "fermo";
    }
  | { esito: "non_controllato"; motivo: string };

export type StatoCommit = { state: string; created_at: string };

// La decisione, pura. `statiTesta` sono gli stati di Vercel sul commit in testa
// a `main`, dal più recente (come li dà GitHub).
export function classificaAllineamento(input: {
  sha: string;
  testa: string;
  avantiDi: number;
  commit: string[];
  statiTesta: StatoCommit[];
  adesso: Date;
}): EsitoAllineamento {
  const { sha, testa, avantiDi, commit, statiTesta, adesso } = input;
  if (testa === sha) return { esito: "allineato", sha };
  const ultimo = statiTesta[0];
  if (!ultimo) return { esito: "indietro", sha, testa, avantiDi, commit, come: "mai_partito" };
  if (ultimo.state === "failure" || ultimo.state === "error")
    return { esito: "indietro", sha, testa, avantiDi, commit, come: "fallito" };
  if (ultimo.state === "pending") {
    const daMinuti = Math.floor((adesso.getTime() - new Date(ultimo.created_at).getTime()) / 60_000);
    if (Number.isFinite(daMinuti) && daMinuti >= 0 && daMinuti < MINUTI_COSTRUZIONE_TOLLERATI)
      return { esito: "in_costruzione", sha, testa, daMinuti };
  }
  return { esito: "indietro", sha, testa, avantiDi, commit, come: "fermo" };
}

// Le due letture da GitHub. Ogni cosa che non torna è «non controllato», mai
// «allineato»: questo è il controllo che esiste per i casi in cui qualcosa non
// arriva, e non può essere lui a confondere un silenzio con un sì.
export async function leggiAllineamento(
  env: Record<string, string | undefined>,
  chiedi: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>,
  adesso: Date = new Date(),
): Promise<EsitoAllineamento> {
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  const owner = env.VERCEL_GIT_REPO_OWNER;
  const repo = env.VERCEL_GIT_REPO_SLUG;
  if (!sha || !owner || !repo)
    return {
      esito: "non_controllato",
      motivo: "la produzione non sa il proprio commit (mancano le variabili VERCEL_GIT_*: in Vercel, «Automatically expose System Environment Variables»)",
    };
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    const r = await chiedi(`${base}/compare/${sha}...main`);
    if (!r.ok) return { esito: "non_controllato", motivo: `GitHub ha risposto ${r.status} al confronto dei commit` };
    const c = (await r.json()) as {
      status?: string;
      ahead_by?: number;
      commits?: { sha?: string; commit?: { message?: string } }[];
    };
    const lista = Array.isArray(c.commits) ? c.commits : null;
    if (!c.status || typeof c.ahead_by !== "number" || !lista)
      return { esito: "non_controllato", motivo: "GitHub ha risposto al confronto in una forma che non riconosciamo" };
    if (c.status === "identical") return { esito: "allineato", sha };
    const testa = lista.length > 0 ? lista[lista.length - 1].sha : undefined;
    if (c.status !== "ahead" || !testa)
      return {
        esito: "non_controllato",
        motivo: `il commit della produzione non è un antenato di main (stato «${c.status}»): non so dire se manca qualcosa`,
      };
    const commit = lista.map((x) => (x.commit?.message ?? "").split("\n")[0]).reverse();
    const s = await chiedi(`${base}/commits/${testa}/statuses?per_page=20`);
    if (!s.ok) return { esito: "non_controllato", motivo: `GitHub ha risposto ${s.status} agli stati del commit in testa` };
    const stati = await s.json();
    if (!Array.isArray(stati)) return { esito: "non_controllato", motivo: "GitHub ha risposto agli stati in una forma che non riconosciamo" };
    const vercel = (stati as { state?: string; created_at?: string; context?: string }[])
      .filter((x) => x.context === "Vercel" && typeof x.state === "string" && typeof x.created_at === "string")
      .map((x) => ({ state: x.state as string, created_at: x.created_at as string }));
    return classificaAllineamento({ sha, testa, avantiDi: c.ahead_by, commit, statiTesta: vercel, adesso });
  } catch (e) {
    return { esito: "non_controllato", motivo: `la richiesta a GitHub non è riuscita (${e instanceof Error ? e.message : String(e)})` };
  }
}

// Allarme: tutto tranne «allineato» e una costruzione appena partita.
export function allineamentoDaSegnalare(e: EsitoAllineamento): boolean {
  return e.esito === "indietro" || e.esito === "non_controllato";
}

const corto = (s: string) => s.slice(0, 7);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// La riga in testa all'email. Testi miei e provvisori.
export function testoAllineamento(e: EsitoAllineamento): string {
  switch (e.esito) {
    case "allineato":
      return `La produzione serve l'ultimo commit di main (${corto(e.sha)}).`;
    case "in_costruzione":
      return `Vercel sta costruendo l'ultimo commit di main (${corto(e.testa)}) da ${e.daMinuti} minuti: la produzione è ancora su ${corto(e.sha)}.`;
    case "non_controllato":
      return `Non siamo riusciti a controllare se la produzione è allineata a main: ${esc(e.motivo)}. Questo non vuol dire che lo sia.`;
    case "indietro": {
      const perche =
        e.come === "fallito"
          ? "l'ultimo deploy di main è fallito"
          : e.come === "mai_partito"
            ? "per l'ultimo commit di main Vercel non ha mai cominciato un deploy"
            : "Vercel ha toccato l'ultimo commit di main ma la produzione non ci è arrivata";
      const elenco = e.commit.slice(0, 10).map((m) => `<li>${esc(m)}</li>`).join("");
      const altri = e.commit.length > 10 ? `<li>…più altri ${e.commit.length - 10}</li>` : "";
      return `⚠️ La produzione è INDIETRO rispetto a main: serve ${corto(e.sha)}, main è a ${corto(e.testa)} (commit non ancora in produzione: ${e.avantiDi}), e ${perche}.<ul>${elenco}${altri}</ul>`;
    }
  }
}
