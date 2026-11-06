// Reminders that say how close she is (Nov 6 2026, her pick from the hooks): instead
// of "Time for today's check-in", the evening reminder says what tonight brings —
// "Health grows in 2 evenings", "3 more evenings to your Balloon", "Your first links
// in about 9 evenings", "Your week's report in 4 evenings".
// Each count is how many evenings are LEFT from where she is now, so a reminder stays
// true until she answers again — and answering reschedules them all
// (notifications.ts). Nothing private: islands and treasures, never her questions.
import i18n from "@/lib/i18n";
import type { Tracker, TrackerEntry } from "@/types/tracker";
import { buildIslands, buildRoutes, islandName, type IslandId } from "@/lib/islands";
import { islandEvenings, toNextStage } from "@/lib/globeArt";
import { ITEMS, itemProgress, owned, worldFacts, type ItemId } from "@/lib/growth";
import { DAYS_PER_WEEK, countedDays, pathModel } from "@/lib/pathSteps";

/** Treasures that come with evenings (the others need something else done). */
const DAILY: ItemId[] = ["balloon", "airplane", "tent", "suitcase", "bicycle", "moon", "house"];
/** Evenings of answers before the first links can show (honest: "about"). */
const LINKS_AT = 10;

/** Progress lines, closest first (at most five). */
export const progressLines = (trackers: Tracker[], entries: TrackerEntry[], notes: number): string[] => {
  const t = i18n.t.bind(i18n);
  if (entries.length === 0 && trackers.length === 0) return [];
  const out: { left: number; text: string }[] = [];
  const islands = buildIslands(trackers, entries);
  const routes = buildRoutes(trackers, entries, islands);
  const evenings = islandEvenings(trackers, entries);

  // her islands growing: the one closest to its next stage
  for (const isl of islands) {
    const left = toNextStage(evenings.get(isl.id) ?? 0);
    if (left === null || left < 1) continue;
    const name = islandName(t, isl.id as IslandId);
    if (!name) continue;
    out.push({ left, text: t("notifications.grows", { island: name, count: left }) });
  }
  // the first links
  if (routes.length === 0) {
    const days = countedDays(trackers, entries).length;
    out.push({ left: Math.max(1, LINKS_AT - days), text: t("notifications.firstLinks", { count: Math.max(1, LINKS_AT - days) }) });
  }
  // the nearest treasure that comes with evenings
  const f = worldFacts(trackers, entries, islands, routes, notes);
  const next = DAILY.filter((id) => !owned(id, f))
    .map((id) => { const [k, n] = itemProgress(id, f); return { id, left: n - k }; })
    .filter((x) => x.left >= 1)
    .sort((a, b) => a.left - b.left)[0];
  if (next && ITEMS.some((it) => it.id === next.id)) {
    out.push({ left: next.left, text: t("notifications.treasure", { treasure: t(`items.${next.id}.name`), count: next.left }) });
  }
  // the week's report
  const m = pathModel(trackers, entries);
  const done = m.pastInWeek.length + (m.todayCounted ? 1 : 0);
  if (done < DAYS_PER_WEEK) out.push({ left: DAYS_PER_WEEK - done, text: t("notifications.report", { count: DAYS_PER_WEEK - done }) });

  out.sort((a, b) => a.left - b.left);
  return [...new Set(out.map((x) => x.text))].slice(0, 5);
};
