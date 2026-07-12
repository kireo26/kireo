"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

// Stesso motivo di Header.tsx: /app ha una propria navigazione, il footer
// pubblico non deve comparire lì. Footer è un Server Component, quindi il
// controllo sul percorso vive in questo thin wrapper client.
export default function FooterGate() {
  const pathname = usePathname();

  if (pathname?.startsWith("/app")) {
    return null;
  }

  return <Footer />;
}
