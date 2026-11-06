// Which island growths she has seen happen (src/components/GrowMoment.tsx), once each.
const SEEN = "memap_grow_seen";
export const growSeen = (island: string, stage: number): boolean => {
  try { return (JSON.parse(localStorage.getItem(SEEN) || "[]") as string[]).includes(`${island}:${stage}`); } catch { return true; }
};
export const markGrowSeen = (island: string, stage: number) => {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN) || "[]") as string[];
    if (!all.includes(`${island}:${stage}`)) localStorage.setItem(SEEN, JSON.stringify([...all, `${island}:${stage}`].slice(-60)));
  } catch { /* plays again, harmless */ }
};
