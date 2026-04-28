import { Tracker, ProblemWhen } from "@/types/tracker";
import { LIFE_STREAMS, LifeStreamTemplate } from "./lifeStreams";
import { TEMPLATE_GROUPS } from "./templateGroups";
import {
  localizeTrackerTitleRaw,
  localizeTrackerQuestionRaw,
  localizeTrackerAdviceRaw,
} from "./trackerLocalize";

// --- Public types ---------------------------------------------------

type Pol = "male" | "female" | "neutral";
type AgeRange = "18-25" | "26-35" | "36-45" | "46-55" | "55+";
type FocusArea =
  | "stress"
  | "sleep"
  | "relationships"
  | "work"
  | "body"
  | "mood"
  | "energy"
  | "money"
  | "hobbies";
type Goal = "patterns" | "habit" | "understand" | "doctor";

export interface InterviewAnswers {
  pol?: Pol;
  age?: AgeRange;
  focus?: FocusArea[];
  hasKids?: boolean;
  hasPets?: boolean;
  hasPartner?: boolean;
  goal?: Goal[];
}

export interface GeneratedStarter {
  title: string;          // localized to active language
  questionText: string;   // localized
  category: Tracker["category"];
  subcategory?: string;
  periodDays: number;
  threshold: number;
  problemWhen: ProblemWhen;
  adviceAboveThreshold: string; // localized
}

// --- Internal: normalised template shape ----------------------------
// Both LIFE_STREAMS templates and TEMPLATE_GROUPS templates collapse into
// this shape, which is what scoring & output operate on. We always score
// against the English title/question/subcategory text + the Russian title
// and questionText where they exist (LIFE_STREAMS only) so keyword lists
// can be either language.

interface NormalizedTemplate {
  // Stable internal id, source-prefixed so dedupe between catalogs works.
  id: string;
  // EN strings used both for display when EN is active and as input to
  // localizeTrackerTitle/Question/Advice (which map EN → RU when needed).
  title: string;
  questionText: string;
  adviceAboveThreshold: string;
  // RU strings, present only on LIFE_STREAMS templates. Used purely for
  // keyword-matching against Russian keywords; never shown directly here
  // because output goes through the localize* helpers which already pick
  // the right side based on the active language.
  titleRu?: string;
  questionTextRu?: string;
  category: Tracker["category"];
  subcategory?: string;
  periodDays: number;
  threshold: number;
  problemWhen: ProblemWhen;
}

const normalizeAll = (): NormalizedTemplate[] => {
  const out: NormalizedTemplate[] = [];

  LIFE_STREAMS.forEach((stream) => {
    stream.templates.forEach((tpl: LifeStreamTemplate) => {
      out.push({
        id: `ls:${stream.id}:${tpl.id}`,
        title: tpl.title,
        questionText: tpl.questionText,
        adviceAboveThreshold: tpl.adviceAboveThreshold,
        titleRu: tpl.titleRu,
        questionTextRu: tpl.questionTextRu,
        category: tpl.category,
        subcategory: tpl.subcategory,
        periodDays: tpl.periodDays,
        threshold: tpl.threshold,
        problemWhen: tpl.problemWhen,
      });
    });
  });

  TEMPLATE_GROUPS.forEach((group) => {
    group.templates.forEach((tpl) => {
      out.push({
        id: `tg:${group.id}:${tpl.id}`,
        title: tpl.title,
        questionText: tpl.questionText,
        adviceAboveThreshold: tpl.adviceAboveThreshold,
        category: tpl.category,
        subcategory: tpl.subcategory,
        periodDays: tpl.periodDays,
        threshold: tpl.threshold,
        problemWhen: tpl.problemWhen,
      });
    });
  });

  return out;
};

// --- Keyword tables -------------------------------------------------

