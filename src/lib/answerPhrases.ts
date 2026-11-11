// What an answer means, in plain words (her note, Nov 6 2026: «В дни без «Спал(а) 7+
// часов» было «Приступ мигрени»» — "выглядит жутко… сделать базу ответов, а не давать
// эту дичь"). Every library question has a short phrase for its "yes" and its "no",
// in English and Russian, written to stand on its own in "A → B" and at the start of a
// sentence, with no case endings to agree. A question she wrote herself has no phrase:
// it is shown as it is, with its answer ("“Walked the dog”: no").
import type { TFunction } from "i18next";
import { getLanguage } from "@/lib/i18n";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import type { Tracker } from "@/types/tracker";
import { S } from "@/lib/answerSentences";

/** [EN yes, EN no, RU yes, RU no], lowercase (capitalised where a line starts). */
const P: Record<string, [string, string, string, string]> = {
  // partner & loved ones
  "argued-with-partner": ["argument with partner", "no argument with partner", "ссора с партнёром", "без ссоры с партнёром"],
  "felt-close-to-partner": ["closeness with partner", "no closeness with partner", "тёплый момент с партнёром", "без тёплого момента с партнёром"],
  "felt-lonely-with-partner": ["feeling alone next to partner", "not alone next to partner", "одиночество рядом с партнёром", "рядом с партнёром не одиноко"],
  "partner-irritated-me": ["irritation at partner", "no irritation at partner", "раздражение на партнёра", "без раздражения на партнёра"],
  "good-time-together": ["good time together", "no fun time together", "приятное время вдвоём", "без приятного времени вдвоём"],
  "partner-complimented-me": ["compliment from partner", "no compliment from partner", "доброе слово от партнёра", "без доброго слова от партнёра"],
  "partner-raised-voice": ["partner raised their voice", "no raised voice", "партнёр повысил голос", "без повышенного голоса"],
  "partner-said-hurtful": ["hurtful words from partner", "no hurtful words", "обидные слова партнёра", "без обидных слов"],
  "called-parent": ["call with mom or dad", "no call with parents", "звонок маме или папе", "без звонка родителям"],
  "thought-about-leaving": ["thought of leaving the relationship", "no thought of leaving the relationship", "мысль расстаться", "без мысли расстаться"],
  "had-sex": ["intimacy with partner", "no intimacy", "физическая близость", "без физической близости"],
  "saw-friends": ["friends in person", "no friends in person", "встреча с друзьями", "без встреч с друзьями"],
  "apologized-first": ["an apology when not at fault", "no apology when not at fault", "извинение не за свою вину", "без лишних извинений"],
  "didnt-like-friend-post": ["a like skipped on purpose", "likes as usual", "нарочно пропущенный лайк", "лайки как обычно"],
  "complimented-stranger": ["a kind deed", "no kind deed", "доброе дело", "без доброго дела"],
  "flirted": ["flirting", "no flirting", "флирт", "без флирта"],
  "thought-about-someone-else": ["warm thoughts of someone else", "no thoughts of someone else", "тёплые мысли о ком-то ещё", "без мыслей о другом человеке"],
  "missed-ex": ["missing an ex", "not missing an ex", "тоска по бывшему партнёру", "без тоски по бывшим"],
  // parenting
  "yelled-at-kid": ["yelling at the kid", "no yelling at the kid", "крик на ребёнка", "без крика на ребёнка"],
  "felt-bad-parent": ["feeling like a bad parent", "no “bad parent” feeling", "чувство «я плохой родитель»", "без чувства «я плохой родитель»"],
  "quality-time-kid": ["a real moment with the kid", "no real moment with the kid", "время с ребёнком по-настоящему", "без живого момента с ребёнком"],
  "ran-out-of-patience": ["out of patience", "patience held", "терпение кончилось", "терпения хватило"],
  "felt-overwhelmed-parenting": ["parenting felt too much", "parenting felt manageable", "с детьми слишком тяжело", "с детьми по силам"],
  // health
  "headache": ["headache", "no headache", "головная боль", "без головной боли"],
  "migraine": ["migraine", "no migraine", "мигрень", "без мигрени"],
  "back-or-neck-pain": ["back pain", "no back pain", "боль в спине", "без боли в спине"],
  "stomach-issues": ["stomach ache", "no stomach ache", "боль в животе", "без боли в животе"],
  "felt-nauseous": ["nausea", "no nausea", "тошнота", "без тошноты"],
  "joint-pain": ["joint pain", "no joint pain", "боль в суставах", "без боли в суставах"],
  "slept-enough": ["7+ hours of sleep", "short night", "7+ часов сна", "короткая ночь"],
  "woke-at-night": ["waking at night", "sleeping through", "ночные пробуждения", "сон без пробуждений"],
  "felt-fatigued": ["feeling drained", "not drained", "сильная усталость", "без сильной усталости"],
  "period-symptoms": ["strong period pain", "no strong period pain", "сильная боль при месячных", "без сильной боли при месячных"],
  "exercised": ["workout", "no workout", "тренировка", "без тренировки"],
  "trained-hard": ["hard training", "no hard training", "серьёзная тренировка", "без серьёзной тренировки"],
  "stretched": ["stretching", "no stretching", "растяжка", "без растяжки"],
  "morning-libido": ["morning libido", "no morning libido", "утреннее влечение", "без утреннего влечения"],
  "felt-recovered": ["rested morning", "wrecked morning", "бодрое утро", "разбитое утро"],
  "outside-30min": ["30 min outside", "under 30 min outside", "30 минут на улице", "меньше 30 минут на улице"],
  "saw-daylight": ["morning daylight", "no morning daylight", "дневной свет до полудня", "без дневного света до полудня"],
  "drank-water": ["enough water", "too little water", "достаточно воды", "мало воды"],
  "ate-by-2pm": ["a meal before 2 pm", "no meal before 2 pm", "еда до 14:00", "без еды до 14:00"],
  "bed-before-midnight": ["bed before midnight", "bed after midnight", "отбой до полуночи", "отбой после полуночи"],
  "skin-allergy": ["itch or rash", "no itch or rash", "зуд или сыпь", "без зуда и сыпи"],
  "heart-palpitations": ["heart racing", "calm heartbeat", "сердце колотится", "спокойное сердце"],
  "eye-strain": ["tired eyes", "rested eyes", "уставшие глаза", "без усталости глаз"],
  "took-meds": ["meds taken", "meds missed", "лекарства приняты", "лекарства пропущены"],
  "napped": ["daytime nap", "no nap", "дневной сон", "без дневного сна"],
  // body & habits
  "drank-alcohol": ["alcohol", "no alcohol", "алкоголь", "без алкоголя"],
  "smoked": ["smoking", "no smoking", "курение", "без курения"],
  "smoked-hookah": ["hookah", "no hookah", "кальян", "без кальяна"],
  "coffee-late": ["coffee after 2 pm", "no coffee after 2 pm", "кофе после 14:00", "без кофе после 14:00"],
  "ate-late": ["late dinner", "no late dinner", "поздний ужин", "без позднего ужина"],
  "ate-sweets": ["more sweets than you wanted", "sweets in check", "больше сладкого, чем хотелось", "сладкое в меру"],
  "screen-time-long": ["4+ hours on screens", "under 4 hours on screens", "4+ часа в экране", "меньше 4 часов в экране"],
  "ate-fast-food": ["fast food", "no fast food", "фастфуд", "без фастфуда"],
  "phone-free-morning": ["phone-free morning", "phone first thing", "утро без телефона", "телефон с утра"],
  "doomscrolled-news": ["too much news", "little news", "много времени в новостях", "новости в меру"],
  "gaming-streams-2h": ["2+ hours of games or streams", "under 2 hours of games or streams", "2+ часа игр или стримов", "меньше 2 часов игр и стримов"],
  "impulse-spending": ["an impulse buy", "no impulse buys", "спонтанная покупка", "без спонтанных покупок"],
  "stayed-on-budget": ["on budget", "overspending", "траты по плану", "траты сверх плана"],
  "stalked-ex": ["checking an ex's profile", "not checking an ex", "просмотр страницы бывшего партнёра", "без просмотра страницы бывших"],
  "deleted-message": ["a deleted message", "no deleted messages", "стёртое сообщение", "без стёртых сообщений"],
  "compared-on-social": ["comparing yourself online", "not comparing yourself online", "сравнение себя с другими", "без сравнения себя с другими"],
  "deleted-own-post": ["a deleted post", "no deleted posts", "удалённый пост", "без удалённых постов"],
  "rewatched-stories": ["rewatching someone's stories", "no rewatching", "пересмотр чужих сторис", "без пересмотра сторис"],
  "screenshotted-chat": ["a chat screenshot", "no screenshots", "скриншот переписки", "без скриншотов"],
  "ordered-delivery": ["delivery instead of cooking", "no delivery", "доставка вместо готовки", "без доставки"],
  "wore-same-shirt": ["same shirt again", "fresh clothes", "та же одежда второй день", "свежая одежда"],
  "looped-one-song": ["one song on repeat", "no song on repeat", "одна песня по кругу", "без песни по кругу"],
  "ate-by-fridge": ["eating by the fridge", "no eating by the fridge", "еда у холодильника", "без еды у холодильника"],
  "skipped-cleaning": ["cleaning put off", "cleaning done", "уборка отложена", "уборка сделана"],
  "bought-on-sale": ["an unneeded sale buy", "no sale buys", "ненужная покупка со скидкой", "без покупок на распродаже"],
  "paid-to-skip-effort": ["paying to skip a chore", "doing it yourself", "оплата вместо усилий", "всё своими силами"],
  "cooked-myself": ["home cooking", "no home cooking", "домашняя еда", "без домашней еды"],
  "screens-before-bed": ["screens before bed", "no screens before bed", "экран перед сном", "без экрана перед сном"],
  "walked-a-lot": ["7,000+ steps", "under 7,000 steps", "7000+ шагов", "меньше 7000 шагов"],
  "ate-vegetables": ["vegetables or fruit", "no vegetables or fruit", "овощи или фрукты", "без овощей и фруктов"],
  // me & my state
  "felt-happy": ["happy day", "not a happy day", "счастливый день", "не самый счастливый день"],
  "felt-anxious": ["anxiety", "no anxiety", "тревога", "без тревоги"],
  "felt-depressed": ["low mood", "no low mood", "подавленность", "без подавленности"],
  "felt-angry": ["anger", "no anger", "злость", "без злости"],
  "felt-lonely": ["loneliness", "no loneliness", "одиночество", "без одиночества"],
  "had-energy": ["energy", "low energy", "энергия", "мало энергии"],
  "cried-today": ["tears", "no tears", "слёзы", "без слёз"],
  "burned-out-after-work": ["drained after work", "not drained after work", "без сил после работы", "силы после работы остались"],
  "didnt-want-to-work": ["not wanting to go to work", "going to work felt okay", "не хочется на работу", "на работу идти нормально"],
  "worked-overtime": ["overtime", "no overtime", "переработка", "без переработки"],
  "felt-fulfilled-at-work": ["meaningful work", "flat work day", "работа даёт энергию", "работа без энергии"],
  "main-thing-done": ["main thing done", "main thing not done", "главное сделано", "главное не сделано"],
  "focus-hour": ["an hour of focused work", "no hour of focused work", "час без отвлечений", "ни часа без отвлечений"],
  "kept-morning-promise": ["morning promise kept", "morning promise not kept", "обещание себе выполнено", "обещание себе не выполнено"],
  "procrastinated": ["procrastination", "no procrastination", "прокрастинация", "без прокрастинации"],
  "no-snooze": ["up on the first alarm", "snoozing", "подъём с первого будильника", "будильник отложен"],
  "felt-proud-today": ["pride in the day", "no pride in the day", "гордость за день", "без гордости за день"],
  "felt-useless": ["feeling of doing nothing useful", "not feeling useless", "чувство «ничего полезного»", "без чувства бесполезности"],
  "snapped-at-loved-ones": ["snapping at someone close", "no snapping", "срыв на близких", "без срывов на близких"],
  "calm-day": ["day without irritation", "irritated day", "день без раздражения", "день с раздражением"],
  "felt-calm": ["calm", "not calm", "спокойствие", "неспокойный день"],
  "time-for-myself": ["me-time", "no me-time", "время для себя", "без времени для себя"],
  "isolated-at-home": ["a whole day alone at home", "time with people", "весь день дома без людей", "живое общение"],
  "said-yes-when-meant-no": ["an unwanted yes", "no unwanted yes", "согласие против желания", "без согласия против желания"],
  "cried-from-something-small": ["tears over small things", "no tears over small things", "слёзы от мелочей", "без слёз от мелочей"],
  "laughed-uncontrollably": ["laughing", "a day without laughs", "смех", "без смеха"],
  "envied-on-social": ["envy online", "no envy online", "зависть в соцсетях", "без зависти в соцсетях"],
  "felt-not-like-others": ["feeling left behind", "not feeling left behind", "чувство «не как все»", "без чувства «не как все»"],
  "danced-or-sang-alone": ["dancing or singing alone", "no dancing or singing", "танцы или пение", "без танцев и пения"],
  "petted-an-animal": ["petting an animal", "no petting an animal", "погладить животное", "без поглаживания животных"],
  "liked-my-selfie": ["a good selfie", "no good selfie", "удачное селфи", "без удачного селфи"],
  "talked-to-pet": ["talking to a pet or plant", "no chats with a pet or plant", "разговор с питомцем или растением", "без разговоров с питомцем"],
  "in-flow": ["in flow", "not in flow", "состояние потока", "без состояния потока"],
  "boss-was-difficult": ["pressure from the boss", "easy day with the boss", "давление от босса", "спокойно с боссом"],
  "conflict-with-colleague": ["conflict with a colleague", "no conflict at work", "конфликт с коллегой", "без конфликта с коллегой"],
  "drained-by-someone": ["a draining person", "no one draining", "кто-то выматывает", "никто не выматывал"],
  "got-recognition": ["praise or recognition", "no praise", "похвала или признание", "без похвалы"],
  "heard-bad-news": ["bad news", "no bad news", "плохие новости", "без плохих новостей"],
  "home-was-tidy": ["tidy home", "messy home", "порядок дома", "беспорядок дома"],
  "felt-stressed": ["stress", "no stress", "стресс", "без стресса"],
  "meditated": ["meditation", "no meditation", "медитация", "без медитации"],
  "felt-grateful": ["something good noticed", "nothing good noticed", "хорошее замечено", "хорошее не замечено"],
  // big decisions (no right answer)
  "wanted-child": ["wanting a child", "no wish for a child", "желание ребёнка", "без желания ребёнка"],
  "thought-about-emigrating": ["thought of moving abroad", "no thought of moving", "мысль уехать", "без мысли уехать"],
  "wanted-leave-job": ["wanting to quit your job", "no wish to quit", "хочется уволиться", "без желания уволиться"],
  "thought-divorce": ["thought of divorce", "no thought of divorce", "мысль о разводе", "без мысли о разводе"],
  "wanted-life-change": ["wanting a big change", "no urge for change", "желание всё поменять", "без желания всё поменять"],
  "wanted-pet": ["wanting a pet", "no wish for a pet", "хочется питомца", "без желания завести питомца"],
  "wanted-learn-new": ["wanting to learn something new", "no thought of learning new things", "желание учиться новому", "без мысли учиться новому"],
  "thought-career-change": ["thought of a career change", "no thought of a career change", "мысль сменить профессию", "без мысли сменить профессию"],
  // hobbies & growth
  "studied-language": ["language practice", "no language practice", "занятие языком", "без занятий языком"],
  "watched-course-lecture": ["a course lecture", "no lecture", "лекция курса", "без лекции"],
  "did-creative-work": ["something creative", "nothing creative", "творчество", "без творчества"],
  "learned-something-new": ["something new learned", "nothing new learned", "новое знание", "без нового знания"],
  "practiced-skill": ["skill practice", "no skill practice", "практика навыка", "без практики навыка"],
  "listened-podcast": ["podcast or audiobook", "no podcast", "подкаст или аудиокнига", "без подкаста"],
  "read-book": ["reading", "no reading", "чтение", "без чтения"],
  "hobby-time": ["hobby time", "no hobby time", "время на хобби", "без хобби"],
  // what happens around
  "noisy-neighbors": ["noisy neighbors", "quiet neighbors", "шумные соседи", "тихие соседи"],
  "construction-nearby": ["construction or renovation noise", "no construction or renovation noise", "шум стройки или ремонта", "без шума стройки и ремонта"],
  "long-commute": ["longer commute than usual", "usual commute", "дорога дольше обычного", "дорога как обычно"],
  "transport-issue": ["transport trouble", "transport on time", "сбой транспорта", "транспорт без сбоев"],
  "internet-down": ["internet or connection trouble", "internet and connection fine", "проблемы с интернетом или связью", "интернет и связь без проблем"],
  "criticized-by-close": ["criticism or hurt from someone close", "no criticism or hurt", "критика или обида от близких", "без критики и обид"],
  "parent-pressured": ["pressure from a parent", "no pressure from parents", "давление родителя", "без давления родителей"],
  "toxic-friend": ["a draining friend", "no draining friends", "выматывающее общение с друзьями", "без токсичного общения"],
  "kids-reached-out": ["kids called or wrote", "no word from the kids", "звонок или сообщение от детей", "нет вестей от детей"],
  "financial-issue": ["unexpected bills", "no unexpected bills", "неожиданные траты", "без неожиданных трат"],
  // life abroad
  "spoke-local-language": ["speaking the local language", "local language not spoken", "разговор на местном языке", "без местного языка"],
  "studied-local-language": ["local language study", "no language study", "занятие местным языком", "без занятий местным языком"],
  "didnt-understand-locals": ["not understanding what locals say", "understanding what locals say", "непонятная речь вокруг", "речь вокруг понятна"],
  "couldnt-express-self": ["language barrier", "no language barrier", "языковой барьер", "без языкового барьера"],
  "language-progress": ["language progress", "no language progress", "прогресс в языке", "без прогресса в языке"],
  "missed-home-country": ["missing home", "not missing home", "тоска по дому", "без тоски по дому"],
  "called-someone-back-home": ["a call home", "no call home", "звонок или сообщение домой", "без звонка домой"],
  "missed-familiar-food": ["missing home food", "not missing home food", "тоска по родной еде", "без тоски по родной еде"],
  "missed-familiar-weather": ["missing home weather", "not missing home weather", "тоска по своей погоде", "без тоски по погоде"],
  "felt-foreigner": ["feeling out of place", "feeling at home", "чувство «не на своём месте»", "чувство «я тут дома»"],
  "felt-settled-in": ["feeling settled in", "not feeling settled in", "чувство «я тут дома»", "без чувства «я тут дома»"],
  "locals-were-warm": ["a nice moment with a local", "no nice moment with locals", "приятный контакт с местными", "без приятного контакта с местными"],
  "talked-to-fellow-expats": ["time with fellow expats", "no time with fellow expats", "общение с земляками", "без общения с земляками"],
  "dealt-with-paperwork": ["paperwork or visa", "no paperwork", "документы или виза", "без бюрократии"],
  "local-institution-contact": ["bank, doctor or office", "no bank, doctor or office", "банк, врач или госконтора", "без банка, врача и госконторы"],
  "climate-drained-me": ["draining weather", "easy weather", "выматывающий климат", "климат не мешал"],
  "tried-local-food": ["local food", "no local food", "местная еда", "без местной еды"],
  "thought-about-going-back": ["thought of going back", "no thought of going back", "мысль вернуться", "без мысли вернуться"],
  "thought-third-country": ["thought of another country", "no thought of another country", "мысль о другой стране", "без мысли о другой стране"],
  "happy-with-the-move": ["glad about the move", "not glad about the move", "радость от переезда", "без радости от переезда"],
  // pet
  "pet-limped": ["pet limping", "pet walking fine", "питомец хромал", "питомец не хромал"],
  "pet-skipped-food": ["pet ate less", "pet ate as usual", "питомец ел меньше", "питомец ел как обычно"],
  "pet-low-energy": ["sluggish pet", "active pet", "вялый питомец", "бодрый питомец"],
  "pet-restless-night": ["restless night for the pet", "calm night for the pet", "беспокойная ночь питомца", "спокойная ночь питомца"],
  "pet-stomach-upset": ["pet's upset stomach", "pet's stomach fine", "рвота или понос у питомца", "живот питомца в порядке"],
  "pet-anxious": ["anxious pet", "calm pet", "тревожный питомец", "спокойный питомец"],
  "pet-playful": ["playful pet", "pet not playful", "игривый питомец", "питомец не играл"],
  // elderly parent
  "parent-confused": ["parent confused", "parent clear", "родитель путался", "родитель не путался"],
  "parent-skipped-meal": ["parent skipped a meal", "parent ate", "родитель пропустил еду", "родитель поел"],
  "parent-slept-poorly": ["parent slept poorly", "parent slept well", "родитель плохо спал", "родитель хорошо спал"],
  "parent-stumbled": ["parent stumbled or fell", "parent steady", "родитель споткнулся или упал", "без падений"],
  "parent-took-meds": ["parent took meds", "parent missed meds", "родитель принял лекарства", "родитель пропустил лекарства"],
  "parent-pain": ["parent in pain", "parent without pain", "родитель жаловался на боль", "родитель без боли"],
  "parent-good-mood": ["parent in a good mood", "parent not in a good mood", "хорошее настроение родителя", "родитель не в настроении"],
  // child
  "child-meltdown": ["child's meltdown", "no meltdown", "истерика у ребёнка", "без истерики"],
  "child-slept-poorly": ["child slept poorly", "child slept well", "ребёнок плохо спал", "ребёнок хорошо спал"],
  "child-refused-food": ["child refused food", "child ate well", "ребёнок почти не ел", "ребёнок хорошо ел"],
  "child-too-much-screen": ["lots of screen time for the child", "little screen time for the child", "много экранов у ребёнка", "мало экранов у ребёнка"],
  "child-physical-activity": ["child moved a lot", "child moved little", "ребёнок много двигался", "ребёнок мало двигался"],
  "child-bright-moment": ["bright moment with the child", "no bright moment", "светлый момент с ребёнком", "без светлого момента"],
  "child-sick-symptoms": ["child unwell", "child healthy", "симптомы болезни у ребёнка", "ребёнок здоров"],
  // from the research (Nov 7 2026)
  "period-day": ["period day", "no period", "месячные", "без месячных"],
  "took-painkiller": ["painkiller", "no painkillers", "обезболивающее", "без обезболивающих"],
  "slow-to-fall-asleep": ["slow to fall asleep", "quick to fall asleep", "долгое засыпание", "быстрое засыпание"],
  "sick-day": ["sick day", "healthy day", "болезнь", "без болезни"],
  "alcohol-3-plus": ["3+ drinks", "under 3 drinks", "3+ порции алкоголя", "меньше 3 порций"],
  "caffeine-4-plus": ["4+ caffeine drinks", "under 4 coffees", "4+ кофеиновых напитка", "меньше 4 чашек"],
  "lost-interest": ["lost interest", "interest in things", "пропал интерес", "интерес к делам"],
  "pms-signs": ["PMS signs", "no PMS signs", "признаки ПМС", "без признаков ПМС"],
  "headache-stopped-me": ["headache in the way", "no headache in the way", "голова помешала делам", "голова не мешала делам"],
  "same-wake-time": ["same wake-up time", "shifted wake-up time", "подъём в одно время", "подъём в другое время"],
  "racing-thoughts-in-bed": ["racing thoughts in bed", "quiet mind in bed", "тревожные мысли перед сном", "спокойная голова перед сном"],
  "less-caffeine-than-usual": ["much less coffee", "usual coffee", "кофе меньше обычного", "кофе как обычно"],
  "neck-pain": ["neck pain", "no neck pain", "боль в шее", "без боли в шее"],
  "got-help-with-kids": ["help with the kids", "no help with the kids", "помощь с детьми", "без помощи с детьми"],
  "skipped-meal": ["skipped meal", "regular meals", "пропуск еды", "регулярная еда"],
  "panic-attack": ["panic attack", "no panic attack", "паническая атака", "без панических атак"],
  "woke-too-early": ["early waking", "slept till the alarm", "слишком раннее пробуждение", "сон до будильника"],
  "travel-or-night-away": ["travel day", "day at home", "поездка", "день дома"],
  "sleep-aid": ["sleep aid", "no sleep aid", "средство для сна", "без средства для сна"],
  "snored-or-gasped": ["snoring or gasping", "quiet sleep", "храп или удушье во сне", "тихий сон"],
  "hot-day": ["hot day", "comfortable weather", "жара", "без жары"],
  "weather-change": ["weather change", "steady weather", "смена погоды", "ровная погода"],
  "phones-together": ["phones in the way", "phone-free time together", "телефоны между вами", "время вдвоём без телефонов"],
  "bedtime-battle": ["bedtime struggle", "easy bedtime", "тяжёлый отбой", "спокойный отбой"],
  "unfair-chores": ["unfair share of chores", "fair share of chores", "неравные домашние дела", "дела поровну"],
  "many-interruptions": ["constant interruptions", "uninterrupted day", "постоянные отвлечения", "день без отвлечений"],
  "social-media-hour": ["1+ hour on social media", "under an hour on social media", "соцсети больше часа", "соцсети меньше часа"],
  "deep-conversation": ["real conversation", "no real conversation", "разговор по душам", "без разговора по душам"],
  "time-in-nature": ["time in nature", "no time in nature", "время на природе", "без времени на природе"],
  "money-worry": ["money worries", "no money worries", "тревога о деньгах", "без тревоги о деньгах"],
  "early-migraine-signs": ["early migraine signs", "no early signs", "предвестники мигрени", "без предвестников"],
  "pill-free-day": ["pill-free day", "active pill day", "перерыв в таблетках", "день с таблеткой"],
  "strength-training": ["strength training", "no strength training", "силовая тренировка", "без силовой"],
  // the body questions (research round 2, Nov 7 2026)
  "pooped-today": ["pooped", "no poop", "туалет по-большому", "без туалета по-большому"],
  "hard-to-poop": ["hard to poop", "no trouble pooping", "трудно сходить в туалет", "без трудностей с туалетом"],
  "heartburn": ["heartburn", "no heartburn", "изжога", "без изжоги"],
  "bloated": ["bloating", "no bloating", "вздутие", "без вздутия"],
  "night-pee-2-plus": ["2+ night trips to pee", "0–1 night trips", "ночью 2+ раза в туалет", "ночью в туалет не больше раза"],
  "bladder-leak": ["bladder leak", "no leaks", "подтекание мочи", "без подтеканий"],
  "loose-stool": ["loose poop", "no loose poop", "жидкий стул", "без жидкого стула"],
  "heavy-flow-day": ["heavy period day", "lighter period day", "обильные месячные", "необильные месячные"],
  "hot-flushes": ["hot flushes", "no hot flushes", "приливы", "без приливов"],
  "night-sweats": ["night sweats", "dry night", "ночная потливость", "ночь без пота"],
  "breakout": ["new spots", "no new spots", "новые прыщи", "без новых прыщей"],
  "dizzy": ["dizziness", "no dizziness", "головокружение", "без головокружения"],
  "medicine-change": ["medicine change", "same medicines", "смена лекарств", "привычные лекарства"],
  "jaw-sore-morning": ["sore jaw on waking", "relaxed jaw on waking", "челюсть болит утром", "спокойная челюсть утром"],
  "pelvic-floor-exercises": ["pelvic floor exercises", "no pelvic floor exercises", "упражнения для тазового дна", "без упражнений для тазового дна"],
  "pee-burning": ["burning when peeing", "no burning", "жжение при мочеиспускании", "без жжения"],
  "bladder-urgency": ["sudden urge to pee", "no sudden urges", "внезапные позывы в туалет", "без срочных позывов"],
  "piles-bothered": ["piles trouble", "no piles trouble", "геморрой беспокоит", "без геморроя"],
  "sweated-a-lot": ["heavy sweating", "usual sweating", "сильная потливость", "обычная потливость"],
  "tinnitus-louder": ["louder ringing", "usual ringing", "шум в ушах сильнее", "шум как обычно"],
  "breast-tender": ["sore breasts", "no breast pain", "болит грудь", "грудь не болит"],
  "fingers-white-cold": ["white or blue fingers", "fingers keep their colour", "пальцы белеют от холода", "пальцы не белеют"],
};

