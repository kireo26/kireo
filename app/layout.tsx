import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, Poppins } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import FooterGate from "@/components/FooterGate";
import { SITE_URL } from "@/lib/site";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  adjustFontFallback: true,
  fallback: ["system-ui", "sans-serif"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
  fallback: ["system-ui", "sans-serif"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300"],
  display: "swap",
  adjustFontFallback: true,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "KIREO — Orientamento. Direzione. Futuro.",
  description:
    "KIREO guida gli studenti delle scuole superiori a scoprire le proprie attitudini e la direzione giusta dopo il diploma — studio o lavoro.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${poppins.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-kireo-dark font-sans text-kireo-light antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <FooterGate />
      </body>
    </html>
  );
}
