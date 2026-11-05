// Short card wording for the most-seen questions (Aurora step 4, plan §5).
// Rules: one fact per card, at most 7 words in EN and 6 in RU, no "today"
// (the header names the day), "you", RU gender-free with the verb first and
// no «ли». YES means it happened. Counted Nov 2 2026 with the plan's script:
// 173 templates; 78 RU questions with "(а)" forms, 68 EN with and/or/slash,
// 146 with today/«сегодня». These 30 are the 11 door questions and the 19
// featured ones. Her own typed questions are never rewritten: the short text
// is used only while a tracker still has the library's own wording.
import { Tracker } from "@/types/tracker";
import { LIFE_STREAMS, type LifeStreamTemplate } from "@/lib/lifeStreams";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerQuestion } from "@/lib/trackerLocalize";

const CARD_TEXT: Record<string, { en: string; ru: string }> = {
  // door questions
  "argued-with-partner": { en: "A fight with your partner?", ru: "Была ссора с партнёром?" },
  "yelled-at-kid": { en: "Snapped at your child?", ru: "Был срыв на ребёнка?" },
  migraine: { en: "A real migraine?", ru: "Была мигрень?" },
  "slept-enough": { en: "Slept 7+ hours?", ru: "Удалось поспать 7+ часов?" },
  "felt-fatigued": { en: "Exhausted most of the day?", ru: "Весь день без сил?" },
  "outside-30min": { en: "30 minutes outside?", ru: "Полчаса на улице?" },
  "ate-by-2pm": { en: "A real meal before 2 pm?", ru: "Была нормальная еда до 14:00?" },
  "drank-alcohol": { en: "Any alcohol?", ru: "Был алкоголь?" },
  "felt-anxious": { en: "Felt anxious?", ru: "Было тревожно?" },
  "felt-depressed": { en: "Felt low most of the day?", ru: "Было подавленное настроение?" },
  "felt-lonely": { en: "Felt lonely?", ru: "Было одиноко?" },
  // featured
  "felt-close-to-partner": { en: "A warm moment with your partner?", ru: "Был тёплый момент вдвоём?" },
  "saw-friends": { en: "Time with friends?", ru: "Было общение с друзьями?" },
  "quality-time-kid": { en: "A real moment with your child?", ru: "Был настоящий момент с ребёнком?" },
  "felt-overwhelmed-parenting": { en: "Parenting felt like too much?", ru: "Было тяжело с детьми?" },
  headache: { en: "Had a headache?", ru: "Болела голова?" },
  exercised: { en: "A real workout?", ru: "Была тренировка?" },
  "ate-sweets": { en: "Had sweets?", ru: "Было сладкое?" },
  "screen-time-long": { en: "4+ hours on screens?", ru: "Было больше 4 часов в экране?" },
  "felt-happy": { en: "A happy day?", ru: "Был счастливый день?" },
  "had-energy": { en: "Enough energy?", ru: "Хватило энергии?" },
  // onboarding v2 (Nov 5 2026)
  "felt-calm": { en: "A calm day?", ru: "Был спокойный день?" },
  "time-for-myself": { en: "Time for yourself?", ru: "Было время для себя?" },
  "main-thing-done": { en: "Got the main thing done?", ru: "Удалось сделать главное?" },
  "focus-hour": { en: "An hour without the phone?", ru: "Был час без телефона?" },
  "woke-at-night": { en: "Woke up at night?", ru: "Просыпался(ась) ночью?" },
  "ate-late": { en: "Ate late?", ru: "Поздно ел(а)?" },
  "wanted-child": { en: "Wished for a child?", ru: "Хотелось ребёнка?" },
  "thought-about-emigrating": { en: "Thought about moving abroad?", ru: "Была мысль уехать?" },
  "read-book": { en: "Read 10+ pages of a book?", ru: "Удалось прочитать 10+ страниц?" },
  "noisy-neighbors": { en: "Noisy neighbors?", ru: "Шумели соседи?" },
  "internet-down": { en: "Internet problems?", ru: "Были проблемы с интернетом?" },
  "criticized-by-close": { en: "Someone close hurt you?", ru: "Кто-то близкий задел?" },
  "spoke-local-language": { en: "Spoke the local language?", ru: "Был разговор на местном языке?" },
  "missed-home-country": { en: "Missed home?", ru: "Была тоска по дому?" },
  "felt-foreigner": { en: "Felt like you don't belong?", ru: "Было чувство отчуждения?" },
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const TEMPLATES = new Map(LIFE_STREAMS.flatMap((s) => s.templates).map((t) => [t.id, t]));

/** The card's question: the short wording when this tracker is still the
 *  library's question, else the usual localized text (her own stays hers). */
export const cardQuestion = (tracker: Tracker): string => {
  const shown = localizeTrackerQuestion(tracker.questionText, tracker.title);
  const id = matchTemplateIdByTitle(tracker.title);
  const short = id ? CARD_TEXT[id] : undefined;
  const tpl = id ? TEMPLATES.get(id) : undefined;
  // Same wording the library would show (in either language, gender
  // forms already applied) = still the library's question.
  if (short && tpl && norm(shown) === norm(localizeTrackerQuestion(tpl.questionText, tpl.title))) {
    return getLanguage() === "ru" ? short.ru : short.en;
  }
  return shown;
};

/** A library question before she adds it, in the same words its card will
 *  use (her note, Nov 3 2026: the list said questions, the library said
 *  statements). */
export const templateQuestion = (tpl: Pick<LifeStreamTemplate, "id" | "title" | "questionText">): string => {
  const short = CARD_TEXT[tpl.id];
  if (short) return getLanguage() === "ru" ? short.ru : short.en;
  return localizeTrackerQuestion(tpl.questionText, tpl.title);
};

/** What she typed, as a question: a capital first letter and a "?" at the
 *  end, the same from every place she can add one. */
export const asQuestion = (text: string): string => {
  const q = text.trim().replace(/\s+/g, " ");
  if (!q) return q;
  const up = q.charAt(0).toUpperCase() + q.slice(1);
  return /[?？]$/.test(up) ? up : `${up}?`;
};
