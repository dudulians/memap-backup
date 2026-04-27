import { LIFE_STREAMS, TRENDING_TEMPLATES_SOURCE } from "./lifeStreams";
import { getLanguage } from "./i18n";
import { polishRu, getPol } from "./genderPolish";

/**
 * Display-time English → Russian mapping for tracker titles & question text.
 *
 * Existing trackers in user localStorage were seeded in English (from
 * LIFE_STREAMS templates, the legacy TEMPLATE_GROUPS catalog, or onboarding
 * starters). We can't mutate stored user data silently, but we can swap the
 * display string at render time when the active language is Russian.
 *
 * For any string not in the map (custom trackers the user typed themselves),
 * we pass through unchanged.
 */

// English ↔ Russian pairs for trackers that ever originated from the
// legacy TEMPLATE_GROUPS catalog (src/lib/templateGroups.ts).
// Kept inline because templateGroups.ts doesn't carry `titleRu`.
const LEGACY_TEMPLATE_GROUP_PAIRS: Array<[string, string]> = [
  ["Low mood days", "Дни низкого настроения"],
  ["No energy days", "Дни без энергии"],
  ["Anxiety days", "Дни тревоги"],
  ["Arguments with partner", "Ссоры с партнёром"],
  ["Feeling close to partner", "Близость с партнёром"],
  ["Family quality time", "Качественное время с семьёй"],
  ["Do I want to go to work?", "Хочу ли я идти на работу?"],
  ["Burned out after work", "Выгорал(а) после работы"],
  ["Overtime days", "Дни переработок"],
  ["Migraine days", "Дни мигрени"],
  ["Poor sleep nights", "Плохие ночи сна"],
  ["Moved my body", "Двигался(ась)"],
  ["Alcohol days", "Дни с алкоголем"],
  ["After-midnight bedtime", "Ложился(ась) после полуночи"],
  ["Doomscrolling evenings", "Вечера залипания в ленте"],
  ["Dog accidents at home", "Собака нашкодила дома"],
  ["Met someone new", "Познакомился(ась) с кем-то"],
  ["Creative days", "Творческие дни"],
];

// Group header translations for the legacy TEMPLATE_GROUPS catalog — the
// "Emotions & Mind", "Connections & Love" etc. section titles in the
// AddTrackerModal suggested-ideas view.
const LEGACY_GROUP_TITLE_PAIRS: Array<[string, string]> = [
  ["Emotions & Mind", "Эмоции и ум"],
  ["Connections & Love", "Близость и отношения"],
  ["Voice & Work", "Голос и работа"],
  ["Health & Body", "Здоровье и тело"],
  ["Habits & substances", "Привычки и зависимости"],
  ["Curious & Fun", "Любопытное и весёлое"],
];

const LEGACY_GROUP_DESC_PAIRS: Array<[string, string]> = [
  ["Track how often your emotional state becomes really difficult.", "Замечай, как часто эмоциональное состояние становится по-настоящему тяжёлым."],
  ["Notice patterns in how your close relationships feel.", "Замечай паттерны в том, как ощущаются твои близкие отношения."],
  ["Understand how your job is affecting you over time.", "Понимай, как работа влияет на тебя со временем."],
  ["Track recurring physical issues and helpful habits.", "Отслеживай повторяющиеся телесные штуки и полезные привычки."],
  ["Notice patterns in alcohol, screens and other habits.", "Замечай паттерны в алкоголе, экранах и других привычках."],
  ["Light-weight trackers for curiosity or playful experiments.", "Лёгкие трекеры для любопытства и игровых экспериментов."],
];

