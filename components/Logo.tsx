import Link from "next/link";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center py-0.5 font-heading text-2xl font-bold leading-[1.25] tracking-tight ${className}`}
      aria-label="KIREO — Torna alla homepage"
    >
      <span className="text-kireo-logo">K</span>
      <span className="text-kireo-light">IRE</span>
      <span className="relative inline-block text-kireo-light">
        O
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <circle
            cx="12"
            cy="12"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.4"
          />
          <path d="M12 6 L14 12 L12 18 L10 12 Z" fill="var(--color-kireo-orange)" />
        </svg>
      </span>
    </Link>
  );
}
