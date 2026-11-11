// Four new demo packs (her ask, Nov 12 2026: «сделать ещё демо-данные, другие, а то у нас старые, на разные темы,
// чтоб можно было всё потестить»). Each one is built so the findings it is made for always show, in Settings → Data
// → demo packs (owner tools):
//   "Work & home"     — "You mostly argue with your partner on days you feel drained after work" (the store's story),
//                       a chain into the arguments, "most often … drained or …", calm mostly on days outside (the good
//                       side), "looks like it's something else" for the headache (sleep and alcohol: the same share of headache days with and without), and her own question without
//                       words ("Say … in your own words").
//   "Migraine & cycle" — "you most often have a headache on days you have your period or feel stressed" (two cycles of
//                       answers, the cycle rule), a next-day link: late coffee → short night.
//   "Parenting"       — "You mostly feel like a bad parent on days you yell at your kid", yelling mostly on days with no
//                       time for yourself, calm with me-time.
//   "Good days"       — the good side: happy most often with friends, time outside or a call to mom (her own question),
//                       calm mostly on days you meditate.
// Days are picked scattered but always the same (a seeded shuffle): an every-third-day rhythm made "the day after"
// links out of nothing (Nov 12 2026, first try). The pairs that matter get exact counts.
export interface NovPack {
  id: "work-home" | "migraine-cycle" | "parenting" | "good-days";
  templateIds: string[];
  /** her own questions, as people type them (without answer words, to try "Say … in your own words") */
  own?: { key: string; en: string; ru: string; problemWhen: "yes" | "no" }[];
  script: (days: number) => Map<string, (boolean | undefined)[]>;
}

/** A small seeded random (mulberry32): the same days every time. */
const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** Exactly `count` of the given days (indexes), picked scattered. */
const someOf = (days: number[], count: number, seed: number): Set<number> => {
  const r = rng(seed), list = [...days];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return new Set(list.slice(0, Math.min(count, list.length)));
};
const all = (n: number) => Array.from({ length: n }, (_, i) => i);
const where = (n: number, f: (i: number) => boolean) => all(n).filter(f);
const toSeries = (n: number, s: Set<number>) => all(n).map((i) => s.has(i));
/** `inside` of the days in `base`, plus `outside` of the other days. */
const mostlyOn = (n: number, base: Set<number>, inside: number, outside: number, seed: number) =>
  new Set([...someOf([...base], inside, seed), ...someOf(where(n, (i) => !base.has(i)), outside, seed + 1)]);

const workHome: NovPack = {
  id: "work-home",
  templateIds: ["burned-out-after-work", "argued-with-partner", "slept-enough", "outside-30min", "felt-calm", "drank-alcohol", "headache", "good-time-together"],
  own: [{ key: "email", en: "Did I check work email after 8 pm?", ru: "Была рабочая почта после 20:00?", problemWhen: "yes" }],
  script: (n) => {
    const drained = someOf(all(n), 15, 11);
    const short = mostlyOn(n, drained, 12, 3, 12);              // short nights mostly on drained days
    const argued = mostlyOn(n, drained, 12, 2, 13);             // 12 of 14 arguments on drained days, 2 on the other 45
    const outside = someOf(all(n), 40, 1815);
    const calm = mostlyOn(n, outside, 27, 4, 1816);               // calm mostly on days outside
    const alcohol = someOf(all(n), 20, 1817);
    const headache = mostlyOn(n, alcohol, 6, 12, 1818);           // 6 of 20 with alcohol, 12 of 40 without: the same share
    const together = someOf(all(n), 18, 1820);
    const email = mostlyOn(n, drained, 11, 3, 19);
    return new Map([
      ["burned-out-after-work", toSeries(n, drained)], ["argued-with-partner", toSeries(n, argued)], ["slept-enough", toSeries(n, short).map((x) => !x)],
      ["outside-30min", toSeries(n, outside)], ["felt-calm", toSeries(n, calm)], ["drank-alcohol", toSeries(n, alcohol)], ["headache", toSeries(n, headache)],
      ["good-time-together", toSeries(n, together)], ["own:email", toSeries(n, email)],
    ]);
  },
};

