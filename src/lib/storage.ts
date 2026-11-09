import { Tracker, TrackerEntry } from "@/types/tracker";
import { safeParse } from "@/lib/safeParse";
import { checkThresholdAlerts } from "@/lib/notifications";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import {
  isKnownLibraryTitle,
  isKnownAdvice,
} from "@/lib/trackerLocalize";

const TRACKERS_KEY = "memap_trackers";
const ENTRIES_KEY = "memap_entries";

// Advice-only migration. When we update advice copy in a release
// (e.g. shortened from "Write down what usually triggers fights —
// the pattern says more than any single argument" to "Write down
// what usually triggers fights"), existing user trackers carry the
// OLD copy in stored data. The localization map only holds CURRENT
// pairs, so the old EN string falls through untranslated → user
// sees raw English in their advice card.
//
// Strategy (very conservative — never overwrite user-edited text):
//   1. Tracker title MUST be a known library title (in the current
//      map either as EN or RU). Custom trackers don't match → skip.
//   2. Stored advice MUST be UNKNOWN to the current map (i.e. not
//      a current canonical EN/RU advice string for any template).
//      That signals "this is legacy text from a previous version".
//   3. Find the template id via title match, look up its current
//      advice, set it on the tracker (in the user's likely
//      language — Cyrillic heuristic).
//
// Title and questionText are NOT migrated even if they look stale,
// because:
//   - They're typically what the user RECOGNISES the tracker as
//   - The localization map already covers many legacy title/question
//     forms (LEGACY_LIFESTREAMS_*_PAIRS), so they translate fine
//   - Risk of overwriting a user-edited title is too high
//
// Idempotent: second run sees the freshly-set advice already in the
// current map → isKnownAdvice returns true → no-op.
/** Library advice that was retired (Nov 7 2026: no tests, drugs or therapies by name). Only these
 *  are refreshed to the current text; a plan she wrote herself is never touched. */
