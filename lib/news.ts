import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

const CONTENT_DIR = path.join(process.cwd(), "content", "news");
const PAROLE_AL_MINUTO = 200;

export type NewsCategoria = "studenti" | "scuola" | "kireo";

export const CATEGORIE_NEWS: Record<NewsCategoria, { label: string; badgeClass: string }> = {
  studenti: { label: "Per gli studenti", badgeClass: "bg-kireo-green/15 text-kireo-green-light" },
  scuola: { label: "Per la scuola", badgeClass: "bg-kireo-orange/15 text-kireo-orange" },
  kireo: { label: "Notizie KIREO", badgeClass: "bg-white/10 text-kireo-light" },
};

type NewsFrontmatter = {
  title: string;
  slug: string;
  description: string;
  category: NewsCategoria;
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  author: string;
  draft: boolean;
  ogImage?: string;
};

export type NewsArticolo = NewsFrontmatter & {
  readingTime: number;
  content: string;
};

export type VoceIndice = { id: string; testo: string };

function calcolaTempoLettura(testo: string): number {
  const parole = testo.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(parole / PAROLE_AL_MINUTO));
}

// Genera gli id degli heading H2 con lo stesso algoritmo (github-slugger)
// usato da rehype-slug in fase di rendering MDX, così i link dell'indice
// puntano esattamente agli anchor generati nella pagina.
export function estraiIndice(mdxBody: string): VoceIndice[] {
  const slugger = new GithubSlugger();
  const voci: VoceIndice[] = [];
  for (const riga of mdxBody.split("\n")) {
    const match = riga.match(/^##\s+(.+?)\s*$/);
    if (match) {
      const testo = match[1].trim();
      voci.push({ id: slugger.slug(testo), testo });
    }
  }
  return voci;
}

function leggiArticolo(nomeFile: string): NewsArticolo {
  const percorso = path.join(CONTENT_DIR, nomeFile);
  const raw = fs.readFileSync(percorso, "utf8");
  const { data, content } = matter(raw);
  const frontmatter = data as NewsFrontmatter;

  return {
    ...frontmatter,
    author: frontmatter.author || "Redazione KIREO",
    readingTime: calcolaTempoLettura(content),
    content,
  };
}

// In produzione esclude le bozze (draft: true); in sviluppo le mostra
// sempre, per poterle rivedere prima della pubblicazione (vedi CLAUDE.md,
// sezione "Linea editoriale News").
function isPubblicato(articolo: NewsArticolo): boolean {
  return !articolo.draft || process.env.NODE_ENV !== "production";
}

let cache: NewsArticolo[] | null = null;

function leggiTuttiIFile(): NewsArticolo[] {
  if (cache) return cache;
  if (!fs.existsSync(CONTENT_DIR)) return [];

  const file = fs
    .readdirSync(CONTENT_DIR)
    .filter((nome) => nome.endsWith(".mdx"))
    .map(leggiArticolo)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  cache = file;
  return file;
}

export function getTuttiGliArticoli(): NewsArticolo[] {
  return leggiTuttiIFile().filter(isPubblicato);
}

export function getArticoloBySlug(slug: string): NewsArticolo | null {
  return getTuttiGliArticoli().find((a) => a.slug === slug) ?? null;
}

export function getArticoliCorrelati(articolo: NewsArticolo, limite = 3): NewsArticolo[] {
  return getTuttiGliArticoli()
    .filter((a) => a.slug !== articolo.slug && a.category === articolo.category)
    .slice(0, limite);
}
