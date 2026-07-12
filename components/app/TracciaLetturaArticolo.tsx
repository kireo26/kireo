"use client";

import { useEffect } from "react";
import { registraAttivita } from "@/lib/app/activityLog";

// Stesso principio di TracciaVisita, per gli articoli News (anch'essi SSG):
// registra una lettura per ciascuna area taggata nel frontmatter.
export default function TracciaLetturaArticolo({ aree }: { aree: string[] }) {
  useEffect(() => {
    aree.forEach((areaSlug) => {
      registraAttivita(areaSlug, "lettura_articolo");
    });
  }, [aree]);

  return null;
}
