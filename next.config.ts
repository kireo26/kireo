import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
