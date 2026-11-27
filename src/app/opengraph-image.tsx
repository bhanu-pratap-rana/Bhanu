import { ImageResponse } from "next/og";
import { knowledgeBase, profile } from "@/lib/knowledge";
import { kagomeLayout } from "@/lib/lattice";

export const alt = `${profile.name} — ${profile.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Latin only: the image renderer does not shape Devanagari reliably.
const lattice = kagomeLayout(knowledgeBase.length, 7, 30);
// A fixed, representative pattern: the notes a typical question pulls.
const lit: Record<number, number> = { 0: 0.3, 1: 0.8, 2: 1, 11: 0.55, 13: 0.3, 25: 0.55 };

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#0a1024",
          color: "#eaeffb",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1 }}>
            {profile.name}
          </div>
          <div
            style={{
              fontSize: 31,
              lineHeight: 1.3,
              marginTop: 32,
              color: "#eaeffb",
            }}
          >
            Applied AI Engineer. I build AI that works in Indian languages.
          </div>
          <div style={{ fontSize: 25, marginTop: 28, color: "#a3aec8" }}>
            Ask the copilot and watch which notes it retrieves.
          </div>
        </div>
        <svg
          width={420}
          height={Math.round((420 * lattice.height) / lattice.width)}
          viewBox={`-2 -2 ${lattice.width + 4} ${lattice.height + 4}`}
        >
          {lattice.cells.map((cell) => (
            <polygon
              key={cell.index}
              points={cell.points}
              fill={lit[cell.index] ? "#f5a524" : "none"}
              fillOpacity={lit[cell.index] ?? 0}
              stroke={lit[cell.index] ? "#f5a524" : "#4d5f98"}
              strokeWidth={1.5}
            />
          ))}
        </svg>
      </div>
    ),
    { ...size },
  );
}
