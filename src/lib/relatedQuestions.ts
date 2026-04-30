// Related-questions engine — surfaces templates likely correlated with
// what a user is already tracking. Replaces the old "pure random Play
// round" with intent: if you care about migraines, the app suggests
// what's KNOWN to influence migraines (sleep, alcohol, caffeine, screens,
// hormones) — not "did you sing in the shower today".
//
// The map below is a manually-curated graph: for each tracker template
// id, a list of 3-7 related template ids that medical / psychological
// research (or strong common sense) ties to it. Used by:
//   - DailySession playMode → builds 10-card play deck weighted toward
//     related-to-user templates
//   - AddTrackerModal → "Связанные с твоими" section
//
// Edges are intentionally one-directional in each entry; we union both
// directions at lookup time so e.g. "headache → sleep" and "sleep → ?"
// can independently grow without making this map symmetric.

import { LIFE_STREAMS, LifeStreamTemplate } from "./lifeStreams";

/**
 * For each template id, which other template ids are commonly
 * correlated. Curated by hand — not derived from user data.
 */
export const RELATED_QUESTIONS: Record<string, string[]> = {
  // ─── Партнёр ────────────────────────────────────────────────────
  "argued-with-partner": [
    "slept-enough",
    "drank-alcohol",
    "period-symptoms",
    "felt-anxious",
    "felt-fatigued",
    "had-energy",
  ],
  "felt-close-to-partner": [
    "had-energy",
    "slept-enough",
    "exercised",
    "good-time-together",
  ],
  "felt-lonely-with-partner": [
    "felt-anxious",
    "felt-depressed",
    "felt-lonely",
    "screen-time-long",
  ],
  "partner-irritated-me": [
    "slept-enough",
    "ran-out-of-patience",
    "period-symptoms",
    "felt-fatigued",
  ],
  "good-time-together": [
    "had-energy",
    "felt-happy",
    "felt-close-to-partner",
  ],
  "called-parent": [
    "felt-lonely",
    "felt-happy",
  ],
  "thought-about-leaving": [
    "argued-with-partner",
    "felt-lonely-with-partner",
    "felt-depressed",
    "thought-divorce",
  ],

  // ─── Родительство ──────────────────────────────────────────────
  "yelled-at-kid": [
    "slept-enough",
    "period-symptoms",
    "drank-alcohol",
    "ran-out-of-patience",
    "felt-fatigued",
    "had-energy",
  ],
  "felt-bad-parent": [
    "felt-anxious",
    "cried-today",
    "yelled-at-kid",
    "felt-overwhelmed-parenting",
  ],
  "quality-time-kid": [
    "had-energy",
    "felt-happy",
    "screen-time-long",
  ],
  "ran-out-of-patience": [
    "slept-enough",
    "felt-fatigued",
    "drank-alcohol",
    "period-symptoms",
  ],
  "felt-overwhelmed-parenting": [
    "felt-fatigued",
    "slept-enough",
    "drank-alcohol",
    "felt-anxious",
  ],

  // ─── Здоровье ──────────────────────────────────────────────────
  "headache": [
    "slept-enough",
    "drank-alcohol",
    "coffee-late",
    "ate-fast-food",
    "screen-time-long",
    "period-symptoms",
  ],
  "migraine": [
    "slept-enough",
    "drank-alcohol",
    "coffee-late",
    "period-symptoms",
    "screen-time-long",
    "ate-sweets",
    "felt-anxious",
  ],
  "back-or-neck-pain": [
    "exercised",
    "screen-time-long",
    "slept-enough",
  ],
  "stomach-issues": [
    "ate-fast-food",
    "ate-sweets",
    "drank-alcohol",
    "coffee-late",
    "felt-anxious",
  ],
  "joint-pain": [
    "exercised",
    "ate-sweets",
    "ate-fast-food",
  ],
  "slept-enough": [
    "coffee-late",
    "screen-time-long",
    "drank-alcohol",
    "felt-anxious",
    "had-energy",
  ],
  "felt-fatigued": [
    "slept-enough",
    "exercised",
    "ate-fast-food",
    "drank-alcohol",
    "coffee-late",
  ],
  "period-symptoms": [
    "felt-anxious",
    "felt-angry",
    "drank-alcohol",
    "ate-sweets",
    "had-energy",
    "cried-today",
  ],
  "exercised": [
    "slept-enough",
    "had-energy",
    "ate-fast-food",
    "felt-happy",
  ],

  // ─── Привычки ──────────────────────────────────────────────────
  "drank-alcohol": [
    "slept-enough",
    "headache",
    "felt-anxious",
    "felt-fatigued",
    "had-energy",
  ],
  "smoked": [
    "felt-anxious",
    "drank-alcohol",
    "coffee-late",
  ],
  "coffee-late": [
    "slept-enough",
    "felt-anxious",
    "headache",
  ],
  "ate-sweets": [
    "felt-fatigued",
    "period-symptoms",
    "stomach-issues",
    "had-energy",
  ],
  "screen-time-long": [
    "slept-enough",
    "felt-anxious",
    "headache",
    "back-or-neck-pain",
    "exercised",
  ],
  "ate-fast-food": [
    "felt-fatigued",
    "headache",
    "stomach-issues",
    "exercised",
  ],

  // ─── Состояние ─────────────────────────────────────────────────
  "felt-happy": [
    "had-energy",
    "slept-enough",
    "exercised",
    "good-time-together",
    "felt-close-to-partner",
  ],
  "felt-anxious": [
    "slept-enough",
    "drank-alcohol",
    "coffee-late",
    "screen-time-long",
    "period-symptoms",
  ],
  "felt-depressed": [
    "slept-enough",
    "exercised",
    "called-parent",
    "had-energy",
    "felt-lonely",
  ],
  "felt-angry": [
    "slept-enough",
    "drank-alcohol",
    "ran-out-of-patience",
    "period-symptoms",
  ],
  "felt-lonely": [
    "called-parent",
    "good-time-together",
    "screen-time-long",
    "felt-depressed",
  ],
  "had-energy": [
    "slept-enough",
    "exercised",
    "ate-fast-food",
    "drank-alcohol",
    "felt-happy",
  ],
  "cried-today": [
    "felt-anxious",
    "period-symptoms",
    "slept-enough",
    "called-parent",
    "felt-depressed",
  ],
  "burned-out-after-work": [
    "slept-enough",
    "exercised",
    "felt-fatigued",
    "drank-alcohol",
    "worked-overtime",
  ],
  "didnt-want-to-work": [
    "slept-enough",
    "felt-fatigued",
    "burned-out-after-work",
    "had-energy",
  ],
  "worked-overtime": [
    "felt-fatigued",
    "slept-enough",
    "burned-out-after-work",
    "had-energy",
  ],
  "felt-fulfilled-at-work": [
    "had-energy",
    "slept-enough",
    "felt-happy",
  ],

  // ─── Большие решения ──────────────────────────────────────────
  "wanted-child": [
    "felt-close-to-partner",
    "felt-happy",
    "had-energy",
    "good-time-together",
  ],
  "thought-about-emigrating": [
    "felt-anxious",
    "felt-fulfilled-at-work",
    "felt-happy",
    "didnt-want-to-work",
  ],
  "wanted-leave-job": [
    "burned-out-after-work",
    "didnt-want-to-work",
    "worked-overtime",
    "felt-fulfilled-at-work",
  ],
  "thought-divorce": [
    "argued-with-partner",
    "felt-lonely-with-partner",
    "partner-irritated-me",
    "thought-about-leaving",
  ],
  "wanted-life-change": [
    "felt-fulfilled-at-work",
    "felt-happy",
    "burned-out-after-work",
  ],
  "wanted-pet": [
    "felt-lonely",
    "felt-happy",
  ],
  "wanted-learn-new": [
    "felt-fulfilled-at-work",
    "had-energy",
    "felt-happy",
  ],
};

