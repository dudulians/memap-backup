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
import { LINKS_AT, countedDays, pathModel } from "@/lib/pathSteps";
import { isPlayful } from "@/lib/playful";

/** Treasures that come with evenings (the others need something else done). */
const DAILY: ItemId[] = ["balloon", "airplane", "tent", "suitcase", "bicycle", "moon", "house"];

/** Progress lines, closest first (at most five). */
export const progressLines = (trackers: Tracker[], entries: TrackerEntry[], notes: number, opts: { weekReport?: boolean } = {}): string[] => {
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
  // no countdown once it has passed: links need clear days, not a date (persona walk, Nov 9 2026: "first links in
  // about 1 evening" on day 21 with nothing to show)
  if (routes.length === 0) {
    const days = countedDays(trackers, entries).length;
    if (days < LINKS_AT) out.push({ left: LINKS_AT - days, text: t("notifications.firstLinks", { count: LINKS_AT - days }) });
  }
  // links found: how many, never what (her note, Nov 6 2026: reminders can be beautiful too)
  else out.push({ left: 2, text: t("notifications.links", { count: routes.length }) });
  // the nearest treasure that comes with evenings (not with "Games and rewards" off)
  const f = worldFacts(trackers, entries, islands, routes, notes);
  const next = !isPlayful() ? undefined : DAILY.filter((id) => !owned(id, f))
    .map((id) => { const [k, n] = itemProgress(id, f); return { id, left: n - k }; })
    .filter((x) => x.left >= 1)
    .sort((a, b) => a.left - b.left)[0];
  if (next && ITEMS.some((it) => it.id === next.id)) {
    out.push({ left: next.left, text: t("notifications.treasure", { treasure: t(`items.${next.id}.name`), count: next.left }) });
  }
  // the week's report: evenings to the end of this calendar week, while it can still come (3 evenings).
  // The count goes down with the calendar, not with answers, so it's only for the next reminder
  // (notifications.ts asks for it once: opts.weekReport).
  if (opts.weekReport !== false) {
    const m = pathModel(trackers, entries);
    if (m.reportIn) out.push({ left: m.reportIn, text: t("notifications.report", { count: m.reportIn }) });
  }

  out.sort((a, b) => a.left - b.left);
  return [...new Set(out.map((x) => x.text))].slice(0, 5);
};
