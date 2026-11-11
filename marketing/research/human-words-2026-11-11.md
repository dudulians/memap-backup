# Простые слова: итог пробы и другие места (11 ноя 2026)

Её выбор на странице «Простые слова MeMap»: `1 да · 2 A · 3 да · 4 A · 5 да · 6 да`.

1. **Итог пробы.** Одна строка называет пробу и то, что изменилось в вопросе с самой большой разницей:
   «Looks like walks together help: you argue with your partner less often.» Под ней мелко счёт.
   - Тяжёлый ответ «да» (ссора): «реже». Тяжёлый ответ «нет» (комплимент): «чаще», и счёт считает хорошие дни.
   - Хуже: «Looks like walks together don't help: … more often».
   - Свой план без короткого названия: «Looks like it helps: …».
   - Где фразы нет или она кривая, остаётся старая строка.
   - Код: src/lib/testResult.ts. Короткие названия 250 проб: src/lib/ideaShorts.ts (у angerMissing нет).
2. **Похвала только за старание (A):** 14 из 14 — своя строка; 10–13 — «Well done!» / «Отлично!»;
   7–9 — «Good effort!» / «Уже немало!»; меньше — только счёт.
3. **Хуже / так же / мало дней:** «No difference yet: …» / «Пока без разницы: …»,
   «Not enough answered days to compare yet.» / «Пока мало отвеченных дней, чтобы сравнить.»
4. **When to act (A):** «7 more questions: time to act», «14 more questions: calm for now»,
   «Time to act on 3 questions»; «Nothing to act on yet»; в «How MeMap works»: «One of your questions: time to act.»
   Слово «rule» осталось там, где речь о её собственном правиле («Your rule: at 3 days in 7…», «Set a rule»).
5. **Карточка острова:** «No compliment from partner · 5 days». Сноска про «да/нет» видна, только если
   какая-то строка всё ещё говорит «да/нет» (свой вопрос без слов).
6. **Отчёт, In short:** «No headache: 6 days in a row, your longest stretch.», «Something good: compliment from
   partner on 4 of 14 days.»

## Где фраза «чаще / реже» не ставится (проверено глазами)

- Звучит криво в обоих языках: felt-overwhelmed-parenting, unfair-chores, ate-sweets, hard-to-poop, pooped-today,
  period-day, morning-libido, didnt-want-to-work, didnt-understand-locals, pet-skipped-food.
- Проба не может это изменить (погода, соседи, счета): long-commute, travel-or-night-away, hot-day, weather-change,
  noisy-neighbors, construction-nearby, transport-issue, internet-down, financial-issue, heard-bad-news,
  dealt-with-paperwork.
- Только EN: calm-day («nothing irritates you more often»).
- Только RU: burned-out-after-work («после работы реже не остаётся сил»), felt-fatigued («реже весь день нет сил»).

## Таблица всех вопросов (как получилось до исключений)