// a tracker made from the library: "1793…-migraine-0" (ensureTemplates), or by its title
const byTitle = (() => {
  let m: Map<string, string> | null = null;
  return () => {
    if (!m) {
      m = new Map();
      for (const s of LIFE_STREAMS) for (const tpl of s.templates) for (const x of [tpl.title, tpl.titleRu, tpl.legacy?.title, tpl.legacy?.titleRu]) if (x) m.set(x.trim().toLowerCase(), tpl.id);
    }
    return m;
  };
})();
export const templateIdOf = (tr: Tracker): string | null => {
  const fromId = /^\d+-(.+)-\d+$/.exec(tr.id)?.[1];
  if (fromId && P[fromId]) return fromId;
  const id = byTitle().get((tr.title ?? "").trim().toLowerCase());
  return id && P[id] ? id : null;
};

// A question someone had before the Nov 7 2026 rewordings keeps the words that fit it
// ("back or neck pain", not "back pain").
const P_OLD: Record<string, [string, string, string, string]> = {
  // re-meant Nov 10 2026 (her pick): who still tracks the old question keeps its words
  "laughed-uncontrollably": ["laughing to tears", "no big laugh", "смех до слёз", "без смеха до слёз"],
  "complimented-stranger": ["kind words to a stranger", "no kind words to strangers", "комплимент незнакомцу", "без комплиментов незнакомцам"],
  // re-meant Nov 9 2026 (content review): who still tracks the old question keeps its words
  "apologized-first": ["apologizing first", "not apologizing first", "первый шаг с извинением", "без первого извинения"],
  "ate-sweets": ["sweets", "no sweets", "сладкое", "без сладкого"],
  "period-symptoms": ["strong cycle symptoms", "mild cycle day", "сильные симптомы цикла", "без сильных симптомов цикла"],
  "back-or-neck-pain": ["back or neck pain", "no back or neck pain", "боль в спине или шее", "без боли в спине и шее"],
  "heart-palpitations": ["palpitations or BP swings", "no palpitations", "сердцебиение или скачки давления", "без сердцебиения и скачков"],
  "saw-daylight": ["daylight", "no daylight", "дневной свет", "без дневного света"],
  "saw-friends": ["time with friends", "no time with friends", "общение с друзьями", "без общения с друзьями"],
  "thought-divorce": ["thought of ending it", "no thought of ending it", "мысль расстаться", "без мысли расстаться"],
  "stomach-issues": ["stomach trouble", "calm stomach", "проблемы с животом", "спокойный живот"],
  "skin-allergy": ["skin reaction", "no skin reaction", "реакция кожи", "без реакции кожи"],
};
const S_OLD: Record<string, [string, string, string, string]> = {
  "laughed-uncontrollably": ["you ~laugh to tears", "there's ~no big laugh", "ты ~смеёшься до слёз", "смеха до слёз ~нет"],
  "complimented-stranger": ["you ~say something kind to a stranger", "you ~don't compliment strangers", "ты ~говоришь приятное незнакомцу", "ты ~не делаешь комплиментов незнакомцам"],
  "apologized-first": ["you ~make the first move to make up", "there's ~no first move", "ты ~делаешь первый шаг к примирению", "первого шага ~нет"],
  "ate-sweets": ["you ~eat sweets", "you ~skip sweets", "ты ~ешь сладкое", "ты ~не ешь сладкое"],
  "period-symptoms": ["cycle symptoms are ~strong", "cycle symptoms are ~mild", "симптомы цикла ~сильные", "симптомы цикла ~мягкие"],
  "back-or-neck-pain": ["your back or neck ~hurts", "your back and neck ~don't hurt", "~болит спина или шея", "спина и шея ~не болят"],
  "heart-palpitations": ["you ~have palpitations or BP swings", "you ~have no palpitations", "есть сердцебиение или скачки давления|~бывает сердцебиение или скачки давления", "сердцебиения и скачков ~нет"],
  "saw-daylight": ["you ~get daylight", "you ~get no daylight", "ты ~видишь дневной свет", "дневного света ~нет"],
  "saw-friends": ["you ~see or message friends", "you ~don't see friends", "ты ~общаешься с друзьями", "ты ~не видишься с друзьями"],
  "thought-divorce": ["you ~think about ending the relationship", "you ~don't think about ending it", "ты ~думаешь расстаться", "мысли расстаться ~нет"],
  "stomach-issues": ["your stomach ~bothers you", "your stomach ~is fine", "~беспокоит живот", "живот ~не беспокоит"],
  "skin-allergy": ["your skin ~reacts", "your skin ~stays calm", "кожа ~реагирует", "кожа ~спокойна"],
};
const isOld = (tr: Tracker, id: string) => {
  const tpl = LIFE_STREAMS.flatMap((s) => s.templates).find((x) => x.id === id);
  const t = (tr.title ?? "").trim().toLowerCase();
  return !!tpl?.legacy && [tpl.legacy.title, tpl.legacy.titleRu].some((x) => x && x.trim().toLowerCase() === t);
};
const rowP = (tr: Tracker, id: string) => (P_OLD[id] && isOld(tr, id) ? P_OLD[id] : P[id]);
const rowS = (tr: Tracker, id: string) => (S_OLD[id] && isOld(tr, id) ? S_OLD[id] : S[id]);

