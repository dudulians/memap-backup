// "Minimum medicine" (her pick, Nov 10 2026: "минимизируем мед советы… хочу быть спокойной в своём приложении" —
// "только ты не удаляй, а как бы архивируй, чтоб мы могли оптом к этому вернуться").
//
// Nothing here deletes anything. The original texts stay where they always were (lifeStreams.ts, bodyTemplates.ts,
// researchTemplates.ts, observeTipsData.ts); this file only lays a calmer version over them while MINIMAL_MEDICINE is
// true. Set it to false and everything comes back at once: the doctor plans, the 11 body questions in the library, the
// 5 tips. People's answers are never touched either way. The full version before Nov 10 is also the git tag
// archive/medical-full-2026-11-10 (with the red-flag list); the list of what changed is
// marketing/archive/medical-content-2026-11-10.md.

/** The switch. */
export const MINIMAL_MEDICINE = true;

/** Clinical body questions not offered to new people (library, search, ideas, islands, hunches, starters).
 *  Anyone who already has one keeps it, with its answers and links. */
export const QUIET_IDS = new Set([
  "pee-burning", "bladder-urgency", "bladder-leak", "piles-bothered", "night-sweats", "dizzy",
  "fingers-white-cold", "tinnitus-louder", "heavy-flow-day", "medicine-change", "hot-flushes",
]);

/** Worth-watching tips about illnesses and medicines, not shown (their copy and sources stay in observeTipsData.ts). */
export const QUIET_TIPS = new Set(["skipped-meal", "took-painkiller", "neck-pain", "period-day", "stomach-issues"]);

/** When to act without a doctor: each plan on its own question's topic (her rule, Nov 9 2026), said as a step the
 *  person can take; "once" so it is a single "I did it", not a 2-week test. Couples or family therapists stay
 *  (thought-about-leaving, thought-divorce, parent-pressured): they are not medicine. */
