// The app icon from her pick (Nov 5 2026: "Yes, icon 1"): her pastel globe,
// cropped ×1.3 so the globe fills the square (it read best at 60 pt on the
// real-size board). Writes every file the iOS and Android projects use, in
// the sizes they already have, plus the store copies.
//   node marketing/tools/make-app-icon.cjs
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const SRC = path.join(root, "marketing/app-icon/candidates-2026-11-05/1-globe-pastel.webp");
const OUT = path.join(root, "marketing/app-icon");
const ZOOM = 1.3;
// Android often masks the icon with a circle: a little less zoom there, so the pin stays inside it
const ZOOM_ROUND = 1.15;
const res = (d, n) => path.join(root, `android/app/src/main/res/mipmap-${d}/${n}.png`);
const DENS = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

(async () => {
  const meta = await sharp(SRC).metadata();
  const side = Math.min(meta.width, meta.height);
  const crop = Math.round(side / ZOOM);
  const left = Math.round((meta.width - crop) / 2), top = Math.round((meta.height - crop) / 2);

  // the background colour: the picture's own corners
  const corner = await sharp(SRC).extract({ left: 0, top: 0, width: 40, height: 40 }).stats();
  const bg = { r: Math.round(corner.channels[0].mean), g: Math.round(corner.channels[1].mean), b: Math.round(corner.channels[2].mean) };

  // the master: 1024×1024, no transparency, square corners (Apple rounds them)
  const master = await sharp(SRC).extract({ left, top, width: crop, height: crop }).resize(1024, 1024, { kernel: "lanczos3" })
    .flatten({ background: bg }).removeAlpha().png().toBuffer();
  const cropR = Math.round(side / ZOOM_ROUND);
  const roundMaster = await sharp(SRC).extract({ left: Math.round((meta.width - cropR) / 2), top: Math.round((meta.height - cropR) / 2), width: cropR, height: cropR })
    .resize(1024, 1024, { kernel: "lanczos3" }).flatten({ background: bg }).removeAlpha().png().toBuffer();
  const write = async (file, buf) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); };
  await write(path.join(OUT, "memap-icon-1024.png"), master);
  await write(path.join(OUT, "memap-icon-play-512.png"), await sharp(master).resize(512, 512).removeAlpha().png().toBuffer());

  // iOS: one 1024 icon; and the sources @capacitor/assets reads, so a later regenerate keeps it
  for (const f of ["ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", "assets/icon.png", "assets/icon-source.png", "resources/icon.png"]) {
    await write(path.join(root, f), master);
  }

  // Android
  for (const [d, size] of Object.entries(DENS)) {
    // legacy square: rounded, a small margin, like the files it replaces
    const m = Math.round(size * 0.03), inner = size - 2 * m, r = Math.round(inner * 0.18);
    const mask = Buffer.from(`<svg width="${inner}" height="${inner}"><rect width="${inner}" height="${inner}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
    const sq = await sharp(master).resize(inner, inner).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    await write(res(d, "ic_launcher"), await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: sq, left: m, top: m }]).png().toBuffer());
    // round
    const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    await write(res(d, "ic_launcher_round"), await sharp(roundMaster).resize(size, size).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer());
    // adaptive layers: the xml insets each by 16.7%, so the picture fills its layer;
    // launchers then mask it (a circle on many phones), so it uses the round crop
    const layer = Math.round(size * 2.25);
    await write(res(d, "ic_launcher_foreground"), await sharp(roundMaster).resize(layer, layer).removeAlpha().png().toBuffer());
    await write(res(d, "ic_launcher_background"), await sharp({ create: { width: layer, height: layer, channels: 4, background: { ...bg, alpha: 1 } } }).png().toBuffer());
  }
  console.log("ok", { crop, left, top, bg });
})();