const LEGACY_TEMPLATE_GROUP_QUESTION_PAIRS: Array<[string, string]> = [
  ["Was your mood very low for most of the day?", "Настроение было очень низким большую часть дня?"],
  ["Did you feel exhausted and without energy for most of the day?", "Ты чувствовал(а) себя истощённым и без сил большую часть дня?"],
  ["Did you feel anxious or on edge most of the day?", "Ты чувствовал(а) тревогу или напряжение большую часть дня?"],
  ["Did you have a serious argument with your partner today?", "У тебя сегодня была серьёзная ссора с партнёром?"],
  ["Did you feel emotionally close to your partner today?", "Ты чувствовал(а) сегодня эмоциональную близость с партнёром?"],
  ["Did you spend any real quality time with your family today?", "Ты провёл(а) сегодня настоящее качественное время с семьёй?"],
  ["Did you genuinely want to go to work today?", "Ты сегодня искренне хотел(а) идти на работу?"],
  ["Did you feel completely burned out after work today?", "Ты чувствовал(а) полное выгорание после работы?"],
  ["Did you work significantly longer than planned today?", "Ты сегодня работал(а) заметно дольше, чем планировал(а)?"],
  ["Did you have a migraine today?", "У тебя сегодня была мигрень?"],
  ["Did you sleep poorly or less than 6 hours last night?", "Ты спал(а) плохо или меньше 6 часов этой ночью?"],
  ["Did you intentionally move your body today (walk, exercise, stretch)?", "Ты сегодня намеренно двигался(ась) (ходил(а), тренировался(ась), тянулся(ась))?"],
  ["Did you drink alcohol today?", "Ты сегодня пил(а) алкоголь?"],
  ["Did you go to bed after midnight today?", "Ты сегодня ложился(ась) после полуночи?"],
  ["Did you spend a lot of time doomscrolling or stuck in social media tonight?", "Ты сегодня много времени залипал(а) в соцсетях?"],
  ["Did your dog pee or poop at home today?", "Собака сегодня написала или накакала дома?"],
  ["Did you meet a new person today that you actually spoke with?", "Ты сегодня познакомился(ась) с кем-то новым и реально поговорил(а)?"],
  ["Did you do anything creative today (writing, drawing, music, ideas)?", "Ты сегодня сделал(а) что-то творческое (писал(а), рисовал(а), музыка, идеи)?"],
];

// Onboarding starters — the English/Russian pairs pulled from
// src/locales/en.ts / ru.ts (onboarding.starters.*) and the hero example
// questions that may be surfaced as starter-like items.
const ONBOARDING_STARTER_TITLE_PAIRS: Array<[string, string]> = [
  ["Headache", "Головная боль"],
  ["Stress", "Стресс"],
  ["Loneliness", "Одиночество"],
  ["Rudeness from others", "Грубость"],
  ["Toxic conversation", "Токсичный разговор"],
  ["Overload", "Перегрузка"],
  ["Deadline pressure", "Давление дедлайнов"],
  ["Sleep", "Сон"],
  ["Movement", "Движение"],
  ["Time with loved ones", "Время с близкими"],
  ["My voice", "Мой голос"],
  ["Joy", "Радость"],
  ["My space", "Моё пространство"],
];

const ONBOARDING_STARTER_QUESTION_PAIRS: Array<[string, string]> = [
  ["Did I have a headache today?", "Болела ли сегодня голова?"],
  ["Did I feel stressed today?", "Чувствовал(а) ли я стресс сегодня?"],
  ["Did I feel lonely today?", "Чувствовал(а) ли я одиночество сегодня?"],
  ["Was someone rude to me today?", "Был ли кто-то груб со мной сегодня?"],
  ["Did I have a toxic conversation today?", "Был ли у меня токсичный разговор сегодня?"],
  ["Did I feel overloaded by work today?", "Чувствовал(а) ли я перегрузку от работы сегодня?"],
  ["Did deadlines pressure me today?", "Давили ли на меня дедлайны сегодня?"],
  ["Did I sleep well last night?", "Хорошо ли я спал(а) сегодня ночью?"],
  ["Did I move my body enough today?", "Двигал(а) ли я достаточно сегодня?"],
  ["Did I spend quality time with someone close?", "Провёл(а) ли я качественное время с кем-то близким?"],
  ["Did I say what I wanted to say today?", "Сказал(а) ли я сегодня то, что хотел(а) сказать?"],
  ["Did something make me smile today?", "Заставило ли меня что-то улыбнуться сегодня?"],
  ["Was my space comfortable today?", "Было ли моё пространство комфортным сегодня?"],
  // Hero example questions (in case any user stored them as tracker question text)
  ["Did I argue with my partner today?", "Я сегодня ссорился(ась) с партнёром?"],
];

