"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import NotificheBell from "@/components/app/NotificheBell";

// LA BARRA MOSTRA L'ORDINE, NON IL PERMESSO.
//
// Due gruppi: le voci del percorso in fila, e il resto. È la sola cosa che i
// gruppi dicono — nessuna voce è disabilitata e nessuna è sbiadita, e la
// decisione di non sbiadirle è del 27/09, con tre ragioni che vale la pena
// tenere scritte perché non rientrino fra un mese:
//
//   · UNA VOCE SPENTA NON PUÒ DIRE PERCHÉ È SPENTA. Tutto il lavoro sulle guide
//     sta nel fatto che il rifiuto nomina il passo che manca: chi clicca su
//     Missioni senza i test arriva e legge cosa manca. Un grigio non nomina
//     niente, e toglie la spiegazione proprio al primo incontro;
//   · di dodici voci quelle davvero chiuse sono DUE — Missioni e Workshop. Le
//     altre sono libere per scelta: le guide perché la Panoramica è sempre
//     aperta, i test perché chiuderli allontanerebbe chi è appena arrivato;
//   · e contraddirebbe una decisione già scritta, in `prossimaTappa.ts`: il
//     percorso CONSIGLIA, e le prime cinque tappe restano consigli.
//
// L'ORDINE DEI PASSI NON È SCRITTO QUI: viene da `PASSI_PERCORSO`. Una seconda
// lista di passi in questo file divergerebbe da quella della pagina del
// percorso al primo che ne tocca una — è la malattia dei due riassunti delle
// guide, vista su un dato invece che su una frase. Qui si aggiungono solo le
// icone (che sono componenti React e non possono stare in una costante
// condivisa) e le due voci di navigazione che NON sono passi del viaggio.
import { PASSI_PERCORSO, type ChiavePasso } from "@/lib/percorso/passi";

const ICONE_PASSI: Record<ChiavePasso, (p: { className?: string }) => React.ReactElement> = {
  aree: IconAree,
  guide: IconGuide,
  test: IconTest,
  missioni: IconEscape,
  workshop: IconWorkshop,
};

const ABBREVIAZIONI: Record<string, string> = { "Le mie attività": "Attività", "Il percorso": "Percorso" };

type Voce = { href: string; label: string; icon: (p: { className?: string }) => React.ReactElement; passo?: ChiavePasso };

const GRUPPO_PERCORSO: Voce[] = [
  { href: "/app", label: "Home", icon: IconHome },
  { href: "/app/percorso", label: "Il percorso", icon: IconPercorso },
  ...PASSI_PERCORSO.map((p) => ({ href: p.href, label: p.nome, icon: ICONE_PASSI[p.chiave], passo: p.chiave })),
];

// AGENDA STA QUI E NON NEL PERCORSO: gli eventi non sono un passo del viaggio, e
// in mezzo ad Aree e Guide romperebbero la fila.
const GRUPPO_RESTO: Voce[] = [
  { href: "/app/agenda", label: "Agenda", icon: IconAgenda },
  { href: "/app/esplora", label: "Esplora", icon: IconEsplora },
  { href: "/app/bacheca", label: "Bacheca", icon: IconBacheca },
  { href: "/app/messaggi", label: "Messaggi", icon: IconMessaggi },
  { href: "/app/attivita", label: "Le mie attività", icon: IconAttivita },
  { href: "/app/profilo", label: "Profilo", icon: IconProfilo },
];

const NAV_ITEMS: Voce[] = [...GRUPPO_PERCORSO, ...GRUPPO_RESTO];

function isAttivo(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9" />
    </svg>
  );
}

function IconAree({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="m14.5 9.5-5 2-2 5 5-2 2-5Z" />
    </svg>
  );
}

function IconAgenda({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

function IconAttivita({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" d="M5 6h14M5 12h14M5 18h9" />
    </svg>
  );
}

function IconEsplora({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="11" cy="11" r="7" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconWorkshop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <rect x="3" y="7" width="18" height="12" rx="2" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M3 12h6v2h6v-2h6" />
    </svg>
  );
}

function IconGuide({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H6a2 2 0 0 1-2-2z" />
      <path strokeWidth="2" strokeLinecap="round" d="M17 3h1a2 2 0 0 1 2 2v12" />
    </svg>
  );
}

function IconTest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 11l2 2 4-4" />
      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" />
    </svg>
  );
}

function IconEscape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 9l-2.5 5.5L7 17l2.5-5.5L15 9z" />
    </svg>
  );
}

function IconBacheca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M8 9h8M8 13h5" />
    </svg>
  );
}

function IconMessaggi({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v11H8l-4 3.5V6Z" />
    </svg>
  );
}

function IconProfilo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
    </svg>
  );
}

function IconPercorso({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 20c0-3 3-4 6-4s6-1 6-4-3-4-6-4-6-1-6-4" />
      <circle cx="6" cy="4" r="1.6" strokeWidth="2" />
      <circle cx="18" cy="20" r="1.6" strokeWidth="2" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
    </svg>
  );
}