const RETIRED_ADVICE = new Set<string>([
    // "Got recognition" counts days without praise (Nov 9 2026)
    "Save what was said — for days I doubt myself",
    "Сохранить что сказали — для дней когда сомневаюсь в себе",
    // said plainly (Nov 8 2026)
    "Name how those words landed — be specific with my partner",
    "Назвать конкретно какие слова ранили — поделиться с партнёром",
    "Log time of day and what was happening just before",
    "Записывать время и что происходило перед этим",
    // weekly goals said plainly (Nov 8 2026)
    "Book 3 workout slots in calendar this week",
    "Внести 3 тренировки в календарь на эту неделю",
    "Put 2 strength sessions in the calendar this week",
    "Внести в календарь 2 силовые тренировки на эту неделю",
    "Plan two nature walks this week",
    "Запланировать на неделе две прогулки на природе",
    "Book a neurologist with my data",
    "Записаться к неврологу с данными",
    "See an osteopath or physiotherapist with my data",
    "Записаться к остеопату или физиотерапевту с данными",
    "Get bloodwork — iron, ferritin, B12, thyroid",
    "Сдать кровь — железо, ферритин, B12, щитовидка",
    "Get hormone bloodwork — testosterone, cortisol",
    "Сдать кровь на гормоны — тестостерон, кортизол",
    "Book an eye doctor and check screen time",
    "Записаться к окулисту и проверить экранное время",
    "Ask a neurologist about migraine prevention",
    "Спросить невролога про профилактику мигрени",
    "Book a physiotherapist with my data",
    "Записаться к физиотерапевту с данными",
    "Book a therapist who treats panic with CBT",
    "Записаться к психотерапевту, который лечит панику методом КПТ",
    "Ask a doctor about CBT for insomnia",
    "Спросить врача про КПТ бессонницы",
    "Ask a doctor to check for sleep apnoea",
    "Попросить врача проверить на апноэ сна",
    "Eat 2 kiwis a day for 4 weeks",
    "4 недели съедать по 2 киви в день",
    "Take psyllium every day for 4 weeks, with water",
    "4 недели каждый день принимать псиллиум, запивая водой",
    "Ask a doctor or dietitian about a low-FODMAP trial",
    "Спросить врача или диетолога про пробную диету low-FODMAP",
    "Do pelvic floor squeezes 3 times a day for 3 months",
    "3 месяца делать упражнения для тазового дна 3 раза в день",
    "Ask a GP to check heavy periods and iron",
    "Попросить врача проверить обильные месячные и уровень железа",
    "Ask a doctor about HRT or CBT for hot flushes",
    "Спросить врача про ЗГТ или КПТ от приливов",
    "Use one acne treatment for 12 weeks before judging it",
    "12 недель пользоваться одним средством от прыщей и только потом оценивать",
    "Ask a dentist about a night guard",
    "Спросить стоматолога про ночную капу",
    "Ask a pharmacist or doctor about a urine infection",
    "Спросить фармацевта или врача, нет ли цистита",
    "Try bladder training for 6 weeks",
    "6 недель тренировать мочевой пузырь",
    "Put on a strong antiperspirant at bedtime for 2 weeks",
    "Две недели наносить сильный антиперспирант на ночь",
    "Ask a doctor about tinnitus support and CBT",
    "Спросить врача про помощь при шуме в ушах и КПТ",
    // content review (Nov 9 2026): plans said plainly, in "you" and whole words; general advice only
    // (no named tests); once vs every day; the vet or a doctor today where waiting is unsafe
    "Write down what usually triggers fights", "Записать что чаще всего вызывает ссоры",
    "Plan one shared moment this week without phones", "Запланировать один совместный момент на эту неделю без телефонов",
    "Tell them how I'm feeling, calmly", "Поговорить о том что я чувствую, спокойно",
    "Find what's under the irritation", "Найти что стоит за раздражением",
    "Tell my partner what kind of words mean most to me", "Сказать партнёру какие слова мне важнее всего",
    "Have a calm conversation about how this lands on me", "Спокойно поговорить о том как это на меня влияет",
    "Talk to your partner and say which words hurt you", "Поговорить с партнёром и сказать, какие именно слова тебя ранят",
    "Talk to my partner about what gets in the way", "Поговорить с партнёром о том что мешает",
    "Notice if I apologize for things that aren't my fault", "Заметить когда извиняюсь не за свою вину",
    "Notice what's underneath: envy, distance, fatigue", "Заметить что под этим: зависть, дистанция, усталость",
    "Notice what I feel after — about myself, not about them", "Заметить что я чувствую после — про себя, не про них",
    "Reflect on what's missing in the current relationship", "Подумать что может быть не так в текущих отношениях",
    "Ask myself if I miss them or that period of my life", "Спросить себя: скучаю по нему/ней или по тому периоду жизни",
    "Find 30 minutes for myself daily, no kid no tasks no phone", "Найти 30 минут в день только себе, без ребёнка, задач и телефона",
    "Write down 3 moments I was a good parent this week", "Записать 3 момента когда я была хорошим родителем на этой неделе",
    "Audit my routine — sleep, food, help", "Пересмотреть свой режим — сон, еда, помощь",
    "Ask for specific concrete help", "Попросить конкретную помощь — у партнёра, семьи, бэбиситтера",
    "Book a doctor visit with my month's data", "Записаться к терапевту — взять с собой данные за месяц",
    "Log what I ate the day before to find the food trigger", "Записывать что ела за сутки до — искать еду-триггер",
    "Let's track what comes before the nausea", "Давай попробуем отследить, что бывает перед тошнотой",
    "See a rheumatologist", "Записаться к ревматологу",
    "One week: no screens before bed, no coffee after 2pm", "Неделю без экранов перед сном и без кофе после 14:00",
    "Записаться к гинекологу про симптомы цикла",
    "Track progress in numbers — weight, reps, distance", "Записать прогресс цифрами — вес, повторы, дистанция",
    "Add 10 minutes after the shower as a habit", "Добавить 10 минут после душа как привычку",
    "Check dinner, late screens, bedroom temperature", "Проверить ужин, поздний экран, температуру в спальне",
    "Keep a 0.7L bottle on the desk, fill twice a day", "Держать бутылку 0.7л на столе, наполнять дважды в день",
    "Set a 'start winding down' alarm 30 min before bed", "Поставить будильник «начни укладываться» за 30 минут до отбоя",
    "Log foods and skincare to find the trigger", "Записывать еду и косметику чтобы найти триггер",
    "Book a cardiologist for a Holter monitor", "Записаться к кардиологу на суточный мониторинг (Холтер)",
    "Look at the nights before the naps — are they short?", "Посмотреть на ночи перед дневным сном — они короткие?",
    "Notice what I'm chasing — stress, boredom, loneliness", "Заметить что я ловлю — стресс, скуку, одиночество",
    "Log the situations where I crave it", "Записать в каких ситуациях тянет",
    "Notice if hookah is a ritual or solo escape", "Заметить — кальян как ритуал с друзьями или сбегание в одиночку",
    "Move last coffee to noon for one week", "Перенести последний кофе на 12:00 на неделю",
    "One week: finish dinner 3 hours before bed", "Неделю заканчивать ужин за 3 часа до сна",
    "Swap dessert for fruit twice a week", "Заменить десерт на фрукт два раза в неделю",
    "Set an app time limit on the worst offender", "Поставить лимит на самое затягивающее приложение",
    "Prep two days of meals on Sunday", "Приготовить еду на 2 дня в воскресенье",
    "Set 30 min/day limit on news apps", "Поставить лимит 30 минут в день на новостные приложения",
    "Set a 1-hour timer before starting", "Ставить таймер на 1 час перед стартом",
    "Use a 24-hour cart wait before buying",
    "Reward myself with something non-material after a streak", "Награждать себя приятным НЕ-материальным после серии",
    "Block or mute for 2 weeks and watch how the day changes", "Заблокировать или муть на 2 недели и посмотреть как изменится день",
    "Notice who I wanted to message and what stopped me", "Заметить кому хотел(а) написать и что остановило",
    "Unfollow or mute people who trigger this", "Анфоллоу или mute людей которые регулярно так влияют",
    "Ask who I'm afraid of and what they'd actually say", "Спросить — кого я боюсь и что они на самом деле сказали бы",
    "Notice what's unprocessed about this person", "Заметить что в этом человеке непрожитое",
    "Ask who I plan to show this to and why", "Спросить кому я планирую показать и зачем",
    "Prep simple stack-meals (rice + veg + protein) for the week", "Готовить простые комбо (рис + овощи + белок) на неделю",
    "Notice if it's tiredness, depression, or just unimportant", "Заметить — это усталость, депрессия, или просто не критично",
    "Write down what the song speaks for me", "Записать что эта песня говорит за меня",
    "Set a 10-minute timer — cleaning is shorter than it feels", "Поставить таймер на 10 минут — уборка короче чем кажется",
    "Notice where I was — apps catch us when we're tired", "Заметить где я была — магазины ловят нас в усталости",
    "Calculate the monthly total — usually shocks", "Посчитать сумму за месяц — обычно шок",
    "A week with the phone away an hour before bed", "Неделю убирать телефон за час до сна",
    "A 20-minute walk after lunch for a week", "Неделю гулять 20 минут после обеда",
    "Write 3 things draining the joy and reduce one", "Записать 3 вещи что забирают радость и уменьшить одну",
    "Schedule a therapy session with my data", "Записаться к психотерапевту с данными",
    "Talk to a doctor — please", "Поговорить с врачом — пожалуйста",
    "Find what need isn't being met under the anger", "Найти какая моя потребность не услышана под злостью",
    "Text one person today, no special reason", "Написать одному человеку сегодня без повода",
    "Поговорить с подругой или психологом о том что копится",
    "Write 3 things at work that drain me and remove one", "Записать 3 вещи на работе что забирают энергию и одну убрать",
    "Give myself 2 weeks before deciding, log what bothers me daily", "Дать себе 2 недели перед решением, каждый день записывать что мешает",
    "Have an honest talk with myself about whether it's the job or this season of life", "Поговорить с собой честно: дело в работе или в моменте жизни",
    "Pick tomorrow's one main thing tonight", "Вечером выбрать одно главное дело на завтра",
    "Put the phone in another room for the first work hour", "Убрать телефон в другую комнату на первый рабочий час",
    "Write down ALL I did today, even small things", "Записать ВСЁ что сделал(а) за день, даже мелкое",
    "Find what was BEFORE the snap — sleep, food, conversation", "Найти что было ПЕРЕД срывом — сон, голод, разговор",
    "Note what's special about these days — sleep, food, support", "Записать что в эти дни особенное — сон, еда, поддержка",
    "Book an hour for myself in the calendar this week",
    "Log the trigger — who and what context", "Записать триггер — кто это был и какой контекст",
    "Write what specifically hooked me — something unprocessed is leaking", "Записать что именно зацепило — что-то непрожитое выходит",
    "Remember the source — these are 'power spots', repeat them", "Запомнить источник — это «места силы», возвращаться к ним",
    "Unfollow — envy rarely turns into motivation", "Анфоллоу — зависть редко превращается в мотивацию",
    "Write what I DON'T see about these 'everyone' — only highlights", "Записать что я НЕ вижу про этих «всех» — все показывают highlights",
    "Repeat — this is a free dopamine dose", "Повторять — это бесплатная доза дофамина",
    "Free oxytocin — make it a daily habit", "Бесплатный окситоцин — сделать ежедневной привычкой",
    "Save these to a 'when I like myself' album", "Сохранять в альбом «когда я нравлюсь себе»",
    "Normal way to voice thoughts — keep going", "Нормальный способ озвучить мысли — продолжать",
    "Note what triggered it — this is my natural flow channel", "Запомнить что именно делал(а) — это твой природный поток-канал",
    "Log specifics — this is data for a future conversation", "Записать конкретно что — фактура для разговора потом",
    "Ask if this is about work or about my personal patterns", "Спросить себя — это про работу или про мои личные паттерны",
    "Limit contact with this person", "Ограничить контакт с этим человеком",
    "Write down 3 things you did today, even small ones", "Записывать 3 дела за день, даже мелкие",
    "Give myself an hour to process before reacting with decisions", "Дать себе час «переварить» — не реагировать сразу решениями",
    "Hire a cleaner once every two weeks", "Нанять помощницу раз в две недели",
    "Talk specifics with my partner — money, home, emotional readiness", "Поговорить с партнёром предметно — финансово, бытово, эмоционально",
    "Write what specifically wears me down — then I'll know if it's leaving or fixing", "Записать что именно тяготит — потом ясно, уходить или менять",
    "Записаться к семейному психологу одной или вдвоём",
    "Write what specifically I want to change, not 'everything'", "Записать что именно хочу изменить, не «всё»",
    "Сходить в приют — посмотреть, посидеть, увидеть реальность",
    "Найти один курс или книгу на эту неделю",
    "Pick ONE course and finish it — parallel courses kill completion", "Выбрать ОДИН курс и закрыть его — параллельные курсы убивают завершение",
    "Block 30 minutes weekly for a no-result creative window", "Выделить 30 минут в неделю на творчество без цели результата",
    "Set a minimum dose — 15 min/day, regularity beats duration", "Поставить минимальную дозу — 15 минут в день, регулярность важнее длительности",
    "Download in advance — commute / walk / cooking become growth windows", "Скачивать заранее — дорога, прогулка, готовка становятся окнами для роста",
    "Keep the book where I sit with my phone", "Положить книгу там где сижу с телефоном",
    "Log specific times — useful evidence if escalating to the building", "Записать конкретное время — пригодится если жаловаться в ТСЖ",
    "Check official quiet hours and document violations", "Проверить регламент шумных работ и фиксировать нарушения",
    "Try shifting departure 30 min earlier or asking for one remote day a week", "Сместить выезд на 30 минут раньше или попросить один remote-день в неделю",
    "Plan a backup route (different mode, taxi, mapped alternatives)", "Запланировать резервный маршрут — другой транспорт, такси, альтернативы",
    "Set up a backup hotspot or a second provider — outages are predictable risk", "Настроить резервную точку доступа или второго провайдера — отключения уже предсказуемый риск",
    "Write down what was said and what boundary I want to set", "Записать что было сказано и какую границу хочу поставить",
    "Notice the pattern — decide on contact limit or therapy support", "Заметить паттерн — решить про лимит общения или поддержку психолога",
    "If it's repeatedly the same person — distance gradually or cut contact", "Если это один и тот же человек — постепенно дистанцироваться или прекратить контакт",
    "Reach out to them first — don't wait for it to be their job", "Написать им первой — не ждать что инициатива всегда их",
    "Note the context and train listening on that exact scenario", "Записать контекст и тренировать слушание именно на нём",
    "Write the missing word/phrase and learn it today", "Записать слово / фразу которой не хватило и выучить сегодня",
    "Note the moment — proof the practice works", "Запомнить момент — доказательство что вложение работает",
    "Schedule a video call with someone who gets the context", "Запланировать видеозвонок с тем кто понимает контекст",
    "Set a regular 'date with home' once a week", "Поставить регулярную «дату с домом» — раз в неделю",
    "Listen to home-season sounds (snow, rain, sea) on YouTube", "Послушать звуки своего сезона (снег, дождь, море) на YouTube",
    "Write what specifically triggered it — look, conversation, situation", "Записать что именно вызвало — взгляд, диалог, ситуация",
    "Note these moments — they're integration markers", "Запоминать эти моменты — маркеры интеграции",
    "Remember this — it separates integration from isolation", "Запомнить этот момент — отличает интеграцию от изоляции",
    "Notice if it's support or echo chamber — both need balance", "Заметить — это поддержка или эхо-камера — нужен баланс",
    "Reward myself with coffee after — ritual of 'I handled it'", "Награждать себя кофе после — ритуал «я справился(ась)»",
    "Note what was hardest — language, protocol, attitude", "Записать что было сложно — язык, протокол, отношение",
    "Treat this as a real factor in the staying-or-leaving decision", "Рассматривать это как реальный фактор в решении остаться / уехать",
    "Add one new local dish to the rotation each month", "Добавлять одно новое местное блюдо в ротацию каждый месяц",
    "Write what triggered it — person, situation, longing", "Записать что вызвало — конкретный человек, ситуация, тоска",
    "Write reasons — running FROM something or going TO something", "Записать причины — бежать ОТ чего-то или идти К чему-то",
    "Save these days — facts for moments of doubt", "Сохранять эти дни — факты для моментов сомнений",
    "Schedule a vet visit — bring this log", "Записаться к ветеринару — взять с собой этот лог",
    "Talk to a vet — appetite changes can signal something", "Поговорить с ветеринаром — изменение аппетита может быть сигналом",
    "Look for patterns — does it match weather, food, walks?", "Поищи закономерности — связано с погодой, едой, прогулками?",
    "Note what changed — new food, environment, stress?", "Запиши что изменилось — новая еда, обстановка, стресс?",
    "Vet visit — bring this log and a food/treat list", "К ветеринару — взять этот лог и список еды/угощений",
    "Identify the trigger — noises, schedule, new people?", "Найди триггер — звуки, режим, новые люди?",
    "Notice what brings out their joy — more of that", "Замечай что приносит им радость — давай этого больше",
    "Bring this log to the next medical visit", "Принести этот лог на следующий визит к врачу",
    "Talk to their doctor — appetite change is significant", "Поговорить с врачом — изменение аппетита это важно",
    "Look at evening routine — meds, screens, what changed?", "Посмотри вечерний режим — лекарства, экраны, что изменилось?",
    "Even one fall matters — talk to the doctor about balance", "Даже одно падение важно — поговори с врачом про равновесие",
    "Set up a weekly pill organizer or a reminder system", "Поставить недельный органайзер таблеток или систему напоминаний",
    "Track where exactly — bring specifics to the doctor", "Отслеживай где именно — принеси конкретику врачу",
    "Notice what lifts their mood — visit, call, hobby?", "Замечай что поднимает им настроение — визит, звонок, хобби?",
    "Look at triggers — sleep, hunger, transitions, screens", "Посмотри триггеры — сон, голод, переходы между делами, экраны",
    "Track the day pattern — what's different before rough nights?", "Отследи паттерн дня — что отличается перед плохими ночами?",
    "Talk to the pediatrician if it's consistent for 2+ weeks", "К педиатру если повторяется 2+ недели подряд",
    "Aim for 30 min outdoor daily — even small moves count", "Стремись к 30 минутам на улице ежедневно — даже мелкие движения считаются",
    "Notice when these happen — what's the setup that makes them possible?", "Замечай когда они случаются — какая обстановка их делает возможными?",
    "Bring this log to the pediatrician — patterns matter", "Принеси этот лог педиатру — паттерны важны",
    "Show my painkiller days to a doctor",
    "Keep a snack with me",
    "Keep the wake-up time fixed and skip naps for a week", "Неделю вставать в одно время и не спать днём",
    "Plan one small thing that used to bring joy, every day", "Каждый день планировать одно маленькое дело, которое раньше радовало",
    "Договориться об одной еде в день без телефонов",
    "Show my dizzy days to a doctor",
    "Drink more water, eat fruit and veg; see a GP if it goes on", "Пить больше воды, есть фрукты и овощи; если не проходит — к терапевту"
  ]);