export const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);

/** "short night", "migraine", "no anxiety"; her own question: "“Walked the dog”: no". */
export const answerPhrase = (t: TFunction, tr: Tracker | undefined, yes: boolean): string => {
  if (!tr) return "";
  const own = yes ? tr.words?.yes : tr.words?.no;
  if (own) return own;
  const id = templateIdOf(tr);
  if (id) { const p = rowP(tr, id); return getLanguage() === "ru" ? (yes ? p[2] : p[3]) : yes ? p[0] : p[1]; }
  return t("link.own", { q: localizeTrackerTitle(tr.title), a: t(yes ? "link.yes" : "link.no") });
};

/** For a test that every library question has its phrases. */
export const phraseIds = () => Object.keys(P);
export const sentenceIds = () => Object.keys(S);

/** How often, from k of n (her "On days you slept under 7 hours, you OFTEN had a
 *  migraine"): almost always · usually · often · more often (a link is only shown
 *  when it came more often than on other days, so "more often" is always true). */
export const oftenWord = (t: TFunction, k: number, n: number): string => {
  const r = n ? k / n : 0;
  // every one of the days: "always", never "almost always" for 4 of 4 (QA, Nov 8 2026)
  if (n > 0 && k === n) return t("link.advAll");
  return t(`link.adv${r >= 0.9 ? 0 : r >= 0.7 ? 1 : r >= 0.5 ? 2 : 3}`);
};

/** An answer as a clause: the cause ("you sleep under 7 hours") or the result, with
 *  how often ("you usually get a migraine"). Her own question: "you answer “no” to …". */
export const answerClause = (t: TFunction, tr: Tracker | undefined, yes: boolean, role: "cause" | "result", often = ""): string => {
  if (!tr) return "";
  const id = templateIdOf(tr);
  const own = yes ? tr.words?.yes : tr.words?.no;
  const s = own && !(id && S[id]) ? t("link.wordsClause", { w: own })
    : id && S[id]
    ? (() => { const r = rowS(tr, id); return getLanguage() === "ru" ? (yes ? r[2] : r[3]) : yes ? r[0] : r[1]; })()
    : t("link.ownClause", { q: localizeTrackerTitle(tr.title).replace(/[?？]+$/, ""), a: t(yes ? "link.yes" : "link.no") });
  const [cause, result] = s.includes("|") ? s.split("|") : [s, s];
  return (role === "cause" ? cause.replace("~", "") : result.replace("~", often ? `${often} ` : "")).replace(/\s+/g, " ").trim();
};
