import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Immagine OG di default per /news e per ogni articolo che non ha un
// ogImage dedicato in frontmatter (vedi generateMetadata in [slug]/page.tsx).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#2C2C2A",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="96" height="96" viewBox="0 0 80 80">
            <g transform="translate(40,40)">
              <circle
                cx="0"
                cy="0"
                r="33"
                fill="none"
                stroke="#2FA57B"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="165 42.3"
                transform="rotate(-118)"
              />
              <g transform="rotate(40)">
                <path d="M 0,-18 L 9,8 L 0,3 L -9,8 Z" fill="#EF9F27" />
              </g>
            </g>
          </svg>
          <span style={{ fontSize: 100, fontWeight: 700, color: "#F0EDE8", letterSpacing: -2 }}>KIREO</span>
        </div>
        <span style={{ marginTop: 32, fontSize: 34, color: "#9A9890" }}>Orientamento. Direzione. Futuro.</span>
      </div>
    ),
    { ...size },
  );
}
