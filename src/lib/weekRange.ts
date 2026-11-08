// This calendar week as dates (her note, Nov 8 2026: "This week, since Monday" — "не очень понимаю"):
// "Nov 2–8" / «2–8 ноября», across months "Oct 30 – Nov 5" / «30 октября – 5 ноября».
export const weekRange = (lang: string, now = new Date()): string => {
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const ru = lang.startsWith("ru");
  const same = mon.getMonth() === sun.getMonth();
  if (ru) {
    const full = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    return same ? `${mon.getDate()}–${full(sun)}` : `${full(mon)} – ${full(sun)}`;
  }
  const short = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return same ? `${short(mon)}–${sun.getDate()}` : `${short(mon)} – ${short(sun)}`;
};
