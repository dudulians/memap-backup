// An island as a picture: her base art plus what stands on it, the same
// composition the Map uses for every island. Used on the
// evening cards (Aurora step 3) and on island sheets.
// Nov 2 2026: what has grown there from her real progress (a little house,
// flowers, a garden after a test, a flag; src/lib/growth.ts) stands on it too.
import { islandDef, mapPic, type IslandId } from "@/lib/islands";
import { growthLand, type GrowthKind } from "@/lib/growth";

export const IslandPicture = ({ id, width = 150, className, growth = [] }: { id: IslandId; width?: number; className?: string; growth?: GrowthKind[] }) => {
  const def = islandDef(id);
  const grown = growthLand(growth, def.land);
  // Land items rise above the base, so the box is taller than the base.
  const height = Math.round(width * 0.9);
  const cy = height - width * 0.3; // the base's centre
  const at = (dx: number, dy: number, w: number) => ({
    left: width / 2 + dx * width - w / 2,
    top: cy + dy * width,
    width: w,
  });
  const piece = ([name, lw, dx, dy]: [string, number, number, number], k: string) => (
    <img key={k} src={mapPic(name)} alt="" decoding="async" draggable={false}
      className="pointer-events-none absolute -translate-y-1/2" style={at(dx, dy, lw * width)} />
  );
  return (
    <div aria-hidden="true" className={className} style={{ position: "relative", width, height }}>
      <img src={mapPic(def.base)} alt="" decoding="async" draggable={false}
        className="pointer-events-none absolute -translate-y-1/2" style={at(0, 0, width)} />
      {grown.back.map((p, i) => piece(p, `b${i}`))}
      {(def.land ?? []).map((p) => piece(p, p[0]))}
      {grown.front.map((p, i) => piece(p, `f${i}`))}
    </div>
  );
};