// Una voce della barra, desktop. Il SEGNO sul passo corrente è un puntino
// arancione a destra, non un colore di sfondo: lo sfondo è già occupato dalla
// voce su cui si sta navigando (`aria-current`), e le due cose sono domande
// diverse — «dove sono adesso» e «dov'è il mio prossimo passo». Se coincidono si
// vedono entrambe senza darsi noia.
function VoceBarra({ item, pathname, passoCorrente }: { item: Voce; pathname: string; passoCorrente: ChiavePasso | null }) {
  const attivo = isAttivo(pathname, item.href);
  const eIlPasso = item.passo !== undefined && item.passo === passoCorrente;
  return (
    <Link
      href={item.href}
      aria-current={attivo ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        attivo ? "bg-kireo-green/15 text-kireo-orange" : "text-kireo-light/90 hover:bg-white/5"
      }`}
    >
      <item.icon className="h-5 w-5 flex-none" />
      <span className="flex-1">{item.label}</span>
      {eIlPasso && (
        <span className="flex-none" title="Il tuo prossimo passo">
          <span className="block h-2 w-2 rounded-full bg-kireo-orange" aria-hidden="true" />
          <span className="sr-only">il tuo prossimo passo</span>
        </span>
      )}
    </Link>
  );
}

export default function AppShell({
  userId,
  passoCorrente,
  children,
}: {
  userId: string;
  /** Il passo del percorso in cui lo studente è adesso, da `getPassoCorrente`.
      Null quando non si sa: allora non si segna niente, invece di segnare un
      passo a caso — un segno sbagliato indica a uno studente un posto in cui non
      è, e vale meno di nessun segno. */
  passoCorrente: ChiavePasso | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const sezioneCorrente = NAV_ITEMS.find((item) => isAttivo(pathname, item.href))?.label ?? "";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-kireo-dark md:flex">
      <aside className="hidden w-60 flex-none flex-col border-r border-white/5 px-4 py-6 md:flex">
        <div className="flex items-center justify-between px-2 pb-8">
          <Logo />
          {/* Sidebar: il pannello si apre verso il contenuto, non verso il bordo
              della finestra (vedi il commento in NotificheBell). */}
          <NotificheBell userId={userId} allineamento="sinistra" />
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Navigazione area personale">
          {GRUPPO_PERCORSO.map((item) => (
            <VoceBarra key={item.href} item={item} pathname={pathname} passoCorrente={passoCorrente} />
          ))}
          {/* La riga fra i due gruppi: dice che qui il percorso finisce e
              comincia il resto. Non è un separatore decorativo, ed è l'unica
              cosa che i gruppi comunicano. */}
          <hr className="my-3 border-white/10" />
          {GRUPPO_RESTO.map((item) => (
            <VoceBarra key={item.href} item={item} pathname={pathname} passoCorrente={passoCorrente} />
          ))}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-kireo-light/70 transition-colors hover:bg-white/5 hover:text-kireo-light"
        >
          <IconLogout className="h-5 w-5 flex-none" />
          Esci
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:hidden">
          <span className="font-heading text-base font-semibold text-kireo-light">{sezioneCorrente}</span>
          <div className="flex items-center gap-1">
            <NotificheBell userId={userId} />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Esci"
              className="flex h-9 w-9 items-center justify-center rounded-full text-kireo-light/80 transition-colors hover:bg-white/5"
            >
              <IconLogout className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-10">{children}</main>

        {/* LA BARRA MOBILE SCORRE, e non è una rifinitura. Con dodici voci su un
            telefono da 390px ognuna aveva 32px: l'icona ci sta, l'etichetta no,
            e le etichette si tagliavano. Con la voce del percorso sono tredici.
            Scorrere tiene visibili le prime (il percorso, che è l'ordine che
            stiamo mostrando) senza NASCONDERE nessuna delle altre — l'unica
            alternativa senza perdite sarebbe stata un menu «Altro», che è una
            decisione di prodotto e non la prendo qui.

            Se un domani si vorrà quella strada: le voci del percorso sono sette
            e ci starebbero, il resto sono sei. */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-white/10 bg-kireo-dark/95 backdrop-blur md:hidden"
          aria-label="Navigazione area personale"
        >
          {NAV_ITEMS.map((item, i) => {
            const attivo = isAttivo(pathname, item.href);
            const eIlPasso = item.passo !== undefined && item.passo === passoCorrente;
            // La riga che separa i due gruppi anche qui: senza, scorrendo non si
            // capisce dove finisce il percorso.
            const primoDelResto = i === GRUPPO_PERCORSO.length;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={attivo ? "page" : undefined}
                className={`relative flex min-w-[68px] flex-none flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  primoDelResto ? "border-l border-white/10" : ""
                } ${attivo ? "text-kireo-orange" : "text-kireo-light/70"}`}
              >
                <item.icon className="h-5 w-5" />
                {ABBREVIAZIONI[item.label] ?? item.label}
                {eIlPasso && (
                  <>
                    <span className="absolute right-3 top-1.5 block h-2 w-2 rounded-full bg-kireo-orange" aria-hidden="true" />
                    <span className="sr-only">il tuo prossimo passo</span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
