import { LIFE_STREAMS, TRENDING_TEMPLATES_SOURCE } from "./lifeStreams";
import { getLanguage } from "./i18n";
import { polishRu, getPol } from "./genderPolish";
import { matchTemplateIdByTitle } from "./relatedQuestions";

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

// Title pairs for the OLD LIFE_STREAMS templates that existed before the
// 1.6 repositioning rewrite. These templates are no longer in
// LIFE_STREAMS, but user-stored trackers still reference these strings,
// so we need to keep the EN↔RU map alive for them. Without this list,
// switching language leaves these trackers showing in their stored
// language (the user's "Felt like starting new life sits in English
// when I switch to Russian" complaint).
const LEGACY_LIFESTREAMS_TITLE_PAIRS: Array<[string, string]> = [
  // Emotions & Mind
  ["Woke up rested", "Проснулся(ась) отдохнувшим"],
  ["Anxious today?", "Тревожно сегодня?"],
  ["Felt happy today", "Чувствовал(а) себя счастливым(ой)"],
  ["Brain fog", "Туман в голове"],
  ["Creative moment", "Творческий момент"],
  ["Cried today", "Сегодня плакал(а)"],
  ["Felt gratitude", "Чувствовал(а) благодарность"],
  ["Anxious for no reason", "Тревога без причины"],
  ["Felt inspired", "Чувствовал(а) вдохновение"],
  ["Wanted to have a child", "Хотел(а) завести ребёнка"],
  ["Felt emotionally empty", "Эмоциональная пустота"],
  ["Wanted to be alone", "Хотел(а) побыть один"],
  ["Laughed out loud", "Смеялся(ась) в голос"],
  // Body & Sensations
  ["Headache today", "Сегодня голова болела"],
  ["Felt energized", "Чувствовал(а) энергию"],
  ["Stomach bothered me", "Беспокоил живот"],
  ["Body felt good", "Тело ощущалось хорошо"],
  ["Physical pain", "Физическая боль"],
  ["Painful cramps", "Болезненные спазмы"],
  ["Stumbled or tripped", "Спотыкался(ась) или падал(а)"],
  ["Felt dizzy", "Кружилась голова"],
  ["Back hurt", "Болела спина"],
  ["Tired after eating", "Уставал(а) после еды"],
  // Connections & Love
  ["Felt loved", "Чувствовал(а) себя любимым"],
  ["Reached out to someone", "Связался(ась) с кем-то"],
  ["Argued with partner", "Ссорился(ась) с партнёром"],
  ["Felt lonely", "Чувствовал(а) одиночество"],
  ["Quality time", "Качественное время"],
  ["Got an affectionate gesture", "Получил(а) жест внимания"],
  ["Anyone hug me", "Меня кто-то обнял"],
  ["Called a friend", "Звонил(а) другу"],
  ["Friend called me first", "Друг позвонил первым"],
  ["Felt close to partner", "Чувствовал(а) близость с партнёром"],
  ["Someone made me smile", "Кто-то заставил улыбнуться"],
  ["Spent time with family", "Провёл(а) время с семьёй"],
  // Voice & Behavior
  ["Spoke my truth", "Говорил(а) свою правду"],
  ["Interrupted others", "Перебивал(а) других"],
  ["Apologized today", "Извинялся(ась) сегодня"],
  ["Raised my voice", "Повышал(а) голос"],
  ["Said no", "Сказал(а) нет"],
  ["Swore today", "Ругался(ась) матом"],
  ["Complimented someone", "Сделал(а) комплимент"],
  ["Said sorry first", "Извинился(ась) первым"],
  ["Stayed calm instead of reacting", "Оставался(ась) спокойным вместо реакции"],
  ["Said no without guilt", "Сказал(а) нет без вины"],
  // Health & Routine
  ["Slept well", "Хорошо выспался(ась)"],
  ["Drank enough water", "Пил(а) достаточно воды"],
  ["High caffeine day", "День с большим кофеином"],
  ["Ate mindfully", "Ел(а) осознанно"],
  ["Medication helped", "Лекарство помогло"],
  ["Felt side effects", "Чувствовал(а) побочные эффекты"],
  ["Took pills on time", "Принимал(а) таблетки вовремя"],
  // Curious & Random
  ["Learned something new", "Узнал(а) что-то новое"],
  ["Random kindness", "Случайная доброта"],
  ["Noticed nature", "Замечал(а) природу"],
  ["Lucky moments", "Удачные моменты"],
  ["Changed my mind", "Поменял(а) мнение"],
  ["Had a weird dream", "Видел(а) странный сон"],
  ["Saw something beautiful", "Видел(а) что-то красивое"],
  ["Found or lost something", "Нашёл(а) или потерял(а) что-то"],
  ["Experienced déjà vu", "Ощутил(а) дежавю"],
  ["Heard a funny phrase", "Слышал(а) забавную фразу"],
  // Fun & Weird
  ["Laughed really hard", "Очень сильно смеялся(ась)"],
  ["Made someone laugh", "Рассмешил(а) кого-то"],
  ["Wore bright colors", "Носил(а) яркие цвета"],
  ["Sang out loud", "Пел(а) вслух"],
  ["Danced with no music", "Танцевал(а) без музыки"],
  ["Sang in the shower", "Пел(а) в душе"],
  ["Imagined myself as movie character", "Представлял(а) себя киногероем"],
  ["Made a meme about my day", "Сделал(а) мем про свой день"],
  ["Felt like starting new life", "Хотел(а) начать новую жизнь"],
  // Social & Digital
  ["Doomscrolling time", "Залипал(а) в ленте"],
  ["Posted something", "Что-то выложил(а)"],
  ["Phone-free hour", "Час без телефона"],
  ["Compared myself online", "Сравнивал(а) себя в сети"],
  ["Sent a voice note", "Отправил(а) голосовое"],
  ["Scrolled social media hour+", "Скроллил(а) соцсети больше часа"],
  ["Got a like that mattered", "Получил(а) важный лайк"],
  ["Commented on someone's post", "Оставил(а) комментарий"],
  ["Checked ex's profile", "Заходил(а) в профиль бывшего/бывшей"],
];