const migrateLegacyAdvice = async (): Promise<void> => {
  const trackers = await getTrackers();
  if (trackers.length === 0) return;
  let anyChanged = false;
  const next = trackers.map((tr) => {
    if (!tr.adviceAboveThreshold) return tr;
    if (!isKnownLibraryTitle(tr.title)) return tr;
    // her own plan stays: only retired library advice is refreshed (found Nov 7 2026). A retired plan
    // can share its words with a ready idea ("Write down 3 things you did today…"), so a known one is
    // refreshed too when it is retired (Nov 9 2026); one that is still its question's plan stays as is.
    const retired = RETIRED_ADVICE.has(tr.adviceAboveThreshold.trim());
    if (!retired && isKnownAdvice(tr.adviceAboveThreshold)) return tr;
    if (!retired) return tr;
    const tplId = matchTemplateIdByTitle(tr.title);
    if (!tplId) return tr;
    // Find canonical template
    let canonical: typeof LIFE_STREAMS[0]["templates"][0] | null = null;
    for (const stream of LIFE_STREAMS) {
      for (const tpl of stream.templates) {
        if (tpl.id === tplId) {
          canonical = tpl;
          break;
        }
      }
      if (canonical) break;
    }
    if (!canonical) return tr;
    // Pick localized form — Cyrillic heuristic on the OLD stored
    // advice means the user was on RU when the tracker was created.
    const looksRu = /[А-Яа-яЁё]/.test(tr.adviceAboveThreshold);
    const newAdvice = looksRu
      ? canonical.adviceAboveThresholdRu
      : canonical.adviceAboveThreshold;
    if (newAdvice === tr.adviceAboveThreshold) return tr;
    anyChanged = true;
    return { ...tr, adviceAboveThreshold: newAdvice };
  });
  if (anyChanged) {
    await saveTrackers(next);
  }
};

