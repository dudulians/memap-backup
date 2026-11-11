// The body questions people rarely say out loud (her note, Nov 7 2026: "как часто ты
// какаешь… такие болезненные вопросы нужно проверить, что они все есть у нас и что мы
// действительно можем помочь"). Evidence, normal ranges, what helps and red flags:
// marketing/research/body-sensitive-topics.md and body-proposed-additions.md.
// Plain, kind words; never in anyone's default set — offered in the library. Advice stays general
// (see a GP, talk to a doctor): no tests, drugs or therapies by name (her note, Nov 7 2026).
import type { LifeStreamTemplate } from "./lifeStreams";

type T = LifeStreamTemplate & { stream: string };
const q = (id: string, sub: string, title: string, titleRu: string, questionText: string, questionTextRu: string,
  problemWhen: "yes" | "no", periodDays: number, threshold: number, advice = "", adviceRu = "",
  flags: { sensitive?: boolean; private?: boolean; category?: LifeStreamTemplate["category"] } = {}): T => ({
  stream: "health", id, category: flags.category ?? "Body", subcategory: sub, title, titleRu, questionText, questionTextRu,
  answerType: "boolean", periodDays, threshold, problemWhen, adviceAboveThreshold: advice, adviceAboveThresholdRu: adviceRu,
  ...(flags.sensitive ? { sensitive: true } : {}), ...(flags.private ? { private: true } : {}),
});
// no sexual or genital questions (her note, Nov 7 2026: "ооочень щепетильно, не нужно")
const P = { private: true };

export const BODY_TEMPLATES: T[] = [
  q("pooped-today", "Digestion", "Pooped today", "Был стул", "Did you poop today?", "Сегодня получилось сходить в туалет по-большому?", "no", 7, 5, "Have fruit or vegetables at every meal", "Есть фрукты или овощи в каждый приём пищи", P),
  q("hard-to-poop", "Digestion", "Hard to poop", "Трудно сходить в туалет", "Was it hard to poop today — hard or lumpy poop, straining, or you couldn't go?", "Сегодня было трудно сходить в туалет — твёрдый стул, приходилось тужиться или не получилось?", "yes", 30, 8, "Have fruit or vegetables at every meal", "Есть фрукты или овощи в каждый приём пищи", P),
  q("heartburn", "Digestion", "Heartburn or reflux", "Изжога", "Did you have heartburn or a sour taste rising in your throat, today or last night?", "Сегодня или ночью была изжога или кислое подступало к горлу?", "yes", 14, 4, "Finish dinner 3 hours before bed", "Заканчивать ужин за 3 часа до сна"),
  q("bloated", "Digestion", "Bloated belly", "Вздутие живота", "Did your belly feel bloated or swollen today?", "Сегодня пучило или распирало живот?", "yes", 30, 8, "See a GP about the bloating", "Сходить к терапевту из-за вздутия", P),
  q("night-pee-2-plus", "Bladder", "Up 2+ times to pee", "Ночью в туалет 2+ раза", "Did you get up 2 or more times to pee last night?", "Этой ночью пришлось вставать в туалет 2 раза или больше?", "yes", 7, 3, "No drinks in the 2 hours before bed", "Ничего не пить за 2 часа до сна", P),
  q("bladder-leak", "Bladder", "Leaked a little pee", "Подтекание мочи", "Did you leak any pee today — when coughing, laughing, lifting, or before reaching the toilet?", "Сегодня подтекала моча — при кашле, смехе, нагрузке или по дороге в туалет?", "yes", 14, 3, "See a GP about the leaks", "Сходить к терапевту из-за подтекания", P),
  q("loose-stool", "Digestion", "Loose or watery poop", "Жидкий стул", "Did you have loose or watery poop today?", "Сегодня был жидкий или очень мягкий стул?", "yes", 30, 8, "Show 4 weeks of answers to a GP", "Показать терапевту ответы за 4 недели", P),
  q("heavy-flow-day", "Cycle", "Heavy period day", "Обильные месячные", "Was your period heavy today — changing within 2 hours, leaking through, or needing two products at once?", "Месячные сегодня обильные — менять средство приходится чаще, чем раз в 2 часа, протекает или нужно два средства сразу?", "yes", 60, 4, "See a GP about heavy periods", "Сходить к врачу из-за обильных месячных"),
  q("hot-flushes", "Menopause", "Hot flushes", "Приливы жара", "Did hot flushes bother you today?", "Сегодня мешали приливы жара?", "yes", 14, 7, "Talk to a doctor about the hot flushes", "Поговорить с врачом о приливах"),
  q("night-sweats", "Menopause", "Woke up sweating", "Ночная потливость", "Did you wake up sweaty or soaked last night?", "Этой ночью приходилось просыпаться в поту?", "yes", 14, 4, "Tell a doctor about the night sweats", "Рассказать врачу про ночную потливость"),
  q("breakout", "Skin", "New breakout", "Новые прыщи", "Did you get new spots or a breakout today?", "Сегодня появились новые прыщи?", "yes", 30, 10, "See a doctor about your skin if it goes on", "Если не проходит — показать кожу врачу"),
  q("dizzy", "Circulation", "Dizzy or light-headed", "Головокружение", "Did you feel dizzy or light-headed today?", "Сегодня кружилась голова или темнело в глазах?", "yes", 30, 5, "Show a doctor your dizzy days", "Показать врачу дни с головокружением"),
  q("medicine-change", "Treatment", "Started or changed a medicine", "Новое лекарство или смена дозы", "Did you start, stop or change a medicine or supplement today?", "Сегодня появилось новое лекарство или добавка, что-то отменилось или поменялась доза?", "yes", 30, 0, "", "", { category: "Health" }),
  q("jaw-sore-morning", "Pain", "Sore jaw on waking", "Утром болит челюсть", "Did your jaw feel sore or tight when you woke up?", "Утром болела или была зажата челюсть?", "yes", 14, 5, "Tell your dentist about it", "Рассказать об этом стоматологу"),
  q("pelvic-floor-exercises", "Bladder", "Pelvic floor exercises", "Упражнения для тазового дна", "Did you do your pelvic floor squeezes today?", "Сегодня были упражнения для мышц тазового дна?", "no", 14, 7, "Do pelvic floor squeezes right after brushing your teeth", "Делать упражнения для тазового дна сразу после чистки зубов", P),
  q("pee-burning", "Bladder", "Burning when peeing", "Жжение при мочеиспускании", "Did it burn or sting when you peed today?", "Сегодня было жжение или резь при мочеиспускании?", "yes", 7, 2, "See a GP about the burning", "Сходить к терапевту из-за жжения", P),
  q("bladder-urgency", "Bladder", "Sudden urge to pee", "Срочные позывы в туалет", "Did you get a sudden urge to pee that was hard to hold today?", "Сегодня был внезапный позыв в туалет, который трудно сдержать?", "yes", 14, 5, "See a GP about the sudden urges", "Сходить к терапевту из-за срочных позывов", P),
  q("piles-bothered", "Digestion", "Piles bothered me", "Беспокоит геморрой", "Did piles bother you today — itching, soreness or a swelling?", "Сегодня беспокоил геморрой — зуд, боль или припухлость?", "yes", 14, 7, "Book a GP about the piles", "Записаться к врачу из-за геморроя", P),
  q("sweated-a-lot", "Skin", "Heavy sweating", "Сильная потливость", "Did heavy sweating bother you today, not from heat or exercise?", "Сегодня мешала сильная потливость — не от жары и не от спорта?", "yes", 30, 8, "See a GP about the sweating", "Сходить к терапевту из-за потливости", P),
  q("tinnitus-louder", "Ears", "Ringing ears louder", "Шум в ушах сильнее", "Was the ringing or buzzing in your ears louder or more bothersome today?", "Сегодня звон или шум в ушах был громче или мешал сильнее?", "yes", 30, 10, "Talk to a doctor about the ringing", "Поговорить с врачом о шуме в ушах"),
  { ...q("breast-tender", "Cycle", "Sore breasts", "Болит грудь", "Were your breasts sore or tender today?", "Сегодня грудь болела или была чувствительной?", "yes", 60, 16, "Get a well-fitting supportive bra", "Подобрать удобный поддерживающий бюстгальтер"), planKind: "once" },
  q("fingers-white-cold", "Circulation", "Fingers went white in the cold", "Пальцы белеют от холода", "Did your fingers or toes turn white or blue in the cold today?", "Сегодня пальцы рук или ног белели или синели от холода?", "yes", 30, 8, "Keep the whole body warm and wear gloves outside", "Держать в тепле всё тело и носить перчатки на улице"),
];

