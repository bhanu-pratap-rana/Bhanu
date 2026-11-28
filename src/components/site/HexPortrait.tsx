import Image from "next/image";
import type { CSSProperties } from "react";

// Flat-top hexagon, the site mark's geometry, filling its box: the box is
// `size` wide and size * sqrt(3)/2 tall, so no empty band above or below.
const HEX_POINTS = "0,50 25,0 75,0 100,50 75,100 25,100";

// The mask is a CSS mask on a plain wrapper (never clip-path on anything
// focusable). An SVG data URL: allowed by the CSP's `img-src data:`.
const HEX_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${HEX_POINTS}"/></svg>`,
)}") center / 100% 100% no-repeat`;

/**
 * The smallest pre-made rendition that covers the box at 2x density
 * (public/portrait/, made from the original photo; see portrait.test.ts).
 *
 * "full": a head-and-shoulders framing made for the hexagon: the hair sits
 * just inside the top edge and the shoulders reach the lower slanted edges,
 * with the marigold background continued into the hexagon's side points.
 * Made by scripts/portrait-hexify.mjs from the original (it uses the
 * `sharp` that Next installs); the files are 2 : sqrt3, the box's own shape,
 * so `object-cover` shows the framing exactly.
 * "crop": the square photo cropped by the hexagon (a tight head-and-shoulders
 * crop), only for tiny avatars where the face must fill the shape.
 */
function portraitSrc(size: number, fit: "full" | "crop"): string {
  if (fit === "crop") {
    if (size <= 48) return "/portrait/bhanu-96.webp";
    if (size <= 128) return "/portrait/bhanu-256.webp";
    return "/portrait/bhanu-800.webp";
  }
  if (size <= 120) return "/portrait/bhanu-hex2-240.webp";
  if (size <= 240) return "/portrait/bhanu-hex2-480.webp";
  return "/portrait/bhanu-hex2-960.webp";
}

/** Absolute-URL-ready path of the largest JPEG, for JSON-LD and social cards. */
export const PORTRAIT_JPG = "/portrait/bhanu-800.jpg";

/**
 * Bhanu's photo in a flat-top hexagon with a 2px accent rim. Not focusable and
 * not interactive. `alt=""` when the text beside it already says who it is.
 * In forced colours the photo stays (it is content) and the rim becomes a
 * 1px CanvasText line.
 */
export function HexPortrait({
  size,
  alt = "Bhanu Pratap Rana",
  eager = false,
  fit = "full",
  className,
}: Readonly<{
  /** Default width in CSS px; the height is width * sqrt(3) / 2. */
  size: number;
  alt?: string;
  /** "full" shows the whole photo (default); "crop" fills the hex with the face. */
  fit?: "full" | "crop";
  /** Above the fold: load at once (small, so no preload). */
  eager?: boolean;
  className?: string;
}>) {
  // A parent may resize the box per breakpoint by setting
  // --hex-portrait-w (hero.css does, per layout); `size` is the default and
  // the image's intrinsic size, so pass the largest size the box reaches.
  const box: CSSProperties = {
    width: `var(--hex-portrait-w, ${size}px)`,
    aspectRatio: "2 / 1.7320508",
  };

  return (
    <span
      className={`relative inline-block shrink-0 align-middle ${className ?? ""}`}
      style={box}
      data-hex-portrait=""
    >
      <span
        className="absolute inset-0 block overflow-hidden"
        style={{ mask: HEX_MASK, WebkitMask: HEX_MASK }}
      >
        <Image
          src={portraitSrc(size, fit)}
          alt={alt}
          width={size}
          height={fit === "full" ? Math.round((size * Math.sqrt(3)) / 2) : size}
          sizes={`${size}px`}
          loading={eager ? "eager" : "lazy"}
          className="block h-full w-full object-cover"
        />
      </span>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <polygon
          points={HEX_POINTS}
          fill="none"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          className="stroke-accent stroke-2 forced-colors:stroke-[color:CanvasText] forced-colors:stroke-1"
        />
      </svg>
    </span>
  );
}
