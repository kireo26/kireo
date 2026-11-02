import Link from "next/link";

// Il collegamento alla pagina dell'account, uno solo per tutte le aree (02/11):
// accanto a «Esci», dove una persona cerca le cose del proprio account.
export const HREF_MIO_ACCOUNT = "/account";

function IconAccount({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

export default function LinkMioAccount({ variante }: { variante: "barra" | "icona" | "testo" }) {
  if (variante === "icona") {
    return (
      <Link
        href={HREF_MIO_ACCOUNT}
        prefetch={false}
        aria-label="Il mio account"
        className="flex h-9 w-9 items-center justify-center rounded-full text-kireo-light/80 transition-colors hover:bg-white/5"
      >
        <IconAccount className="h-5 w-5" />
      </Link>
    );
  }
  if (variante === "testo") {
    return (
      <Link href={HREF_MIO_ACCOUNT} prefetch={false} className="text-sm text-kireo-light/80 underline-offset-2 hover:underline">
        Il mio account
      </Link>
    );
  }
  return (
    <Link
      href={HREF_MIO_ACCOUNT}
      prefetch={false}
      className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-kireo-light/70 transition-colors hover:bg-white/5 hover:text-kireo-light"
    >
      <IconAccount className="h-5 w-5 flex-none" />
      Il mio account
    </Link>
  );
}
