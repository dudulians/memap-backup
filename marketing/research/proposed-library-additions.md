# Proposed library additions (Nov 7 2026)

33 new yes/no questions, highest value first. After them: rewording and splits of existing questions, and door context swaps.

**Ranking.** By app frequency + strength of evidence + whether the question unlocks a real "when to act" rule. See `tracking-apps-and-gaps.md` §5, `triggers-and-links-evidence.md`, `when-to-act.md`. Numbers in brackets point to `sources.md`.

**Ids.** All checked against the 188 ids in `src/lib/lifeStreams.ts`: no collisions.

**Rules.**
- A rule counts hard-answer days in `periodDays`, and lights at `threshold` (`lighthouses.ts`).
- **0 = marker**: no action point. The answer is context for links (period day, travel, weather).
  - Markers have no hard answer. We suggest showing them in a neutral colour, like the wishes/decisions indigo, not rose red.
  - `problemWhen` is set to "yes" for them only because the field needs a value.
- *(design)* = not a clinical number.

**Russian.**
- Titles, questions and phrases have no gendered forms.
- Questions are impersonal or present tense ("болеешь", "пришлось").
- Advice is in the infinitive, as in the current library.

**Don't switch them all on.** Too many questions is the most common complaint about other apps [232, 266]. These belong in the library and in door context sets, not in everyone's default list.

---

## Table 1. The questions

