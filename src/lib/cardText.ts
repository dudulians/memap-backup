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
import { testQuestionOf } from "@/lib/testWords";
import { RU_CARD } from "@/lib/ruNeutral";

const CARD_TEXT: Record<string, { en: string; ru: string }> = {
  // inner questions (Nov 12 2026, option A)
  "kept-going-over-it": { en: "Did you keep going over something in your head?", ru: "Крутилась в голове одна и та же ситуация?" },
  "scolded-myself": { en: "Did you scold yourself for something?", ru: "Приходилось себя ругать?" },
  "switched-off-from-work": { en: "Did you manage to switch off from work in the evening?", ru: "Удалось вечером отключиться от работы?" },
  "felt-understood": { en: "Did you feel understood by someone?", ru: "Было чувство, что тебя понимают?" },
  "let-it-pass": { en: "Did you let something pass to avoid an argument?", ru: "Пришлось промолчать, чтобы не было ссоры?" },
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
  // RU says "most of the day" like EN (content review, Nov 9 2026: any low moment counted in RU)
  "felt-depressed": { en: "Did you feel low most of the day?", ru: "Было подавленное настроение почти весь день?" },
  "felt-lonely": { en: "Did you feel lonely?", ru: "Было одиноко?" },
  // featured
  "felt-close-to-partner": { en: "Did you have a warm moment with your partner?", ru: "Был тёплый момент вдвоём?" },
  // "in person", as the title and the tip say (content review, Nov 9 2026)
  "saw-friends": { en: "Did you see friends in person?", ru: "Была встреча с друзьями вживую?" },
  // «настоящий момент» reads as "the present moment" (content review, Nov 9 2026)
  "quality-time-kid": { en: "Did you have a real moment with your child?", ru: "Удалось по-настоящему побыть с ребёнком?" },
  "felt-overwhelmed-parenting": { en: "Did parenting feel like too much?", ru: "Было тяжело с детьми?" },
  headache: { en: "Did you have a headache?", ru: "Болела голова?" },
  exercised: { en: "Did you do a real workout?", ru: "Была тренировка?" },
  "ate-sweets": { en: "Did you eat more sweets than you wanted?", ru: "Сладкого было больше, чем хотелось?" },
  "screen-time-long": { en: "Did you spend 4+ hours on screens outside work?", ru: "Было больше 4 часов в экране не по работе?" },
  "felt-happy": { en: "Was it a happy day?", ru: "Был счастливый день?" },
  "had-energy": { en: "Did you have enough energy for your day?", ru: "Хватило энергии на день?" },
  "wanted-leave-job": { en: "Did you seriously think about quitting?", ru: "Была всерьёз мысль уволиться?" },
  // onboarding v2 (Nov 5 2026)
  "felt-calm": { en: "Did you feel calm?", ru: "Был спокойный день?" },
  "time-for-myself": { en: "Did you have time for yourself?", ru: "Было время для себя?" },
  "main-thing-done": { en: "Did you finish your most important task?", ru: "Самое важное дело сделано?" },
  "focus-hour": { en: "Did you work an hour without your phone?", ru: "Был час без телефона?" },
  "woke-at-night": { en: "Did you wake up at night?", ru: "Были ночные пробуждения?" },
  // a big meal late, as the question and the tip mean (content review, Nov 9 2026)
  "ate-late": { en: "Did you have a big dinner late in the evening?", ru: "Был поздний плотный ужин?" },
  "wanted-child": { en: "Did you wish for a child?", ru: "Хотелось ребёнка?" },
  "thought-about-emigrating": { en: "Did you think about moving abroad?", ru: "Была мысль уехать из страны?" },
  "read-book": { en: "Did you read 10+ pages of a book?", ru: "Удалось прочитать 10+ страниц?" },
  "took-meds": { en: "Did you take your medication?", ru: "Удалось принять лекарства как нужно?" },
  "napped": { en: "Did you nap during the day?", ru: "Был дневной сон?" },
  "screens-before-bed": { en: "Did you use screens in the hour before sleep?", ru: "Был экран за час до сна?" },
  "walked-a-lot": { en: "Did you walk 7,000+ steps?", ru: "Удалось пройти 7000+ шагов?" },
  "ate-vegetables": { en: "Did you eat vegetables or fruit?", ru: "Были овощи или фрукты?" },
  "felt-stressed": { en: "Was the day stressful?", ru: "Был стресс?" },
  "meditated": { en: "Did you meditate or breathe slowly?", ru: "Удалось помедитировать или подышать?" },
  "felt-grateful": { en: "Did you notice something good?", ru: "Удалось заметить что-то хорошее?" },
  "hobby-time": { en: "Did you spend time on your hobby?", ru: "Было время на хобби?" },
  "noisy-neighbors": { en: "Were the neighbors noisy?", ru: "Шумели соседи?" },
  "internet-down": { en: "Did you have internet problems?", ru: "Были проблемы с интернетом?" },
  // criticism too, as the title and the answer words say (content review, Nov 9 2026)
  "criticized-by-close": { en: "Did someone close criticize or hurt you?", ru: "Кто-то близкий критиковал или задел?" },
  "spoke-local-language": { en: "Did you speak the local language?", ru: "Был разговор на местном языке?" },
  "missed-home-country": { en: "Did you miss home?", ru: "Была тоска по дому?" },
  "felt-foreigner": { en: "Did you feel like you don't belong?", ru: "Было чувство отчуждения?" },
  // content review (Nov 9 2026): no slashes, brackets, «нём/ней», slang or stiff words; same meaning
  "partner-irritated-me": { en: "Did your partner annoy you?", ru: "Партнёр раздражал?" },
  "procrastinated": { en: "Did you put things off most of the day?", ru: "Дела в основном откладывались?" },
  "boss-was-difficult": { en: "Did your boss put pressure on you or treat you badly?", ru: "Начальник давил или вёл себя неприятно?" },
  "impulse-spending": { en: "Did you buy something on impulse?", ru: "Была спонтанная покупка?" },
  "same-wake-time": { en: "Did you get up at about your usual time?", ru: "Подъём был примерно в обычное время?" },
  "felt-fulfilled-at-work": { en: "Did work feel meaningful or energising?", ru: "Работа радовала или давала силы?" },
  "cooked-myself": { en: "Did you cook at home instead of ordering or eating out?", ru: "Еда была домашняя, не доставка и не кафе?" },
  "did-creative-work": { en: "Did you write, draw, play music or make something?", ru: "Было что-то творческое — текст, рисунок, музыка, поделка?" },
  "stretched": { en: "Did you stretch or do a warm-up?", ru: "Была растяжка или разминка?" },
  "doomscrolled-news": { en: "Did you spend too long in news or sports feeds?", ru: "Было слишком много новостей или спортивных лент?" },
  "skipped-meal": { en: "Did you skip a meal or go 5+ hours without food in the day?", ru: "Был пропуск еды или больше 5 часов без еды днём?" },
  "felt-nauseous": { en: "Did you feel nauseous, not from something you ate?", ru: "Тошнило, но не из-за еды?" },
  "ate-fast-food": { en: "Did you eat fast food, pastries or white bread?", ru: "Был фастфуд, выпечка или быстрые углеводы?" },
  "parent-pressured": { en: "Did a parent push their opinion, criticize or hurt you?", ru: "Родитель давил мнением, критиковал или обижал?" },
  "child-physical-activity": { en: "Did your child run, play or walk outside a lot?", ru: "Ребёнок много двигался — бегал, играл, гулял?" },
};