| id | hard | EN better | RU better | EN worse | RU worse |
|---|---|---|---|---|---|
| argued-with-partner | yes | you argue with your partner less often | вы реже ссоритесь с партнёром | you argue with your partner more often | вы чаще ссоритесь с партнёром |
| felt-close-to-partner | no | you feel close to your partner more often | чаще бывает тёплый момент с партнёром | you feel close to your partner less often | реже бывает тёплый момент с партнёром |
| felt-lonely-with-partner | yes | you feel alone next to your partner less often | тебе реже одиноко рядом с партнёром | you feel alone next to your partner more often | тебе чаще одиноко рядом с партнёром |
| partner-irritated-me | yes | your partner irritates you less often | партнёр реже раздражает | your partner irritates you more often | партнёр чаще раздражает |
| good-time-together | no | you have a good time together more often | вам чаще хорошо вдвоём | you have a good time together less often | вам реже хорошо вдвоём |
| partner-complimented-me | no | your partner pays you a real compliment more often | партнёр чаще говорит что-то по-настоящему доброе | your partner pays you a real compliment less often | партнёр реже говорит что-то по-настоящему доброе |
| partner-raised-voice | yes | your partner raises their voice less often | партнёр реже повышает голос | your partner raises their voice more often | партнёр чаще повышает голос |
| partner-said-hurtful | yes | your partner says something hurtful less often | партнёр реже говорит что-то обидное | your partner says something hurtful more often | партнёр чаще говорит что-то обидное |
| called-parent | no | you call mom or dad more often | ты чаще звонишь маме или папе | you call mom or dad less often | ты реже звонишь маме или папе |
| thought-about-leaving | yes | you think about leaving the relationship less often | ты реже думаешь расстаться | you think about leaving the relationship more often | ты чаще думаешь расстаться |
| had-sex | no | you are intimate with your partner more often | чаще бывает физическая близость | you are intimate with your partner less often | реже бывает физическая близость |
| saw-friends | no | you see friends in person more often | ты чаще видишься с друзьями вживую | you see friends in person less often | ты реже видишься с друзьями вживую |
| apologized-first | yes | you say sorry for what isn't your fault less often | ты реже извиняешься не за свою вину | you say sorry for what isn't your fault more often | ты чаще извиняешься не за свою вину |
| didnt-like-friend-post (quiet) | yes | you skip a like on purpose less often | ты реже нарочно не ставишь лайк | you skip a like on purpose more often | ты чаще нарочно не ставишь лайк |
| complimented-stranger | no | you do something kind for someone more often | ты чаще делаешь что-то доброе для другого | you do something kind for someone less often | ты реже делаешь что-то доброе для другого |
| flirted | yes | you flirt less often | реже бывает флирт | you flirt more often | чаще бывает флирт |
| thought-about-someone-else | yes | you think about someone else less often | ты реже думаешь о другом человеке | you think about someone else more often | ты чаще думаешь о другом человеке |
| missed-ex | yes | you miss an ex less often | ты реже скучаешь по бывшим | you miss an ex more often | ты чаще скучаешь по бывшим |
| phones-together | yes | phones get in the way less often | телефоны реже мешают побыть вдвоём | phones get in the way more often | телефоны чаще мешают побыть вдвоём |
| unfair-chores | yes | you carry more than your share less often | на тебе реже больше дел, чем справедливо | you carry more than your share more often | на тебе чаще больше дел, чем справедливо |
| yelled-at-kid | yes | you yell at your kid less often | ты реже срываешься на ребёнка | you yell at your kid more often | ты чаще срываешься на ребёнка |
| felt-bad-parent | yes | you feel like a bad parent less often | реже приходит мысль «я плохой родитель» | you feel like a bad parent more often | чаще приходит мысль «я плохой родитель» |
| quality-time-kid | no | you have a real moment with your kid more often | ты чаще по-настоящему вместе с ребёнком | you have a real moment with your kid less often | ты реже по-настоящему вместе с ребёнком |
| ran-out-of-patience | yes | you run out of patience less often | терпения реже не хватает | you run out of patience more often | терпения чаще не хватает |
| felt-overwhelmed-parenting | yes | parenting feels like too much less often | с детьми реже слишком тяжело | parenting feels like too much more often | с детьми чаще слишком тяжело |
| got-help-with-kids | no | you get help with the kids more often | тебе чаще помогают с детьми | you get help with the kids less often | тебе реже помогают с детьми |
| headache | yes | you have a headache less often | реже болит голова | you have a headache more often | чаще болит голова |
| migraine | yes | you get a migraine less often | реже бывает мигрень | you get a migraine more often | чаще бывает мигрень |
| back-or-neck-pain | yes | your back hurts less often | реже болит спина | your back hurts more often | чаще болит спина |
| stomach-issues | yes | your stomach hurts less often | реже болит живот | your stomach hurts more often | чаще болит живот |
| felt-nauseous | yes | you feel nauseous less often | тебя реже тошнит | you feel nauseous more often | тебя чаще тошнит |
| joint-pain | yes | your joints hurt less often | реже болят суставы | your joints hurt more often | чаще болят суставы |
| slept-enough | no | you sleep 7+ hours more often | ты чаще спишь 7+ часов | you sleep 7+ hours less often | ты реже спишь 7+ часов |
| woke-at-night | yes | you wake up at night less often | ты реже просыпаешься ночью | you wake up at night more often | ты чаще просыпаешься ночью |
| felt-fatigued | yes | you feel drained all day less often | реже весь день нет сил | you feel drained all day more often | чаще весь день нет сил |
| period-symptoms | yes | period pain makes the day hard less often | боль при месячных реже мешает | period pain makes the day hard more often | боль при месячных чаще мешает |
| exercised | no | you work out more often | ты чаще тренируешься | you work out less often | ты реже тренируешься |
| trained-hard | no | you train hard more often | ты чаще тренируешься всерьёз | you train hard less often | ты реже тренируешься всерьёз |
| stretched | no | you stretch more often | ты чаще делаешь растяжку | you stretch less often | ты реже делаешь растяжку |
| morning-libido | no | there's morning libido more often | утром чаще есть влечение | there's morning libido less often | утром реже есть влечение |
| felt-recovered | no | you wake up rested more often | утро чаще бодрое | you wake up rested less often | утро реже бодрое |
| outside-30min | no | you spend 30 minutes outside more often | ты чаще бываешь на улице хотя бы 30 минут | you spend 30 minutes outside less often | ты реже бываешь на улице хотя бы 30 минут |
| saw-daylight | no | you get daylight before noon more often | ты чаще бываешь на дневном свету до полудня | you get daylight before noon less often | ты реже бываешь на дневном свету до полудня |
| drank-water | no | you drink enough water more often | ты чаще пьёшь достаточно воды | you drink enough water less often | ты реже пьёшь достаточно воды |
| ate-by-2pm | no | you eat before 2 pm more often | ты чаще ешь до 14:00 | you eat before 2 pm less often | ты реже ешь до 14:00 |
| bed-before-midnight | no | you go to bed before midnight more often | ты чаще ложишься до полуночи | you go to bed before midnight less often | ты реже ложишься до полуночи |
| skin-allergy | yes | you get an itch or a rash less often | реже бывает зуд или сыпь | you get an itch or a rash more often | чаще бывает зуд или сыпь |
| heart-palpitations | yes | your heart races or skips less often | сердце реже колотится или сбивается | your heart races or skips more often | сердце чаще колотится или сбивается |
| eye-strain | yes | your eyes get tired less often | глаза реже устают | your eyes get tired more often | глаза чаще устают |
| took-meds | no | you take your meds more often | ты чаще принимаешь лекарства | you take your meds less often | ты реже принимаешь лекарства |
| napped | yes | you nap during the day less often | ты реже спишь днём | you nap during the day more often | ты чаще спишь днём |
| period-day | yes | you have your period less often | у тебя реже месячные | you have your period more often | у тебя чаще месячные |
| took-painkiller | yes | you take a painkiller less often | ты реже пьёшь обезболивающее | you take a painkiller more often | ты чаще пьёшь обезболивающее |
| slow-to-fall-asleep | yes | you take over 30 minutes to fall asleep less often | ты реже засыпаешь дольше 30 минут | you take over 30 minutes to fall asleep more often | ты чаще засыпаешь дольше 30 минут |
| sick-day | yes | you are ill less often | ты реже болеешь | you are ill more often | ты чаще болеешь |
| pms-signs | yes | you have PMS signs less often | реже бывают признаки ПМС | you have PMS signs more often | чаще бывают признаки ПМС |
| headache-stopped-me | yes | a headache stops your plans less often | головная боль реже мешает делам | a headache stops your plans more often | головная боль чаще мешает делам |
| same-wake-time | no | you get up at the same time more often | подъём чаще в одно и то же время | you get up at the same time less often | подъём реже в одно и то же время |
| racing-thoughts-in-bed | yes | thoughts keep you awake less often | мысли реже не дают уснуть | thoughts keep you awake more often | мысли чаще не дают уснуть |
| neck-pain | yes | your neck hurts less often | реже болит шея | your neck hurts more often | чаще болит шея |
| skipped-meal | yes | you skip a meal less often | ты реже пропускаешь еду | you skip a meal more often | ты чаще пропускаешь еду |
| woke-too-early | yes | you wake too early less often | ты реже просыпаешься слишком рано | you wake too early more often | ты чаще просыпаешься слишком рано |
| sleep-aid | yes | you take something to sleep less often | ты реже принимаешь что-то для сна | you take something to sleep more often | ты чаще принимаешь что-то для сна |
| snored-or-gasped | yes | you snore or gasp in your sleep less often | ты реже храпишь или задыхаешься во сне | you snore or gasp in your sleep more often | ты чаще храпишь или задыхаешься во сне |
| time-in-nature | no | you spend time in nature more often | ты чаще бываешь на природе | you spend time in nature less often | ты реже бываешь на природе |
| early-migraine-signs | yes | you notice early migraine signs less often | реже бывают предвестники мигрени | you notice early migraine signs more often | чаще бывают предвестники мигрени |
| pill-free-day (quiet) | yes | you are on a pill-free day less often | у тебя реже перерыв в таблетках | you are on a pill-free day more often | у тебя чаще перерыв в таблетках |
| strength-training | no | you do strength training more often | ты чаще делаешь силовую тренировку | you do strength training less often | ты реже делаешь силовую тренировку |
| pooped-today | no | you poop more often | стул чаще есть | you poop less often | стул реже есть |
| hard-to-poop | yes | pooping is hard less often | сходить в туалет реже трудно | pooping is hard more often | сходить в туалет чаще трудно |
| heartburn | yes | you have heartburn less often | реже бывает изжога | you have heartburn more often | чаще бывает изжога |
| bloated | yes | your belly feels bloated less often | живот реже пучит | your belly feels bloated more often | живот чаще пучит |
| night-pee-2-plus | yes | you get up 2+ times to pee less often | ночью ты реже встаёшь в туалет 2+ раза | you get up 2+ times to pee more often | ночью ты чаще встаёшь в туалет 2+ раза |
| bladder-leak (quiet) | yes | you leak a little less often | моча реже подтекает | you leak a little more often | моча чаще подтекает |
| loose-stool | yes | your poop is loose less often | стул реже жидкий | your poop is loose more often | стул чаще жидкий |
| heavy-flow-day (quiet) | yes | your period is heavy less often | месячные реже обильные | your period is heavy more often | месячные чаще обильные |
| hot-flushes (quiet) | yes | hot flushes bother you less often | приливы реже мешают | hot flushes bother you more often | приливы чаще мешают |
| night-sweats (quiet) | yes | you wake up sweating less often | ты реже просыпаешься в поту | you wake up sweating more often | ты чаще просыпаешься в поту |
| breakout | yes | you get new spots less often | реже появляются новые прыщи | you get new spots more often | чаще появляются новые прыщи |
| dizzy (quiet) | yes | you feel dizzy less often | реже кружится голова | you feel dizzy more often | чаще кружится голова |
| medicine-change (quiet) | yes | your medicines change less often | лекарства реже меняются | your medicines change more often | лекарства чаще меняются |
| jaw-sore-morning | yes | your jaw is sore in the morning less often | утром реже болит челюсть | your jaw is sore in the morning more often | утром чаще болит челюсть |
| pelvic-floor-exercises (quiet) | no | you do your pelvic floor exercises more often | ты чаще делаешь упражнения для тазового дна | you do your pelvic floor exercises less often | ты реже делаешь упражнения для тазового дна |
| pee-burning (quiet) | yes | peeing burns less often | при мочеиспускании реже жжёт | peeing burns more often | при мочеиспускании чаще жжёт |
| bladder-urgency (quiet) | yes | you have to rush to pee less often | реже приходится бежать в туалет | you have to rush to pee more often | чаще приходится бежать в туалет |
| piles-bothered (quiet) | yes | piles bother you less often | геморрой реже беспокоит | piles bother you more often | геморрой чаще беспокоит |
| sweated-a-lot | yes | you sweat heavily less often | ты реже сильно потеешь | you sweat heavily more often | ты чаще сильно потеешь |
| tinnitus-louder (quiet) | yes | the ringing is louder less often | шум в ушах реже сильнее | the ringing is louder more often | шум в ушах чаще сильнее |
| breast-tender | yes | your breasts are sore less often | грудь реже болит | your breasts are sore more often | грудь чаще болит |
| fingers-white-cold (quiet) | yes | your fingers turn white or blue less often | пальцы реже белеют от холода | your fingers turn white or blue more often | пальцы чаще белеют от холода |
| drank-alcohol | yes | you drink alcohol less often | ты реже пьёшь алкоголь | you drink alcohol more often | ты чаще пьёшь алкоголь |
| smoked | yes | you smoke less often | ты реже куришь | you smoke more often | ты чаще куришь |
| smoked-hookah | yes | you smoke hookah less often | реже бывает кальян | you smoke hookah more often | чаще бывает кальян |
| coffee-late | yes | you have coffee after 2 pm less often | ты реже пьёшь кофе после 14:00 | you have coffee after 2 pm more often | ты чаще пьёшь кофе после 14:00 |
| ate-late | yes | you eat late in the evening less often | ты реже поздно ужинаешь | you eat late in the evening more often | ты чаще поздно ужинаешь |
| ate-sweets | yes | you eat more sweets than you want less often | ты реже ешь больше сладкого, чем хочется | you eat more sweets than you want more often | ты чаще ешь больше сладкого, чем хочется |
| screen-time-long | yes | you spend 4+ hours on screens less often | ты реже проводишь в экране больше 4 часов | you spend 4+ hours on screens more often | ты чаще проводишь в экране больше 4 часов |
| ate-fast-food | yes | you eat fast food less often | ты реже ешь фастфуд | you eat fast food more often | ты чаще ешь фастфуд |
| phone-free-morning | no | your first hour is phone-free more often | первый час чаще проходит без телефона | your first hour is phone-free less often | первый час реже проходит без телефона |
| doomscrolled-news | yes | you spend too long on news less often | ты реже залипаешь в новости | you spend too long on news more often | ты чаще залипаешь в новости |
| gaming-streams-2h | yes | you game or watch streams 2+ hours less often | ты реже играешь или смотришь стримы больше 2 часов | you game or watch streams 2+ hours more often | ты чаще играешь или смотришь стримы больше 2 часов |
| impulse-spending | yes | you buy something on impulse less often | ты реже покупаешь что-то спонтанно | you buy something on impulse more often | ты чаще покупаешь что-то спонтанно |
| stayed-on-budget | no | you stay on budget more often | ты чаще укладываешься в бюджет | you stay on budget less often | ты реже укладываешься в бюджет |
| stalked-ex | yes | you check an ex's profile less often | ты реже заходишь на страницу бывших | you check an ex's profile more often | ты чаще заходишь на страницу бывших |
| deleted-message (quiet) | yes | you delete a message before sending less often | ты реже стираешь сообщение, не отправив | you delete a message before sending more often | ты чаще стираешь сообщение, не отправив |
| compared-on-social | yes | you compare yourself online less often | ты реже сравниваешь себя с другими в соцсетях | you compare yourself online more often | ты чаще сравниваешь себя с другими в соцсетях |
| deleted-own-post (quiet) | yes | you delete your own post less often | ты реже удаляешь свой пост | you delete your own post more often | ты чаще удаляешь свой пост |
| rewatched-stories (quiet) | yes | you rewatch someone's stories less often | ты реже пересматриваешь чужие сторис | you rewatch someone's stories more often | ты чаще пересматриваешь чужие сторис |
| screenshotted-chat (quiet) | yes | you screenshot a chat less often | ты реже скриншотишь переписку | you screenshot a chat more often | ты чаще скриншотишь переписку |
| ordered-delivery | yes | you order delivery instead of cooking less often | ты реже заказываешь доставку вместо готовки | you order delivery instead of cooking more often | ты чаще заказываешь доставку вместо готовки |
| wore-same-shirt (quiet) | yes | you wear the same clothes again less often | ты реже носишь ту же одежду второй день | you wear the same clothes again more often | ты чаще носишь ту же одежду второй день |
| looped-one-song (quiet) | yes | you play one song on repeat less often | одна песня реже играет по кругу | you play one song on repeat more often | одна песня чаще играет по кругу |
| ate-by-fridge (quiet) | yes | you eat standing by the fridge less often | ты реже ешь стоя у холодильника | you eat standing by the fridge more often | ты чаще ешь стоя у холодильника |
| skipped-cleaning (quiet) | yes | you put off cleaning less often | ты реже откладываешь уборку | you put off cleaning more often | ты чаще откладываешь уборку |
| bought-on-sale (quiet) | yes | you buy something unneeded on sale less often | ты реже покупаешь ненужное на распродаже | you buy something unneeded on sale more often | ты чаще покупаешь ненужное на распродаже |
| paid-to-skip-effort (quiet) | yes | you pay to skip the effort less often | ты реже платишь, чтобы не делать что-то своими руками | you pay to skip the effort more often | ты чаще платишь, чтобы не делать что-то своими руками |
| cooked-myself | no | you cook at home more often | ты чаще готовишь дома | you cook at home less often | ты реже готовишь дома |
| screens-before-bed | yes | you're on a screen before bed less often | ты реже сидишь в телефоне перед сном | you're on a screen before bed more often | ты чаще сидишь в телефоне перед сном |
| walked-a-lot | no | you walk 7,000+ steps more often | ты чаще проходишь 7000+ шагов | you walk 7,000+ steps less often | ты реже проходишь 7000+ шагов |
| ate-vegetables | no | you eat vegetables or fruit more often | ты чаще ешь овощи или фрукты | you eat vegetables or fruit less often | ты реже ешь овощи или фрукты |
| alcohol-3-plus | yes | you have 3+ drinks less often | ты реже выпиваешь 3+ порции | you have 3+ drinks more often | ты чаще выпиваешь 3+ порции |
| caffeine-4-plus | yes | you have 4+ coffees less often | ты реже пьёшь 4+ чашки кофе | you have 4+ coffees more often | ты чаще пьёшь 4+ чашки кофе |
| less-caffeine-than-usual (quiet) | yes | you have much less coffee than usual less often | кофе реже гораздо меньше обычного | you have much less coffee than usual more often | кофе чаще гораздо меньше обычного |
| social-media-hour | yes | you spend over an hour on social media less often | ты реже сидишь в соцсетях больше часа | you spend over an hour on social media more often | ты чаще сидишь в соцсетях больше часа |
| felt-happy | no | you feel happy more often | тебе чаще радостно | you feel happy less often | тебе реже радостно |
| felt-anxious | yes | you feel anxious less often | реже бывает тревога | you feel anxious more often | чаще бывает тревога |
| felt-depressed | yes | you feel low less often | тебе реже тяжело и пусто | you feel low more often | тебе чаще тяжело и пусто |
| felt-angry | yes | you feel angry less often | ты реже злишься | you feel angry more often | ты чаще злишься |
| felt-lonely | yes | you feel lonely less often | тебе реже одиноко | you feel lonely more often | тебе чаще одиноко |
| had-energy | no | you have energy more often | энергии чаще хватает | you have energy less often | энергии реже хватает |
| cried-today | yes | you cry less often | ты реже плачешь | you cry more often | ты чаще плачешь |
| burned-out-after-work | yes | you feel burned out after work less often | после работы реже не остаётся сил | you feel burned out after work more often | после работы чаще не остаётся сил |
| didnt-want-to-work | yes | you don't want to go to work less often | реже не хочется идти на работу | you don't want to go to work more often | чаще не хочется идти на работу |
| worked-overtime | yes | you work overtime less often | ты реже перерабатываешь | you work overtime more often | ты чаще перерабатываешь |
| felt-fulfilled-at-work | no | work gives you energy more often | работа чаще даёт энергию | work gives you energy less often | работа реже даёт энергию |
| main-thing-done | no | you get the main thing done more often | ты чаще делаешь главное за день | you get the main thing done less often | ты реже делаешь главное за день |
| focus-hour | no | you get an hour of focused work more often | чаще бывает час без отвлечений | you get an hour of focused work less often | реже бывает час без отвлечений |
| kept-morning-promise | no | you do what you promised yourself in the morning more often | ты чаще делаешь то, что обещаешь себе утром | you do what you promised yourself in the morning less often | ты реже делаешь то, что обещаешь себе утром |
| procrastinated | yes | you procrastinate less often | ты реже откладываешь дела | you procrastinate more often | ты чаще откладываешь дела |
| no-snooze | no | you get up on the first alarm more often | ты чаще встаёшь с первого будильника | you get up on the first alarm less often | ты реже встаёшь с первого будильника |
| felt-proud-today | no | you feel proud of the day more often | ты чаще гордишься днём | you feel proud of the day less often | ты реже гордишься днём |
| felt-useless | yes | you feel you did nothing useful less often | реже кажется, что день прошёл зря | you feel you did nothing useful more often | чаще кажется, что день прошёл зря |
| snapped-at-loved-ones | yes | you snap at someone close less often | ты реже срываешься на близких | you snap at someone close more often | ты чаще срываешься на близких |
| calm-day | no | nothing irritates you more often | день чаще проходит без раздражения | nothing irritates you less often | день реже проходит без раздражения |
| felt-calm | no | you feel calm more often | тебе чаще спокойно | you feel calm less often | тебе реже спокойно |
| time-for-myself | no | you have time for yourself more often | у тебя чаще есть время для себя | you have time for yourself less often | у тебя реже есть время для себя |
| isolated-at-home | yes | you stay home alone all day less often | ты реже весь день дома без людей | you stay home alone all day more often | ты чаще весь день дома без людей |
| said-yes-when-meant-no | yes | you agree to something you don't really want less often | ты реже соглашаешься на то, чего не хочешь | you agree to something you don't really want more often | ты чаще соглашаешься на то, чего не хочешь |
| cried-from-something-small (quiet) | yes | you cry over something small less often | ты реже плачешь от мелочей | you cry over something small more often | ты чаще плачешь от мелочей |
| laughed-uncontrollably | no | you laugh more often | ты чаще смеёшься | you laugh less often | ты реже смеёшься |
| envied-on-social | yes | you feel envy online less often | ты реже завидуешь чужой жизни в соцсетях | you feel envy online more often | ты чаще завидуешь чужой жизни в соцсетях |
| felt-not-like-others | yes | you feel left behind less often | реже кажется, что ты «не как все» | you feel left behind more often | чаще кажется, что ты «не как все» |
| danced-or-sang-alone (quiet) | no | you dance or sing alone more often | ты чаще танцуешь или поёшь | you dance or sing alone less often | ты реже танцуешь или поёшь |
| petted-an-animal | no | you pet a cat or dog more often | ты чаще гладишь котика или собаку | you pet a cat or dog less often | ты реже гладишь котика или собаку |
| liked-my-selfie (quiet) | no | you like yourself in a photo more often | ты чаще нравишься себе на фото | you like yourself in a photo less often | ты реже нравишься себе на фото |
| talked-to-pet (quiet) | no | you talk to a pet or plant more often | ты чаще разговариваешь с питомцем или растением | you talk to a pet or plant less often | ты реже разговариваешь с питомцем или растением |
| in-flow | no | you are in flow more often | чаще бывает состояние потока | you are in flow less often | реже бывает состояние потока |
| boss-was-difficult | yes | your boss puts pressure on you less often | босс реже давит или неприятен | your boss puts pressure on you more often | босс чаще давит или неприятен |
| conflict-with-colleague | yes | you clash with a colleague less often | реже бывает конфликт с коллегой | you clash with a colleague more often | чаще бывает конфликт с коллегой |
| drained-by-someone | yes | someone drains you less often | тебя реже кто-то выматывает | someone drains you more often | тебя чаще кто-то выматывает |
| got-recognition | no | you get praise more often | тебя чаще хвалят | you get praise less often | тебя реже хвалят |
| heard-bad-news | yes | you hear bad news less often | реже приходят плохие новости | you hear bad news more often | чаще приходят плохие новости |
| home-was-tidy | no | home is tidy more often | дома чаще порядок | home is tidy less often | дома реже порядок |
| felt-stressed | yes | you feel stressed less often | реже бывает стресс | you feel stressed more often | чаще бывает стресс |
| meditated | no | you meditate more often | ты чаще медитируешь | you meditate less often | ты реже медитируешь |
| felt-grateful | no | you notice something good more often | ты чаще замечаешь хорошее | you notice something good less often | ты реже замечаешь хорошее |
| lost-interest | yes | you lose interest in things less often | тебе реже ничего не интересно | you lose interest in things more often | тебе чаще ничего не интересно |
| panic-attack | yes | you have a panic attack less often | реже бывает паническая атака | you have a panic attack more often | чаще бывает паническая атака |
| many-interruptions | yes | you get interrupted all day less often | тебя реже отвлекают весь день | you get interrupted all day more often | тебя чаще отвлекают весь день |
| deep-conversation | no | you have a real conversation more often | у тебя чаще бывает разговор по душам | you have a real conversation less often | у тебя реже бывает разговор по душам |
| money-worry | yes | money worries you less often | деньги реже тревожат | money worries you more often | деньги чаще тревожат |
| wanted-child | yes | you want a child less often | реже хочется ребёнка | you want a child more often | чаще хочется ребёнка |
| thought-about-emigrating | yes | you think about moving abroad less often | ты реже думаешь уехать | you think about moving abroad more often | ты чаще думаешь уехать |
| wanted-leave-job | yes | you want to quit less often | реже хочется уволиться | you want to quit more often | чаще хочется уволиться |
| thought-divorce | yes | you think about divorce less often | ты реже думаешь о разводе | you think about divorce more often | ты чаще думаешь о разводе |
| wanted-life-change | yes | you want to change everything less often | реже хочется всё поменять | you want to change everything more often | чаще хочется всё поменять |
| wanted-pet | yes | you want a pet less often | реже хочется завести питомца | you want a pet more often | чаще хочется завести питомца |
| wanted-learn-new (quiet) | yes | you want to learn something new less often | реже хочется учиться новому | you want to learn something new more often | чаще хочется учиться новому |
| thought-career-change | yes | you think about a career change less often | ты реже думаешь сменить профессию | you think about a career change more often | ты чаще думаешь сменить профессию |
| studied-language | no | you practice a language more often | ты чаще занимаешься языком | you practice a language less often | ты реже занимаешься языком |
| watched-course-lecture (quiet) | no | you watch a course lecture more often | ты чаще смотришь лекцию курса | you watch a course lecture less often | ты реже смотришь лекцию курса |
| did-creative-work | no | you do something creative more often | ты чаще занимаешься творчеством | you do something creative less often | ты реже занимаешься творчеством |
| learned-something-new | no | you learn something new more often | ты чаще узнаёшь что-то новое | you learn something new less often | ты реже узнаёшь что-то новое |
| practiced-skill | no | you practice a skill more often | ты чаще тренируешь навык | you practice a skill less often | ты реже тренируешь навык |
| listened-podcast | no | you listen to something educational more often | ты чаще слушаешь что-то познавательное | you listen to something educational less often | ты реже слушаешь что-то познавательное |
| read-book | no | you read a book more often | ты чаще читаешь книгу | you read a book less often | ты реже читаешь книгу |
| hobby-time | no | you spend time on a hobby more often | ты чаще занимаешься хобби | you spend time on a hobby less often | ты реже занимаешься хобби |
| noisy-neighbors | yes | the neighbors are noisy less often | соседи реже шумят | the neighbors are noisy more often | соседи чаще шумят |
| construction-nearby | yes | there's construction or renovation noise less often | реже шумит стройка или ремонт | there's construction or renovation noise more often | чаще шумит стройка или ремонт |
| long-commute | yes | your commute takes longer than usual less often | дорога реже занимает больше обычного | your commute takes longer than usual more often | дорога чаще занимает больше обычного |
| transport-issue | yes | transport lets you down less often | транспорт реже подводит | transport lets you down more often | транспорт чаще подводит |
| internet-down | yes | the internet or connection acts up less often | реже барахлит интернет или связь | the internet or connection acts up more often | чаще барахлит интернет или связь |
| criticized-by-close | yes | someone close criticizes or hurts you less often | кто-то близкий реже критикует или задевает | someone close criticizes or hurts you more often | кто-то близкий чаще критикует или задевает |
| parent-pressured | yes | a parent pressures or hurts you less often | родитель реже давит или обижает | a parent pressures or hurts you more often | родитель чаще давит или обижает |
| toxic-friend | yes | a friend drains you less often | реже бывает токсичное общение с другом | a friend drains you more often | чаще бывает токсичное общение с другом |
| kids-reached-out | no | the kids call or write more often | дети чаще пишут или звонят | the kids call or write less often | дети реже пишут или звонят |
| financial-issue | yes | there are unexpected bills less often | реже бывают неожиданные траты | there are unexpected bills more often | чаще бывают неожиданные траты |
| travel-or-night-away | yes | you are away from home less often | ты реже не дома | you are away from home more often | ты чаще не дома |
| hot-day | yes | it is hot less often | реже жарко | it is hot more often | чаще жарко |
| weather-change | yes | the weather changes sharply less often | погода реже резко меняется | the weather changes sharply more often | погода чаще резко меняется |
| spoke-local-language | no | you speak to locals in their language more often | ты чаще говоришь с местными на их языке | you speak to locals in their language less often | ты реже говоришь с местными на их языке |
| studied-local-language | no | you study the local language more often | ты чаще учишь местный язык | you study the local language less often | ты реже учишь местный язык |
| didnt-understand-locals | yes | you can't follow the locals less often | ты реже не понимаешь, что говорят вокруг | you can't follow the locals more often | ты чаще не понимаешь, что говорят вокруг |
| couldnt-express-self | yes | the language barrier gets in the way less often | языковой барьер реже мешает | the language barrier gets in the way more often | языковой барьер чаще мешает |
| language-progress | no | you feel progress in the language more often | ты чаще чувствуешь прогресс в языке | you feel progress in the language less often | ты реже чувствуешь прогресс в языке |
| missed-home-country | yes | you miss home less often | ты реже скучаешь по дому | you miss home more often | ты чаще скучаешь по дому |
| called-someone-back-home | no | you call someone back home more often | ты чаще звонишь или пишешь домой | you call someone back home less often | ты реже звонишь или пишешь домой |
| missed-familiar-food | yes | you miss food from home less often | ты реже скучаешь по родной еде | you miss food from home more often | ты чаще скучаешь по родной еде |
| missed-familiar-weather (quiet) | yes | you miss the weather back home less often | ты реже скучаешь по своей погоде | you miss the weather back home more often | ты чаще скучаешь по своей погоде |
| felt-foreigner | yes | you feel out of place here less often | ты реже чувствуешь себя здесь не на своём месте | you feel out of place here more often | ты чаще чувствуешь себя здесь не на своём месте |
| felt-settled-in | no | you feel settled in here more often | ты чаще чувствуешь себя здесь как дома | you feel settled in here less often | ты реже чувствуешь себя здесь как дома |
| locals-were-warm | no | you have a nice moment with a local more often | чаще бывает приятный контакт с местными | you have a nice moment with a local less often | реже бывает приятный контакт с местными |
| talked-to-fellow-expats | no | you talk to fellow expats more often | ты чаще общаешься с земляками | you talk to fellow expats less often | ты реже общаешься с земляками |
| dealt-with-paperwork | yes | you deal with documents or a visa less often | ты реже занимаешься документами или визой | you deal with documents or a visa more often | ты чаще занимаешься документами или визой |
| local-institution-contact (quiet) | yes | you go to a bank, doctor or office less often | ты реже ходишь в банк, к врачу или в госконтору | you go to a bank, doctor or office more often | ты чаще ходишь в банк, к врачу или в госконтору |
| climate-drained-me | yes | the weather or climate drains you less often | климат реже выматывает | the weather or climate drains you more often | климат чаще выматывает |
| tried-local-food (quiet) | no | you eat local food more often | ты чаще ешь местную еду | you eat local food less often | ты реже ешь местную еду |
| thought-about-going-back | yes | you think about going back less often | ты реже думаешь вернуться | you think about going back more often | ты чаще думаешь вернуться |
| thought-third-country (quiet) | yes | you think about another country less often | ты реже думаешь о другой стране | you think about another country more often | ты чаще думаешь о другой стране |
| happy-with-the-move | no | you feel glad about the move more often | ты чаще радуешься переезду | you feel glad about the move less often | ты реже радуешься переезду |
| pet-limped | yes | your pet limps less often | питомец реже хромает | your pet limps more often | питомец чаще хромает |
| pet-skipped-food | yes | your pet eats less than usual less often | питомец реже ест меньше обычного | your pet eats less than usual more often | питомец чаще ест меньше обычного |
| pet-low-energy | yes | your pet is sluggish less often | питомец реже вялый | your pet is sluggish more often | питомец чаще вялый |
| pet-restless-night | yes | your pet is restless at night less often | питомец реже беспокоится ночью | your pet is restless at night more often | питомец чаще беспокоится ночью |
| pet-stomach-upset | yes | your pet has an upset stomach less often | у питомца реже бывает рвота или понос | your pet has an upset stomach more often | у питомца чаще бывает рвота или понос |
| pet-anxious | yes | your pet seems anxious less often | питомец реже тревожится | your pet seems anxious more often | питомец чаще тревожится |
| pet-playful | no | your pet is playful more often | питомец чаще играет | your pet is playful less often | питомец реже играет |
| parent-confused | yes | your parent gets confused less often | родитель реже путается | your parent gets confused more often | родитель чаще путается |
| parent-skipped-meal | yes | your parent skips a meal less often | родитель реже пропускает еду | your parent skips a meal more often | родитель чаще пропускает еду |
| parent-slept-poorly | yes | your parent sleeps poorly less often | родитель реже плохо спит | your parent sleeps poorly more often | родитель чаще плохо спит |
| parent-stumbled | yes | your parent stumbles or falls less often | родитель реже спотыкается или падает | your parent stumbles or falls more often | родитель чаще спотыкается или падает |
| parent-took-meds | no | your parent takes their meds more often | родитель чаще принимает лекарства | your parent takes their meds less often | родитель реже принимает лекарства |
| parent-pain | yes | your parent complains of pain less often | родитель реже жалуется на боль | your parent complains of pain more often | родитель чаще жалуется на боль |
| parent-good-mood | no | your parent is in a good mood more often | у родителя чаще хорошее настроение | your parent is in a good mood less often | у родителя реже хорошее настроение |
| child-meltdown | yes | your child has a meltdown less often | у ребёнка реже бывает истерика | your child has a meltdown more often | у ребёнка чаще бывает истерика |
| child-slept-poorly | yes | your child sleeps poorly less often | ребёнок реже плохо спит | your child sleeps poorly more often | ребёнок чаще плохо спит |
| child-refused-food | yes | your child refuses food less often | ребёнок реже отказывается от еды | your child refuses food more often | ребёнок чаще отказывается от еды |
| child-too-much-screen | yes | your child has lots of screen time less often | ребёнок реже засиживается в экранах | your child has lots of screen time more often | ребёнок чаще засиживается в экранах |
| child-physical-activity | no | your child moves a lot more often | ребёнок чаще много двигается | your child moves a lot less often | ребёнок реже много двигается |
| child-bright-moment | no | you and your child share a bright moment more often | у вас с ребёнком чаще бывает светлый момент | you and your child share a bright moment less often | у вас с ребёнком реже бывает светлый момент |
| child-sick-symptoms | yes | your child has sick symptoms less often | у ребёнка реже симптомы болезни | your child has sick symptoms more often | у ребёнка чаще симптомы болезни |
| bedtime-battle | yes | bedtime is a struggle less often | отбой реже даётся тяжело | bedtime is a struggle more often | отбой чаще даётся тяжело |
