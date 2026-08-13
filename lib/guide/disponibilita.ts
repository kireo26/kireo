import { existsSync } from "fs";
import path from "path";
import { AREE } from "@/data/aree";
import type { LivelloGuida } from "./config";

// Verifica se il PDF reale di una guida esiste davvero in public/guide/<area>/
// <livello>.pdf, invece di affidarsi a un flag manuale (stesso principio di
// lib/materiali.ts): caricare il file al percorso giusto rende la guida
// apribile da solo, senza toccare il codice. Server-only (fs): da chiamare solo
// da Server Component o Route Handler.
export function guidaPdfEsiste(areaSlug: string, livello: LivelloGuida): boolean {
  return existsSync(path.join(process.cwd(), "public", "guide", areaSlug, `${livello}.pdf`));
}

// Slug delle aree che hanno già il PDF reale della Guida 1 (Panoramica): usato
// per far puntare il lead-magnet pubblico e il chip «Scarica la guida» al PDF
// vero dove esiste, tenendo il segnaposto come fallback dove non esiste ancora.
export function areeConGuida1Reale(): string[] {
  return AREE.filter((a) => guidaPdfEsiste(a.slug, 1)).map((a) => a.slug);
}
