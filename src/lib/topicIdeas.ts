// Changes to test that fit the question (her note, Nov 9 2026: on "Compared myself online" the first
// idea was "Unfollow or mute people who trigger this", and "Not for me" then offered "Skip sweets in
// the evening" and "Stretch for 5 minutes" — the island's ideas, about something else entirely).
// Every library question has a topic; each topic has its own small changes (TOPIC_IDEAS in
// experiments.ts, words in experiment.idea.*). A library question with no topic (noise, paperwork…)
// gets no ready ideas, only "write your own"; her own questions fall back to the island's ideas.
import type { Tracker, TrackerEntry } from "@/types/tracker";
import { IDEAS, TOPIC_IDEAS, ideasFor } from "@/lib/experiments";
import { templateIdOf } from "@/lib/answerPhrases";
import { islandOf, type IslandId } from "@/lib/islands";
import { isoLocal } from "@/lib/doors";

/** topic → its library questions (template ids) */
const SPEC: Record<string, string> = {
  social: "compared-on-social deleted-own-post rewatched-stories screenshotted-chat stalked-ex social-media-hour envied-on-social didnt-like-friend-post",
  screens: "phone-free-morning screen-time-long screens-before-bed gaming-streams-2h",
  news: "doomscrolled-news",
  sleep: "bed-before-midnight felt-recovered napped racing-thoughts-in-bed same-wake-time sleep-aid slept-enough slow-to-fall-asleep snored-or-gasped woke-at-night woke-too-early",
  caffeine: "caffeine-4-plus coffee-late less-caffeine-than-usual",
  food: "ate-by-fridge ate-fast-food ate-sweets cooked-myself ordered-delivery ate-late ate-vegetables skipped-meal ate-by-2pm drank-water",
  alcohol: "alcohol-3-plus drank-alcohol",
  smoking: "smoked smoked-hookah",
  money: "bought-on-sale impulse-spending paid-to-skip-effort stayed-on-budget money-worry financial-issue",
  movement: "walked-a-lot exercised strength-training stretched trained-hard outside-30min saw-daylight time-in-nature",
  pain: "back-or-neck-pain neck-pain joint-pain jaw-sore-morning",
  headache: "migraine headache headache-stopped-me took-painkiller",
  digestion: "bloated hard-to-poop heartburn loose-stool piles-bothered pooped-today stomach-issues",
  nausea: "felt-nauseous",
  body: "bladder-leak bladder-urgency pee-burning pelvic-floor-exercises night-pee-2-plus heart-palpitations dizzy fingers-white-cold breast-tender heavy-flow-day period-symptoms pms-signs tinnitus-louder morning-libido hot-flushes night-sweats breakout skin-allergy sweated-a-lot sick-day",
  eyes: "eye-strain",
  energy: "felt-fatigued had-energy",
  calm: "felt-stressed felt-anxious panic-attack calm-day felt-calm meditated heard-bad-news",
  mood: "felt-depressed felt-happy lost-interest cried-from-something-small cried-today looped-one-song wore-same-shirt",
  joy: "felt-grateful laughed-uncontrollably danced-or-sang-alone petted-an-animal talked-to-pet",
  anger: "felt-angry snapped-at-loved-ones",
  selfworth: "felt-not-like-others felt-useless felt-proud-today got-recognition liked-my-selfie apologized-first",
  rest: "time-for-myself",
  lonely: "felt-lonely isolated-at-home deep-conversation saw-friends complimented-stranger deleted-message kids-reached-out",
  partner: "argued-with-partner felt-close-to-partner felt-lonely-with-partner good-time-together had-sex partner-complimented-me partner-irritated-me partner-raised-voice partner-said-hurtful phones-together thought-about-leaving unfair-chores flirted thought-about-someone-else",
  past: "missed-ex",
  kids: "bedtime-battle child-meltdown child-physical-activity child-refused-food child-sick-symptoms child-slept-poorly child-too-much-screen child-bright-moment quality-time-kid",
  parenting: "got-help-with-kids yelled-at-kid felt-bad-parent felt-overwhelmed-parenting ran-out-of-patience",
  pet: "pet-anxious pet-limped pet-low-energy pet-playful pet-restless-night pet-skipped-food pet-stomach-upset",
  parents: "called-parent parent-confused parent-good-mood parent-pain parent-skipped-meal parent-slept-poorly parent-stumbled parent-took-meds",
  work: "burned-out-after-work felt-fulfilled-at-work didnt-want-to-work worked-overtime",
  focus: "focus-hour main-thing-done many-interruptions procrastinated in-flow",
  workpeople: "boss-was-difficult conflict-with-colleague",
  boundaries: "said-yes-when-meant-no drained-by-someone criticized-by-close parent-pressured toxic-friend",
  habits: "kept-morning-promise no-snooze",
  growth: "did-creative-work hobby-time learned-something-new listened-podcast practiced-skill read-book studied-language watched-course-lecture",
  decisions: "thought-about-emigrating thought-divorce wanted-child wanted-learn-new wanted-life-change wanted-pet thought-career-change wanted-leave-job thought-about-going-back thought-third-country",
  home: "skipped-cleaning home-was-tidy",
  expat: "talked-to-fellow-expats called-someone-back-home locals-were-warm felt-foreigner felt-settled-in missed-home-country missed-familiar-food missed-familiar-weather happy-with-the-move tried-local-food",
  language: "couldnt-express-self didnt-understand-locals language-progress spoke-local-language studied-local-language",
};
const TOPIC_OF = new Map(Object.entries(SPEC).flatMap(([topic, ids]) => ids.split(/\s+/).map((id) => [id, topic] as const)));

/** The question's topic, when it is a library question with one. */
export const topicOf = (tr: Tracker): string | null => {
  const id = templateIdOf(tr);
  return id ? TOPIC_OF.get(id) ?? null : null;
};

/** Small changes that fit this question (keys into experiment.idea.*). */
export const ideasForQuestion = (tr: Tracker): string[] => {
  const topic = topicOf(tr);
  if (topic) return TOPIC_IDEAS[topic] ?? [];
  // a library question with no topic (noise, paperwork…): nothing unrelated
  if (templateIdOf(tr)) return [];
  // her own question: the island's everyday ideas
  return ideasFor(islandOf(tr));
};

/** "Test one change" on an island: the changes for what is hardest there lately, a few topics in turn. */
export const ideasForIsland = (island: IslandId, trackers: Tracker[], entries: TrackerEntry[]): string[] => {
  const d = new Date(); d.setDate(d.getDate() - 30);
  const since = isoLocal(d);
  const here = trackers.filter((x) => !x.archived && x.source !== "play" && islandOf(x) === island);
  const hard = (tr: Tracker) => entries.filter((e) => e.trackerId === tr.id && e.date >= since && typeof e.value === "boolean" && e.value === (tr.problemWhen === "yes")).length;
  const lists = [...new Set(here.map((tr) => ({ tr, n: hard(tr) })).sort((a, b) => b.n - a.n).map(({ tr }) => topicOf(tr)).filter((x): x is string => !!x))]
    .map((topic) => TOPIC_IDEAS[topic] ?? []);
  const out: string[] = [];
  for (let k = 0; k < 4 && out.length < 4; k++) for (const l of lists) { const id = l[k]; if (id && !out.includes(id) && out.length < 4) out.push(id); }
  return out.length ? out : IDEAS[island] ?? ideasFor(island);
};