// Reflection-text translations for the 18 legacy TEMPLATE_GROUPS templates.
// LIFE_STREAMS templates already carry adviceAboveThresholdRu inline; this
// is the bridge for the older catalog that doesn't.
const LEGACY_TEMPLATE_GROUP_ADVICE_PAIRS: Array<[string, string]> = [
  ["Many days with very low mood noticed. Consider talking to a mental health professional for support.", "Много дней с очень низким настроением. Возможно, стоит поговорить со специалистом по психическому здоровью."],
  ["Frequent low-energy days emerging. This could signal burnout or stress. Consider slowing down and asking for support.", "Часто бывают дни без энергии. Это может быть выгорание или стресс. Подумай, чтобы сбавить темп и попросить поддержки."],
  ["Anxiety appearing often. It might be helpful to talk to a therapist or doctor.", "Тревога появляется часто. Возможно, стоит обратиться к терапевту или врачу."],
  ["Frequent arguments noticed. It may be time to talk openly together or consider couples therapy.", "Замечено много ссор. Возможно, время для открытого разговора или семейной терапии."],
  ["Many days feeling distant. It may be worth talking honestly about needs and expectations.", "Много дней с ощущением дистанции. Возможно, стоит честно поговорить о потребностях и ожиданиях."],
  ["Almost no quality time together recently. Small changes in routine may help you reconnect.", "Качественного времени вместе почти не было. Небольшие изменения в рутине могут помочь восстановить связь."],
  ["Most days you didn't want to go to work. It might be time to rethink your job, workload or environment.", "Большинство дней не хотелось идти на работу. Возможно, стоит переосмыслить работу, нагрузку или окружение."],
  ["Frequent burnout evenings emerging. Your workload, boundaries or role may need attention.", "Часто появляется выгорание по вечерам. Возможно, нагрузке, границам или роли нужно внимание."],
  ["Constant overtime is rarely sustainable. Consider discussing expectations or protecting your time.", "Постоянные переработки редко проходят бесследно. Подумай, чтобы обсудить ожидания или защитить своё время."],
  ["Migraines appearing very often. Consider talking to a neurologist about preventive treatment.", "Мигрени появляются очень часто. Возможно, стоит поговорить с неврологом о профилактическом лечении."],
  ["Frequent poor sleep can affect mood, focus and health. Consider improving sleep habits or consulting a specialist.", "Частый плохой сон влияет на настроение, концентрацию и здоровье. Подумай, чтобы улучшить привычки сна или обратиться к специалисту."],
  ["Most days pass without intentional movement. Starting with small, gentle activity could already help.", "Большинство дней проходят без движения. Начать с небольшой, мягкой активности уже может помочь."],
  ["Alcohol present on many days. It may be helpful to reconsider your habits or talk to a professional.", "Алкоголь присутствует во многие дни. Возможно, стоит пересмотреть привычки или поговорить со специалистом."],
  ["Frequently going to bed very late. Small changes to evening routines can help.", "Ты часто ложишься очень поздно. Небольшие изменения в вечерней рутине могут помочь."],
  ["Most evenings end in doomscrolling. It might be helpful to set gentle limits or replace it with something calming.", "Большинство вечеров заканчиваются залипанием в ленте. Возможно, поможет мягкое ограничение или замена на что-то успокаивающее."],
  ["Frequent accidents noticed. May be time to check health, routine or training.", "Замечено много промахов. Возможно, стоит проверить здоровье, рутину или подучить."],
  ["Want more connection but rarely meet new people? Try changing a small routine or activity.", "Хочется больше общения, но редко знакомишься с новыми людьми? Попробуй сменить небольшую рутину или активность."],
  ["Creativity is important to you but happens rarely. Blocking even 15 minutes can make a difference.", "Творчество важно, но случается редко. Даже 15 минут в день уже многое меняют."],
];

// Bidirectional lookup. Each "domain" (titles / questions / advices /
// groupTitles / groupDescriptions) has both EN→RU and RU→EN maps so that
// switching language in either direction translates known template strings
// without touching what's persisted in localStorage. Custom user-typed
// strings that aren't in any map pass through unchanged.
interface DirectionalMap {
  enToRu: Map<string, string>;
  ruToEn: Map<string, string>;
}

interface LookupMaps {
  titles: DirectionalMap;
  questions: DirectionalMap;
  advices: DirectionalMap;
  groupTitles: DirectionalMap;
  groupDescriptions: DirectionalMap;
}

let _map: LookupMaps | null = null;

// Helper: register a pair into both directions. Empty strings are skipped
// (some advice fields can be empty for templates that don't need them).
const addPair = (m: DirectionalMap, en: string, ru: string) => {
  if (!en || !ru) return;
  m.enToRu.set(en, ru);
  m.ruToEn.set(ru, en);
};