| # | id | area | title | titleRu | questionText | questionTextRu |
|---|---|---|---|---|---|---|
| 1 | `period-day` | health | Period day | День месячных | Did you have your period today (any bleeding)? | Сегодня были месячные (хоть немного)? |
| 2 | `took-painkiller` | health | Painkiller for headache | Обезболивающее от головы | Did you take a painkiller or migraine pill for a headache today? | Сегодня пришлось пить обезболивающее или таблетку от мигрени? |
| 3 | `slow-to-fall-asleep` | health | Took 30+ min to fall asleep | Засыпание дольше 30 минут | Did it take you more than 30 minutes to fall asleep last night? | Этой ночью долго не получалось уснуть — больше 30 минут? |
| 4 | `sick-day` | health | Felt ill (cold, fever, infection) | Болезнь (простуда, температура) | Did you feel ill today — a cold, fever, flu or another infection? | Сегодня болеешь — простуда, температура, грипп или другая инфекция? |
| 5 | `alcohol-3-plus` | habits | 3+ alcoholic drinks | 3+ порции алкоголя | Did you have 3 or more alcoholic drinks today (each = a glass of wine, a beer or a shot)? | Сегодня было 3+ порции алкоголя (порция — бокал вина, бутылка пива или рюмка)? |
| 6 | `caffeine-4-plus` | habits | 4+ coffees or energy drinks | 4+ чашки кофе | Did you have 4 or more coffees, strong teas or energy drinks today? | Сегодня было 4+ чашки кофе, крепкого чая или энергетика? |
| 7 | `lost-interest` | state | Nothing felt interesting | Ничего не радовало | Did you lose interest or pleasure in things you usually enjoy, for most of the day? | Почти весь день не было интереса и радости даже от того, что обычно нравится? |
| 8 | `pms-signs` | health | PMS signs | Признаки ПМС | Did you have PMS signs today — irritability, tearfulness, low mood, bloating, sore breasts? | Сегодня есть признаки ПМС — раздражительность, плаксивость, плохое настроение, вздутие, болит грудь? |
| 9 | `headache-stopped-me` | health | Headache stopped my plans | Голова помешала делам | Did a headache stop you from doing normal things today — work, study, plans, chores? | Сегодня головная боль помешала обычным делам — работе, учёбе, планам, дому? |
| 10 | `same-wake-time` | health | Up at the same time | Подъём в одно и то же время | Did you get up within an hour of your usual time (weekends too)? | Подъём сегодня был в пределах часа от обычного (в выходные тоже)? |
| 11 | `racing-thoughts-in-bed` | health | Racing thoughts in bed | Мысли не давали уснуть | Did worries or racing thoughts keep you awake in bed last night? | Этой ночью в кровати крутились мысли и тревоги и мешали уснуть? |
| 12 | `less-caffeine-than-usual` | habits | Much less coffee than usual | Кофе гораздо меньше обычного | Did you have much less caffeine than usual today, or none? | Сегодня кофеина было гораздо меньше обычного или не было совсем? |
| 13 | `neck-pain` | health | Neck pain or stiffness | Болит или затекает шея | Did your neck hurt or feel stiff today? | Сегодня болела или затекала шея? |
| 14 | `got-help-with-kids` | parenting | Got help with the kids | Помощь с детьми | Did someone share the childcare with you today — partner, family, a sitter, a friend? | Сегодня кто-то разделил заботу о детях — партнёр, родные, няня, друзья? |
| 15 | `skipped-meal` | health | Skipped a meal | Пропущенный приём пищи | Did you skip a meal or go 5+ waking hours without food? | Сегодня был пропущенный приём пищи или 5+ часов без еды (не во сне)? |
| 16 | `panic-attack` | state | Panic attack | Паническая атака | Did you have a panic attack today — a sudden wave of fear with a racing heart or short breath? | Сегодня была паническая атака — внезапная волна страха, сердце колотится, не хватает воздуха? |
| 17 | `woke-too-early` | health | Woke too early | Слишком раннее пробуждение | Did you wake up much earlier than planned and not get back to sleep? | Сегодня сон оборвался сильно раньше будильника, и уснуть снова не получилось? |
| 18 | `travel-or-night-away` | external-events | Travel or a night away | Поездка или ночь не дома | Did you travel today or sleep away from your own bed? | Сегодня была поездка или ночь не в своей кровати? |
| 19 | `sleep-aid` | health | Took something to sleep | Средство для сна | Did you take a sleeping pill, melatonin or another sleep aid last night? | Этой ночью было снотворное, мелатонин или другое средство для сна? |
| 20 | `snored-or-gasped` | health | Snoring or gasping in sleep | Храп или удушье во сне | Did you (or someone near you) notice loud snoring, gasping or choking in your sleep? | Во сне был громкий храп или будто перехватывало дыхание (по словам близких или по записи)? |
| 21 | `hot-day` | external-events | Very hot or stuffy day | Жара или духота | Did the heat or stuffiness get to you today? | Сегодня донимала жара или духота? |
| 22 | `weather-change` | external-events | Sharp weather change | Резкая смена погоды | Did you notice a sharp weather change today — a storm, sudden cold or heat, a pressure drop? | Сегодня резко менялась погода — гроза, похолодание, жара, перепад давления? |
| 23 | `phones-together` | partner | Phones got in the way | Телефоны мешали побыть вдвоём | Did phones get in the way of your time together today? | Сегодня телефоны мешали побыть вдвоём? |
| 24 | `bedtime-battle` | child-wellbeing | Bedtime was a struggle | Тяжёлый отбой | Did your child's bedtime turn into a struggle or run late? | Отбой ребёнка сегодня затянулся или превратился в борьбу? |
| 25 | `unfair-chores` | partner | Carried more than my share | Домашние дела — неравно | Did you feel you carried more than your fair share of home tasks today? | Сегодня казалось, что домашних дел на тебе больше, чем справедливо? |
| 26 | `many-interruptions` | state | Constant interruptions | Постоянно отвлекали | Did constant interruptions, messages or meetings break up your day? | Сегодня день рвали постоянные сообщения, звонки или встречи? |
| 27 | `social-media-hour` | habits | 1+ hour on social media | Соцсети больше часа | Did you spend more than an hour on social media today? | Сегодня в соцсетях больше часа? |
| 28 | `deep-conversation` | state | Had a real conversation | Разговор по душам | Did you have a real, open conversation with someone today (not small talk)? | Сегодня был настоящий, открытый разговор с кем-то (не просто болтовня)? |
| 29 | `time-in-nature` | health | Time in nature | Время на природе | Did you spend time in a park, by water or among trees today? | Сегодня было время в парке, у воды или среди деревьев? |
| 30 | `money-worry` | state | Money worries | Тревога о деньгах | Did money worries take up your thoughts today? | Сегодня мысли занимали тревоги о деньгах? |
| 31 | `early-migraine-signs` | health | Early migraine signs | Предвестники мигрени | Did you notice your usual early migraine signs today — yawning, a stiff neck, cravings, odd tiredness? | Сегодня были привычные предвестники мигрени — зевота, скованная шея, тяга к еде, странная усталость? |
| 32 | `pill-free-day` | health | Pill-free day of the pack | Перерыв в таблетках | Did you have a pill-free or placebo day of your birth-control pack today? | Сегодня день перерыва или пустышки в упаковке противозачаточных? |
| 33 | `strength-training` | health | Strength training | Силовая тренировка | Did you do strength exercises today — weights, bands or bodyweight? | Сегодня были силовые упражнения — с весами, резинками или с весом своего тела? |