/** Library rules that changed ([days, out of days]). A question still on the OLD library rule moves to
 *  the new one, once per question; a rule she set herself is never touched, and neither is one she
 *  sets back to the old numbers later. Threshold 0 = no rule (no action point). */
const RULE_CHANGES: { id: string; was: [number, number]; now: [number, number] }[] = [
  // the weekly goals (Nov 8 2026): "12 days without a workout in 30" didn't match "3 workouts a week"
  { id: "exercised", was: [12, 30], now: [5, 7] },
  { id: "strength-training", was: [23, 30], now: [6, 7] },
  { id: "time-in-nature", was: [12, 14], now: [6, 7] },
  // content review (Nov 9 2026). Harm: a fall, missed medicines, a pet that stops eating or limps
  // can't wait for a month of answers
  { id: "parent-stumbled", was: [2, 30], now: [1, 30] },
  { id: "parent-took-meds", was: [22, 30], now: [3, 14] },
  { id: "pet-skipped-food", was: [5, 30], now: [2, 7] },
  { id: "pet-limped", was: [5, 30], now: [3, 14] },
  // when-to-act.md: the research rules (UK drink-free days; light; NHS "tired for a few weeks")
  { id: "drank-alcohol", was: [12, 30], now: [4, 7] },
  { id: "screens-before-bed", was: [15, 30], now: [4, 7] },
  { id: "outside-30min", was: [15, 30], now: [4, 7] },
  { id: "saw-daylight", was: [15, 30], now: [4, 7] },
  { id: "felt-fatigued", was: [12, 30], now: [14, 21] },
  // good things that are rare by nature lit up for nearly everyone in the first week or two
  { id: "partner-complimented-me", was: [8, 30], now: [24, 30] },
  { id: "called-parent", was: [10, 30], now: [25, 30] },
  { id: "saw-friends", was: [12, 30], now: [24, 30] },
  { id: "complimented-stranger", was: [5, 30], now: [27, 30] },
  { id: "trained-hard", was: [8, 30], now: [24, 30] },
  { id: "stretched", was: [10, 30], now: [20, 30] },
  { id: "laughed-uncontrollably", was: [5, 30], now: [25, 30] },
  { id: "danced-or-sang-alone", was: [8, 30], now: [25, 30] },
  { id: "petted-an-animal", was: [10, 30], now: [25, 30] },
  { id: "liked-my-selfie", was: [5, 30], now: [25, 30] },
  { id: "got-recognition", was: [5, 30], now: [25, 30] },
  { id: "in-flow", was: [10, 30], now: [25, 30] },
  { id: "language-progress", was: [8, 30], now: [20, 30] },
  { id: "felt-settled-in", was: [12, 30], now: [20, 30] },
  { id: "locals-were-warm", was: [8, 30], now: [20, 30] },
  { id: "happy-with-the-move", was: [8, 30], now: [15, 30] },
  // common things that lit up too soon
  { id: "child-meltdown", was: [5, 30], now: [12, 30] },
  { id: "looped-one-song", was: [8, 30], now: [12, 30] },
  { id: "social-media-hour", was: [15, 30], now: [20, 30] },
  // two months is too long to wait for "I want out" one day in three
  { id: "thought-about-leaving", was: [20, 60], now: [10, 30] },
  // no rule: a sensitive question that sent people to a GP for ordinary mornings; a pet or plant to talk to
  { id: "morning-libido", was: [12, 30], now: [0, 30] },
  { id: "talked-to-pet", was: [10, 30], now: [0, 30] },
];
/** "tracker id|template id|was>now" for every question a rule change has already looked at. */
const RULE_MOVES_KEY = "memap_rule_moves";
/** Removed from MeMap (her note, Nov 8 2026: "давай вообще уберём этот вопрос"): "Partner brought me
 *  flowers" goes to the archive once; the answers stay. */