const LEGACY_LIFESTREAMS_QUESTION_PAIRS: Array<[string, string]> = [
  // Emotions & Mind
  ["Did you wake up feeling rested?", "Ты проснулся(ась) сегодня отдохнувшим?"],
  ["Did anxiety show up today?", "Приходила ли сегодня тревога?"],
  ["Did you feel happy today?", "Чувствовал(а) ли ты себя сегодня счастливым(ой)?"],
  ["Did you feel noticeable brain fog today?", "Чувствовал(а) ли ты сегодня заметный туман в голове?"],
  ["Did you feel a creative spark today?", "Ощущал(а) ли ты сегодня творческую искру?"],
  ["Did I cry today?", "Я сегодня плакал(а)?"],
  ["Did I feel gratitude for something today?", "Я чувствовал(а) за что-то благодарность сегодня?"],
  ["Did I feel anxious for no reason?", "Я чувствовал(а) тревогу без причины?"],
  ["Did I feel inspired today?", "Я чувствовал(а) сегодня вдохновение?"],
  ["Did I want to have a child today?", "Я хотел(а) сегодня завести ребёнка?"],
  ["Did I feel emotionally empty?", "Я чувствовал(а) эмоциональную пустоту?"],
  ["Did I strongly want to be left alone today?", "Мне сегодня сильно хотелось, чтобы меня оставили в покое?"],
  ["Did I laugh out loud?", "Я сегодня громко смеялся(ась)?"],
  // Body & Sensations
  ["Did you have a headache today?", "У тебя сегодня болела голова?"],
  ["Did you feel energized today?", "Ты чувствовал(а) сегодня прилив энергии?"],
  ["Did your stomach bother you today?", "Тебя сегодня беспокоил живот?"],
  ["Did your body feel comfortable and good today?", "Тело ощущалось сегодня комфортно и хорошо?"],
  ["Did you feel significant physical pain today?", "Ты чувствовал(а) сегодня заметную физическую боль?"],
  ["Did I have painful cramps today?", "У меня сегодня были болезненные спазмы?"],
  ["Did I stumble or trip?", "Я сегодня спотыкался(ась) или чуть не упал(а)?"],
  ["Did I feel dizzy?", "У меня сегодня кружилась голова?"],
  ["Did my back hurt?", "У меня сегодня болела спина?"],
  ["Did I feel tired after eating?", "Я чувствовал(а) усталость после еды?"],
  // Connections
  ["Did you feel loved today?", "Ты чувствовал(а) себя сегодня любимым?"],
  ["Did you reach out to a friend or loved one?", "Ты написал(а) или позвонил(а) другу либо близкому?"],
  ["Did you argue with your partner today?", "Ты сегодня ссорился(ась) с партнёром?"],
  ["Did you feel lonely today?", "Ты чувствовал(а) сегодня одиночество?"],
  ["Did you spend real quality time with someone you care about?", "Ты провёл(а) настоящее качественное время с близким человеком?"],
  ["Did my partner do something affectionate for me today (gift, note, hug, kind word)?", "Партнёр сделал сегодня для меня что-то приятное (подарок, записка, объятие, доброе слово)?"],
  ["Did anyone hug me today?", "Меня сегодня кто-нибудь обнял?"],
  ["Did I call a friend today?", "Я сегодня звонил(а) другу?"],
  ["Did a friend call me first?", "Мне сегодня первым позвонил друг?"],
  ["Did I feel close to my partner?", "Я чувствовал(а) сегодня близость с партнёром?"],
  ["Did anyone make me smile unexpectedly?", "Кто-то неожиданно заставил меня сегодня улыбнуться?"],
  ["Did I spend time with family?", "Я провёл(а) сегодня время с семьёй?"],
  // Voice
  ["Did you say what you really meant today?", "Ты сегодня сказал(а) то, что на самом деле думал(а)?"],
  ["Did you interrupt someone while they were talking?", "Ты сегодня перебивал(а) кого-то во время разговора?"],
  ["Did I apologize for something today?", "Я сегодня за что-то извинялся(ась)?"],
  ["Did you raise your voice or yell today?", "Ты сегодня повышал(а) голос или кричал(а)?"],
  ["Did you say 'no' to something you didn't want to do?", "Ты сегодня сказал(а) «нет» тому, чего не хотел(а) делать?"],
  ["Did I swear today?", "Я сегодня ругался(ась) матом?"],
  ["Did I compliment someone?", "Я сегодня сделал(а) кому-то комплимент?"],
  ["Did I say 'sorry' first?", "Я сегодня извинился(ась) первым?"],
  ["Did I manage to stay calm instead of reacting?", "Мне удалось остаться спокойным, а не реагировать?"],
  ["Did I say 'no' without guilt?", "Я сказал(а) «нет» без чувства вины?"],
  // Health
  ["Did you sleep well last night?", "Ты хорошо спал(а) этой ночью?"],
  ["Did you intentionally move your body today (walk, stretch, dance)?", "Ты сегодня намеренно двигался(ась) (ходил(а), тянулся(ась), танцевал(а))?"],
  ["Did you drink enough water today?", "Ты сегодня пил(а) достаточно воды?"],
  ["Did you have more than 2 caffeinated drinks today?", "У тебя сегодня было больше 2 напитков с кофеином?"],
  ["Did you eat at least one meal without screens or rushing?", "Ты ел(а) хотя бы один раз без экранов и без спешки?"],
  ["Did my medication help today?", "Моё лекарство сегодня помогло?"],
  ["Did I feel side effects?", "Я чувствовал(а) побочные эффекты?"],
  ["Did I take my pills on time?", "Я принял(а) сегодня таблетки вовремя?"],
  // Curious
  ["Did you learn something new today?", "Ты сегодня узнал(а) что-то новое?"],
  ["Did you do something kind for a stranger?", "Ты сделал(а) сегодня что-то доброе для незнакомца?"],
  ["Did you notice something beautiful in nature today?", "Ты заметил(а) сегодня что-то красивое в природе?"],
  ["Did something lucky or coincidental happen?", "Случилось ли что-то удачное или совпадение?"],
  ["Did you change your mind about something today?", "Ты сегодня поменял(а) о чём-то своё мнение?"],
  ["Did I have a weird dream?", "Мне снился странный сон?"],
  ["Did I see something beautiful on the street?", "Я видел(а) сегодня что-то красивое на улице?"],
  ["Did I find or lose something small?", "Я сегодня что-то маленькое нашёл(а) или потерял(а)?"],
  ["Did I experience déjà vu?", "Я сегодня ощутил(а) дежавю?"],
  ["Did I hear a funny phrase today?", "Я слышал(а) сегодня забавную фразу?"],
  // Fun
  ["Did you laugh so hard you cried or snorted?", "Ты сегодня смеялся(ась) так, что плакал(а) или фыркал(а)?"],
  ["Did you make someone laugh today?", "Ты сегодня кого-нибудь рассмешил(а)?"],
  ["Did you wear bright or fun colors today?", "Ты надел(а) сегодня что-то яркое или весёлое по цвету?"],
  ["Did you sing out loud today (even badly)?", "Ты сегодня пел(а) вслух (пусть даже плохо)?"],
  ["Did I dance with no music?", "Я сегодня танцевал(а) без музыки?"],
  ["Did I sing in the shower?", "Я сегодня пел(а) в душе?"],
  ["Did I imagine myself as a movie character?", "Я представлял(а) себя сегодня героем фильма?"],
  ["Did I make a meme about my day?", "Я сделал(а) сегодня мем про свой день?"],
  ["Did I feel like starting a new life somewhere?", "Я хотел(а) сегодня начать новую жизнь где-то ещё?"],
  // Social
  ["Did you spend time doomscrolling or stuck in feeds?", "Ты сегодня залипал(а) в ленте или бесконечно скроллил(а)?"],
  ["Did you post anything on social media?", "Ты сегодня что-то выкладывал(а) в соцсетях?"],
  ["Did you have at least one hour without your phone?", "У тебя был сегодня хотя бы один час без телефона?"],
  ["Did I compare myself to someone online?", "Я сегодня сравнивал(а) себя с кем-то из соцсетей?"],
  ["Did I send a voice message instead of typing?", "Ты сегодня отправил(а) голосовое вместо того, чтобы напечатать?"],
  ["Did I scroll social media for more than an hour?", "Я сегодня скроллил(а) соцсети дольше часа?"],
  ["Did I get a like that mattered to me?", "Мне сегодня пришёл лайк, который был для меня важен?"],
  ["Did I comment on someone's post?", "Я сегодня оставил(а) комментарий под чужим постом?"],
  ["Did I check my ex's profile or stories?", "Я сегодня заглядывал(а) в профиль или сторис бывшего/бывшей?"],
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
  // DEFAULT_STARTERS pairs — universal-5 fallback set used when the
  // interview gives no signal. Without these here, switching language
  // leaves the starter trackers in their stored language ("Close ones"
  // staying in EN view when stored from RU, etc.).
  ["Close ones", "Близкие"],
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
  // DEFAULT_STARTERS questions — exact strings from the universal-5
  // fallback set (en.ts/ru.ts → onboarding.defaultStarters.*). Pair
  // them so the starter questions translate when language switches.
  ["Did I sleep more than 7 hours?", "Спал ли я больше 7 часов?"],
  ["Did I move my body today?", "Двигал ли я тело сегодня?"],
  ["Did I talk to someone close today?", "Поговорил ли я сегодня с кем-то близким?"],
  ["Did I do something just for fun today?", "Сделал ли я сегодня что-то для удовольствия?"],
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

  // Legacy LIFE_STREAMS pairs (templates removed in 1.6 repositioning).
  // User trackers stored from those templates would otherwise lose
  // translation when switching language — these pairs preserve it.
  LEGACY_LIFESTREAMS_TITLE_PAIRS.forEach(([en, ru]) => addPair(titles, en, ru));
  LEGACY_LIFESTREAMS_QUESTION_PAIRS.forEach(([en, ru]) => addPair(questions, en, ru));

  // Onboarding starters
  ONBOARDING_STARTER_TITLE_PAIRS.forEach(([en, ru]) => addPair(titles, en, ru));
  ONBOARDING_STARTER_QUESTION_PAIRS.forEach(([en, ru]) => addPair(questions, en, ru));

  // Group titles and descriptions — legacy hardcoded pairs (kept for any
  // user data that still references old TEMPLATE_GROUPS group titles)…
  LEGACY_GROUP_TITLE_PAIRS.forEach(([en, ru]) => addPair(groupTitles, en, ru));
  LEGACY_GROUP_DESC_PAIRS.forEach(([en, ru]) => addPair(groupDescriptions, en, ru));

  // …plus the live LIFE_STREAMS' title/titleRu and description pairs so
  // the AddTrackerModal cluster headers ("Партнёр и близкие" etc.)
  // show the active language without needing to be manually mirrored.
  LIFE_STREAMS.forEach((stream) => {
    addPair(groupTitles, stream.title, stream.titleRu);
    addPair(groupDescriptions, stream.description, stream.descriptionRu);
  });

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

/**
 * Resolve the localized question text for a tracker.
 *
 * Two strategies, tried in order:
 *
 *   1. Direct EN↔RU lookup in the questions map (existing behaviour).
 *      Works when the stored question matches a known canonical pair.
 *
 *   2. Title-based fallback (1.7.3+).  If the direct lookup did not
 *      change the string AND a `titleHint` is provided, we resolve
 *      the title to a template id via matchTemplateIdByTitle, find
 *      that template in LIFE_STREAMS, and return its canonical
 *      question text in the active language.
 *
 *      This catches the case where the user's stored question text
 *      was created by a legacy onboarding version, a dev-data path,
 *      or a manual edit — strings the static map doesn't know about
 *      — but the title is still recognizable (e.g. "Headache" →
 *      template id "headache" → canonical "Did you have a headache
 *      today?" in EN or "Болела ли сегодня голова?" in RU).
 *
 *      Without this fallback, a tracker with English title and a
 *      Russian-typo question would render its Russian text verbatim
 *      in the English UI — the bug the user reported on 2026-05-12.
 *
 * titleHint is optional so existing call sites compile unchanged.
 * Call sites that have the tracker object available should pass
 * tracker.title to get the smarter behaviour.
 */
export const localizeTrackerQuestion = (q: string, titleHint?: string): string => {
  const direct = lookup(getMap().questions, q);
  if (direct !== q || !titleHint) return direct;

  const tplId = matchTemplateIdByTitle(titleHint);
  if (!tplId) return direct;

  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      if (tpl.id !== tplId) continue;
      const lang = getLanguage();
      const canonical = lang === "ru" ? tpl.questionTextRu : tpl.questionText;
      if (!canonical) return direct;
      return lang === "ru" ? polishRu(canonical, getPol()) : canonical;
    }
  }
  return direct;
};