/** The old card words of a question whose meaning changed (template.legacy keeps the old text). */
const CARD_TEXT_OLD: Record<string, { en: string; ru: string }> = {
  "ate-sweets": { en: "Did you eat sweets?", ru: "Было сладкое?" },
  "apologized-first": { en: "Did you apologise to someone first?", ru: "Первое «прости» было от тебя?" },
  "good-time-together": { en: "Did you share a good moment as a couple?", ru: "Был приятный момент вдвоём?" },
  // re-meant Nov 10 2026 (her pick): "Laughed today", "Did something kind for someone"
  "laughed-uncontrollably": { en: "Did you laugh so hard you couldn't stop?", ru: "Был смех до слёз?" },
  "complimented-stranger": { en: "Did you say something kind to someone outside your circle?", ru: "Было приятное слово кому-то не из своих?" },
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
/** «сделал(а)», «один(на)»: a library wording with gender endings (her own questions don't have them) */
const GENDER_BRACKETS = /[а-яё]\((а|ась|ла|ой|на|ы|ая|легла|прошла|одна|довольна)\)/i;
const TEMPLATES = new Map(LIFE_STREAMS.flatMap((s) => s.templates).map((t) => [t.id, t]));

/** The card's question: the short wording when this tracker is still the
 *  library's question, else the usual localized text (her own stays hers). */
export const cardQuestion = (tracker: Tracker): string => {
  // a 2-week test: its name as a whole question in today's language (Nov 8 2026: "In bed by 23:00?")
  if (tracker.id.endsWith("-test")) return testQuestionOf(tracker.title);
  const shown = localizeTrackerQuestion(tracker.questionText, tracker.title);
  const id = matchTemplateIdByTitle(tracker.title);
  const short = id ? CARD_TEXT[id] : undefined;
  const tpl = id ? TEMPLATES.get(id) : undefined;
  // Same wording the library would show (in either language, gender
  // forms already applied) = still the library's question.
  if (short && tpl && norm(shown) === norm(localizeTrackerQuestion(tpl.questionText, tpl.title))) {
    return noToday(getLanguage() === "ru" ? short.ru : short.en);
  }
  // A question re-meant in the library (content review, Nov 9 2026) that she already tracks keeps
  // its old meaning, in the old card's words: her answers were to that question.
  const old = id ? CARD_TEXT_OLD[id] : undefined;
  const leg = tpl?.legacy;
  if (old && leg && [leg.questionText, leg.questionTextRu].some((q) => !!q && norm(shown) === norm(localizeTrackerQuestion(q, tracker.title)))) {
    return noToday(getLanguage() === "ru" ? old.ru : old.en);
  }
  // Russian without gender brackets for the library wording (QA, Nov 8 2026)
  if (getLanguage() === "ru" && id && RU_CARD[id] && tpl && (norm(shown) === norm(localizeTrackerQuestion(tpl.questionText, tpl.title)) || GENDER_BRACKETS.test(shown))) return noToday(RU_CARD[id]);
  return noToday(shown);
};
/** Is this still the library's own question: its wording now or before the Nov 2026 rewordings, in English or
 *  Russian, with or without gender brackets? When she renamed it ("Did you fight with Kristina?") it is not, and her
 *  words win everywhere a link or a chip speaks about it (her rule, Nov 13 2026; built Nov 14). The same test the
 *  card uses above. */
export const isLibraryWording = (tracker: Tracker, knownId?: string | null): boolean => {
  // knownId: what the question is about when its id says so (a library question keeps its id when its title changes)
  const id = knownId ?? matchTemplateIdByTitle(tracker.title);
  const tpl = id ? TEMPLATES.get(id) : undefined;
  if (!id || !tpl) return false;
  if (!tracker.questionText?.trim()) return true;
  const bare = (q: string) => norm(noToday(q)).split("?").join("").split("？").join("").trim();
  const shown = bare(localizeTrackerQuestion(tracker.questionText, tracker.title));
  const raw = bare(tracker.questionText);
  const leg = tpl.legacy;
  const known = [tpl.questionText, tpl.questionTextRu, leg?.questionText, leg?.questionTextRu, tpl.title, tpl.titleRu, leg?.title, leg?.titleRu,
    CARD_TEXT[id]?.en, CARD_TEXT[id]?.ru, CARD_TEXT_OLD[id]?.en, CARD_TEXT_OLD[id]?.ru, RU_CARD[id]].filter((q): q is string => !!q);
  if (known.some((q) => { const k = bare(q), l = bare(localizeTrackerQuestion(q, tracker.title)); return k === raw || k === shown || l === raw || l === shown; })) return true;
  // an old Russian wording of the library, still with gender endings: no one types "(а)" in a question of their own
  return GENDER_BRACKETS.test(tracker.questionText);
};
/** The card's header names the day; past days use the same card (QA, Nov 8 2026: "Did your back hurt
 *  today?" on a past day). Only the library's own wording; her own questions stay as she typed them. */
const noToday = (q: string): string => {
  const en = q.replace(/\btoday's\b/gi, "the day's").replace(/^Was today a day\b/i, "Was it a day").replace(/\bmake today\b/gi, "make the day")
    .replace(/,?\s+today or last night/i, " during the day or at night").replace(/\s+today\b/gi, "")
    // "last night" is the wrong night when she answers for yesterday (QA re-check, Nov 9 2026)
    .replace(/\bfall asleep last night\b/gi, "fall asleep").replace(/\s+last night\b/gi, " at night")
    // one way to write a time in English: "2 pm" (QA, Nov 8 2026: "after 2pm" next to "2 pm")
    .replace(/\b(\d{1,2})(am|pm)\b/g, "$1 $2");
  // «сегодня» anywhere in the sentence, not only at its end (QA re-check: «Болел сегодня какой-то сустав?»)
  const ru = en.replace(/^Сегодня\s+(\S)/, (_m, c: string) => c.toUpperCase()).replace(/\s+сегодня(?=[\s?,—(/]|$)/g, "");
  return ru;
};

/** A library question before she adds it, in the same words its card will
 *  use (her note, Nov 3 2026: the list said questions, the library said
 *  statements). */
export const templateQuestion = (tpl: Pick<LifeStreamTemplate, "id" | "title" | "questionText">): string => {
  const short = CARD_TEXT[tpl.id];
  if (short) return noToday(getLanguage() === "ru" ? short.ru : short.en);
  if (getLanguage() === "ru" && RU_CARD[tpl.id]) return noToday(RU_CARD[tpl.id]);
  return noToday(localizeTrackerQuestion(tpl.questionText, tpl.title));
};

/** What she typed, as a question: a capital first letter and a "?" at the
 *  end, the same from every place she can add one. */
export const asQuestion = (text: string): string => {
  const q = text.trim().replace(/\s+/g, " ");
  if (!q) return q;
  const up = q.charAt(0).toUpperCase() + q.slice(1);
  return /[?？]$/.test(up) ? up : `${up}?`;
};
