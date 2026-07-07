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
  // ─── Партнёр и близкие ──────────────────────────────────────────
  "argued-with-partner": [
    "slept-enough",
    "drank-alcohol",
    "period-symptoms",
    "felt-anxious",
    "felt-fatigued",
    "had-energy",
    "snapped-at-loved-ones",
    "apologized-first",
  ],
  "felt-close-to-partner": [
    "had-energy",
    "slept-enough",
    "exercised",
    "good-time-together",
    "had-sex",
    "flirted",
  ],
  "felt-lonely-with-partner": [
    "felt-anxious",
    "felt-depressed",
    "felt-lonely",
    "screen-time-long",
    "thought-about-someone-else",
    "missed-ex",
  ],
  "partner-irritated-me": [
    "slept-enough",
    "ran-out-of-patience",
    "period-symptoms",
    "felt-fatigued",
    "snapped-at-loved-ones",
  ],
  "good-time-together": [
    "had-energy",
    "felt-happy",
    "felt-close-to-partner",
    "had-sex",
  ],
  "called-parent": [
    "felt-lonely",
    "felt-happy",
    "saw-friends",
  ],
  "thought-about-leaving": [
    "argued-with-partner",
    "felt-lonely-with-partner",
    "felt-depressed",
    "thought-divorce",
    "thought-about-someone-else",
  ],
  "had-sex": [
    "felt-close-to-partner",
    "good-time-together",
    "drank-alcohol",
    "slept-enough",
    "had-energy",
    "morning-libido",
  ],
  "saw-friends": [
    "felt-happy",
    "felt-lonely",
    "called-parent",
    "had-energy",
    "drank-alcohol",
    "laughed-uncontrollably",
  ],
  "apologized-first": [
    "argued-with-partner",
    "felt-anxious",
    "partner-irritated-me",
    "said-yes-when-meant-no",
  ],
  "didnt-like-friend-post": [
    "compared-on-social",
    "envied-on-social",
    "felt-anxious",
  ],
  "complimented-stranger": [
    "felt-happy",
    "had-energy",
    "felt-lonely",
  ],
  "flirted": [
    "felt-close-to-partner",
    "missed-ex",
    "thought-about-someone-else",
    "drank-alcohol",
    "had-energy",
  ],
  "thought-about-someone-else": [
    "argued-with-partner",
    "felt-lonely-with-partner",
    "missed-ex",
    "felt-close-to-partner",
    "thought-divorce",
  ],
  "missed-ex": [
    "stalked-ex",
    "thought-divorce",
    "looped-one-song",
    "felt-lonely",
    "rewatched-stories",
    "thought-about-someone-else",
  ],

  // ─── Родительство ──────────────────────────────────────────────
  "yelled-at-kid": [
    "slept-enough",
    "period-symptoms",
    "drank-alcohol",
    "ran-out-of-patience",
    "felt-fatigued",
    "had-energy",
    "snapped-at-loved-ones",
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
    "drained-by-someone",
  ],
  "felt-overwhelmed-parenting": [
    "felt-fatigued",
    "slept-enough",
    "drank-alcohol",
    "felt-anxious",
    "said-yes-when-meant-no",
  ],

  // ─── Здоровье и симптомы ───────────────────────────────────────
  "headache": [
    "slept-enough",
    "drank-alcohol",
    "coffee-late",
    "ate-fast-food",
    "screen-time-long",
    "period-symptoms",
    "drank-water",
    "eye-strain",
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
    "stretched",
  ],
  "stomach-issues": [
    "ate-fast-food",
    "ate-sweets",
    "drank-alcohol",
    "coffee-late",
    "felt-anxious",
    "felt-nauseous",
  ],
  "felt-nauseous": [
    "stomach-issues",
    "migraine",
    "drank-alcohol",
    "coffee-late",
    "ate-fast-food",
    "felt-anxious",
    "period-symptoms",
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
    "bed-before-midnight",
    "felt-recovered",
    "no-snooze",
  ],
  "felt-fatigued": [
    "slept-enough",
    "exercised",
    "ate-fast-food",
    "drank-alcohol",
    "coffee-late",
    "drained-by-someone",
    "stretched",
    "drank-water",
  ],
  "period-symptoms": [
    "felt-anxious",
    "felt-angry",
    "drank-alcohol",
    "ate-sweets",
    "had-energy",
    "cried-today",
    "cried-from-something-small",
  ],
  "exercised": [
    "slept-enough",
    "had-energy",
    "ate-fast-food",
    "felt-happy",
    "stretched",
    "trained-hard",
    "outside-30min",
  ],
  "trained-hard": [
    "had-energy",
    "slept-enough",
    "felt-fatigued",
    "felt-recovered",
    "exercised",
  ],
  "stretched": [
    "back-or-neck-pain",
    "exercised",
    "felt-recovered",
    "felt-fatigued",
  ],
  "morning-libido": [
    "slept-enough",
    "had-energy",
    "felt-fatigued",
    "drank-alcohol",
    "had-sex",
  ],
  "felt-recovered": [
    "slept-enough",
    "exercised",
    "drank-alcohol",
    "bed-before-midnight",
    "stretched",
  ],
  "outside-30min": [
    "had-energy",
    "felt-happy",
    "slept-enough",
    "felt-anxious",
    "saw-daylight",
    "exercised",
  ],
  "saw-daylight": [
    "slept-enough",
    "felt-happy",
    "had-energy",
    "outside-30min",
  ],
  "drank-water": [
    "headache",
    "felt-fatigued",
    "eye-strain",
  ],
  "ate-by-2pm": [
    "had-energy",
    "headache",
    "ate-sweets",
  ],
  "bed-before-midnight": [
    "slept-enough",
    "felt-recovered",
    "screen-time-long",
    "coffee-late",
    "no-snooze",
    "read-book",
  ],
  "skin-allergy": [
    "ate-sweets",
    "ate-fast-food",
    "drank-alcohol",
  ],
  "heart-palpitations": [
    "coffee-late",
    "felt-anxious",
    "drank-alcohol",
  ],
  "eye-strain": [
    "screen-time-long",
    "slept-enough",
    "headache",
    "drank-water",
  ],

  // ─── Привычки ──────────────────────────────────────────────────
  "drank-alcohol": [
    "slept-enough",
    "headache",
    "felt-anxious",
    "felt-fatigued",
    "had-energy",
    "felt-recovered",
    "snapped-at-loved-ones",
  ],
  "smoked": [
    "felt-anxious",
    "drank-alcohol",
    "coffee-late",
  ],
  "smoked-hookah": [
    "drank-alcohol",
    "smoked",
    "saw-friends",
  ],
  "coffee-late": [
    "slept-enough",
    "felt-anxious",
    "headache",
    "heart-palpitations",
    "bed-before-midnight",
  ],
  "ate-sweets": [
    "felt-fatigued",
    "period-symptoms",
    "stomach-issues",
    "had-energy",
    "skin-allergy",
  ],
  "screen-time-long": [
    "slept-enough",
    "felt-anxious",
    "headache",
    "back-or-neck-pain",
    "exercised",
    "phone-free-morning",
    "doomscrolled-news",
    "eye-strain",
    "gaming-streams-2h",
  ],
  "ate-fast-food": [
    "felt-fatigued",
    "headache",
    "stomach-issues",
    "exercised",
    "ordered-delivery",
    "cooked-myself",
    "ate-by-fridge",
  ],
  "phone-free-morning": [
    "felt-anxious",
    "slept-enough",
    "screen-time-long",
    "kept-morning-promise",
    "no-snooze",
  ],
  "doomscrolled-news": [
    "felt-anxious",
    "screen-time-long",
    "heard-bad-news",
    "slept-enough",
  ],
  "gaming-streams-2h": [
    "slept-enough",
    "screen-time-long",
    "felt-fulfilled-at-work",
    "isolated-at-home",
  ],
  "impulse-spending": [
    "felt-anxious",
    "felt-depressed",
    "screen-time-long",
    "stayed-on-budget",
    "bought-on-sale",
  ],
  "stayed-on-budget": [
    "impulse-spending",
    "bought-on-sale",
    "paid-to-skip-effort",
  ],
  "stalked-ex": [
    "missed-ex",
    "thought-about-someone-else",
    "screen-time-long",
    "drank-alcohol",
    "rewatched-stories",
  ],
  "deleted-message": [
    "felt-anxious",
    "said-yes-when-meant-no",
    "argued-with-partner",
  ],
  "compared-on-social": [
    "felt-depressed",
    "envied-on-social",
    "screen-time-long",
    "felt-not-like-others",
    "didnt-like-friend-post",
  ],
  "deleted-own-post": [
    "felt-anxious",
    "compared-on-social",
  ],
  "rewatched-stories": [
    "missed-ex",
    "stalked-ex",
    "thought-about-someone-else",
    "screen-time-long",
  ],
  "screenshotted-chat": [
    "argued-with-partner",
    "deleted-message",
  ],
  "ordered-delivery": [
    "felt-fatigued",
    "ate-fast-food",
    "cooked-myself",
    "paid-to-skip-effort",
  ],
  "wore-same-shirt": [
    "felt-depressed",
    "felt-fatigued",
    "isolated-at-home",
  ],
  "looped-one-song": [
    "cried-today",
    "missed-ex",
    "felt-lonely",
    "danced-or-sang-alone",
  ],
  "ate-by-fridge": [
    "felt-anxious",
    "ate-sweets",
    "ate-fast-food",
    "screen-time-long",
  ],
  "skipped-cleaning": [
    "felt-fatigued",
    "felt-depressed",
    "home-was-tidy",
  ],
  "bought-on-sale": [
    "impulse-spending",
    "paid-to-skip-effort",
    "stayed-on-budget",
  ],
  "paid-to-skip-effort": [
    "felt-fatigued",
    "ordered-delivery",
    "impulse-spending",
    "stayed-on-budget",
  ],
  "cooked-myself": [
    "ate-fast-food",
    "ordered-delivery",
    "ate-by-fridge",
  ],

  // ─── Состояние ─────────────────────────────────────────────────
  "felt-happy": [
    "had-energy",
    "slept-enough",
    "exercised",
    "good-time-together",
    "felt-close-to-partner",
    "saw-friends",
    "complimented-stranger",
    "laughed-uncontrollably",
    "petted-an-animal",
    "danced-or-sang-alone",
    "liked-my-selfie",
    "felt-proud-today",
    "in-flow",
    "got-recognition",
    "outside-30min",
  ],
  "felt-anxious": [
    "slept-enough",
    "drank-alcohol",
    "coffee-late",
    "screen-time-long",
    "period-symptoms",
    "impulse-spending",
    "ate-by-fridge",
    "doomscrolled-news",
    "deleted-message",
    "heart-palpitations",
    "said-yes-when-meant-no",
  ],
  "felt-depressed": [
    "slept-enough",
    "exercised",
    "called-parent",
    "had-energy",
    "felt-lonely",
    "isolated-at-home",
    "wore-same-shirt",
    "felt-useless",
    "compared-on-social",
    "envied-on-social",
  ],
  "felt-angry": [
    "slept-enough",
    "drank-alcohol",
    "ran-out-of-patience",
    "period-symptoms",
    "snapped-at-loved-ones",
  ],
  "felt-lonely": [
    "called-parent",
    "good-time-together",
    "screen-time-long",
    "felt-depressed",
    "isolated-at-home",
    "talked-to-pet",
    "missed-ex",
    "talked-to-fellow-expats",
    "saw-friends",
  ],
  "had-energy": [
    "slept-enough",
    "exercised",
    "ate-fast-food",
    "drank-alcohol",
    "felt-happy",
    "felt-recovered",
    "outside-30min",
    "trained-hard",
  ],
  "cried-today": [
    "felt-anxious",
    "period-symptoms",
    "slept-enough",
    "called-parent",
    "felt-depressed",
    "cried-from-something-small",
    "heard-bad-news",
  ],
  "burned-out-after-work": [
    "slept-enough",
    "exercised",
    "felt-fatigued",
    "drank-alcohol",
    "worked-overtime",
    "boss-was-difficult",
    "drained-by-someone",
    "conflict-with-colleague",
    "thought-career-change",
  ],
  "didnt-want-to-work": [
    "slept-enough",
    "felt-fatigued",
    "burned-out-after-work",
    "had-energy",
    "boss-was-difficult",
    "procrastinated",
    "thought-career-change",
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
    "in-flow",
    "got-recognition",
    "did-creative-work",
  ],
  "kept-morning-promise": [
    "felt-proud-today",
    "slept-enough",
    "no-snooze",
    "procrastinated",
    "phone-free-morning",
  ],
  "procrastinated": [
    "felt-useless",
    "felt-fatigued",
    "screen-time-long",
    "didnt-want-to-work",
    "kept-morning-promise",
  ],
  "no-snooze": [
    "slept-enough",
    "bed-before-midnight",
    "kept-morning-promise",
  ],
  "felt-proud-today": [
    "kept-morning-promise",
    "in-flow",
    "got-recognition",
    "did-creative-work",
  ],
  "felt-useless": [
    "procrastinated",
    "felt-depressed",
    "compared-on-social",
    "felt-not-like-others",
  ],
  "snapped-at-loved-ones": [
    "slept-enough",
    "drank-alcohol",
    "ran-out-of-patience",
    "period-symptoms",
    "argued-with-partner",
    "yelled-at-kid",
  ],
  "calm-day": [
    "slept-enough",
    "exercised",
    "drank-alcohol",
    "period-symptoms",
    "home-was-tidy",
  ],
  "isolated-at-home": [
    "felt-lonely",
    "screen-time-long",
    "felt-depressed",
    "saw-friends",
    "wore-same-shirt",
  ],
  "said-yes-when-meant-no": [
    "felt-anxious",
    "drained-by-someone",
    "ran-out-of-patience",
    "deleted-message",
  ],
  "cried-from-something-small": [
    "cried-today",
    "period-symptoms",
    "slept-enough",
    "felt-anxious",
  ],
  "laughed-uncontrollably": [
    "felt-happy",
    "saw-friends",
    "danced-or-sang-alone",
  ],
  "envied-on-social": [
    "compared-on-social",
    "screen-time-long",
    "felt-depressed",
    "felt-not-like-others",
  ],
  "felt-not-like-others": [
    "compared-on-social",
    "envied-on-social",
    "felt-depressed",
    "isolated-at-home",
    "felt-useless",
  ],
  "danced-or-sang-alone": [
    "felt-happy",
    "had-energy",
    "looped-one-song",
    "laughed-uncontrollably",
  ],
  "petted-an-animal": [
    "felt-happy",
    "had-energy",
    "felt-lonely",
  ],
  "liked-my-selfie": [
    "felt-happy",
    "had-energy",
    "felt-proud-today",
  ],
  "talked-to-pet": [
    "felt-lonely",
    "felt-happy",
    "isolated-at-home",
  ],
  "in-flow": [
    "felt-fulfilled-at-work",
    "felt-proud-today",
    "had-energy",
    "did-creative-work",
  ],
  "boss-was-difficult": [
    "burned-out-after-work",
    "didnt-want-to-work",
    "felt-anxious",
    "snapped-at-loved-ones",
    "conflict-with-colleague",
  ],
  "conflict-with-colleague": [
    "boss-was-difficult",
    "drained-by-someone",
    "felt-anxious",
    "burned-out-after-work",
  ],
  "drained-by-someone": [
    "felt-fatigued",
    "said-yes-when-meant-no",
    "felt-anxious",
    "burned-out-after-work",
  ],
  "got-recognition": [
    "felt-proud-today",
    "felt-fulfilled-at-work",
    "felt-happy",
  ],
  "heard-bad-news": [
    "felt-anxious",
    "cried-today",
    "drank-alcohol",
    "doomscrolled-news",
  ],
  "home-was-tidy": [
    "felt-happy",
    "calm-day",
    "skipped-cleaning",
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
    "thought-about-going-back",
    "thought-third-country",
    "missed-home-country",
  ],
  "wanted-leave-job": [
    "burned-out-after-work",
    "didnt-want-to-work",
    "worked-overtime",
    "felt-fulfilled-at-work",
    "thought-career-change",
    "boss-was-difficult",
  ],
  "thought-divorce": [
    "argued-with-partner",
    "felt-lonely-with-partner",
    "partner-irritated-me",
    "thought-about-leaving",
    "missed-ex",
    "thought-about-someone-else",
  ],
  "wanted-life-change": [
    "felt-fulfilled-at-work",
    "felt-happy",
    "burned-out-after-work",
    "thought-career-change",
  ],
  "wanted-pet": [
    "felt-lonely",
    "felt-happy",
  ],
  "wanted-learn-new": [
    "felt-fulfilled-at-work",
    "had-energy",
    "felt-happy",
    "thought-career-change",
    "studied-language",
    "watched-course-lecture",
  ],
  "thought-career-change": [
    "wanted-leave-job",
    "didnt-want-to-work",
    "burned-out-after-work",
    "wanted-learn-new",
    "felt-fulfilled-at-work",
  ],
  "studied-language": [
    "felt-fulfilled-at-work",
    "had-energy",
    "kept-morning-promise",
    "watched-course-lecture",
    "practiced-skill",
  ],
  "watched-course-lecture": [
    "studied-language",
    "learned-something-new",
    "kept-morning-promise",
    "practiced-skill",
  ],
  "did-creative-work": [
    "in-flow",
    "felt-proud-today",
    "felt-happy",
    "felt-fulfilled-at-work",
    "practiced-skill",
  ],
  "learned-something-new": [
    "watched-course-lecture",
    "listened-podcast",
    "read-book",
    "did-creative-work",
  ],
  "practiced-skill": [
    "studied-language",
    "watched-course-lecture",
    "did-creative-work",
    "kept-morning-promise",
  ],
  "listened-podcast": [
    "outside-30min",
    "exercised",
    "learned-something-new",
  ],
  "read-book": [
    "bed-before-midnight",
    "screen-time-long",
    "learned-something-new",
  ],

  // ─── Внешние события ──────────────────────────────────────────
  "noisy-neighbors": [
    "slept-enough",
    "felt-recovered",
    "headache",
    "snapped-at-loved-ones",
    "felt-anxious",
  ],
  "construction-nearby": [
    "slept-enough",
    "headache",
    "felt-anxious",
    "snapped-at-loved-ones",
  ],
  "long-commute": [
    "felt-fatigued",
    "burned-out-after-work",
    "snapped-at-loved-ones",
    "didnt-want-to-work",
  ],
  "transport-issue": [
    "felt-anxious",
    "felt-angry",
    "long-commute",
  ],
  "internet-down": [
    "felt-anxious",
    "snapped-at-loved-ones",
    "worked-overtime",
  ],
  "criticized-by-close": [
    "felt-anxious",
    "cried-today",
    "snapped-at-loved-ones",
    "argued-with-partner",
    "ate-sweets",
  ],
  "parent-pressured": [
    "felt-anxious",
    "cried-today",
    "snapped-at-loved-ones",
    "called-parent",
    "criticized-by-close",
  ],
  "toxic-friend": [
    "felt-anxious",
    "drained-by-someone",
    "felt-fatigued",
    "saw-friends",
  ],
  "kids-reached-out": [
    "felt-happy",
    "felt-lonely",
    "called-parent",
    "good-time-together",
  ],
  "financial-issue": [
    "felt-anxious",
    "impulse-spending",
    "stayed-on-budget",
  ],

  // ─── Жизнь за границей (gated by isExpat) ─────────────────────
  "spoke-local-language": [
    "studied-local-language",
    "language-progress",
    "felt-settled-in",
  ],
  "studied-local-language": [
    "spoke-local-language",
    "language-progress",
    "kept-morning-promise",
    "studied-language",
  ],
  "didnt-understand-locals": [
    "felt-foreigner",
    "couldnt-express-self",
    "studied-local-language",
  ],
  "couldnt-express-self": [
    "didnt-understand-locals",
    "felt-foreigner",
    "studied-local-language",
  ],
  "language-progress": [
    "studied-local-language",
    "spoke-local-language",
    "felt-settled-in",
  ],
  "missed-home-country": [
    "called-someone-back-home",
    "missed-familiar-food",
    "missed-familiar-weather",
    "felt-foreigner",
    "thought-about-going-back",
  ],
  "called-someone-back-home": [
    "missed-home-country",
    "felt-lonely",
    "felt-happy",
  ],
  "missed-familiar-food": [
    "missed-home-country",
    "tried-local-food",
    "cooked-myself",
  ],
  "missed-familiar-weather": [
    "missed-home-country",
    "climate-drained-me",
    "felt-fatigued",
  ],
  "felt-foreigner": [
    "didnt-understand-locals",
    "missed-home-country",
    "locals-were-warm",
    "talked-to-fellow-expats",
    "couldnt-express-self",
  ],
  "felt-settled-in": [
    "spoke-local-language",
    "locals-were-warm",
    "happy-with-the-move",
    "language-progress",
    "tried-local-food",
  ],
  "locals-were-warm": [
    "felt-settled-in",
    "felt-happy",
    "felt-foreigner",
  ],
  "talked-to-fellow-expats": [
    "felt-foreigner",
    "felt-lonely",
    "missed-home-country",
  ],
  "dealt-with-paperwork": [
    "felt-anxious",
    "local-institution-contact",
    "felt-fatigued",
  ],
  "local-institution-contact": [
    "dealt-with-paperwork",
    "felt-foreigner",
    "didnt-understand-locals",
  ],
  "climate-drained-me": [
    "felt-fatigued",
    "missed-familiar-weather",
    "thought-about-going-back",
  ],
  "tried-local-food": [
    "felt-settled-in",
    "missed-familiar-food",
    "happy-with-the-move",
  ],
  "thought-about-going-back": [
    "missed-home-country",
    "climate-drained-me",
    "felt-foreigner",
    "thought-about-emigrating",
    "thought-third-country",
  ],
  "thought-third-country": [
    "thought-about-going-back",
    "thought-about-emigrating",
    "climate-drained-me",
  ],
  "happy-with-the-move": [
    "felt-settled-in",
    "locals-were-warm",
    "language-progress",
    "felt-happy",
    "tried-local-food",
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
 * doesn't equal any of our template titles literally, but it's
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
  ["had-sex", ["секс", "близост физич", "intima", "had sex", "sex"]],
  ["felt-close-to-partner", ["близост", "обним", "обнял", "close to partner"]],
  ["felt-lonely-with-partner", ["одинок рядом", "alone with"]],
  ["partner-irritated-me", ["партнёр раздраж", "партнер раздраж", "бесил", "irritated"]],
  ["good-time-together", ["вдвоём", "вдвоем", "вместе с парт", "date night", "together with"]],
  ["called-parent", ["позвон мам", "позвон пап", "звонил мам", "звонил пап", "написал мам", "написал пап", "called mom", "called dad", "called parent", "родител"]],
  ["thought-about-leaving", ["хочу уйти", "уйти из отнош", "leave the relat", "leave partner"]],
  ["saw-friends", ["с друз", "с подруг", "встрет с друз", "saw friend", "with friend", "hung out"]],
  ["apologized-first", ["извинил", "первым изви", "первой изви", "apologiz", "said sorry"]],
  ["didnt-like-friend-post", ["не лайкн", "не поставил лайк", "skipped like", "didn't like post"]],
  ["complimented-stranger", ["комплимент", "сказал прият", "compliment"]],
  ["flirted", ["флирт", "флиртов", "flirt"]],
  ["thought-about-someone-else", ["думал о друг", "думала о друг", "о ком-то ещё", "о ком-то еще", "thought about someone", "someone other"]],
  ["missed-ex", ["скучал по бывш", "тоск по бывш", "missed ex", "missed my ex"]],

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
  // felt-nauseous BEFORE stomach-issues — pure nausea signals (no
  // stomach pain) match here first; stomach-issues catches the
  // broader "живот болел / GI" cases below.
  ["felt-nauseous", ["тошнило", "тошнота", "тошнит", "подташн", "feel nauseous", "felt nauseous", "queasy"]],
  ["stomach-issues", ["живот", "ЖКТ", "пищевар", "stomach", "gut"]],
  ["joint-pain", ["суста", "коле", "запяст", "joint pain"]],
  ["slept-enough", ["выспал", "сон", "спал", "сну", "slept", "sleep enough", "rested"]],
  ["felt-fatigued", ["устал", "усталост", "выжат", "истощ", "fatigue", "drained", "exhausted"]],
  ["period-symptoms", ["ПМС", "цикл", "месячн", "PMS", "period sympt"]],
  ["exercised", ["трениров", "зал", "пробеж", "йог", "qi", "workout", "gym", "exercise", "ran ", "running"]],
  ["trained-hard", ["нагрузк", "интенсив", "силов", "hard workout", "trained hard"]],
  ["stretched", ["растяжк", "растяг", "мобильность", "stretch", "mobility"]],
  ["morning-libido", ["утрен либид", "утрен влеч", "morning libido"]],
  ["felt-recovered", ["восстанов", "отдохн", "recovered", "well-rested"]],
  ["outside-30min", ["на улиц", "на свеж возд", "прогулк", "walk outside", "outside", "fresh air"]],
  ["saw-daylight", ["дневн свет", "солнц на кож", "daylight"]],
  ["drank-water", ["воду", "воды", "пил воду", "drank water", "hydrat"]],
  ["ate-by-2pm", ["позавтрак", "до обеда", "до 14", "ate breakfast", "breakfast"]],
  ["bed-before-midnight", ["лёг до полуноч", "легла до полуноч", "до 12", "bed before midnight", "before midnight"]],
  ["skin-allergy", ["аллерг", "сыпь", "зуд", "rash", "itch", "allergy"]],
  ["heart-palpitations", ["сердцебиен", "давлен", "palpitation", "heart rate", "blood pressure"]],
  ["eye-strain", ["устал глаз", "болел глаз", "eye strain", "tired eyes"]],

  // Habits in question
  ["smoked-hookah", ["кальян", "hookah", "shisha"]],
  ["drank-alcohol", ["алкогол", "вино", "пив", "коньяк", "виски", "коктейль", "alcohol", "wine", "beer", "drink"]],
  ["smoked", ["курил", "сигарет", "вейп", "smoke", "vape", "cigarette"]],
  ["coffee-late", ["кофе", "кофеин", "coffee", "caffeine", "espresso"]],
  ["ate-sweets", ["сладк", "десерт", "конфет", "торт", "sweet", "dessert", "candy", "cake"]],
  ["screen-time-long", ["экран", "залип в телеф", "scroll", "screen", "phone time", "telegram"]],
  ["ate-fast-food", ["фастфуд", "выпечк", "пиццу", "бургер", "fast food", "junk"]],
  ["phone-free-morning", ["без телефона утр", "phone-free morn", "morning no phone"]],
  ["doomscrolled-news", ["новост", "doomscroll", "news", "залип в новост"]],
  ["gaming-streams-2h", ["игр", "стрим", "gaming", "stream", "twitch"]],
  ["impulse-spending", ["импульс", "потратил спонтан", "impulse"]],
  ["stayed-on-budget", ["бюджет", "budget", "spending plan"]],
  ["stalked-ex", ["залип на странице бывш", "залип на профил бывш", "stalked ex", "ex's profile"]],
  ["deleted-message", ["стирал сообщ", "удалил сообщ", "не отправ", "deleted message", "didn't send"]],
  ["compared-on-social", ["сравнивал себя", "у неё лучше", "у нее лучше", "у него лучше", "compared myself"]],
  ["deleted-own-post", ["удалил свой пост", "deleted my post", "deleted own post"]],
  ["rewatched-stories", ["прокрут сторис", "rewatched stor"]],
  ["screenshotted-chat", ["скрин переписк", "screenshot chat"]],
  ["ordered-delivery", ["заказал доставк", "доставк еды", "ordered food", "food delivery"]],
  ["wore-same-shirt", ["одну футболк", "не переод", "same shirt", "same outfit"]],
  ["looped-one-song", ["одну песн", "одной песн", "одну композ", "looped song", "on repeat"]],
  ["ate-by-fridge", ["у холодильник", "у плит", "by the fridge", "ate standing"]],
  ["skipped-cleaning", ["убор", "не убрал", "skipped clean"]],
  ["bought-on-sale", ["распродаж", "скидк", "on sale", "bought sale"]],
  ["paid-to-skip-effort", ["заплатил чтоб не дел", "лень делать", "paid to skip"]],
  ["cooked-myself", ["готовил сам", "приготовил дом", "cooked myself", "home cooked"]],

  // Inner state
  ["cried-from-something-small", ["плакал от рекл", "плакал от фильм", "плакал от пес", "cried at movie", "cried at song"]],
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
  ["kept-morning-promise", ["обещал утром", "сделал что обещал", "morning promise"]],
  ["procrastinated", ["прокраст", "тянул", "откладыв", "procrast"]],
  ["no-snooze", ["без откладыв", "без snooze", "first alarm", "no snooze"]],
  ["felt-proud-today", ["горд", "сделал что хотел", "proud", "felt proud"]],
  ["felt-useless", ["бесполез", "useless"]],
  ["snapped-at-loved-ones", ["сорвал на близ", "повысил голос на близ", "snapped at"]],
  ["calm-day", ["без раздраж", "calm day", "no irritation"]],
  ["isolated-at-home", ["весь день один дома", "не выход", "isolated at home"]],
  ["said-yes-when-meant-no", ["сказал да хотел нет", "согласил против", "said yes meant no"]],
  ["laughed-uncontrollably", ["ржал до слёз", "ржал до слез", "смеял до слёз", "laughed uncontrol", "couldn't stop laugh"]],
  ["envied-on-social", ["завид", "envy", "envied"]],
  ["felt-not-like-others", ["не как все", "not like everyone"]],
  ["danced-or-sang-alone", ["танцев один", "пел громко", "danced alone", "sang alone"]],
  ["petted-an-animal", ["гладил кот", "гладил соб", "тискал", "petted", "pet animal"]],
  ["liked-my-selfie", ["селфи", "понрав фото", "liked my selfie", "selfie"]],
  ["talked-to-pet", ["говорил с пит", "говорил с раст", "talked to pet", "talked to plant"]],
  ["in-flow", ["в потоке", "увлеч", "in flow", "flow state"]],
  ["boss-was-difficult", ["босс", "руководит", "начальн", "boss", "manager"]],
  ["conflict-with-colleague", ["с коллег", "напряжён с коллег", "напряжен с коллег", "conflict colleague", "coworker"]],
  ["drained-by-someone", ["вымат", "высас энерг", "drained by", "drain me"]],
  ["got-recognition", ["похвал", "признан", "благодар", "recognition", "praise"]],
  ["heard-bad-news", ["плохие новост", "плохая новост", "bad news"]],
  ["home-was-tidy", ["дома порядок", "прибран", "home tidy", "house tidy"]],

  // Big decisions
  ["wanted-child", ["хотел ребёнка", "хотел ребенка", "хотелось ребёнка", "хотелось ребенка", "want a child", "want kids"]],
  ["thought-about-emigrating", ["уехать", "переезд", "эмигр", "emigrat", "move abroad", "leave country", "релок"]],
  ["wanted-leave-job", ["уйти с работ", "уволи", "сменить работ", "quit job", "leave job"]],
  ["thought-divorce", ["развод", "разводи", "расстат", "divorce", "split"]],
  ["wanted-life-change", ["менять жизнь", "всё поменять", "все поменять", "radical change"]],
  ["wanted-pet", ["завести кошк", "завести собак", "питомца", "котёнка", "котенка", "щенк", "get a pet", "kitten", "puppy"]],
  ["wanted-learn-new", ["учиться", "новой професс", "новую сферу", "новый курс", "learn new", "new career"]],
  ["thought-career-change", ["сменить профес", "сменить специал", "career change", "change profession"]],
  ["studied-language", ["учил язык", "учил английск", "учил китайск", "studied language", "language practice"]],
  ["watched-course-lecture", ["лекци", "курс", "lecture", "course"]],
  ["did-creative-work", ["писал", "рисовал", "creative", "draw", "wrote"]],
  ["learned-something-new", ["узнал нов", "learned new", "new fact"]],
  ["practiced-skill", ["навык", "практик", "practiced skill"]],
  ["listened-podcast", ["подкаст", "аудиокниг", "podcast", "audiobook"]],
  ["read-book", ["читал книг", "прочитал книг", "read a book", "read book"]],

  // External events
  ["noisy-neighbors", ["соседи шум", "соседи громк", "noisy neighbor"]],
  ["construction-nearby", ["стройк", "ремонт у соседей", "ремонт рядом", "construction noise"]],
  ["long-commute", ["пробк", "дорога долго", "долго добир", "traffic jam", "long commute"]],
  ["transport-issue", ["транспорт подвёл", "транспорт подвел", "автобус опозд", "поезд отмен", "метро отмен", "transport delay", "transport cancel"]],
  ["internet-down", ["интернет тормоз", "интернет не работ", "связь тормоз", "связи не было", "internet down", "wifi down", "no signal"]],
  ["criticized-by-close", ["близкий критик", "близкий обиде", "близкий давил", "close criticized"]],
  ["parent-pressured", ["родитель давил", "родитель критик", "мама обижала", "папа критик", "parent pressured", "parent hurtful"]],
  ["toxic-friend", ["токсичн друг", "токсичн подруг", "токсичн коллег", "toxic friend"]],
  ["kids-reached-out", ["дети писал", "дети звонил", "дети реагир", "kids called", "kids messaged"]],
  ["financial-issue", ["неожиданн трат", "штраф", "счета пришли", "списали ден", "unexpected charge", "fine arrived"]],

  // Expat
  ["spoke-local-language", ["на местном", "spoke local"]],
  ["studied-local-language", ["учил местн", "местный язык", "studied local"]],
  ["didnt-understand-locals", ["не понял что вокруг", "didn't understand"]],
  ["couldnt-express-self", ["не смог выраз", "языковой барьер", "couldn't express", "language barrier"]],
  ["language-progress", ["прогресс в язык", "language progress"]],
  ["missed-home-country", ["скучал по родн стран", "missed home"]],
  ["called-someone-back-home", ["связался с кем-то в родн", "called back home"]],
  ["missed-familiar-food", ["скучал по знаком ед", "missed familiar food"]],
  ["missed-familiar-weather", ["скучал по погод", "missed weather"]],
  ["felt-foreigner", ["чужим", "чужой", "foreigner"]],
  ["felt-settled-in", ["обустра", "освоил", "settled in"]],
  ["locals-were-warm", ["местные тёпл", "местные тепл", "locals warm"]],
  ["talked-to-fellow-expats", ["с земляк", "expat", "fellow expat"]],
  ["dealt-with-paperwork", ["докум", "виз", "бюрокр", "paperwork", "visa"]],
  ["local-institution-contact", ["в банк", "у врач", "в госконт", "local institution"]],
  ["climate-drained-me", ["климат вымат", "погода вымат", "climate drain"]],
  ["tried-local-food", ["местн кух", "местн блюд", "local food"]],
  ["thought-about-going-back", ["вернуться", "возвращ", "going back"]],
  ["thought-third-country", ["третьей стран", "ехать дальш", "third country"]],
  ["happy-with-the-move", ["доволен переезд", "довольна переезд", "happy with the move"]],
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
// Memoisation for matchTemplateIdByTitle. The original ran a full
// LIFE_STREAMS scan (193 templates × 2 localised strings) on every call,
// and computeCorrelations calls it ~6× per tracker pair — an
// O(trackers² × library) hot path that surfaced as multi-second iOS
// "App Hang" freezes on data-heavy accounts.
//
// Two layers, both indexing the compile-time-constant LIFE_STREAMS (so
// neither ever needs invalidation):
//   - exactTitleIndex: normalised title/titleRu → id, built once, giving
//     O(1) exact matches. Insertion order mirrors the old loop exactly
//     (declaration order, title before titleRu, first match wins) so the
//     resolved id is byte-for-byte identical to the scan it replaces.
//   - matchCache: normalised title → resolved id, covering the keyword
//     fallback too so repeat lookups of the same title are free.
let exactTitleIndex: Map<string, string> | null = null;
const getExactTitleIndex = (): Map<string, string> => {
  if (exactTitleIndex) return exactTitleIndex;
  const idx = new Map<string, string>();
  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      const en = tpl.title.toLowerCase();
      const ru = tpl.titleRu.toLowerCase();
      // First writer wins — reproduces the original loop's
      // return-on-first-match, checking title before titleRu.
      if (!idx.has(en)) idx.set(en, tpl.id);
      if (!idx.has(ru)) idx.set(ru, tpl.id);
    }
  }
  exactTitleIndex = idx;
  return idx;
};

const matchCache = new Map<string, string | null>();

export const matchTemplateIdByTitle = (title: string): string | null => {
  const norm = title.trim().toLowerCase();
  const cached = matchCache.get(norm);
  if (cached !== undefined) return cached;

  // 1) Exact match against any template's localised title.
  let result = getExactTitleIndex().get(norm) ?? null;

  // 2) Keyword fallback — any keyword stem appears in the title?
  // First template wins (declaration order is intentional).
  if (result === null) {
    for (const [tplId, stems] of TEMPLATE_KEYWORDS) {
      if (stems.some((stem) => norm.includes(stem.toLowerCase()))) {
        result = tplId;
        break;
      }
    }
  }

  matchCache.set(norm, result);
  return result;
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
