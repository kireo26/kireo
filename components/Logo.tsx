import Link from "next/link";

// Nota: la geometria della bussola (cerchio + ago) è duplicata anche in
// app/icon.svg e app/apple-icon.tsx per generare la favicon standalone.
// Se cambia qui, aggiornarla anche lì.

const VARIANTS = {
  dark: { accent: "#2FA57B", ire: "#F0EDE8" },
  light: { accent: "#0F6E56", ire: "#2C2C2A" },
};

export default function Logo({
  variant = "dark",
  className = "",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const { accent, ire } = VARIANTS[variant];

  return (
    <Link
      href="/"
      aria-label="KIREO — Torna alla homepage"
      className={`inline-flex items-baseline gap-[0.12em] font-logo text-2xl font-light ${className}`}
    >
      <span style={{ color: accent }}>K</span>
      <span style={{ color: ire }}>I</span>
      <span style={{ color: ire }}>R</span>
      <span style={{ color: ire }}>E</span>
      <svg viewBox="0 0 80 80" aria-hidden="true" style={{ height: "0.8em", width: "0.8em" }}>
        <g transform="translate(40,40)">
          <circle
            cx="0"
            cy="0"
            r="33"
            fill="none"
            stroke={accent}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray="165 42.3"
            transform="rotate(-118)"
          />
          <g transform="rotate(40)">
            <path d="M 0,-18 L 9,8 L 0,3 L -9,8 Z" fill="#EF9F27" />
          </g>
        </g>
      </svg>
    </Link>
  );
}
