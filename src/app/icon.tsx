import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// The site mark: one note in the copilot's memory, lit.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a1024",
        }}
      >
        <svg width="30" height="26" viewBox="0 0 30 26">
          <polygon points="29,13 22,25.1 8,25.1 1,13 8,0.9 22,0.9" fill="none" stroke="#f5a524" strokeWidth="2.6" />
          <polygon points="21,13 18,18.2 12,18.2 9,13 12,7.8 18,7.8" fill="#f5a524" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
