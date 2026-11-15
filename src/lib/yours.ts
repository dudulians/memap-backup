// Whose question it is (Nov 15 2026, board C: "★ Yours · you came with this" / "MeMap suggested"): the topic she came
// with (and the other topics picked with it) or a question in her own words is hers; the rest MeMap suggested.
import type { Tracker } from "@/types/tracker";
import { templateIdOf } from "@/lib/answerPhrases";
import { getDoorState } from "@/lib/doors";

export const yoursOf = (tr: Tracker): "came" | "own" | null => {
  const d = getDoorState();
  if (d && (d.trackerId === tr.id || d.extra?.some((x) => x.trackerId === tr.id))) return "came";
  // someone from the old look came with every question they had before the new look began (old-user walk, Nov 15 2026)
  if (!d) {
    try {
      const since = localStorage.getItem("memap_path_start");
      if (since && localStorage.getItem("memap_upgrade_invite") === "accepted" && (tr.createdAt ?? "").slice(0, 10) < since) return "came";
    } catch { /* as below */ }
  }
  return templateIdOf(tr) ? null : "own";
};