const FOCUS_KEYWORDS: Record<FocusArea, string[]> = {
  stress: ["stress", "anxious", "anxiety", "overload", "tense", "deadline", "pressure", "стресс", "тревог", "перегруз"],
  sleep: ["sleep", "rested", "tired", "сон", "спал", "отдых", "уставший"],
  relationships: ["partner", "family", "argue", "close", "loved", "партнёр", "семь", "близк", "ссор"],
  work: ["work", "job", "burnout", "overtime", "deadline", "работа", "выгорани", "переработ", "дедлайн"],
  body: ["body", "move", "exercise", "headache", "pain", "тело", "движ", "голова", "болит"],
  mood: ["mood", "happy", "low", "blue", "sad", "настроение", "радост", "грусть", "уныни"],
  energy: ["energy", "exhausted", "tired", "fatigue", "энерг", "истощ", "сил"],
  money: ["money", "finance", "spent", "saved", "деньги", "финанс", "потрат"],
  hobbies: ["creative", "hobby", "skill", "learn", "творч", "хобби", "учил"],
};

// Subset of relationships keywords that imply a partner specifically (so
// the hasPartner boost doesn't fire on broad family/friend templates).
const PARTNER_KEYWORDS = ["partner", "партнёр"];

const KIDS_KEYWORDS = ["kids", "children", "parenting", "child", "ребён", "дет"];
const PETS_KEYWORDS = ["dog", "cat", "pet", "walk", "собак", "кошк", "питом"];

// Goal-specific keyword bundles (case-insensitive, EN+RU mixed). These are
// intentionally narrower than focus-area lists so the +1/+2 boosts only
// fire on templates that genuinely match the goal's intent.
const HABIT_KEYWORDS = ["move", "moved", "movement", "exercise", "sleep", "slept", "water", "hydrat", "ate", "meal", "phone", "scroll", "движ", "сон", "спал", "вод", "ел"];
const DOCTOR_KEYWORDS = ["headache", "migraine", "pain", "sleep", "alcohol", "medic", "pill", "side effect", "dizzy", "cramp", "back", "голова", "мигрен", "боль", "сон", "алког", "лекарств", "таблет", "побочн", "спин"];
const PATTERNS_KEYWORDS = ["mood", "anxious", "anxiety", "lonely", "love", "partner", "argue", "family", "close", "настроени", "тревог", "одиноч", "люб", "партнёр", "ссор", "семь", "близк"];
const UNDERSTAND_KEYWORDS = ["mood", "felt", "feel", "wanted", "thought", "noticed", "настроени", "чувств", "хотел", "замет"];

// --- Helpers --------------------------------------------------------

const haystack = (t: NormalizedTemplate): string => {
  return [
    t.title,
    t.titleRu ?? "",
    t.questionText,
    t.questionTextRu ?? "",
    t.subcategory ?? "",
  ]
    .join(" ")
    .toLowerCase();
};

const matchesAny = (hay: string, keywords: string[]): boolean => {
  return keywords.some((kw) => hay.includes(kw.toLowerCase()));
};

