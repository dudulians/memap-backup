// The ready ideas' names before Nov 8 2026 ("В кровати до 23:00" — "звучит странно"; now they are
// actions: "Go to bed by 23:00" / «Ложиться спать до 23:00»). A test or a plan saved with an old
// name is still that idea: it shows the new name and asks the idea's own question.
export const LEGACY_IDEA_NAMES: Record<string, { en?: string; ru?: string }> = {
  // before Nov 10 2026 ("Say no to one small thing a day" — "сразу и не понять, что это")
  "smallNo__old": { "en": "Say no to one small thing a day", "ru": "Раз в день отказываться от чего-то небольшого" },
  // a library plan before its own test words (Nov 10 2026): a test started with these words is that idea
  "textFriend__saw-friends": { "en": "Text one friend today, no reason needed", "ru": "Написать одному другу сегодня без повода" },
  "pauseSorry__apologized-first": { "en": "Notice when you apologize for things that aren't your fault", "ru": "Замечать, когда извиняешься не за свою вину" },
  "kindStranger__complimented-stranger": { "en": "Make this a daily ritual — one compliment per day", "ru": "Сделать это ежедневным ритуалом — один комплимент в день" },
  "noPhoneMeal__phones-together": { "en": "Agree on one phone-free meal a day", "ru": "Договориться об одном приёме пищи в день без телефонов" },
  "myTime__yelled-at-kid": { "en": "Find 20 minutes a day just for you: no kids, no tasks, no phone", "ru": "Найти 20 минут в день только для себя: без детей, дел и телефона" },
  "kidTime15__quality-time-kid": { "en": "Block 15 minutes daily for the kid, no phone", "ru": "Выделить 15 минут в день только на ребёнка, без телефона" },
  "bed8h__slept-enough": { "en": "Set a reminder to go to bed 8 hours before you get up", "ru": "Поставить напоминание лечь спать за 8 часов до подъёма" },
  "morningLight__saw-daylight": { "en": "Get 10 minutes of morning light without sunglasses", "ru": "Получать 10 минут утреннего света без очков" },
  "breakfastReady__ate-by-2pm": { "en": "Prep breakfast the night before", "ru": "Готовить завтрак с вечера" },
  "windDown30__bed-before-midnight": { "en": "Set a “start winding down” alarm 30 minutes before bed", "ru": "Поставить будильник „начни укладываться“ за 30 минут до отбоя" },
  "moisturize__skin-allergy": { "en": "Moisturise twice a day, even when the skin is clear", "ru": "Мазать кожу увлажняющим кремом дважды в день, даже когда она чистая" },
  "pillsWithHabit__took-meds": { "en": "Keep the pills next to something you do every day, same time", "ru": "Положить таблетки рядом с тем, что делаешь каждый день, в одно и то же время" },
  "sameWake__same-wake-time": { "en": "Keep one wake-up time for 2 weeks, weekends too", "ru": "Две недели вставать в одно время, в выходные тоже" },
  "worryList__racing-thoughts-in-bed": { "en": "Write tomorrow's worries on paper an hour before bed", "ru": "За час до сна выписать на бумагу завтрашние заботы" },
  "sameWake__woke-too-early": { "en": "Get up at the same time every day, weekends too", "ru": "Вставать в одно и то же время каждый день, в выходные тоже" },
  "fruitVegMeals__pooped-today": { "en": "Eat fruit or vegetables at every meal", "ru": "Есть фрукты или овощи в каждый приём пищи" },
  "fruitVegMeals__hard-to-poop": { "en": "Eat fruit or vegetables at every meal", "ru": "Есть фрукты или овощи в каждый приём пищи" },
  "dinnerEarly__heartburn": { "en": "Finish eating 3 hours before bed for 2 weeks", "ru": "Две недели заканчивать есть за 3 часа до сна" },
  "noDrinksBed2h__night-pee-2-plus": { "en": "Stop drinks 2 hours before bed for 2 weeks", "ru": "Две недели ничего не пить за 2 часа до сна" },
  "squeezeBrushing__pelvic-floor-exercises": { "en": "Do them right after brushing your teeth", "ru": "Делать их сразу после чистки зубов" },
  "fruitDessert__ate-sweets": { "en": "Have fruit instead of dessert in the evening", "ru": "Есть вечером фрукт вместо десерта" },
  "gamesHourDay__gaming-streams-2h": { "en": "Set a 1-hour timer before you start playing", "ru": "Ставить таймер на час перед началом игры" },
  "waitDay__impulse-spending": { "en": "Put it in the cart and wait 24 hours before buying", "ru": "Класть в корзину и ждать 24 часа перед покупкой" },
  "snackPlate__ate-by-fridge": { "en": "Always plate food, even snacks", "ru": "Всегда класть еду на тарелку, даже перекус" },
  "tidy10__skipped-cleaning": { "en": "Set a 10-minute timer: cleaning takes less time than it feels", "ru": "Поставить таймер на 10 минут: уборка короче, чем кажется" },
  "cookOne__cooked-myself": { "en": "Plan one simple home-cooked meal a day", "ru": "Запланировать одно простое домашнее блюдо в день" },
  "drinkLimit__alcohol-3-plus": { "en": "Decide the drink limit before the evening", "ru": "Решить лимит порций до начала вечера" },
  "decafOne__caffeine-4-plus": { "en": "Swap one coffee a day for decaf for 2 weeks", "ru": "Две недели менять одну чашку в день на кофе без кофеина" },
  "sameCoffee__less-caffeine-than-usual": { "en": "Keep coffee the same every day, weekends too", "ru": "Пить кофе одинаково каждый день, в выходные тоже" },
  "socialLimit__social-media-hour": { "en": "Try 30 minutes a day for 2 weeks", "ru": "Две недели — не больше 30 минут в день" },
  "workEndFixed__worked-overtime": { "en": "Set a hard end-of-day time this week", "ru": "Поставить твёрдое время окончания работы на эту неделю" },
  "doneList__felt-useless": { "en": "Write down everything you did today, even small things", "ru": "Записывать всё, что получилось сделать за день, даже мелочи" },
  "outAmongPeople__isolated-at-home": { "en": "Go out for coffee — even just to be among people", "ru": "Выйти за кофе — просто чтобы быть среди людей" },
  "songMove__danced-or-sang-alone": { "en": "Put on one song and move: it lifts the mood", "ru": "Включить одну песню и подвигаться: это поднимает настроение" },
  "meditate5__meditated": { "en": "5 minutes at the same time every day for a week", "ru": "Неделю по 5 минут в одно и то же время" },
  "goodThingEvening__felt-grateful": { "en": "Write down one good thing each evening for a week", "ru": "Неделю записывать вечером одну хорошую вещь" },
  "notifOffHour__many-interruptions": { "en": "Block one hour a day with notifications off", "ru": "Ставить в день один час без уведомлений" },
  "learn15__studied-language": { "en": "Set a 15-minute slot at the same time daily", "ru": "Поставить 15-минутное окно в одно и то же время дня" },
  "learn15__practiced-skill": { "en": "Practise 15 minutes a day: regular beats long", "ru": "Заниматься по 15 минут в день: регулярность важнее длительности" },
  "episodeOnTheGo__listened-podcast": { "en": "Download an episode ahead for the road, a walk or cooking", "ru": "Скачивать выпуск заранее: для дороги, прогулки или готовки" },
  "kidsMessage__kids-reached-out": { "en": "Write to them first instead of waiting", "ru": "Написать им, не дожидаясь, пока напишут они" },
  "askLocal__spoke-local-language": { "en": "Ask one question per day in the local language", "ru": "Задавать минимум один вопрос в день на местном" },
  "localLang15__studied-local-language": { "en": "Set 15 minutes at the same time every day", "ru": "Поставить 15 минут в одно и то же время каждый день" },
  "homeSounds__missed-familiar-weather": { "en": "Listen to the sounds of your home season: snow, rain, sea", "ru": "Послушать звуки своего сезона: снег, дождь, море" },
  "localChat__locals-were-warm": { "en": "Make the first small step yourself: say hello to a neighbour or a shop assistant", "ru": "Сделать первый маленький шаг: поздороваться с соседом или продавцом" },
  "screenFreeActivity__child-too-much-screen": { "en": "Plan one screen-free activity for tomorrow", "ru": "Запланировать одно занятие без экранов на завтра" },
  "kidOutside30__child-physical-activity": { "en": "Get outside with your child for 30 minutes a day: even a short walk counts", "ru": "Выходить с ребёнком на улицу на 30 минут в день: даже короткая прогулка считается" },
  "outsideMorning": {
    "en": "10 minutes outside in the morning",
    "ru": "10 минут на улице утром"
  },
  "phoneAway": {
    "en": "Phone away an hour before bed",
    "ru": "Телефон в сторону за час до сна"
  },
  "talkNoPhones": {
    "en": "10 minutes of talking, no phones",
    "ru": "10 минут разговора без телефонов"
  },
  "thankYou": {
    "en": "Say one thank-you",
    "ru": "Одно «спасибо» партнёру"
  },
  "walkTogether": {
    "en": "A walk together",
    "ru": "Прогулка вместе"
  },
  "playTogether": {
    "en": "15 minutes of play together",
    "ru": "15 минут игры вместе"
  },
  "bedtimeSame": {
    "en": "The same bedtime every night",
    "ru": "Отбой в одно и то же время"
  },
  "bed23": {
    "en": "In bed by 23:00",
    "ru": "В кровати до 23:00"
  },
  "noCoffee14": {
    "en": "Skip coffee after 14:00",
    "ru": "Без кофе после 14:00"
  },
  "noCoffee14__1": { "en": "No coffee after 14:00" },
  "water": {
    "en": "About 2 litres of water",
    "ru": "Около 2 литров воды"
  },
  "walk20": {
    "en": "A 20-minute walk",
    "ru": "Прогулка 20 минут"
  },
  "stretch": {
    "en": "5 minutes of stretching",
    "ru": "5 минут растяжки"
  },
  "noSweetsEvening": {
    "en": "No sweets in the evening",
    "ru": "Без сладкого вечером"
  },
  "extraWalk": {
    "en": "An extra walk with your pet",
    "ru": "Лишняя прогулка с питомцем"
  },
  "playTime": {
    "en": "10 minutes of play with your pet",
    "ru": "10 минут игры с питомцем"
  },
  "sameFoodTime": {
    "en": "Pet meals at the same times",
    "ru": "Кормление в одно время"
  },
  // one parent, not "parents" (content review, Nov 9 2026); the names before Nov 8 under __1
  "callParents": {
    "en": "Call your parents",
    "ru": "Звонить родителям"
  },
  "callParents__1": {
    "en": "A short call to your parents",
    "ru": "Короткий звонок родителям"
  },
  "visitWeekend": {
    "en": "Ask your parents about their day",
    "ru": "Спрашивать родителей, как прошёл их день"
  },
  "visitWeekend__1": {
    "en": "Ask them about their day",
    "ru": "Спросить, как прошёл их день"
  },
  "shortMessage": {
    "en": "Send your parents a short message",
    "ru": "Писать родителям короткое сообщение"
  },
  "shortMessage__1": {
    "en": "A short message to them",
    "ru": "Короткое сообщение им"
  },
  "lunchBreak": {
    "en": "A real lunch break",
    "ru": "Настоящий обеденный перерыв"
  },
  "noMailEvening": {
    "en": "No work mail in the evening",
    "ru": "Без рабочей почты вечером"
  },
  "noNewsEvening": {
    "en": "No news in the evening",
    "ru": "Без новостей вечером"
  },
  "threeLines": {
    "ru": "3 строчки вечером"
  },
  "screenFreeHour": {
    "ru": "Без экранов за час до сна детей",
    "en": "No screens in the hour before the kids' bedtime"
  },
  "stop19": {
    "ru": "Закончить работу до 19:00"
  },
  "talkNoPhones__ru2": { "ru": "10 минут говорить без телефонов" },
  "outsideMorning__ru2": { "ru": "Утром 10 минут побыть на улице" },
  // content review, Nov 9 2026: "в своей жизни" was filler
  "gladLine": { "ru": "Записывать одну вещь, которая радует в своей жизни" },
};
