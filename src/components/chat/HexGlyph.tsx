import { glyphLayout, hexPoints } from "@/lib/hex-glyph";

const CELLS = glyphLayout();

/**
 * The copilot's mark: a 7-cell honeycomb, a miniature of the 3D core. Lit
 * cells are filled, unlit ones only outlined, so the state never depends on
 * colour alone (forced colours keep the difference). Decorative: whatever
 * carries it names the action in text.
 */
export function HexGlyph({
  lit,
  size = 24,
  className,
}: Readonly<{
  /** 7 values, 0..1: how lit each cell is (centre first). */
  lit?: ArrayLike<number>;
  size?: number;
  className?: string;
}>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-hex-glyph=""
    >
      {CELLS.map((cell, i) => {
        const on = Math.min(1, Math.max(0, lit?.[i] ?? 0));
        return (
          <polygon
            key={i}
            className="hex-glyph-cell"
            data-on={on > 0.05 ? "true" : undefined}
            points={hexPoints(cell.cx * 100, cell.cy * 100, cell.r * 100 * 0.92)}
            style={{ ["--on" as string]: on.toFixed(2) }}
          />
        );
      })}
    </svg>
  );
}