// Score one template against the interview answers. Returns a number;
// the higher, the better the fit. Negative scores are possible when
// context flags actively penalise a template (e.g. has-no-kids on a
// parenting template).
const scoreTemplate = (
  tpl: NormalizedTemplate,
  answers: InterviewAnswers
): number => {
  let score = 0;
  const hay = haystack(tpl);

  // --- Focus areas (strongest signal) ---
  const focus = answers.focus ?? [];
  focus.forEach((area) => {
    // Category match — direct mapping of focus → category.
    switch (area) {
      case "stress":
        if (tpl.category === "Emotions") score += 5;
        break;
      case "sleep": {
        const isSleep =
          (tpl.subcategory ?? "").toLowerCase().includes("sleep") ||
          (tpl.subcategory ?? "").toLowerCase().includes("сон") ||
          tpl.title.toLowerCase().includes("sleep") ||
          tpl.title.toLowerCase().includes("slept") ||
          (tpl.titleRu ?? "").toLowerCase().includes("спал") ||
          (tpl.titleRu ?? "").toLowerCase().includes("сон");
        if (isSleep) score += 5;
        break;
      }
      case "body":
        if (tpl.category === "Body") score += 5;
        break;
      case "relationships":
        if (tpl.category === "Connections") score += 5;
        break;
      case "work": {
        const sub = (tpl.subcategory ?? "").toLowerCase();
        const workSub = sub.includes("burnout") || sub.includes("overload") || sub.includes("motivation");
        if (tpl.category === "Voice" || workSub) score += 5;
        break;
      }
      case "mood":
        if (tpl.category === "Emotions") score += 3;
        break;
      case "energy": {
        const isEnergy =
          hay.includes("energy") ||
          hay.includes("exhaust") ||
          hay.includes("fatigue") ||
          hay.includes("энерг") ||
          hay.includes("истощ");
        if (isEnergy) score += 5;
        break;
      }
      case "money": {
        const isMoney =
          hay.includes("money") ||
          hay.includes("finance") ||
          hay.includes("деньги") ||
          hay.includes("финанс");
        if (isMoney) score += 5;
        break;
      }
      case "hobbies":
        if (tpl.category === "Curious" || tpl.category === "Fun") score += 5;
        break;
    }

    // Keyword match in title/question/subcategory — additive on top of
    // category match so e.g. an Emotions template literally about stress
    // beats a generic Emotions template.
    if (matchesAny(hay, FOCUS_KEYWORDS[area])) score += 3;
  });

  // --- Context flags ---
  if (answers.hasKids === true && matchesAny(hay, KIDS_KEYWORDS)) score += 6;
  if (answers.hasPets === true && matchesAny(hay, PETS_KEYWORDS)) score += 6;
  if (answers.hasPartner === true && matchesAny(hay, PARTNER_KEYWORDS)) score += 4;

  if (answers.hasKids === false && matchesAny(hay, KIDS_KEYWORDS)) score -= 2;
  if (answers.hasPets === false && matchesAny(hay, PETS_KEYWORDS)) score -= 2;

  // --- Goals (multi-select, light nudges) ---
  const goals = answers.goal ?? [];
  goals.forEach((g) => {
    switch (g) {
      case "habit":
        if (matchesAny(hay, HABIT_KEYWORDS)) score += 2;
        break;
      case "doctor":
        if (matchesAny(hay, DOCTOR_KEYWORDS)) score += 2;
        break;
      case "patterns":
        if (matchesAny(hay, PATTERNS_KEYWORDS)) score += 1;
        break;
      case "understand":
        if (matchesAny(hay, UNDERSTAND_KEYWORDS)) score += 1;
        break;
    }
  });

  // --- Age cohort (light nudge) ---
  switch (answers.age) {
    case "18-25":
      if (
        tpl.category === "Social" ||
        tpl.category === "Emotions" ||
        tpl.category === "Voice" ||
        hay.includes("energy") ||
        hay.includes("энерг")
      ) {
        score += 1;
      }
      break;
    case "26-35":
      if (
        tpl.category === "Voice" ||
        tpl.category === "Connections" ||
        hay.includes("sleep") ||
        hay.includes("сон") ||
        hay.includes("спал")
      ) {
        score += 1;
      }
      break;
    case "36-45":
      if (
        tpl.category === "Body" ||
        tpl.category === "Voice" ||
        hay.includes("family") ||
        hay.includes("семь") ||
        hay.includes("kids") ||
        hay.includes("ребён") ||
        hay.includes("дет")
      ) {
        score += 1;
      }
      break;
    case "46-55":
      if (
        tpl.category === "Body" ||
        tpl.category === "Health" ||
        hay.includes("family") ||
        hay.includes("семь")
      ) {
        score += 1;
      }
      break;
    case "55+":
      if (
        tpl.category === "Body" ||
        tpl.category === "Health" ||
        tpl.category === "Fun" ||
        hay.includes("sleep") ||
        hay.includes("сон") ||
        hay.includes("joy") ||
        hay.includes("радост")
      ) {
        score += 1;
      }
      break;
  }

  // pol (gender) intentionally has no scoring effect.

  return score;
};

