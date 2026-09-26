import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // I PDF delle guide 2 e 3 vivono FUORI da public/ (vedi `percorsoGuida` in
  // lib/guide/config.ts: là dentro sarebbero serviti dalla rete di
  // distribuzione, cioè raggiungibili senza passare dal cancello). La rotta che
  // li serve li legge dal filesystem, quindi devono stare nel bundle della
  // funzione: il tracciamento automatico non li vede, perché il percorso è
  // composto a runtime da area e livello.
  //
  // SE QUESTA RIGA SI PERDE il sintomo è un 500 sul download di una guida, e
  // lascia una riga in `guasti` con specie `guida_riservata` — rumoroso e
  // immediato, non silenzioso. È la ragione per cui questa strada è stata
  // preferita a una guardia davanti a `public/`, il cui fallimento invece non si
  // vedrebbe affatto.
  outputFileTracingIncludes: {
    "/api/guide/[areaSlug]/[livello]": ["./content/guide/**/*.pdf"],
  },
  async redirects() {
    return [
      {
        // /per-le-istituzioni è stata rinominata in /istituzioni (estesa
        // con confronto piani + form di richiesta accesso ente).
        source: "/per-le-istituzioni",
        destination: "/istituzioni",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
