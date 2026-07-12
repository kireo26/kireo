import type { MetadataRoute } from "next";
import { AREE } from "@/data/aree";
import { getTuttiGliArticoli } from "@/lib/news";
import { SITE_URL } from "@/lib/site";

// Pagine pubbliche indicizzabili. Le pagine di autenticazione (/accedi,
// /registrazione a parte perché ha valore SEO, /recupera-password,
// /reimposta-password) e l'area privata /app restano fuori, vedi robots.ts.
const PAGINE_STATICHE = [
  "",
  "per-gli-studenti",
  "come-funziona",
  "per-le-scuole",
  "istituzioni",
  "per-i-docenti",
  "registrazione",
  "contatti",
  "privacy",
  "news",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const pagine: MetadataRoute.Sitemap = PAGINE_STATICHE.map((percorso) => ({
    url: percorso ? `${SITE_URL}/${percorso}` : SITE_URL,
    changeFrequency: "monthly",
    priority: percorso === "" ? 1 : 0.7,
  }));

  const aree: MetadataRoute.Sitemap = AREE.map((area) => ({
    url: `${SITE_URL}/aree/${area.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const articoli: MetadataRoute.Sitemap = getTuttiGliArticoli().map((articolo) => ({
    url: `${SITE_URL}/news/${articolo.slug}`,
    lastModified: articolo.updatedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...pagine, ...aree, ...articoli];
}