export const localizeTrackerAdvice = (a: string): string =>
  lookup(getMap().advices, a);

// Used by storage migration to decide if a stored tracker came from
// the library (title is in the current map → safe to refresh advice
// from the canonical template) vs is a custom user-typed tracker
// (title not in map → leave everything alone).
export const isKnownLibraryTitle = (title: string): boolean => {
  if (!title) return false;
  const m = getMap().titles;
  return m.enToRu.has(title) || m.ruToEn.has(title);
};

// Whether an advice string is recognised by the current localization
// map. If FALSE, the user's stored advice is from a previous library
// version (or fully custom) — migration should consider replacing it.
export const isKnownAdvice = (advice: string): boolean => {
  if (!advice) return true; // empty advice → nothing to migrate
  const m = getMap().advices;
  return m.enToRu.has(advice) || m.ruToEn.has(advice);
};

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

// Best-guess mapping from the legacy `category` to a cluster id, used
// for trackers stored before the cluster field existed (1.6 and
// earlier). Many-to-one collisions resolved to the most universal
// case (Connections → "partner", not "parenting").
const CATEGORY_TO_CLUSTER: Record<string, string> = {
  Connections: "partner",
  Health: "health",
  Body: "health",
  Emotions: "state",
  Fun: "state",
  Voice: "big-decisions",
  Social: "external-events",
  Curious: "habits",
};

