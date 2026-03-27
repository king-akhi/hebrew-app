import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Aleph — Learn Hebrew";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#18181b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* Aleph letter */}
        <div
          style={{
            fontSize: 200,
            color: "white",
            lineHeight: 1,
            fontFamily: "serif",
          }}
        >
          א
        </div>

        {/* App name */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "white",
            letterSpacing: "-2px",
          }}
        >
          Aleph
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#a1a1aa",
          }}
        >
          Learn Modern Hebrew
        </div>
      </div>
    ),
    { ...size }
  );
}