// True if the interview produced any signal we'd score against — used by
// callers to decide between "use generator" and "fall back to universal
// 5". An interview with only `pol` or only `age` set is treated as "no
// signal" because age alone gives at most +1, which can't differentiate.
export const hasMeaningfulInterviewSignal = (
  answers: InterviewAnswers
): boolean => {
  if (answers.focus && answers.focus.length > 0) return true;
  if (answers.goal && answers.goal.length > 0) return true;
  if (answers.hasKids !== undefined) return true;
  if (answers.hasPets !== undefined) return true;
  if (answers.hasPartner !== undefined) return true;
  return false;
};

// Topic words that should not appear in two picked templates at once.
// We extract the first matching topic from each title and use it as a
// secondary diversity key on top of category + subcategory caps.
// Without this, focus="stress" was producing two anxiety cards
// ("Anxious today?" + "Anxiety days") because they sit in different
// subcategories. Topic-key collision blocks the second one.
const TITLE_TOPIC_KEYWORDS: Array<[string, string[]]> = [
  ["anxiety",   ["anxiety", "anxious", "тревог"]],
  ["sleep",     ["sleep", "slept", "сон", "спал"]],
  ["mood",      ["mood", "low", "blue", "sad", "happy", "настроени"]],
  ["energy",    ["energy", "exhaust", "fatigue", "энерги", "истощ", "сил"]],
  ["stress",    ["stress", "tense", "стресс"]],
  ["headache",  ["headache", "migraine", "голова", "мигрен"]],
  ["partner",   ["partner", "argue", "argument", "партнёр", "ссор"]],
  ["family",    ["family", "kid", "child", "семь", "ребён", "дет"]],
  ["alcohol",   ["alcohol", "drink", "drank", "алког"]],
  ["screen",    ["scroll", "phone", "social", "doomscroll", "лент", "телефон", "соцсет"]],
  ["work",      ["work", "burnout", "overtime", "deadline", "работ", "выгоран", "переработ", "дедлайн"]],
  ["movement",  ["move", "moved", "exercise", "walk", "движ", "ходил", "трен"]],
  ["loneliness",["lonely", "alone", "одинок"]],
  ["voice",     ["spoke", "said", "voice", "speak", "голос", "сказал", "говорил"]],
  ["creative",  ["creat", "draw", "music", "write", "творч", "рисовал", "писал"]],
  ["food",      ["ate", "eat", "meal", "ел", "обед", "завтрак"]],
  ["water",     ["water", "hydrat", "вод"]],
];

const topicOf = (tpl: NormalizedTemplate): string | null => {
  const hay = (tpl.title + " " + (tpl.titleRu ?? "") + " " + (tpl.subcategory ?? "")).toLowerCase();
  for (const [topic, kws] of TITLE_TOPIC_KEYWORDS) {
    if (kws.some((k) => hay.includes(k))) return topic;
  }
  return null;
};

