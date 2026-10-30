/**
 * Write every app icon size from one 1024x1024 square PNG.
 *
 *   node scripts/make-app-icons.mjs marketing/brand/icon/lamb-c.png "#2B6670" "#123139" marketing/brand/icon/lamb-c-round.png
 *
 * The two colours are the background's radial gradient (centre, edge),
 * used for the Android adaptive-icon background layer. The optional
 * last file is a version with everything pulled into the centre circle
 * for Android, where launchers cut the icon into a circle or squircle.
 *
 * iOS: one 1024 icon, flattened with NO alpha channel (App Store
 * Connect rejects an icon with transparency).
 * Android: legacy square + round launcher icons, plus the adaptive pair
 * (foreground = the full icon, background = the gradient), same sizes
 * and layout @capacitor/assets produced before.
 * Web: resources/, assets/ and the PWA webp sizes in icons/.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [src, inner = "#2B6670", outer = "#123139", androidSrc = src] = process.argv.slice(2);
if (!src) {
  console.error("usage: node scripts/make-app-icons.mjs <1024.png> [inner] [outer]");
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const base = await sharp(src).resize(1024, 1024).flatten({ background: outer }).removeAlpha().png().toBuffer();
const out = (rel) => path.join(ROOT, rel);
const square = (size) => sharp(base).resize(size, size).png();

// iOS + generic sources
await square(1024).toFile(out("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"));
await square(1024).toFile(out("resources/icon.png"));
await square(1024).toFile(out("assets/icon.png"));
await square(1024).toFile(out("assets/icon-source.png"));

// PWA
for (const s of [48, 72, 96, 128, 192, 256, 512]) {
  await sharp(base).resize(s, s).webp({ quality: 92 }).toFile(out(`icons/icon-${s}.webp`));
}

// Android
const mask = (size, round) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><${round ? `circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"` : `rect width="${size}" height="${size}" rx="${size * 0.2}"`} fill="#fff"/></svg>`,
  );
const gradient = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><defs><radialGradient id="g" cx="50%" cy="28%" r="80%"><stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/></radialGradient></defs><rect width="${size}" height="${size}" fill="url(#g)"/></svg>`,
  );
const droid = await sharp(androidSrc).resize(1024, 1024).flatten({ background: outer }).removeAlpha().png().toBuffer();
const DENSITIES = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, legacy] of Object.entries(DENSITIES)) {
  const dir = out(`android/app/src/main/res/mipmap-${d}`);
  const layer = Math.round(legacy * 2.25); // 108dp adaptive layer vs 48dp legacy
  for (const [name, round] of [["ic_launcher", false], ["ic_launcher_round", true]]) {
    await sharp(droid).resize(legacy, legacy).composite([{ input: mask(legacy, round), blend: "dest-in" }]).png().toFile(path.join(dir, `${name}.png`));
  }
  await sharp(droid).resize(layer, layer).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
  await sharp(gradient(layer)).png().toFile(path.join(dir, "ic_launcher_background.png"));
}
fs.writeFileSync(
  out("android/app/src/main/res/values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${outer}</color>\n</resources>\n`,
);
console.log("icons written from", src);
