import { ImageResponse } from "next/og";

export const alt = "Bhanu Copilot — Applied AI Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4f3ef",
          color: "#0c0a09",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: 24,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#78716c",
            }}
          >
            Bhanu Copilot v1.0
          </div>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
            Applied AI Engineer
          </div>
          <div style={{ fontSize: 34, color: "#57534e", marginTop: 8 }}>
            GenAI · RAG · Computer Vision · FastAPI · AI Automation
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: 28,
            color: "#0c0a09",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#0c0a09",
              color: "#ffffff",
              borderRadius: 12,
              padding: "10px 18px",
              fontSize: 26,
            }}
          >
            Ask me anything about Bhanu →
          </div>
          <div style={{ color: "#78716c", fontSize: 24 }}>
            A RAG-powered AI portfolio
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
