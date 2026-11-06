// Card wording for the most-seen questions (Aurora step 4, plan §5; rewritten
// Nov 5 2026, her note: "A warm moment with your partner?" and "Time with
// friends?" read like the app offering something, not asking about her day,
// even under "About today"). Rules: a whole question with "you" and a verb
// ("Did you…?", "Were you…?"), about 8 words; no "today" (the card's header
// names the day, and past days use the same card); RU gender-free with the
// verb or «было» first and no «ли». YES means it happened. Her own typed
// questions are never rewritten: the short text is used only while a tracker
// still has the library's own wording.
import { Tracker } from "@/types/tracker";
import { LIFE_STREAMS, type LifeStreamTemplate } from "@/lib/lifeStreams";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerQuestion } from "@/lib/trackerLocalize";

const CARD_TEXT: Record<string, { en: string; ru: string }> = {
  // door questions
  "argued-with-partner": { en: "Did you fight with your partner?", ru: "Была ссора с партнёром?" },
  "yelled-at-kid": { en: "Did you snap at your child?", ru: "Был срыв на ребёнка?" },
  migraine: { en: "Did you have a migraine?", ru: "Была мигрень?" },
  "slept-enough": { en: "Did you sleep 7+ hours?", ru: "Удалось поспать 7+ часов?" },
  "felt-fatigued": { en: "Were you exhausted most of the day?", ru: "Весь день не было сил?" },
  "outside-30min": { en: "Were you outside for 30 minutes?", ru: "Удалось побыть на улице полчаса?" },
  "ate-by-2pm": { en: "Did you eat a real meal before 2 pm?", ru: "Была нормальная еда до 14:00?" },
  "drank-alcohol": { en: "Did you drink any alcohol?", ru: "Был алкоголь?" },
  "felt-anxious": { en: "Did you feel anxious?", ru: "Было тревожно?" },
  "felt-depressed": { en: "Did you feel low most of the day?", ru: "Было подавленное настроение?" },
  "felt-lonely": { en: "Did you feel lonely?", ru: "Было одиноко?" },
  // featured
  "felt-close-to-partner": { en: "Did you have a warm moment with your partner?", ru: "Был тёплый момент вдвоём?" },
  "saw-friends": { en: "Did you spend time with friends?", ru: "Было общение с друзьями?" },
  "quality-time-kid": { en: "Did you have a real moment with your child?", ru: "Был настоящий момент с ребёнком?" },
  "felt-overwhelmed-parenting": { en: "Did parenting feel like too much?", ru: "Было тяжело с детьми?" },
  headache: { en: "Did you have a headache?", ru: "Болела голова?" },
  exercised: { en: "Did you do a real workout?", ru: "Была тренировка?" },
  "ate-sweets": { en: "Did you eat sweets?", ru: "Было сладкое?" },
  "screen-time-long": { en: "Did you spend 4+ hours on screens?", ru: "Было больше 4 часов в экране?" },
  "felt-happy": { en: "Was it a happy day?", ru: "Был счастливый день?" },
  "had-energy": { en: "Did you have enough energy?", ru: "Хватило энергии?" },
  // onboarding v2 (Nov 5 2026)
  "felt-calm": { en: "Did you feel calm?", ru: "Был спокойный день?" },
  "time-for-myself": { en: "Did you have time for yourself?", ru: "Было время для себя?" },
  "main-thing-done": { en: "Did you finish your most important task?", ru: "Успели сделать самое важное дело?" },
  "focus-hour": { en: "Did you work an hour without your phone?", ru: "Был час без телефона?" },
  "woke-at-night": { en: "Did you wake up at night?", ru: "Просыпался(ась) ночью?" },
  "ate-late": { en: "Did you eat late in the evening?", ru: "Был поздний плотный ужин?" },
  "wanted-child": { en: "Did you wish for a child?", ru: "Хотелось ребёнка?" },
  "thought-about-emigrating": { en: "Did you think about moving abroad?", ru: "Была мысль уехать?" },
  "read-book": { en: "Did you read 10+ pages of a book?", ru: "Удалось прочитать 10+ страниц?" },
  "took-meds": { en: "Did you take your medication?", ru: "Удалось принять лекарства как нужно?" },
  "napped": { en: "Did you nap during the day?", ru: "Спал(а) днём?" },
  "screens-before-bed": { en: "Screens in the hour before sleep?", ru: "Был экран за час до сна?" },
  "walked-a-lot": { en: "Did you walk 7,000+ steps?", ru: "Удалось пройти 7000+ шагов?" },
  "ate-vegetables": { en: "Did you eat vegetables or fruit?", ru: "Были овощи или фрукты?" },
  "felt-stressed": { en: "Was today stressful?", ru: "Сегодня был стресс?" },
  "meditated": { en: "Did you meditate or breathe slowly?", ru: "Удалось помедитировать или подышать?" },
  "felt-grateful": { en: "Did you notice something good?", ru: "Удалось заметить что-то хорошее?" },
  "hobby-time": { en: "Did you spend time on your hobby?", ru: "Было время на хобби?" },
  "noisy-neighbors": { en: "Were the neighbors noisy?", ru: "Шумели соседи?" },
  "internet-down": { en: "Did you have internet problems?", ru: "Были проблемы с интернетом?" },
  "criticized-by-close": { en: "Did someone close hurt you?", ru: "Кто-то близкий задел?" },
  "spoke-local-language": { en: "Did you speak the local language?", ru: "Был разговор на местном языке?" },
  "missed-home-country": { en: "Did you miss home?", ru: "Была тоска по дому?" },
  "felt-foreigner": { en: "Did you feel like you don't belong?", ru: "Было чувство отчуждения?" },
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
