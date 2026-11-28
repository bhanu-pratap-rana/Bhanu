import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { currentRole, profile } from "@/lib/knowledge";

// The same role line as the hero: the resume title at the current employer.
const ROLE = currentRole.line;
// Proof in plain words; both numbers are on the resume (see profile.statement).
const PROOF = "Semantic search over 1,633 Hindi books. A learning app piloted with 570+ students in Assam.";

export const alt = `${profile.name}, ${ROLE}. ${PROOF}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dark-theme tokens from globals.css.
const GROUND = "#060a1c";
const INK = "#eef2ff";
const MUTED = "#a9b3d9";
const ACCENT = "#ffb21f";
const SCENE_BODY = "#111a4a";
const SCENE_EDGE = "#5b6cff";
const SCENE_HOT = "#ffd45e";
const SCENE_ACCENT = "#ffa51f";
const SCENE_RIM = "#ff8a1f";

// Flat-top hexagon (the site mark's geometry).
const HEX_CLIP = "polygon(0% 50%, 25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%)";
const hexHeight = (w: number) => Math.round((w * Math.sqrt(3)) / 2);

// Portrait: 360 wide.
const HEX_W = 360;
const HEX_H = hexHeight(HEX_W);
const RIM = 6;

// Honeycomb motif: 7 flat-top cells (a centre and its six neighbours), the
// same shape the 3D core is built from. Three cells are lit like the core's
// prism tops: pale-gold centre, marigold, saffron rim.
const CELL_W = 40;
const CELL_H = hexHeight(CELL_W);
const CELL_EDGE = 2;
const STEP = 1.1; // spacing factor, leaves a hairline gap between cells
const CELLS: { dx: number; dy: number; lit: boolean }[] = [
  { dx: 0, dy: 0, lit: true },
  { dx: 0, dy: -1, lit: false },
  { dx: 0, dy: 1, lit: false },
  { dx: 0.75, dy: -0.5, lit: true },
  { dx: 0.75, dy: 0.5, lit: false },
  { dx: -0.75, dy: -0.5, lit: false },
  { dx: -0.75, dy: 0.5, lit: true },
];
const COMB_W = Math.ceil(CELL_W * (1 + 1.5 * STEP));
const COMB_H = Math.ceil(CELL_H * (1 + 2 * STEP));
const LIT_FILL = `radial-gradient(circle at 50% 50%, ${SCENE_HOT} 0%, ${SCENE_ACCENT} 55%, ${SCENE_RIM} 100%)`;

function Honeycomb() {
  return (
    <div style={{ display: "flex", position: "relative", width: COMB_W, height: COMB_H }}>
      {CELLS.map(({ dx, dy, lit }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: Math.round(COMB_W / 2 - CELL_W / 2 + dx * CELL_W * STEP),
            top: Math.round(COMB_H / 2 - CELL_H / 2 + dy * CELL_H * STEP),
            width: CELL_W,
            height: CELL_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: lit ? SCENE_RIM : SCENE_EDGE,
            clipPath: HEX_CLIP,
          }}
        >
          <div
            style={{
              width: CELL_W - CELL_EDGE * 2,
              height: CELL_H - CELL_EDGE * 2,
              background: lit ? LIT_FILL : SCENE_BODY,
              clipPath: HEX_CLIP,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// Latin only: the image renderer does not shape Devanagari reliably. Static:
// no params, the portrait is read from public/ at build time. Default font:
// nothing is fetched at build time.
export default async function OpengraphImage() {
  // The hexagon-shaped rendition: the whole photo inside the hex, not cut.
  const photo = await readFile(join(process.cwd(), "public/portrait/bhanu-hex2-1200.jpg"), "base64");
  const photoSrc = `data:image/jpeg;base64,${photo}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "space-between",
          background: GROUND,
          color: INK,
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 680, marginTop: -40 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}>
            {profile.name}
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.3, marginTop: 28, color: ACCENT }}>
            {ROLE}
          </div>
          <div style={{ fontSize: 27, lineHeight: 1.4, marginTop: 24, color: MUTED }}>
            {PROOF}
          </div>
        </div>
        {/* Marigold rim: a slightly larger hexagon behind the clipped photo. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: HEX_W + RIM * 2,
            height: HEX_H + RIM * 2,
            background: ACCENT,
            clipPath: HEX_CLIP,
          }}
        >
          <img
            src={photoSrc}
            alt=""
            width={HEX_W}
            height={HEX_H}
            style={{ width: HEX_W, height: HEX_H, objectFit: "cover", clipPath: HEX_CLIP }}
          />
        </div>
        <div style={{ display: "flex", position: "absolute", left: 72, bottom: 44 }}>
          <Honeycomb />
        </div>
      </div>
    ),
    { ...size },
  );
}
