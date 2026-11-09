// This calendar week as dates (her note, Nov 8 2026: "This week, since Monday" — "не очень понимаю"):
// "Nov 2–8" / «2–8 ноября», across months "Oct 30 – Nov 5" / «30 октября – 5 ноября».
export const weekRange = (lang: string, now = new Date()): string => {
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  return dateRange(lang, mon, sun);
};

/** Any span of days the same way: "Nov 8–14" / «8–14 ноября» (the week report says which days it
 *  counts, QA Nov 8 2026: its week and the island's week were different days, with no dates). */
export const dateRange = (lang: string, from: Date, to: Date): string => {
  const ru = lang.startsWith("ru");
  const same = from.getMonth() === to.getMonth();
  if (ru) {
    const full = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    return same ? `${from.getDate()}–${full(to)}` : `${full(from)} – ${full(to)}`;
  }
  const short = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return same ? `${short(from)}–${to.getDate()}` : `${short(from)} – ${short(to)}`;
};

/** The last 7 days, today included, as dates. */
export const last7Range = (lang: string, now = new Date()): string =>
  dateRange(lang, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), now);