## Table 2. Rule, advice, why

| # | id | problemWhen | periodDays / threshold | advice | adviceRu | why [sources] |
|---|---|---|---|---|---|---|
| 1 | `period-day` | yes (marker) | 30 / 0 | — | — | Biggest single migraine factor in diaries (OR about 2 around day 1). Needed to read PMS/PMDD timing. Tracked by 8 apps. [55, 66, 67, 25] |
| 2 | `took-painkiller` | yes | 30 / 9 | Show my painkiller days to a doctor | Показать врачу, сколько дней были обезболивающие | Overuse headache is defined by painkiller days (≥10 or ≥15 a month). Keep to about 2 a week. [2, 4, 6] |
| 3 | `slow-to-fall-asleep` | yes | 7 / 3 | Get up after 20 minutes awake, go back when sleepy | Если 20 минут не спится — встать и вернуться, когда начнёт клонить в сон | Insomnia = 3 nights a week; ≥31 min is the research rule; a core sleep-diary item. [11, 12, 113, 14] |
| 4 | `sick-day` | yes | 30 / 10 *(design)* | See a doctor if it keeps coming back | Сходить к врачу, если болезнь не отпускает | Explains tired, sleepless, low days, so other answers aren't blamed. 12% are still fatigued 6 months after an infection. Oura, Clue, Visible track it. [134, 245] |
| 5 | `alcohol-3-plus` | yes | 30 / 4 | Decide the drink limit before the evening | Решить лимит порций до начала вечера | Sleep, next-day mood and couple aggression get worse with dose. Canada: no more than 2 on any day. [93, 137, 187, 32] |
| 6 | `caffeine-4-plus` | yes | 30 / 8 | Swap one coffee a day for decaf for 2 weeks | Две недели менять одну чашку в день на кофе без кофеина | About 400 mg = EFSA's daily ceiling; anxiety rises mainly above it. 9 apps track the amount. [37, 170, 171] |
| 7 | `lost-interest` | yes | 14 / 8 | Plan one small thing that used to bring joy, every day | Каждый день планировать одно маленькое дело, которое раньше радовало | One of the two core signs of depression (DSM-5, PHQ-2); we only ask about low mood. Behavioural activation is first-line. At 12/14, suggest a professional. [17, 19, 20, 47] |
| 8 | `pms-signs` | yes | 60 / 10 *(proxy)* | Show 2 cycles of answers to a gynaecologist | Показать гинекологу ответы за 2 цикла | PMDD needs daily ratings over 2 cycles. Premenstrual low mood is not universal, so the personal pattern is the value. [25, 122, 123] |
| 9 | `headache-stopped-me` | yes | 30 / 3 | Ask a neurologist about migraine prevention | Спросить невролога про профилактику мигрени | Prevention depends on headache days *and* how much they disrupt life. [3] |
| 10 | `same-wake-time` | no | 14 / 5 *(design)* | Keep one wake-up time for 2 weeks, weekends too | Две недели вставать в одно время, в выходные тоже | A fixed wake time is part of CBT-I. Irregular sleep goes with low mood and insomnia. [14, 107] |
| 11 | `racing-thoughts-in-bed` | yes | 14 / 6 *(design)* | Write tomorrow's worries on paper an hour before bed | За час до сна выписать на бумагу завтрашние заботы | Bedtime worry was the main predictor of a poor night over 42 nights. Evidence for the action itself is weak. [100, 101, 48] |
| 12 | `less-caffeine-than-usual` | yes | 30 / 6 | Keep coffee the same every day, weekends too | Пить кофе одинаково каждый день, в выходные тоже | Withdrawal headache in about 50%, 12–24 h later, even from 100 mg a day. Explains "weekend headaches". [72, 8] |
| 13 | `neck-pain` | yes | 30 / 10 | Book a physiotherapist with my data | Записаться к физиотерапевту с данными | Top factor in Migraine Buddy data. OR 1.94 on bad migraine days. Often an early sign of an attack. [88, 62, 84] |
| 14 | `got-help-with-kids` | no | 30 / 20 | Ask for one fixed hour of help each week | Договориться об одном постоянном часе помощи в неделю | Low support is among the strongest predictors of parental burnout (35,170 parents). [208, 197] |
| 15 | `skipped-meal` | yes | 30 / 8 | Keep a snack with me | Носить с собой перекус | 57% of people with migraine name it; a fasting trial was inconclusive, so weak–moderate. Also covers fasting days, e.g. Ramadan. [56, 65] |
| 16 | `panic-attack` | yes | 30 / 4 *(design)* | Book a therapist who treats panic with CBT | Записаться к психотерапевту, который лечит панику методом КПТ | High caffeine and sleep loss raise anxiety. NICE recommends CBT for panic. [171, 111, 24] |
| 17 | `woke-too-early` | yes | 7 / 3 | Keep the wake-up time fixed and skip naps for a week | Неделю вставать в одно время и не спать днём | Early waking is one of the three insomnia complaints; a sleep-diary item. [11, 113] |
| 18 | `travel-or-night-away` | yes (marker) | 30 / 0 | — | — | Travel and a strange bed change sleep and routine. Marking them stops false links. Oura has a "travel" tag. [245] |
| 19 | `sleep-aid` | yes | 30 / 10 *(design)* | Ask a doctor about CBT for insomnia | Спросить врача про КПТ бессонницы | Guidelines put CBT-I before pills. A sleep aid changes the night, so links need it as context. [14, 15, 113] |
| 20 | `snored-or-gasped` | yes | 30 / 4 *(design)* | Ask a doctor to check for sleep apnoea | Попросить врача проверить на апноэ сна | NHS: gasping or choking in sleep is a reason to see a GP about tiredness. [43] |
| 21 | `hot-day` | yes (marker) | 30 / 0 | — | — | Heat linked to migraine in 6 of 12 studies. Mild dehydration raises fatigue and headache. Today only expats are asked about climate. [74, 79, 132] |
| 22 | `weather-change` | yes (marker) | 30 / 0 | — | — | Most-wanted factor (4 users, 5 apps), but the evidence is weak: only some people react. Better filled from a weather service than asked. [76, 78] |
| 23 | `phones-together` | yes | 30 / 10 | Agree on one phone-free meal a day | Договориться об одной еде в день без телефонов | Partner phone use goes with lower satisfaction and more conflict (52 studies, mostly cross-sectional). [192] |
| 24 | `bedtime-battle` | yes | 30 / 10 | Start the bedtime routine 20 minutes earlier | Начинать вечерний ритуал на 20 минут раньше | Late or broken child sleep → tantrums and parent stress the next day. [203, 204] |
| 25 | `unfair-chores` | yes | 30 / 10 | Write the week's home tasks together | Вместе расписать домашние дела на неделю | Feeling it is unfair matters more than the split; appreciation cancels it. [196, 197] |
| 26 | `many-interruptions` | yes | 30 / 12 | Block one hour a day with notifications off | Ставить в день один час без уведомлений | Interrupted work → more stress and effort. A year-long self-log named meetings a top mood factor. [217, 256] |
| 27 | `social-media-hour` | yes | 30 / 15 | Try 30 minutes a day for 2 weeks | Две недели — не больше 30 минут в день | Cutting down gave a small drop in low mood. Effects differ by person, so a personal test fits. [157, 160, 156] |
| 28 | `deep-conversation` | no | 30 / 20 | Call one person for a real talk this week | На этой неделе позвонить одному человеку и поговорить по душам | Depth of conversation and in-person contact go with well-being and less loneliness. [151, 152] |
| 29 | `time-in-nature` | no | 14 / 12 *(design)* | Plan two nature walks this week | Запланировать на неделе две прогулки на природе | Nature linked to better mood, now and later (EMA). "120 min a week" is an association, not a dose. [155, 154] |
| 30 | `money-worry` | yes | 30 / 10 | Write this month's money in and out on one page | Расписать на одной странице доходы и траты месяца | Money fights recur and stay unresolved. 3 self-trackers logged money stress. We track only money events. [195, 261, 258] |
| 31 | `early-migraine-signs` | yes (marker) | 30 / 0 | — | — | 29–66% have warning signs. Cravings and tiredness then look like triggers. Lets the engine say "early sign", not "cause". [83, 84, 85] |
| 32 | `pill-free-day` | yes (marker) | 30 / 0 | — | — | Migraine is 4× more common on pill-free days 3–6 of the combined pill. [70] |
| 33 | `strength-training` | no | 30 / 23 *(design: lights below about 2 a week when most days are answered)* | Put 2 strength sessions in the calendar this week | Внести в календарь 2 силовые тренировки на эту неделю | WHO: strength on ≥2 days a week. Strength training lowered depressive symptoms in trials. [38, 148] |