// Display-time helper: returns the localized Theme name for a tracker.
// Used by Signals + anywhere else we'd otherwise show the legacy
// `category` (which leaks raw English keys like "Voice" into Russian
// UI). Falls back to the localized category if the cluster can't be
// resolved, so untouched legacy data still renders something useful.
export const localizeTrackerTheme = (tracker: {
  cluster?: string;
  category: string;
}): string => {
  const clusterId = tracker.cluster ?? CATEGORY_TO_CLUSTER[tracker.category];
  if (clusterId) {
    const stream = LIFE_STREAMS.find((s) => s.id === clusterId);
    if (stream) {
      // Pick the active-language title directly from LIFE_STREAMS — no
      // need to round-trip through groupTitles lookup since the source
      // already has both forms.
      return getLanguage() === "ru" ? stream.titleRu : stream.title;
    }
  }
  // Last-resort fallback: localized category key.
  return localizeGroupTitle(tracker.category);
};

export const localizeTracker = <T extends { title: string; questionText?: string }>(tracker: T): T => {
  // Both directions handled inside localizeTrackerTitle/Question — they
  // pick the right lookup based on getLanguage(). No early-return needed.
  return {
    ...tracker,
    title: localizeTrackerTitle(tracker.title),
    ...(tracker.questionText ? { questionText: localizeTrackerQuestion(tracker.questionText, tracker.title) } : {}),
  };
};
