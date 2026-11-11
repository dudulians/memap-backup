// One island picture, drawn the same everywhere (her note, Nov 11 2026: "надо понять, что у нас везде — и в
// онбординге, и в создании острова, и когда мы рассказываем про острова — они одинаковые, и по стадиям расписаны
// одинаково"; the island card showed a bare island while the globe showed it with its treasures, the ladder's
// "In bloom" had its flag hanging in the air, and making her own island showed the old flat-map art with the house
// floating over its base). The island from her pack at its stage, and what stands on it exactly as on the globe
// (PlanetMap / PlanetGlobe): her garden, the lighthouse, the flag at "In bloom", her treasures in their places.
import type { IslandId } from "@/lib/islands";
import { art, artOf, stageOf } from "@/lib/globeArt";
import { mapPicFor } from "@/lib/islands";
import { standAt, standsOn } from "@/lib/islandSpots";
import type { PlacedTreasure } from "@/lib/growth";
import { cn } from "@/lib/utils";

const pair = (pic: string) => (<><img className="art-day" src={mapPicFor(pic, false)} alt="" /><img className="art-night" src={mapPicFor(pic, true)} alt="" /></>);

export const IslandAsOnGlobe = ({ island, days, treasures, garden, lit = false, className, style }: {
  island: IslandId;
  /** evenings answered on it: its stage */
  days: number;
  /** her treasures placed on it (growth.ts placeTreasures), as on the globe */
  treasures?: PlacedTreasure[];
  /** trees from her finished tests */
  garden?: string[];
  /** its lighthouse is lit (time to act) */
  lit?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const name = artOf(island, days), stage = stageOf(days);
  return (
    <span aria-hidden="true" data-art={name} className={cn("planet-isle island-pic", className)} style={style}>
      <img className="art-day island-art" src={art(name, false)} alt="" />
      <img className="art-night island-art" src={art(name, true)} alt="" />
      {garden?.map((pic, gi) => <span key={`g${gi}`} className="stand tree" style={standAt(name, gi === 0 ? "g1" : "g2")}>{pair(pic)}</span>)}
      {lit && <span className="stand lighthouse" style={standAt(name, "light")}>{pair("lighthouse")}</span>}
      {stage === 4 && <span className="stand flag" style={standAt(name, "flag")}>{pair("marker_flag")}</span>}
      {treasures?.filter((tr) => !tr.ghost && standsOn(name, tr.id)).map((tr) => (
        <span key={tr.id} className={`treasure t-${tr.slot} it-${tr.id}${tr.slot !== "sky" ? " stand" : ""}`} style={tr.slot !== "sky" ? standAt(name, tr.slot) : undefined}>{pair(tr.pic)}</span>
      ))}
    </span>
  );
};