## Table 3. Phrases (format of `answerPhrases.ts` and `answerSentences.ts`)

- **Labels** are lowercase noun phrases.
- **Clauses** are present tense, second person. "~" marks where the frequency word goes.
- **"cause|result"** where the two read better apart.
- **RU** has no gendered forms. "Здоров", "один/одна" and similar were avoided on purpose.

| # | id | label yes / no (EN) | label yes / no (RU) | clause yes / no (EN) | clause yes / no (RU) |
|---|---|---|---|---|---|
| 1 | `period-day` | period day / no period | месячные / без месячных | you ~have your period / you ~don't have your period | у тебя ~месячные / месячных ~нет |
| 2 | `took-painkiller` | painkiller day / no painkillers | обезболивающее / без обезболивающих | you ~take a painkiller / you ~take no painkillers | ты ~пьёшь обезболивающее / ты ~обходишься без обезболивающих |
| 3 | `slow-to-fall-asleep` | slow to fall asleep / quick to fall asleep | долгое засыпание / быстрое засыпание | you ~take over 30 minutes to fall asleep / you ~fall asleep within 30 minutes | ты ~засыпаешь дольше 30 минут / ты ~засыпаешь быстро |
| 4 | `sick-day` | sick day / healthy day | болезнь / без болезни | you ~are ill / you ~are well | ты ~болеешь / болезни ~нет |
| 5 | `alcohol-3-plus` | 3+ drinks / under 3 drinks | 3+ порции алкоголя / меньше 3 порций | you ~have 3+ drinks / you ~stay under 3 drinks | ты ~выпиваешь 3+ порции / ты ~пьёшь меньше 3 порций |
| 6 | `caffeine-4-plus` | 4+ coffees / under 4 coffees | 4+ чашки кофе / меньше 4 чашек | you ~have 4+ coffees / you ~have fewer than 4 coffees | ты ~пьёшь 4+ чашки кофе / ты ~пьёшь меньше 4 чашек |
| 7 | `lost-interest` | no interest or joy / interest in things | без интереса и радости / интерес к делам | you ~lose interest in things / you ~keep your interest in things | тебе ~ничего не интересно / интерес к делам ~есть |
| 8 | `pms-signs` | PMS signs / no PMS signs | признаки ПМС / без признаков ПМС | you ~have PMS signs / you ~have no PMS signs | у тебя признаки ПМС\|~бывают признаки ПМС / признаков ПМС ~нет |
| 9 | `headache-stopped-me` | a day lost to headache / no day lost to headache | день, сорванный головой / без сорванных дней | a headache ~stops your plans / headaches ~don't stop your plans | головная боль ~мешает делам / голова ~не мешает делам |
| 10 | `same-wake-time` | same wake-up time / shifted wake-up time | подъём в одно время / сдвинутый подъём | you ~get up at the same time / your wake-up time ~shifts | подъём ~в одно и то же время / подъём ~сдвигается |
| 11 | `racing-thoughts-in-bed` | racing thoughts in bed / quiet mind in bed | мысли перед сном / спокойная голова перед сном | thoughts ~keep you awake / your mind ~is quiet at bedtime | мысли ~не дают уснуть / перед сном в голове ~тихо |
| 12 | `less-caffeine-than-usual` | much less coffee / usual coffee | меньше привычного кофе / привычный кофе | you ~cut back on coffee sharply / you ~keep your coffee steady | кофе ~гораздо меньше привычного / кофе ~в привычном количестве |
| 13 | `neck-pain` | neck pain / no neck pain | боль в шее / без боли в шее | your neck ~hurts / your neck ~is fine | ~болит шея / шея ~не болит |
| 14 | `got-help-with-kids` | help with the kids / no help with the kids | помощь с детьми / без помощи с детьми | you ~get help with the kids / you ~handle the kids alone | тебе ~помогают с детьми / помощи с детьми ~нет |
| 15 | `skipped-meal` | skipped meal / regular meals | пропуск еды / регулярная еда | you ~skip a meal / you ~eat regularly | ты ~пропускаешь еду / ты ~ешь регулярно |
| 16 | `panic-attack` | panic attack / no panic attack | паническая атака / без панических атак | you ~have a panic attack / you ~have no panic attack | у тебя паническая атака\|~бывает паническая атака / панических атак ~нет |
| 17 | `woke-too-early` | early waking / slept till the alarm | ранний обрыв сна / сон до будильника | you ~wake too early / you ~sleep until your alarm | ты ~просыпаешься слишком рано / ты ~спишь до будильника |
| 18 | `travel-or-night-away` | travel day / day at home | поездка / день дома | you ~are travelling / you ~are at home | ты ~в поездке / ты ~дома |
| 19 | `sleep-aid` | sleep aid / no sleep aid | средство для сна / без средства для сна | you ~take something to sleep / you ~sleep without aids | ты ~принимаешь средство для сна / ты ~спишь без средств |
| 20 | `snored-or-gasped` | snoring or gasping / quiet sleep | храп или удушье во сне / тихий сон | you ~snore or gasp in your sleep / your sleep ~is quiet | ты ~храпишь во сне / сон ~тихий |
| 21 | `hot-day` | hot day / comfortable weather | жара / без жары | it ~is hot / the weather ~is comfortable | ~жарко / жары ~нет |
| 22 | `weather-change` | weather change / steady weather | смена погоды / ровная погода | the weather ~changes sharply / the weather ~is steady | погода ~резко меняется / погода ~ровная |
| 23 | `phones-together` | phones in the way / phone-free time together | телефоны между вами / время вдвоём без телефонов | phones ~get in the way / your time together ~is phone-free | телефоны ~мешают побыть вдвоём / время вдвоём ~без телефонов |
| 24 | `bedtime-battle` | bedtime struggle / easy bedtime | тяжёлый отбой / спокойный отбой | bedtime ~is a struggle / bedtime ~goes smoothly | отбой ~даётся тяжело / отбой ~проходит спокойно |
| 25 | `unfair-chores` | unfair share of chores / fair share of chores | неравные домашние дела / дела поровну | you ~carry more than your share / the chores ~feel fair | на тебе ~больше дел, чем справедливо / дела ~делятся честно |
| 26 | `many-interruptions` | constant interruptions / uninterrupted day | постоянные отвлечения / день без отвлечений | you ~get interrupted all day / your day ~runs without interruptions | тебя ~постоянно отвлекают / день ~идёт без отвлечений |
| 27 | `social-media-hour` | 1+ hour on social media / under an hour on social media | соцсети больше часа / соцсети меньше часа | you ~spend over an hour on social media / you ~spend under an hour on social media | ты ~сидишь в соцсетях больше часа / ты ~проводишь в соцсетях меньше часа |
| 28 | `deep-conversation` | real conversation / no real conversation | разговор по душам / без разговора по душам | you ~have a real conversation / you ~have no real conversation | у тебя ~бывает разговор по душам / разговора по душам ~нет |
| 29 | `time-in-nature` | time in nature / no nature | время на природе / без природы | you ~spend time in nature / you ~get no time in nature | ты ~бываешь на природе / природы ~нет |
| 30 | `money-worry` | money worries / no money worries | тревога о деньгах / без тревоги о деньгах | money ~worries you / money ~doesn't worry you | деньги ~тревожат / тревоги о деньгах ~нет |
| 31 | `early-migraine-signs` | early migraine signs / no early signs | предвестники мигрени / без предвестников | you ~notice early migraine signs / you ~notice no early signs | у тебя предвестники мигрени\|~бывают предвестники мигрени / предвестников ~нет |
| 32 | `pill-free-day` | pill-free day / active pill day | перерыв в таблетках / день с таблеткой | you ~are on a pill-free day / you ~are on an active pill | у тебя ~перерыв в таблетках / перерыва в таблетках ~нет |
| 33 | `strength-training` | strength training / no strength training | силовая тренировка / без силовой | you ~do strength training / you ~skip strength training | ты ~делаешь силовую тренировку / силовой ~нет |