/**
 * Returns a flat `Set<string>` of template ids that are correlated with
 * any of the user's existing template ids. The set EXCLUDES the user's
 * current ids themselves (so we recommend NEW questions, not repeats).
 *
 * Bidirectional: if user has "headache" and the map has
 * `migraine: ["headache", ...]`, then "migraine" is also pulled in
 * (because someone tracking headaches is plausibly interested in
 * migraines too).
 */
export const getRelatedTemplateIds = (
  userTemplateIds: string[],
): Set<string> => {
  const userSet = new Set(userTemplateIds);
  const out = new Set<string>();

  // Forward edges: user has X → suggest things X relates to.
  for (const id of userTemplateIds) {
    const related = RELATED_QUESTIONS[id];
    if (related) {
      for (const r of related) {
        if (!userSet.has(r)) out.add(r);
      }
    }
  }

  // Reverse edges: user has Y, and some Z's RELATED list includes Y →
  // suggest Z. Catches "you have headache, so try the migraine question".
  for (const [sourceId, related] of Object.entries(RELATED_QUESTIONS)) {
    if (userSet.has(sourceId)) continue; // already in user's set
    if (related.some((r) => userSet.has(r))) {
      out.add(sourceId);
    }
  }

  return out;
};

/**
 * Walk LIFE_STREAMS and return the template objects matching given ids.
 * Order preserved as they appear in the streams (deterministic).
 */
