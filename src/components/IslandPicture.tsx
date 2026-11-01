// An island as a picture: her base art plus what stands on it, the same
// composition the Map draws on its ball (WorldMap drawThing). Used on the
// evening cards (Aurora step 3) and on island sheets.
import { islandDef, mapPic, type IslandId } from "@/lib/islands";

export const IslandPicture = ({ id, width = 150, className }: { id: IslandId; width?: number; className?: string }) => {
  const def = islandDef(id);
  // Land items rise above the base, so the box is taller than the base.
  const height = Math.round(width * 0.9);
  const cy = height - width * 0.3; // the base's centre
  const at = (dx: number, dy: number, w: number) => ({
    left: width / 2 + dx * width - w / 2,
    top: cy + dy * width,
    width: w,
  });
  return (
    <div aria-hidden="true" className={className} style={{ position: "relative", width, height }}>
      <img src={mapPic(def.base)} alt="" decoding="async" draggable={false}
        className="pointer-events-none absolute -translate-y-1/2" style={at(0, 0, width)} />
      {(def.land ?? []).map(([name, lw, dx, dy]) => (
        <img key={name} src={mapPic(name)} alt="" decoding="async" draggable={false}
          className="pointer-events-none absolute -translate-y-1/2" style={at(dx, dy, lw * width)} />
      ))}
    </div>
  );
};