(In the table, `\|` is the "cause|result" separator, escaped for Markdown.)

**Sample sentences, read aloud**
- "On days after you cut back on coffee sharply, you **often** have a headache — 6 of 9 times."
- «В дни, когда у тебя месячные, **почти всегда** бывает мигрень — 5 из 6 раз.»
- «В дни, когда мысли не дают уснуть, ты **обычно** спишь меньше 7 часов — 7 из 10 раз.»

---

## Reword or split existing questions

| id | Problem now | Proposal | Why |
|---|---|---|---|
| `slept-enough` | Asks two things: "at least 7 hours **and** felt rested". `felt-recovered` already asks about feeling rested. Rule 30/18 waits for 18 short nights. | Hours only. EN: "Did you sleep at least 7 hours last night?" RU: «Этой ночью сна было 7+ часов?» Rule **14/6**. | One question, one fact; AASM ≥7 h [13]. |
| `period-symptoms` | Mixes period pain and PMS, and has no day marker. | Split into `period-day` (marker) + `pms-signs` (new). Keep this id as **"Strong period pain"**. EN: "Did period pain or cramps make today hard?" RU: «Боль или спазмы при месячных сегодня мешали?» | Cycle windows and the PMDD 2-cycle rule need the period day [25, 66]. |
| `back-or-neck-pain` | Neck and back behave differently for migraine. | Rename to "Back pain" (EN "Did your back hurt today?", RU «Сегодня болела спина?»), plus `neck-pain` (new). | Neck pain is a migraine factor and early sign; back pain is not [62, 84]. |
| `smoked` | "Cigarette, vape **or hookah**" double-counts with `smoked-hookah`. | "Cigarette or vape" only. | No double counting. |
| `stomach-issues` | Includes nausea, which `felt-nauseous` also asks. | "Stomach pain or digestion trouble". Leave nausea to `felt-nauseous`. | No double counting. |
| `heart-palpitations` | "Rapid heartbeat **or BP swings**": blood pressure can't be felt reliably. | EN: "Did you feel your heart racing, pounding or skipping?" Measured BP, if wanted, as a separate custom number. | One felt symptom. (Chest pain or fainting with palpitations should get a same-day note; not researched here.) |
| `felt-anxious` | "Did anxiety show up today?" is vague. | EN: "Did you feel anxious or find it hard to stop worrying today?" RU: «Сегодня была тревога или трудно было перестать волноваться?» Rule **14/8**. | Hard-to-control worry is the core of GAD [22]. |
| `felt-depressed` | Rule 30/8. | Rule **14/8**, then offer PHQ-2; at 12/14 → "talk to a professional". | DSM-5 2-week window [17, 19]. |
| `woke-at-night` | No length given. | EN: "Did you wake at night and lie awake for 30+ minutes?" RU: «Этой ночью был подъём среди ночи и 30+ минут без сна?» Rule **7/3**. | Insomnia research rule ≥31 min, 3 nights a week [11, 12]. |
| `ate-by-2pm` | An indirect stand-in for "skipped meal" in the migraine door. | Use `skipped-meal` in the migraine door. Keep or retire this one. | Self-reported trigger is skipped meals [56]. |
| `saw-daylight` | Overlaps `outside-30min`. | "Daylight before noon". EN: "Did you get outdoor daylight before noon?" RU: «Был дневной свет на улице до полудня?» | Earlier daylight goes with better sleep [106, 41]. |
| `saw-friends` | "Connect with friends" mixes texting and meeting. | Make it in person: "Did you see friends in person today?" Add `deep-conversation`. | In-person contact helps loneliness most [152]. |
| `thought-about-leaving` + `thought-divorce` | Two questions with the same Russian title («Думал(а) расстаться») and almost the same sentence. | Merge, or make one "leave the relationship" (partner) and one "divorce / formal split" (big decisions) with clearly different words. | Duplicate answers inflate links. |
| `felt-fatigued` + `had-energy` | Near opposites. | Don't put both in one person's default set. | The same signal counted twice. |
| `calm-day` + `felt-calm` + `felt-angry` | Three overlapping questions. | Keep `felt-calm` and `felt-angry` as defaults. | Fewer, clearer questions [262]. |
| `coffee-late` | A fixed "2 pm" cutoff. | Fine for an 11 pm bedtime. Later: cutoff = bedtime − 9 h. | Coffee ≥8.8 h before bed [90]. |

