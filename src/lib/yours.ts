// Whose question it is (Nov 15 2026, board C: "★ Yours · you came with this" / "MeMap suggested"): the topic she came
// with (and the other topics picked with it) or a question in her own words is hers; the rest MeMap suggested.
import type { Tracker } from "@/types/tracker";
import { templateIdOf } from "@/lib/answerPhrases";
import { getDoorState } from "@/lib/doors";

export const yoursOf = (tr: Tracker): "came" | "own" | null => {
  const d = getDoorState();
  if (d && (d.trackerId === tr.id || d.extra?.some((x) => x.trackerId === tr.id))) return "came";
  return templateIdOf(tr) ? null : "own";
};
