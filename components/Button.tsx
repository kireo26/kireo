import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-kireo-green text-kireo-light hover:bg-kireo-green-light",
  outline:
    "border border-kireo-light/30 text-kireo-light hover:border-kireo-light/60 hover:bg-white/5",
  ghost: "text-kireo-light hover:text-kireo-orange",
};

const baseClasses =
  "inline-flex items-center justify-center rounded-full px-6 py-3 font-sans text-sm font-semibold transition-colors";

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