type Plan = { en: string; ru: string };
const LOOK = (en: string, ru: string): Plan => ({ en, ru });
export const CALM_PLANS: Record<string, Plan> = {
  headache: LOOK("Look back at what came before the headache days", "Посмотреть, что было перед днями с головной болью"),
  migraine: LOOK("Look back at what came before the migraine days", "Посмотреть, что было перед днями с мигренью"),
  "back-or-neck-pain": LOOK("Look back at what came before the back pain", "Посмотреть, что было перед болью в спине"),
  "stomach-issues": LOOK("Look back at what came before the stomach aches", "Посмотреть, что было перед болью в животе"),
  "joint-pain": LOOK("Look back at what came before the joint pain", "Посмотреть, что было перед болью в суставах"),
  "felt-fatigued": LOOK("Look back at what came before the drained days", "Посмотреть, что было перед днями без сил"),
  "heart-palpitations": LOOK("Look back at what came before the racing-heart days", "Посмотреть, что было перед днями с сердцебиением"),
  "took-painkiller": LOOK("Look back at what came before the painkiller days", "Посмотреть, что было перед днями с обезболивающим"),
  "sick-day": LOOK("Look back at what came before the days you felt ill", "Посмотреть, что было перед днями болезни"),
  "headache-stopped-me": LOOK("Look back at what came before these headache days", "Посмотреть, что было перед этими днями с головной болью"),
  "neck-pain": LOOK("Look back at what came before the neck pain", "Посмотреть, что было перед болью в шее"),
  "sleep-aid": LOOK("Look back at the evenings before you took something to sleep", "Посмотреть, какими были вечера перед средством для сна"),
  "snored-or-gasped": LOOK("Look back at the evenings before the snoring nights", "Посмотреть, какими были вечера перед ночами с храпом"),
  bloated: LOOK("Look back at what you ate before the bloating", "Посмотреть, что было в еде перед вздутием"),
  "bladder-leak": LOOK("Look back at what came before the leaks", "Посмотреть, что было перед подтеканием"),
  "loose-stool": LOOK("Look back at what you ate before these days", "Посмотреть, что было в еде перед этими днями"),
  "heavy-flow-day": LOOK("Look back at where the heavy days fall in your cycle", "Посмотреть, на какие дни цикла приходятся обильные дни"),
  "hot-flushes": LOOK("Look back at what came before the hot flushes", "Посмотреть, что было перед приливами"),
  "night-sweats": LOOK("Look back at the evenings before the sweaty nights", "Посмотреть, какими были вечера перед ночами с потливостью"),
  breakout: LOOK("Look back at what came before the breakouts", "Посмотреть, что было перед новыми прыщами"),
  dizzy: LOOK("Look back at what came before the dizzy days", "Посмотреть, что было перед днями с головокружением"),
  "jaw-sore-morning": LOOK("Look back at the evenings before a sore jaw", "Посмотреть, какими были вечера перед утрами с больной челюстью"),
  "pee-burning": LOOK("Look back at what came before the burning", "Посмотреть, что было перед жжением"),
  "bladder-urgency": LOOK("Look back at what you drank before the sudden urges", "Посмотреть, что было выпито перед срочными позывами"),
  "piles-bothered": LOOK("Look back at what came before the days piles bothered you", "Посмотреть, что было перед днями, когда беспокоил геморрой"),
  "sweated-a-lot": LOOK("Look back at what came before the heavy sweating", "Посмотреть, что было перед сильной потливостью"),
  "tinnitus-louder": LOOK("Look back at what came before the louder days", "Посмотреть, что было перед днями, когда шум в ушах сильнее"),
  "had-energy": LOOK("Look back at what came before the low-energy days", "Посмотреть, что было перед днями без энергии"),
  "panic-attack": LOOK("Look back at what came before the panic attacks", "Посмотреть, что было перед паническими атаками"),
  "felt-anxious": LOOK("Tell someone you trust how these days have been", "Рассказать близкому человеку, как прошли эти дни"),
  "felt-depressed": LOOK("Tell someone you trust how these days have been", "Рассказать близкому человеку, как прошли эти дни"),
  "lost-interest": LOOK("Tell someone you trust how these days have been", "Рассказать близкому человеку, как прошли эти дни"),
  "cried-today": LOOK("Talk to a friend about what's building up", "Поговорить с близким человеком о том, что копится"),
  "parent-confused": LOOK("Look back at what came before the confused days", "Посмотреть, что было перед днями с путаницей"),
  "parent-skipped-meal": LOOK("Look back at what came before the skipped meals", "Посмотреть, что было перед пропусками еды"),
  "parent-slept-poorly": LOOK("Look at the evening: late naps, screens, coffee, pain", "Посмотреть на вечер: дневной сон, экраны, кофе, боль"),
  "parent-stumbled": LOOK("Look around their home for things to trip over", "Посмотреть, обо что у них дома можно споткнуться"),
  "parent-took-meds": LOOK("Get a weekly pill box or set reminders", "Завести таблетницу на неделю или поставить напоминания"),
  "parent-pain": LOOK("Write down where it hurts and when", "Записать, где и когда болит"),
  "parent-good-mood": LOOK("Notice what lifts their mood: a visit, a call, a hobby", "Замечать, что поднимает им настроение: визит, звонок, хобби"),
};

/** The doctor plans' own words, from the library, collected while the calm ones are laid over them: old saved
 *  questions that still carry one are refreshed to the calm plan (storage.ts), and back again if the switch flips. */
export const ARCHIVED_PLANS = new Set<string>();
export const CALM_PLAN_TEXTS = new Set<string>(Object.values(CALM_PLANS).flatMap((p) => [p.en, p.ru]));

type Tpl = { id: string; adviceAboveThreshold?: string; adviceAboveThresholdRu?: string; planKind?: "once" | "daily"; quiet?: boolean };
/** Lay "minimum medicine" over the library (called once, from lifeStreams.ts, after all templates are in). */
export const applyMinimalMedicine = (streams: { templates: Tpl[] }[]) => {
  if (!MINIMAL_MEDICINE) return;
  for (const s of streams) for (const t of s.templates) {
    if (QUIET_IDS.has(t.id)) t.quiet = true;
    const calm = CALM_PLANS[t.id];
    if (!calm) continue;
    if (t.adviceAboveThreshold) ARCHIVED_PLANS.add(t.adviceAboveThreshold);
    if (t.adviceAboveThresholdRu) ARCHIVED_PLANS.add(t.adviceAboveThresholdRu);
    t.adviceAboveThreshold = calm.en;
    t.adviceAboveThresholdRu = calm.ru;
    t.planKind = "once";
  }
};

/** A saved plan that should be refreshed from the library: a doctor plan while the switch is on, a calm one after
 *  it is turned off. */
export const isSwitchedPlan = (text: string) => (MINIMAL_MEDICINE ? ARCHIVED_PLANS.has(text) : CALM_PLAN_TEXTS.has(text));
