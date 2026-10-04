// IL CARICATORE DELL'IFRAME API — l'unica parte che tocca `window`, tenuta
// fuori da lib/sondaYoutube.ts così quel modulo resta puro e provabile da uno
// script Node.
//
// DUE DOMINI, E LA DIFFERENZA NON È UN DETTAGLIO. Lo script dell'API lo serve
// solo `www.youtube.com`; il PLAYER però si costruisce con
// `host: youtube-nocookie.com`, così l'incorporamento resta sul dominio senza
// cookie che il progetto ha scelto dal primo giorno. Quello che cambia
// rispetto a prima è che una pagina KIREO carica ora uno script di Google: è
// un costo reale, e si paga per una ragione dichiarata — senza l'API non si
// può sapere che il video non si vede, e senza saperlo si continuano a
// scrivere presenze finte (vedi `presenzaDaContare` in lib/sondaYoutube.ts).
// Lo script si carica SOLO quando c'è un video da provare o da mostrare, mai
// al montaggio di una pagina.

type EventoPlayer = { data: number };

export type PlayerYoutube = {
  destroy(): void;
};

export type OpzioniPlayer = {
  videoId: string;
  width?: string;
  height?: string;
  events?: {
    onReady?: () => void;
    onError?: (e: EventoPlayer) => void;
  };
};

export type ApiYoutube = {
  Player: new (elemento: HTMLElement, opzioni: OpzioniPlayer & { host?: string }) => PlayerYoutube;
};

declare global {
  interface Window {
    YT?: ApiYoutube;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const HOST_NOCOOKIE = "https://www.youtube-nocookie.com";

const URL_API = "https://www.youtube.com/iframe_api";

// Singleton: l'API chiama `window.onYouTubeIframeAPIReady` UNA volta sola e
// globalmente, quindi due consumatori che se la sovrascrivono a vicenda si
// romperebbero. Su fallimento la promessa viene dimenticata, così un secondo
// tentativo può ripartire invece di trovare per sempre il rifiuto del primo.
let promessa: Promise<ApiYoutube> | null = null;

export function caricaApiYoutube(): Promise<ApiYoutube> {
  if (promessa) return promessa;
  promessa = new Promise<ApiYoutube>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("api_youtube_fuori_dal_browser"));
      return;
    }
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const precedente = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      precedente?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("api_youtube_senza_player"));
    };
    const esistente = document.querySelector<HTMLScriptElement>(`script[src="${URL_API}"]`);
    if (esistente) return;
    const script = document.createElement("script");
    script.src = URL_API;
    script.async = true;
    script.onerror = () => reject(new Error("api_youtube_non_caricata"));
    document.head.appendChild(script);
  });
  promessa.catch(() => {
    promessa = null;
  });
  return promessa;
}
