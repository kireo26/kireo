"use client";

import { useEffect } from "react";
import { registraAttivita } from "@/lib/app/activityLog";

// Da inserire nelle pagine pubbliche statiche (Server Component): non
// avendo codice server per-richiesta (SSG), la visita si registra qui,
// lato client, al montaggio. No-op silenzioso per visitatori anonimi o
// oltre il cap giornaliero (vedi lib/app/activityLog.ts).
export default function TracciaVisita({ areaSlug }: { areaSlug: string }) {
  useEffect(() => {
    registraAttivita(areaSlug, "visita_area");
  }, [areaSlug]);

  return null;
}
