// Her note (Nov 7 2026): "иконка слишком бледная, у нас были ещё варианты?" — the live icon and
// brighter options side by side at real size. Writes marketing/app-icon/candidates-2026-11-07/.
const sharp = require("sharp");
const path = require("path");
const root = path.resolve(__dirname, "../..");
const C = path.join(root, "marketing/app-icon/candidates-2026-11-05");
const OUT = path.join(root, "marketing/app-icon/candidates-2026-11-07");
const crop = async (src, zoom, dy = 0) => {
  const m = await sharp(src).metadata(); const side = Math.min(m.width, m.height); const c = Math.round(side / zoom);
  const top = Math.max(0, Math.min(m.height - c, Math.round((m.height - c) / 2 + dy * m.height)));
  return sharp(src).extract({ left: Math.round((m.width - c) / 2), top, width: c, height: c }).resize(1024, 1024, { kernel: "lanczos3" });
};
(async () => {
  const v = [
    ["A-now", await crop(path.join(C, "1-globe-pastel.webp"), 1.3)],
    ["B-pastel-brighter", (await crop(path.join(C, "1-globe-pastel.webp"), 1.3)).modulate({ saturation: 1.55, brightness: 0.97 }).linear(1.12, -16)],
    ["C-bright-clouds", await crop(path.join(C, "3-globe-bright-clouds.webp"), 1.22, -0.02)],
    ["D-bright-clouds-richer", (await crop(path.join(C, "3-globe-bright-clouds.webp"), 1.22, -0.02)).modulate({ saturation: 1.2 }).linear(1.06, -8)],
    ["E-night", await crop(path.join(C, "4-globe-night.webp"), 1.22, -0.02)],
  ];
  for (const [name, img] of v) await img.flatten({ background: "#ffffff" }).removeAlpha().png().toFile(path.join(OUT, `${name}.png`));
  console.log("ok", v.map((x) => x[0]).join(", "));
})();
