import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DealBrief — Multifamily Property Research & Analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1D3557",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 96px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo / brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 48,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "white",
              letterSpacing: "-1px",
            }}
          >
            DEAL
          </span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#A8C5E8",
              letterSpacing: "-1px",
            }}
          >
            BRIEF
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "white",
            lineHeight: 1.15,
            letterSpacing: "-1.5px",
            marginBottom: 28,
            maxWidth: 800,
          }}
        >
          Multifamily property research in minutes.
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: 24,
            color: "#A8C5E8",
            lineHeight: 1.5,
            maxWidth: 700,
            fontWeight: 400,
          }}
        >
          Tax assessment · Permits · Flood zone · Crime · Demographics · Debt service analysis
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 64,
            right: 96,
            fontSize: 18,
            color: "#4A7FB5",
            fontWeight: 500,
          }}
        >
          getdealbrief.com
        </div>
      </div>
    ),
    { ...size }
  );
}
