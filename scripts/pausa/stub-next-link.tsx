import type { ReactNode } from "react";
export default function Link({ href, children, ...r }: { href: string; children: ReactNode } & Record<string, unknown>) {
  return <a href={href} {...r}>{children}</a>;
}