const REMOVED_TITLES = ["partner brought me flowers", "партнёр подарил мне цветы"];
const archiveRemoved = async (): Promise<void> => {
  if (localStorage.getItem("memap_removed_flowers")) return;
  localStorage.setItem("memap_removed_flowers", "1");
  const trackers = await getTrackers();
  if (!trackers.some((t) => !t.archived && REMOVED_TITLES.includes(t.title.trim().toLowerCase()))) return;
  await saveTrackers(trackers.map((t) => (REMOVED_TITLES.includes(t.title.trim().toLowerCase()) ? { ...t, archived: true } : t)));
};
const migrateRules = async (): Promise<void> => {
  const trackers = await getTrackers();
  const seen = new Set(safeParse<string[]>(localStorage.getItem(RULE_MOVES_KEY), []));
  const before = seen.size;
  let changed = false;
  const next = trackers.map((tr) => {
    // her 2-week tests and the games have no library rule
    if (tr.id.endsWith("-test") || tr.source === "play") return tr;
    // a question she wrote herself only looks like a library one: its rule is hers
    if (!isKnownLibraryTitle(tr.title)) return tr;
    const id = matchTemplateIdByTitle(tr.title);
    if (!id) return tr;
    let out = tr;
    // in order, so a rule that changed twice moves along both steps
    for (const r of RULE_CHANGES) {
      if (r.id !== id) continue;
      const key = `${tr.id}|${r.id}|${r.was.join("/")}>${r.now.join("/")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (out.threshold !== r.was[0] || out.periodDays !== r.was[1]) continue;
      out = { ...out, threshold: r.now[0], periodDays: r.now[1] };
      changed = true;
    }
    return out;
  });
  if (changed) await saveTrackers(next);
  if (seen.size !== before) localStorage.setItem(RULE_MOVES_KEY, JSON.stringify([...seen]));
};

// Public — call once on app startup. Wraps in try/catch so a
// corrupted entry can't break the whole app boot.
export const runStartupMigrations = async (): Promise<void> => {
  try {
    await migrateLegacyAdvice();
    await migrateRules();
    await archiveRemoved();
    // a running old-style weekly-goal test moves onto her own question (Nov 8 2026)
    await (await import("@/lib/testWords")).migrateGoalTests();
  } catch (e) {
    console.error("startup migrations failed:", e);
  }
};

export const getTrackers = (): Promise<Tracker[]> => {
  return Promise.resolve().then(() => {
    const data = localStorage.getItem(TRACKERS_KEY);
    return safeParse<Tracker[]>(data, []);
  });
};

export const saveTrackers = (trackers: Tracker[]): Promise<void> => {
  return Promise.resolve().then(() => {
    localStorage.setItem(TRACKERS_KEY, JSON.stringify(trackers));
    try {
      window.dispatchEvent(new Event("memap-trackers-changed"));
    } catch {
      // Ignore — environment without window (SSR / tests)
    }
  });
};

export const getEntries = (): Promise<TrackerEntry[]> => {
  return Promise.resolve().then(() => {
    const data = localStorage.getItem(ENTRIES_KEY);
    return safeParse<TrackerEntry[]>(data, []);
  });
};

export const saveEntries = (entries: TrackerEntry[]): Promise<void> => {
  return Promise.resolve().then(async () => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
    // Broadcast so other mounted views (TodayTab, TrackerDetails, calendars)
    // refresh their local entry cache. Fire synchronously after the write —
    // anyone listening can re-read localStorage immediately.
    try {
      window.dispatchEvent(new Event("memap-entries-changed"));
    } catch {
      // environments without window (SSR) — no-op
    }
    try {
      const trackers = await getTrackers();
      await checkThresholdAlerts(trackers, entries);
    } catch {
      // threshold check is best-effort, never block saves
    }
  });
};