/** Asked only when the answer they follow was "yes" that day; other days they stay blank. */
export const FOLLOW_UPS: Record<string, string> = { "heavy-flow-day": "period-day" };
/** One day without it is normal: a "no" isn't drawn as a hard day (only the rule counts). */
export const QUIET_NO = new Set(["pooped-today"]);
/** Pairs that go together by nature (a follow-up and its question, two sides of one thing):
 *  never shown as a link, "period ↔ heavy period" says nothing new (Nov 7 2026). */
const NATURAL_PAIRS: [string, string][] = [
  ["period-day", "heavy-flow-day"], ["period-day", "period-symptoms"], ["period-day", "pms-signs"], ["period-day", "breast-tender"],
  ["pms-signs", "breast-tender"], ["pms-signs", "period-symptoms"], ["hot-flushes", "night-sweats"], ["bladder-urgency", "bladder-leak"],
  ["pooped-today", "hard-to-poop"], ["pooped-today", "loose-stool"], ["headache", "migraine"], ["felt-depressed", "lost-interest"], ["felt-anxious", "panic-attack"],
  // yelling at the kid and running out of patience with the kid are one moment told twice (Nov 11 2026)
  ["yelled-at-kid", "ran-out-of-patience"],
];
const NATURAL = new Set(NATURAL_PAIRS.flatMap(([x, y]) => [`${x}|${y}`, `${y}|${x}`]));
export const isNaturalPair = (a: string | null, b: string | null) => !!a && !!b && NATURAL.has(`${a}|${b}`);
/** A question already asked inside another one is not suggested next to it ("PMS signs" asks about sore breasts). */
export const COVERED_BY: Record<string, string[]> = { "breast-tender": ["pms-signs"] };
export const isCovered = (tplId: string, have: Iterable<string>) => { const by = COVERED_BY[tplId]; if (!by) return false; const h = new Set(have); return by.some((x) => h.has(x)); };
/** Body questions with a doctor rule: they light even when onboarding added them (lighthouses ALWAYS_LIGHT).
 *  Until Nov 10 2026 their cards also offered "Something worrying?", a list of signs by urgency; that list was
 *  removed (her content audit: MeMap is self-tracking, not medical triage). */
export const DOCTOR_RULE_IDS = new Set([
  ...BODY_TEMPLATES.map((x) => x.id).filter((id) => id !== "pelvic-floor-exercises"),
  "headache", "migraine", "stomach-issues", "felt-nauseous", "heart-palpitations", "period-symptoms", "period-day", "eye-strain", "back-or-neck-pain",
  "panic-attack", "snored-or-gasped", "neck-pain", "headache-stopped-me", "took-painkiller", "felt-fatigued",
  "parent-confused", "parent-stumbled", "parent-pain",
]);