const migraineCycle: NovPack = {
  id: "migraine-cycle",
  templateIds: ["headache", "period-day", "felt-stressed", "slept-enough", "coffee-late", "felt-fatigued", "drank-water", "screens-before-bed"],
  script: (n) => {
    const period = new Set(where(n, (i) => i % 28 < 5));                       // a cycle: two and a bit; a headache on all but one period day (a shifted block made "the day after a headache, your period")
    const stressed = someOf(where(n, (i) => !period.has(i)), 9, 21);
    const headache = new Set([...where(n, (i) => period.has(i) && i !== 30), ...someOf([...stressed], 8, 22), ...someOf(where(n, (i) => !period.has(i) && !stressed.has(i)), 1, 23)]);
    const coffee = someOf(where(n, (i) => i < n - 1), 12, 24);
    const after = new Set([...coffee].map((i) => i + 1));
    const short = new Set([...someOf([...after], 10, 25), ...someOf(where(n, (i) => !after.has(i)), 4, 26)]); // the night after late coffee
    const fatigued = mostlyOn(n, short, 11, 3, 27);
    return new Map([
      ["headache", toSeries(n, headache)], ["period-day", toSeries(n, period)], ["felt-stressed", toSeries(n, stressed)],
      ["slept-enough", toSeries(n, short).map((x) => !x)], ["coffee-late", toSeries(n, coffee)], ["felt-fatigued", toSeries(n, fatigued)],
      ["drank-water", toSeries(n, someOf(all(n), 30, 28))], ["screens-before-bed", toSeries(n, someOf(all(n), 15, 29))],
    ]);
  },
};

// seeds picked so no unplanned link shows (a search over seeds, Nov 12 2026)
const P = 1850, G = 1108;

const parenting: NovPack = {
  id: "parenting",
  templateIds: ["yelled-at-kid", "felt-bad-parent", "time-for-myself", "child-slept-poorly", "slept-enough", "felt-calm", "quality-time-kid", "felt-overwhelmed-parenting"],
  script: (n) => {
    const childPoor = someOf(all(n), 12, P);
    const short = mostlyOn(n, childPoor, 10, 3, P + 1);
    const meTime = someOf(all(n), 40, P + 2);
    const noMe = new Set(where(n, (i) => !meTime.has(i)));
    const yelled = mostlyOn(n, noMe, 14, 2, P + 3);                // yelling mostly on days with no time for yourself
    const badParent = mostlyOn(n, yelled, 13, 1, P + 4);           // "bad parent" mostly on yelling days
    const calm = mostlyOn(n, meTime, 30, 2, P + 5);                // calm with me-time
    return new Map([
      ["yelled-at-kid", toSeries(n, yelled)], ["felt-bad-parent", toSeries(n, badParent)], ["time-for-myself", toSeries(n, meTime)],
      ["child-slept-poorly", toSeries(n, childPoor)], ["slept-enough", toSeries(n, short).map((x) => !x)], ["felt-calm", toSeries(n, calm)],
      ["quality-time-kid", toSeries(n, mostlyOn(n, meTime, 12, 3, P + 6))], ["felt-overwhelmed-parenting", toSeries(n, someOf(all(n), 15, P + 7))],
    ]);
  },
};

const goodDays: NovPack = {
  id: "good-days",
  templateIds: ["felt-happy", "saw-friends", "outside-30min", "meditated", "felt-calm", "screen-time-long", "did-creative-work", "walked-a-lot"],
  own: [{ key: "mom", en: "Did I call my mom?", ru: "Был звонок маме?", problemWhen: "no" }],
  script: (n) => {
    const friends = someOf(all(n), 12, G);
    const outside = someOf(where(n, (i) => !friends.has(i)), 10, G + 1);
    const mom = someOf(where(n, (i) => !friends.has(i) && !outside.has(i)), 8, G + 2);
    const others = someOf(where(n, (i) => !friends.has(i) && !outside.has(i) && !mom.has(i)), 2, G + 3);
    const happy = new Set([...friends, ...outside, ...mom, ...others]); // happy days come with friends, time outside or a call to mom
    const meditated = someOf(all(n), 30, G + 4);
    const calm = mostlyOn(n, meditated, 25, 3, G + 5);             // calm mostly on days you meditate
    return new Map([
      ["felt-happy", toSeries(n, happy)], ["saw-friends", toSeries(n, friends)], ["outside-30min", toSeries(n, outside)], ["meditated", toSeries(n, meditated)],
      ["felt-calm", toSeries(n, calm)], ["screen-time-long", toSeries(n, mostlyOn(n, new Set(where(n, (i) => !meditated.has(i))), 13, 2, G + 6))],
      ["did-creative-work", toSeries(n, someOf(all(n), 15, G + 7))], ["walked-a-lot", toSeries(n, someOf(all(n), 40, G + 8))], ["own:mom", toSeries(n, mom)],
    ]);
  },
};

export const NOV_PACKS: NovPack[] = [workHome, migraineCycle, parenting, goodDays];