const buildMap = (): LookupMaps => {
  const titles: DirectionalMap = { enToRu: new Map(), ruToEn: new Map() };
  const questions: DirectionalMap = { enToRu: new Map(), ruToEn: new Map() };
  const advices: DirectionalMap = { enToRu: new Map(), ruToEn: new Map() };
  const groupTitles: DirectionalMap = { enToRu: new Map(), ruToEn: new Map() };
  const groupDescriptions: DirectionalMap = { enToRu: new Map(), ruToEn: new Map() };

  // From LIFE_STREAMS
  LIFE_STREAMS.forEach((stream) => {
    stream.templates.forEach((t) => {
      addPair(titles, t.title, t.titleRu);
      addPair(questions, t.questionText, t.questionTextRu);
      addPair(advices, t.adviceAboveThreshold, t.adviceAboveThresholdRu);
    });
  });

  // From TRENDING templates source
  TRENDING_TEMPLATES_SOURCE.forEach((t) => {
    addPair(titles, t.title, t.titleRu);
    addPair(questions, t.questionText, t.questionTextRu);
    addPair(advices, t.adviceAboveThreshold, t.adviceAboveThresholdRu);
  });

  // Legacy TEMPLATE_GROUPS pairs
  LEGACY_TEMPLATE_GROUP_PAIRS.forEach(([en, ru]) => addPair(titles, en, ru));
  LEGACY_TEMPLATE_GROUP_QUESTION_PAIRS.forEach(([en, ru]) => addPair(questions, en, ru));
  LEGACY_TEMPLATE_GROUP_ADVICE_PAIRS.forEach(([en, ru]) => addPair(advices, en, ru));

  // Onboarding starters
  ONBOARDING_STARTER_TITLE_PAIRS.forEach(([en, ru]) => addPair(titles, en, ru));
  ONBOARDING_STARTER_QUESTION_PAIRS.forEach(([en, ru]) => addPair(questions, en, ru));

  // Group titles and descriptions
  LEGACY_GROUP_TITLE_PAIRS.forEach(([en, ru]) => addPair(groupTitles, en, ru));
  LEGACY_GROUP_DESC_PAIRS.forEach(([en, ru]) => addPair(groupDescriptions, en, ru));

  return { titles, questions, advices, groupTitles, groupDescriptions };
};

const getMap = (): LookupMaps => {
  if (_map === null) _map = buildMap();
  return _map;
};

// Generic lookup for the active language. Picks the right direction map and
// passes the input through unchanged if no translation exists (custom text).
// When the active language is Russian, the result is also run through
// polishRu so bracketed gender suffixes (e.g. "сделал(а)") resolve to the
// user's actual `pol`. Custom user-typed strings still pass through both
// stages — no map hit + polishRu is a no-op for text without brackets.
// Display-time lookup: maps EN↔RU AND polishes RU output by the user's
// stored pol. Use this for ALL render-time strings.
const lookup = (m: DirectionalMap, input: string): string => {
  if (!input) return input;
  const lang = getLanguage();
  const dir = lang === "ru" ? m.enToRu : m.ruToEn;
  const out = dir.get(input) ?? input;
  return lang === "ru" ? polishRu(out, getPol()) : out;
};

// Storage lookup: same map switch but DOES NOT polish — keeps the
// neutral bracketed form intact so a tracker stored at gender-A can be
// re-rendered correctly when the user later picks gender-B. Use this
// when seeding new trackers (onboarding, AddTracker, play round, etc.).
const lookupRaw = (m: DirectionalMap, input: string): string => {
  if (!input) return input;
  const lang = getLanguage();
  const dir = lang === "ru" ? m.enToRu : m.ruToEn;
  return dir.get(input) ?? input;
};

export const localizeTrackerTitle = (title: string): string =>
  lookup(getMap().titles, title);

export const localizeTrackerQuestion = (q: string): string =>
  lookup(getMap().questions, q);

export const localizeTrackerAdvice = (a: string): string =>
  lookup(getMap().advices, a);

// Storage variants — return localized but un-polished text. Stored
// trackers therefore keep "сделал(а)"-style brackets, and polishRu
// runs at display time via the regular localize* functions above.
export const localizeTrackerTitleRaw = (title: string): string =>
  lookupRaw(getMap().titles, title);

export const localizeTrackerQuestionRaw = (q: string): string =>
  lookupRaw(getMap().questions, q);

export const localizeTrackerAdviceRaw = (a: string): string =>
  lookupRaw(getMap().advices, a);

export const localizeGroupTitle = (title: string): string =>
  lookup(getMap().groupTitles, title);

export const localizeGroupDescription = (desc: string): string =>
  lookup(getMap().groupDescriptions, desc);

export const localizeTracker = <T extends { title: string; questionText?: string }>(tracker: T): T => {
  // Both directions handled inside localizeTrackerTitle/Question — they
  // pick the right lookup based on getLanguage(). No early-return needed.
  return {
    ...tracker,
    title: localizeTrackerTitle(tracker.title),
    ...(tracker.questionText ? { questionText: localizeTrackerQuestion(tracker.questionText) } : {}),
  };
};