// Pick the top N scored templates with diversity caps so the user
// always sees variety:
//   - Per-category cap (default 2) — at most 2 from same Tracker.category
//   - Per-subcategory cap (1)      — at most 1 from same `subcategory`
//   - Per-topic cap (1)            — at most 1 with the same topic key
//                                    (anxiety, sleep, partner, etc.)
// Tiebreak is stable (insertion order from normalizeAll, i.e.
// LIFE_STREAMS before TEMPLATE_GROUPS).
const pickTop = (
  scored: Array<{ tpl: NormalizedTemplate; score: number }>,
  count: number,
  perCategoryCap: number
): NormalizedTemplate[] => {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked: NormalizedTemplate[] = [];
  const perCat: Map<Tracker["category"], number> = new Map();
  const seenSubcategories = new Set<string>();
  const seenTopics = new Set<string>();
  const seenTitles = new Set<string>();

  for (const item of sorted) {
    if (picked.length >= count) break;
    if (item.score <= 0) break; // ignore zero / negative scored ones in scored pass
    const used = perCat.get(item.tpl.category) ?? 0;
    if (used >= perCategoryCap) continue;
    const sub = item.tpl.subcategory?.trim().toLowerCase();
    if (sub && seenSubcategories.has(sub)) continue;
    const topic = topicOf(item.tpl);
    if (topic && seenTopics.has(topic)) continue;
    const titleKey = item.tpl.title.trim().toLowerCase();
    if (seenTitles.has(titleKey)) continue;
    picked.push(item.tpl);
    perCat.set(item.tpl.category, used + 1);
    if (sub) seenSubcategories.add(sub);
    if (topic) seenTopics.add(topic);
    seenTitles.add(titleKey);
  }

  // Second pass: if caps held us back, relax subcategory/topic
  // restrictions (but keep title dedupe) to fill remaining slots.
  // Variety preferred, but never at the cost of returning < N cards.
  if (picked.length < count) {
    for (const item of sorted) {
      if (picked.length >= count) break;
      if (item.score <= 0) break;
      const titleKey = item.tpl.title.trim().toLowerCase();
      if (seenTitles.has(titleKey)) continue;
      picked.push(item.tpl);
      seenTitles.add(titleKey);
    }
  }

  return picked;
};

// Generated starters are STORED as trackers, not just displayed. Use
// the raw (non-polishing) variants so the bracketed neutral form is
// preserved on disk — that lets the user change pol later and have
// the tracker re-render correctly. polishRu runs at display time.
const toGenerated = (tpl: NormalizedTemplate): GeneratedStarter => ({
  title: localizeTrackerTitleRaw(tpl.title),
  questionText: localizeTrackerQuestionRaw(tpl.questionText),
  category: tpl.category,
  subcategory: tpl.subcategory,
  periodDays: tpl.periodDays,
  threshold: tpl.threshold,
  problemWhen: tpl.problemWhen,
  adviceAboveThreshold: localizeTrackerAdviceRaw(tpl.adviceAboveThreshold),
});

// --- Public API -----------------------------------------------------

export const generateStarterPack = (
  answers: InterviewAnswers,
  count: number = 5,
  /**
   * Lowercase titles to skip. Used by the onboarding "regenerate" flow:
   * the user removes cards she doesn't like and asks for new ones — we
   * pass titles already shown so the next pick avoids them. Without this
   * the same top-scored cards would just come back.
   *
   * Title is the dedupe key (rather than internal template id) because
   * GeneratedStarter doesn't carry the id forward and the localised
   * title is what the UI binds against anyway. Localised titles are
   * unique within a locale.
   */
  excludeTitles: string[] = [],
): GeneratedStarter[] => {
  // No signal at all → return empty so callers fall back to universal 5.
  if (!hasMeaningfulInterviewSignal(answers)) return [];

  const all = normalizeAll();
  const excludeSet = new Set(excludeTitles.map((t) => t.toLowerCase().trim()));
  // Filter BEFORE scoring so candidates already shown can't influence
  // the diversity caps (otherwise an already-shown sleep template would
  // still consume the "1 sleep topic" slot in pickTop).
  const candidates =
    excludeSet.size === 0
      ? all
      : all.filter((tpl) => {
          const ru = (tpl.titleRu ?? "").toLowerCase().trim();
          const en = tpl.title.toLowerCase().trim();
          return !excludeSet.has(ru) && !excludeSet.has(en);
        });
  const scored = candidates.map((tpl) => ({ tpl, score: scoreTemplate(tpl, answers) }));
  const picked = pickTop(scored, count, 2);
  return picked.map(toGenerated);
};