## Door context swaps (3 context questions each)

| Door | Now | Proposed | Why |
|---|---|---|---|
| migraine | slept-enough, felt-anxious, ate-by-2pm | slept-enough, felt-stressed, skipped-meal (+ `period-day` when cycle tracking is on) | Stress is the studied factor; skipped meals beat "ate before 2 pm"; the period is the biggest factor [55, 56, 60] |
| sleep / goodSleep | coffee-late, screen-time-long, ate-late | racing-thoughts-in-bed, drank-alcohol, coffee-late | Bedtime worry and evening alcohol have the strongest real-life support [91, 100] |
| fights | slept-enough, drank-alcohol, felt-fatigued | slept-enough, drank-alcohol, felt-stressed | Stress spillover is the best day-to-day predictor [182, 186, 187] |
| kid | slept-enough, felt-fatigued, felt-anxious | slept-enough, child-slept-poorly, got-help-with-kids | Child sleep and support [198, 203, 208] |
| drinking | slept-enough, felt-anxious, felt-lonely | saw-friends, felt-stressed, slept-enough | People drink on good-mood and social days, not on bad ones. Keep stress to show that honestly [136, 137] |
| period | slept-enough, felt-stressed, felt-fatigued | period-day, felt-stressed, slept-enough | The day marker unlocks cycle windows; stress has the most PMS evidence [119] |
| mood, stress, energy, calm, focus, movement, joy | — | keep | Already match the evidence (sleep, outdoors, exercise, stress) |