export const getTemplatesByIds = (ids: Set<string>): LifeStreamTemplate[] => {
  const out: LifeStreamTemplate[] = [];
  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      if (ids.has(tpl.id)) out.push(tpl);
    }
  }
  return out;
};

/**
 * Keyword fallback for matching custom user-typed trackers to known
 * templates. The user's custom tracker title (e.g. "Звонила маме")
 * doesn't equal any of our 41 template titles literally, but it's
 * semantically the same as `called-parent`. We match on word stems —
 * Russian (mainly) + English — to give custom trackers access to
 * the related-questions graph and the "expected pair" semantic
 * tagging in correlations.
 *
 * The map is keyed by template id; each entry is a list of stems
 * we'll search for inside the user's title (lowercased). Order
 * within entries doesn't matter, but order BETWEEN entries does —
 * the first template whose any stem matches wins (so put more
 * specific stems before more general ones).
 *
 * Stems are intentionally short prefixes ("плакал", not "плакала")
 * so they catch all gendered/declined forms ("плакал", "плакала",
 * "плакали", "плачу"). Russian morphology handled by prefix match.
 */
const TEMPLATE_KEYWORDS: Array<[string, string[]]> = [
  // Partner & loved ones
  ["argued-with-partner", ["ссор", "поссорил", "ругал", "argue", "fight", "argument"]],
  ["felt-close-to-partner", ["близост", "обним", "обнял", "intima", "close to partner"]],
  ["felt-lonely-with-partner", ["одинок рядом", "alone with"]],
  ["partner-irritated-me", ["партнёр раздраж", "партнер раздраж", "бесил", "irritated"]],
  ["good-time-together", ["вдвоём", "вдвоем", "вместе с парт", "date night", "together with"]],
  ["called-parent", ["позвон", "звонил", "написал мам", "написал пап", "called mom", "called dad", "called parent", "родител"]],
  ["thought-about-leaving", ["хочу уйти", "уйти из отнош", "leave the relat", "leave partner"]],

  // Parenting
  ["yelled-at-kid", ["накричал", "сорвал", "yelled at kid", "yelled at child", "вспыш"]],
  ["felt-bad-parent", ["плох мать", "плохой отец", "плохой родител", "bad parent", "bad mother", "bad father"]],
  ["quality-time-kid", ["с ребёнком", "с ребенком", "время с дет", "quality time with"]],
  ["ran-out-of-patience", ["терпени", "patience"]],
  ["felt-overwhelmed-parenting", ["перегруз родител", "overwhelm parent"]],

  // Health & symptoms
  ["migraine", ["мигрен", "migraine"]],
  ["headache", ["головн", "болела голов", "болит голов", "head pain", "headache"]],
  ["back-or-neck-pain", ["спин", "шея", "шею", "back pain", "neck pain"]],
  ["stomach-issues", ["живот", "тошн", "ЖКТ", "пищевар", "stomach", "nausea", "gut"]],
  ["joint-pain", ["суста", "коле", "запяст", "joint pain"]],
  ["slept-enough", ["выспал", "сон", "спал", "сну", "slept", "sleep enough", "rested"]],
  ["felt-fatigued", ["устал", "усталост", "выжат", "истощ", "fatigue", "drained", "exhausted"]],
  ["period-symptoms", ["ПМС", "цикл", "месячн", "PMS", "period sympt"]],
  ["exercised", ["трениров", "зал", "пробеж", "йог", "qi", "workout", "gym", "exercise", "ran ", "running"]],

  // Habits in question
  ["drank-alcohol", ["алкогол", "вино", "пив", "коньяк", "виски", "коктейль", "alcohol", "wine", "beer", "drink"]],
  ["smoked", ["курил", "сигарет", "вейп", "кальян", "smoke", "vape", "cigarette"]],
  ["coffee-late", ["кофе", "кофеин", "coffee", "caffeine", "espresso"]],
  ["ate-sweets", ["сладк", "десерт", "конфет", "торт", "sweet", "dessert", "candy", "cake"]],
  ["screen-time-long", ["экран", "залип", "scroll", "screen", "phone time", "telegram"]],
  ["ate-fast-food", ["фастфуд", "выпечк", "пиццу", "бургер", "fast food", "junk"]],

  // Inner state
  ["cried-today", ["плакал", "слёз", "слез", "cried", "tears"]],
  ["felt-happy", ["счастлив", "радост", "радоваться", "happy", "joy", "joyful"]],
  ["felt-anxious", ["тревог", "anxiet", "anxious", "panic"]],
  ["felt-depressed", ["депрес", "подавл", "пуст эмоц", "пустот", "sad", "down", "empty"]],
  ["felt-angry", ["злост", "злил", "раздраж", "ярост", "angry", "anger", "rage"]],
  ["felt-lonely", ["одинок", "lonely", "loneliness"]],
  ["had-energy", ["энерги", "сил", "бодр", "vigor", "energy"]],
  ["burned-out-after-work", ["выгор", "burnout", "burned out"]],
  ["didnt-want-to-work", ["не хотел на работ", "не хотел идти на раб", "didn't want to work"]],
  ["worked-overtime", ["переработ", "поздно работа", "overtime"]],
  ["felt-fulfilled-at-work", ["работа дава", "осмыслен", "meaningful work", "fulfill"]],

  // Big decisions
  ["wanted-child", ["хотел ребёнка", "хотел ребенка", "хотелось ребёнка", "хотелось ребенка", "want a child", "want kids"]],
  ["thought-about-emigrating", ["уехать", "переезд", "эмигр", "emigrat", "move abroad", "leave country", "релок"]],
  ["wanted-leave-job", ["уйти с работ", "уволи", "сменить работ", "quit job", "leave job"]],
  ["thought-divorce", ["развод", "разводи", "расстат", "divorce", "split"]],
  ["wanted-life-change", ["менять жизнь", "всё поменять", "все поменять", "radical change"]],
  ["wanted-pet", ["завести кошк", "завести собак", "питомца", "котёнка", "котенка", "щенк", "pet", "kitten", "puppy"]],
  ["wanted-learn-new", ["учиться", "новой професс", "новую сферу", "новый курс", "learn new", "new career"]],
];

