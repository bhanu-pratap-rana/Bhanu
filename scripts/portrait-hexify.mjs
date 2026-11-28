// Frames the square portrait in a flat-top hexagon box (2 : sqrt3) as a
// head-and-shoulders portrait: the photo is a little taller than the hexagon,
// the top of the hair sits just inside its top edge, and the shoulders run
// out to the lower slanted edges (the photo's lower corners fall outside the
// hexagon, which the page masks). The narrow bands the square leaves at the
// hexagon's left and right points get a matching marigold gradient, and the
// photo's sides are feathered into it above the shoulders.
//
// Usage: node scripts/portrait-hexify.mjs <square-photo.png> public/portrait
// (PREVIEW=out.png also writes a hexagon-masked preview). Uses the `sharp`
// that Next installs.
import sharp from "sharp";

const [src, outDir] = process.argv.slice(2);

/** The photo's height relative to the hexagon's (> 1 crops the bottom). */
const HEIGHT_SCALE = 1.04;
/** Space kept above the hair, as a share of the hexagon's height. */
const TOP_MARGIN = 0.025;
/** The hair starts this far down the source photo (px). */
const HAIR_TOP = 40;
/** Source rows from here down are shoulders/shirt: never feathered. */
const SHOULDER_ROW = 900;
/** Feather width at the photo's sides and top (source px). */
const F = 120;

const meta = await sharp(src).metadata();
const S = Math.min(meta.width, meta.height);
const H = Math.round(S / HEIGHT_SCALE);
const W = Math.round((H * 2) / Math.sqrt(3));
// Where the photo's top row lands on the canvas (negative: above it).
const placeTop = Math.round(TOP_MARGIN * H - HAIR_TOP);
const cropTop = Math.max(0, -placeTop);
const top = Math.max(0, placeTop);
const PH = Math.min(S - cropTop, H - top);
const left = Math.round((W - S) / 2);

const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="g" cx="50%" cy="38%" r="62%">
    <stop offset="0" stop-color="rgb(253,212,70)"/>
    <stop offset="0.45" stop-color="rgb(254,198,30)"/>
    <stop offset="1" stop-color="rgb(249,184,14)"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/></svg>`);

const photo = await sharp(src)
  .extract({ left: 0, top: cropTop, width: S, height: PH })
  .removeAlpha()
  .toBuffer();

// Alpha: feathered at the sides (and the top, if the photo starts below the
// canvas top), fully opaque from the shoulders down so the shirt never fades.
const solidFrom = Math.max(0, SHOULDER_ROW - cropTop);
const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${PH}">
  <defs>
    <linearGradient id="h" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000"/><stop offset="${F / S}" stop-color="#fff"/>
      <stop offset="${1 - F / S}" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
    </linearGradient>
    <linearGradient id="v" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${top > 0 ? "#000" : "#fff"}"/>
      <stop offset="${top > 0 ? F / PH : 0}" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
    </linearGradient>
    <mask id="m"><rect width="100%" height="100%" fill="url(#v)"/></mask>
  </defs>
  <rect width="100%" height="100%" fill="url(#h)" mask="url(#m)"/>
  <rect y="${solidFrom}" width="100%" height="${Math.max(0, PH - solidFrom)}" fill="#fff"/></svg>`);
const alpha = await sharp(mask).greyscale().raw().toBuffer();
const feathered = await sharp(photo)
  .joinChannel(alpha, { raw: { width: S, height: PH, channels: 1 } })
  .png()
  .toBuffer();

// If the square is wider than the box, crop its sides to fit.
const cropX = Math.max(0, -left);
const placed = await sharp(feathered)
  .extract({ left: cropX, top: 0, width: S - 2 * cropX, height: PH })
  .toBuffer();
const base = await sharp(bg)
  .composite([{ input: placed, left: Math.max(0, left), top }])
  .png()
  .toBuffer();

for (const w of [960, 480, 240]) {
  const h = Math.round((w * Math.sqrt(3)) / 2);
  await sharp(base).resize(w, h).webp({ quality: 82 }).toFile(`${outDir}/bhanu-hex2-${w}.webp`);
}
await sharp(base)
  .resize(1200, Math.round((1200 * Math.sqrt(3)) / 2))
  .jpeg({ quality: 80, mozjpeg: true })
  .toFile(`${outDir}/bhanu-hex2-1200.jpg`);

if (process.env.PREVIEW) {
  const hexMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="416" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,50 25,0 75,0 100,50 75,100 25,100" fill="#fff"/></svg>`,
  );
  await sharp(`${outDir}/bhanu-hex2-480.webp`)
    .resize(480, 416)
    .composite([{ input: hexMask, blend: "dest-in" }])
    .png()
    .toFile(process.env.PREVIEW);
}
console.log({ S, W, H, top, cropTop, left, PH });
