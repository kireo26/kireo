import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Header from "@/components/Header";
import FooterGate from "@/components/FooterGate";
import { SITE_URL } from "@/lib/site";

// I CARATTERI STANNO DENTRO IL PROGETTO (27/10), non si scaricano a ogni
// costruzione. Con `next/font/google` la build andava a prenderli da Google:
// due volte in due giorni è fallita su Vercel (`module-not-found` sul CSS del
// carattere, 26/10 e 27/10), con lo stesso codice che sette minuti prima era
// verde. *Una costruzione che dipende da qualcosa che va a prendere fuori
// fallisce a caso, addosso a chi ha distribuito per ultimo* (Mario).
// I file vengono dai pacchetti Fontsource 5.3.0 (gli stessi caratteri di
// Google Fonts, sottoinsieme latino, solo tondo: era quello che chiedeva
// `subsets: ["latin"]`), con la loro licenza OFL accanto in `app/fonts/`.
// ⚠️ Non tornare a `next/font/google` per comodità: il guasto che toglie è
// esattamente quello che si ripresenterebbe. `npm run test:caratteri` lo vieta.
const spaceGrotesk = localFont({
  variable: "--font-display",
  src: "./fonts/space-grotesk/space-grotesk-latin-wght-normal.woff2",
  weight: "300 700",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const dmSans = localFont({
  variable: "--font-dm-sans",
  src: "./fonts/dm-sans/dm-sans-latin-wght-normal.woff2",
  weight: "100 1000",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const poppins = localFont({
  variable: "--font-poppins",
  src: "./fonts/poppins/poppins-latin-300-normal.woff2",
  weight: "300",
  display: "swap",
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