/**
 * Try to extract a template id from a stored tracker. Trackers store
 * localised TITLE strings, not template ids — so we match by title
 * against LIFE_STREAMS (both EN and RU sides) for an exact match,
 * then fall back to keyword matching for custom user-typed trackers.
 *
 * Returns the id if matched, or null when nothing fits (e.g. a fully
 * custom tracker like "Завтрак был полезным" that doesn't trigger
 * any of our keyword stems).
 */
export const matchTemplateIdByTitle = (title: string): string | null => {
  const norm = title.trim().toLowerCase();

  // 1) Exact match against any template's localised title.
  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      if (tpl.title.toLowerCase() === norm) return tpl.id;
      if (tpl.titleRu.toLowerCase() === norm) return tpl.id;
    }
  }

  // 2) Keyword fallback — any keyword stem appears in the title?
  // First template wins (declaration order is intentional).
  for (const [tplId, stems] of TEMPLATE_KEYWORDS) {
    if (stems.some((stem) => norm.includes(stem.toLowerCase()))) return tplId;
  }

  return null;
};

/**
 * Top-level helper for callers: given a list of user trackers
 * (with stored titles), return template objects that are related but
 * not yet in the user's set.
 *
 * If the user has no trackers we can match (all custom or empty list),
 * returns an empty array — callers should fall back to "any random
 * template".
 */
export const getRelatedQuestions = (
  userTrackerTitles: string[],
): LifeStreamTemplate[] => {
  const userIds = userTrackerTitles
    .map(matchTemplateIdByTitle)
    .filter((id): id is string => id !== null);
  if (userIds.length === 0) return [];

  const relatedIds = getRelatedTemplateIds(userIds);
  return getTemplatesByIds(relatedIds);
};
