import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Stessa geometria della bussola di components/Logo.tsx e app/icon.svg.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2C2C2A",
        }}
      >
        <svg width="124" height="124" viewBox="0 0 80 80">
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
      </div>
    ),
    { ...size }
  );
}
