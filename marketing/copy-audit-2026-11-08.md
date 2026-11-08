# MeMap copy audit: new UI, EN + RU

Read-only audit of `src/locales/en.ts`, `src/locales/ru.ts`, `src/lib/answerPhrases.ts`, the `notifications` block, and the components that build lines out of fragments. The baseline is commit **4edf2b0** ("v96, part 1", Nov 8 2026 09:14). The working tree was identical to that commit when this audit was checked.

## 0. Already fixed in v96. Check these on the phone, don't redo them

| Her example | State in 4edf2b0 |
|---|---|
| "In bed by 23:00?" as a test's evening card | `cardQuestion()` → `testQuestionOf()` (lib/testWords.ts) now shows the idea's own whole question ("Were you in bed by 23:00?" / «Удалось лечь до 23:00?»), or otherwise `experiment.planQ`. |
| «В кровати до 23:00» | `experiment.idea.bed23.change` is now «Ложиться спать до 23:00» / "Go to bed by 23:00". All idea names are now actions, with old names kept in `lib/ideaNames.ts`. Three are still not actions; see row 18. |
| Push "In bed by 23:00" / "Day 2 of 14 · one small step today" | Replaced by `notifications.try.{start,mid1..4,goal,half,twoLeft,last}` with a real title and a body. Three small problems remain; see rows 19–21. |
| "Short night" / "No workout" under a plan in When to act | The card now shows `cardQuestion(tr)` (the real question) and a meter line `rules.why` / `rules.whySoFar`. That meter line is still a telegram; see rows 1–2. `label()` in ActionPoints.tsx:109 is now dead code. |
| «Внести 3 тренировки в календарь на эту неделю?» | Retired in `lib/storage.ts` (RETIRED_ADVICE). The library plan is now "3 workouts a week"; `GOALS` in lib/testWords.ts watches the question itself and shows "This week: 2 of 3". |
| Lighthouse push "\"X\" hit 4 signals. Time to act." | Now "Your rule for "X" was reached. Your plan: …" / «Сработало твоё правило для «X». Твой план: …». |
| Daily push "Today · 3 questions · ~1 min" | Now "3 short questions, about 1 min", with five rotating titles (`notifications.dayTitle1..5`). |

## 1. Summary

Counts by problem type. The counts are of rows (a row can cover a few sibling keys). Some rows fit two types, so the counts overlap.

| Problem type | Rows |
|---|---|
| Telegram or fragment: meaning lost, or parts joined with " · " / "→" / "1/2" | 43 |
| Built in code from fragments, so the fix is in a component (see §4) | 16 sites |
| Russian grammar or plural bug (wrong case, missing plural forms, broken agreement, capital letter after a colon) | 7 |
| Gendered Russian: hard-coded female forms, or bracket forms outside tracker titles | 11 strings (3 hard female, 8 brackets) |
| EN/RU meaning mismatch, or terminology drift («тест» vs «проверка»; "action point" / "limit" / "rule" / "lighthouse") | 7 |
| Not a whole question, or a name used as a question | 5 |
| Robotic or cold tone | 5 |
| English or anglicism left in ru.ts | 3 (Инсайт, theme names, Demo Mode) |
| Names a drug, test or specialist | 2 (both outside the locales: one is a question, not advice; one is legacy advice text) |
| Odd short answer phrases in answerPhrases.ts | 10 |

The pattern behind most rows: a number line with " · " standing in for a verb ("act at 4", "Health 1/2 · 3 of 8", "Growing · next in 2 evenings", "First week · 3 of 7"). The fix is almost always the same: turn the line into a short sentence with a verb, and say what the number counts.

Notation: plural keys are written `_one / _other` (EN) and `_one / _few / _many / _other` (RU; `_other` copies `_few` unless shown). `{{placeholders}}` are unchanged unless the row says "new key".

---

## 2. Top 40 (most visible or worst first)

| # | Key / where | Current EN | Current RU | Problem | Proposed EN | Proposed RU |
|---|---|---|---|---|---|---|
| 1 | `rules.whySoFar_*` (meter under every When-to-act card and row; ActionPoints.tsx:85) | “{{ans}}” on {{k}} of the last {{count}} days · act at {{n}} | «{{ans}}» в {{k}} из {{count}} последних дней · пора действовать с {{n}} | Telegram. "act at 4" doesn't say what 4 is. | You answered “{{ans}}” on {{k}} of the last {{count}} days. At {{n}}, it's time to act. | _one: Ответ «{{ans}}» был в {{k}} из {{count}} последнего дня. Когда наберётся {{n}}, пора действовать.<br>_few/_many/_other: Ответ «{{ans}}» был в {{k}} из {{count}} последних дней. Когда наберётся {{n}}, пора действовать. |
| 2 | `rules.why_*` (meter on a lit card; ActionPoints.tsx:85, also `why()` :110) | “{{ans}}” on {{k}} of the last {{count}} days | «{{ans}}» в {{k}} из {{count}} последних дней | Fragment with no verb; doesn't say the limit is reached. | You answered “{{ans}}” on {{k}} of the last {{count}} days. It's time to act. | _one: Ответ «{{ans}}» был в {{k}} из {{count}} последнего дня. Пора действовать.<br>_few…: Ответ «{{ans}}» был в {{k}} из {{count}} последних дней. Пора действовать. |
| 3 | `path.end.title` + `path.end.notYet_*` (Today: the end node before the day is done; EveningPath.tsx:326, :711) | Done for today / After your {{count}} steps today. Today's questions can wait until tonight. Then: bubbles to pop. | На сегодня всё / После {{count}} шагов за сегодня. Вопросы за сегодня можно оставить на вечер. Потом — пузыри. | Says "Done for today" while steps remain. "After your 3 steps today." has no verb. "Then: bubbles to pop" is a telegram. | New key `path.end.titleAhead`: The end of today's path<br>notYet_one: It opens after your last step today, then bubbles are waiting. No rush: tonight is fine.<br>_other: It opens after your {{count}} steps today, then bubbles are waiting. No rush: tonight is fine. | titleAhead: Конец сегодняшнего пути<br>_one: Откроется после последнего шага на сегодня — потом ждут пузыри. Можно не спешить: вечером тоже хорошо.<br>_few/_many: Откроется после {{count}} шагов на сегодня — потом ждут пузыри. Можно не спешить: вечером тоже хорошо. |
| 4 | `path.next4.report`, `path.next4.reportN` (chip under "Week 1"; EveningPath.tsx:558) | First week report in {{count}} evenings | Первый отчёт недели через {{count}} веч. | **Bug:** called with `count` but has no plural keys, so EN shows "in 1 evenings". RU uses the abbreviation «веч.». | report_one: Your first week's report in {{count}} evening<br>report_other: Your first week's report in {{count}} evenings<br>reportN_one / _other: Your week's report in {{count}} evening(s) | report_one: Первый отчёт недели — через {{count}} вечер<br>_few: …через {{count}} вечера<br>_many: …через {{count}} вечеров<br>reportN_*: Отчёт недели — через {{count}} вечер / вечера / вечеров |
| 5 | `path.next4.links_*`, `.rule`, `.lit_*`, `.trying` (same chip; EveningPath.tsx:561–565) | 2 links found · see them / Set your own rule · When to act / 1 rule reached · see your plan / {{change}} · day 3 of 14 | Найдено 2 связи · посмотреть / Поставь своё правило · Когда действовать / Сработало 1 правило · твой план / {{change}} · день 3 из 14 | Every chip is two fragments glued with " · ". | links_one: MeMap found {{count}} link. Take a look<br>links_other: MeMap found {{count}} links. Take a look<br>rule: Set your own rule for when to act<br>lit_one: {{count}} rule is reached. Your plan is waiting<br>lit_other: {{count}} rules are reached. Your plans are waiting<br>trying: Trying “{{change}}”: day {{k}} of {{count}} | links_one: Нашлась {{count}} связь — посмотри<br>_few: Нашлись {{count}} связи — посмотри<br>_many: Нашлось {{count}} связей — посмотри<br>rule: Задай своё правило: когда пора действовать<br>lit_one: Сработало {{count}} правило — твой план ждёт<br>_few: Сработали {{count}} правила — планы ждут<br>_many: Сработало {{count}} правил — планы ждут<br>trying: Пробуешь «{{change}}»: день {{k}} из {{count}} |
| 6 | Step name "Health 1/2" (EveningPath.tsx:293) + session header "Health 1/2 · 3 of 8" (DailySession.tsx:1281–1291, `dailySession.countOf`) | {{name}} 1/2 · {{current}} of {{total}} | {{name}} 1/2 · {{current}} из {{total}} | Two counters in one telegram; "1/2" is maths notation. | New key `path.part`: {{name}}, part {{k}} of {{n}}<br>Header counter: use the existing `dailySession.questionOf` ("Question {{current}} of {{total}}") on its own line, without " · ". | path.part: {{name}}, часть {{k}} из {{n}}<br>questionOf: Вопрос {{current}} из {{total}} |
| 7 | `path.left_*` (step sub + bubble; EveningPath.tsx:352, :817) | {{count}} left | Остался {{count}} / Осталось {{count}} | "2 left" — two what? | _one: {{count}} question left<br>_other: {{count}} questions left | _one: Остался {{count}} вопрос<br>_few: Осталось {{count}} вопроса<br>_many: Осталось {{count}} вопросов |
| 8 | `path.stepDone` + sub (DailySession.tsx:798–800: `${stepTitle} · ${path.answers}`) | Done! / Health 1/2 · 3 answers | Готово! / Здоровье 1/2 · 3 ответа | The sub is a telegram and doesn't say what's next. | stepDone: Done! (keep)<br>New key `path.stepSaved_one`: {{count}} answer saved. Your next step is waiting on the path.<br>_other: {{count}} answers saved. Your next step is waiting on the path. | _one: {{count}} ответ сохранён. Следующий шаг ждёт на пути.<br>_few: {{count}} ответа сохранены. Следующий шаг ждёт на пути.<br>_many: {{count}} ответов сохранено. Следующий шаг ждёт на пути. |
| 9 | `path.fillTitle`, `path.pastFill` (EveningPath.tsx:283, :1022; `{{day}}` = weekday in nominative from `toLocaleDateString`) | Fill in {{day}} / Fill in {{day}} | Заполнить {{day}} / Заполнить: {{day}} | **RU case bug:** «Заполнить среда / пятница / суббота». "Fill in Tuesday" is also awkward. | Answer for {{day}} | Ответить за день: {{day}} *(keeps the nominative)* |
| 10 | `rules.countedFrom` (When to act → See details; ActionPoints.tsx:311) | Pale days are before you last acted on it. | Бледные дни — до того, как ты в последний раз это сделала. | **Gendered (female).** | (keep) | Бледные дни — до того, как план был сделан в последний раз. |
| 11 | `rules.testing` + `experiment.weekOf` joined (running-test row in When to act; ActionPoints.tsx:145) | Trying it · day 3 of 14 · This week: 2 of 3 | Пробуешь · день 3 из 14 · На этой неделе: 2 из 3 | Three fragments in one line. | testing: You're trying it: day {{k}} of {{count}}<br>weekOf: This week: {{k}} of {{n}} done *(put it on its own line, not joined with " · ")* | testing: Проверка идёт: день {{k}} из {{count}}<br>weekOf: На этой неделе получилось {{k}} из {{n}} |
| 12 | `rules.show` (button on a lit card; ActionPoints.tsx:200) | Show | Показать | "Show" what? | See details | Подробнее |
| 13 | `rules.kindDaily` (once / daily toggle) | Every day · 2 weeks | Каждый день · 2 недели | Telegram label. | Every day for 2 weeks | Каждый день 2 недели |
| 14 | `rules.beforeAfter` (After "I did it"; ActionPoints.tsx:222, :294) | Before: {{k1}} of {{n1}} days · since: {{k2}} of {{n2}} | До: {{k1}} из {{n1}} дней · после: {{k2}} из {{n2}} | Telegram; "since" and «после» hang. | Before: {{k1}} of {{n1}} days. Since then: {{k2}} of {{n2}}. | До этого: {{k1}} из {{n1}} дней. С тех пор: {{k2}} из {{n2}}. |
| 15 | `experiment.hardOn`, `experiment.withIt_*`, `experiment.withoutIt_*` (test result; ExperimentSheet.tsx:184–186) | Hard days on {{island}} / With it: 2 of 6 days / Without it: 4 of 8 days | Тяжёлые дни: {{island}} / С изменением: 2 из 6 дней / Без него: 4 из 8 дней | "With it" means nothing out of context; it's the main result of the test. | hardOn: Hard days on the {{island}} island<br>withIt_one/_other: On days you did it: {{k}} of {{count}} day(s)<br>withoutIt_*: On the other days: {{k}} of {{count}} day(s) | hardOn: Тяжёлые дни на острове «{{island}}»<br>withIt_one: В дни, когда получилось: {{k}} из {{count}} дня<br>_few/_many: …{{k}} из {{count}} дней<br>withoutIt_*: В остальные дни: {{k}} из {{count}} дня / дней |
| 16 | `experiment.startedLine_*` (after Start; ExperimentSheet.tsx:161) | It's in your {{island}} questions for the next {{count}} days. | Вопрос будет в «{{island}}» {{count}} дней. | RU is broken: «в «Здоровье» 14 дней». | (keep) | _one: Следующий {{count}} день этот вопрос будет среди вопросов острова «{{island}}».<br>_few: Следующие {{count}} дня этот вопрос будет среди вопросов острова «{{island}}».<br>_many: Следующие {{count}} дней … |
| 17 | `experiment.idea.visitWeekend.q` | Did you ask your parents about their day? | Родители рассказали про свой день? | **Meaning mismatch:** RU asks whether the parents talked, but the plan is to ask them. | (keep) | Удалось спросить родителей, как прошёл их день? |
| 18 | `experiment.idea.screenFreeHour.change` (EN), `talkNoPhones.change` (RU), `outsideMorning.change` (RU) | No screens in the hour before the kids' bedtime | 10 минут говорить без телефонов / Утром 10 минут побыть на улице | The only EN idea that is still not an action. Two RU names have odd word order. **Add the old names to `lib/ideaNames.ts`** so running tests are still recognised. | Keep screens off in the hour before the kids' bedtime | Говорить 10 минут без телефонов / Побыть утром 10 минут на улице |
| 19 | `notifications.try.goal.body` (RU) | {{change}}. Could today be one of them? | {{change}}. Может, сегодня один из этих дней? | **RU agreement:** with «3 тренировки в неделю», «один из этих дней» doesn't refer to anything. | (keep) | {{change}}. Может, сегодня как раз такой день? |
| 20 | `notifications.try.mid4.body` (RU) | {{change}}. Keep going: your result comes in {{left}} days. | {{change}}. Так держать: результат — на 15-й день. | RU hard-codes "15", while EN uses `{{left}}`. | (keep) | {{change}}. Так держать! Дней до результата: {{left}}. |
| 21 | `notifications.try.start.body` (lib/notifications.ts:326 `tryWords`) | Today's small step: {{change}}. This evening MeMap will ask how it went. | Маленький шаг на сегодня: {{change}}. Вечером MeMap спросит, как получилось. | `{{change}}` starts with a capital → «…на сегодня: Ложиться спать до 23:00.» (wrong in RU). | Today's small step: “{{change}}”. This evening MeMap will ask how it went. | Маленький шаг на сегодня — «{{change}}». Вечером MeMap спросит, как получилось. |
| 22 | RU terminology: `rules.testDone`, `rules.afterTest_*`, `rules.afterTestDone`, `rules.kindDailyLine` | Your test is done: see it on Today / A test on this island ends in {{count}} days. Two at once and you couldn't tell which helped. | Тест закончен… / Тест на этом острове… / …как прошёл тест… / Тест на 2 недели… | The same thing is «проверка» in ExperimentSheet and pushes but «тест» here. The EN line is a fragment. | afterTest_*: A test on this island ends in {{count}} day(s). With two at once, you couldn't tell which one helped. | testDone: Проверка закончена: результат на «Сегодня»<br>afterTest_*: Проверка на этом острове закончится через {{count}} день / дня / дней. Если проверять две сразу, не понять, что помогло.<br>afterTestDone: Сначала посмотри на «Сегодня», как прошла проверка<br>kindDailyLine: Проверка на 2 недели: MeMap каждый вечер спросит, получилось ли, и сравнит дни с этим и без. |
| 23 | `hunch.askHard`, `hunch.askGood` (HunchGame.tsx:63, x = `answerPhrase`) | What do you think brings on {{x}}? / What do you think brings {{x}}? | Как думаешь, от чего бывает {{x}}? (both) | EN loses its article ("brings on fight with partner"). RU uses the same line for good and hard, and «бывает 7+ часов сна» is ungrammatical. | askHard: What do you think comes before “{{x}}”?<br>askGood: What do you think helps you get “{{x}}”? | askHard: Как думаешь, что бывает перед этим: «{{x}}»?<br>askGood: Как думаешь, что этому помогает: «{{x}}»? |
| 24 | `hunch.withIt_*`, `hunch.withoutIt_*` + card header (HunchGame.tsx:145 adds `map.nextDay` after the suspect) | Coffee after 2 pm next day / With it: migraine on 3 of 5 days / Without it: 1 of 9 days | Кофе после 14:00 на следующий день / С этим: мигрень — 3 из 5 дней / Без этого: 1 из 9 дней | The header reads as if the coffee is the next day (it's the day before). "With it" is unclear. | New key `hunch.dayBefore`: {{x}} the day before<br>withIt_*: On days with it: “{{b}}” on {{k}} of {{count}} day(s)<br>withoutIt_*: On other days: {{k}} of {{count}} day(s) | dayBefore: {{x}} — накануне<br>withIt_*: В дни с этим: «{{b}}» — {{k}} из {{count}} дня / дней<br>withoutIt_*: В остальные дни: {{k}} из {{count}} дня / дней |
| 25 | `hunch.needTwo` (locked "Your hunch" step) | After your first two questions | После первых двух вопросов | Fragment: it doesn't say what happens. | Opens after you answer your first two questions | Откроется, когда будут ответы на первые два вопроса |
| 26 | SteadyCard rows (SteadyCard.tsx:49, :61: `cap(answerPhrase)` + `steady.kOf`) | Short night ……… 4 of 5 days | Короткая ночь ……… 4 из 5 дней | The same "Short night" problem she reported: the row doesn't say that the thought came on 4 of 5 short-night days. | New key `steady.col` (above the rows): The thought came:<br>New key `steady.on`: On days with “{{x}}” | col: Мысль приходила:<br>on: В дни, когда «{{x}}» |
| 27 | `path.stage{n}` + `path.toNext_*` joined with " · " (EveningPath.tsx:634–636, MapTab.tsx:291, GrowMoment.tsx:111) | Growing · next in 2 evenings | Растёт · дальше через 2 вечера | Telegram, repeated in 3 places. | New key `path.stageLine_one/_other`: Stage: {{stage}}. The next one comes in {{count}} evening(s).<br>New key `path.stageFull`: Stage: {{stage}}. Fully grown! | stageLine_one: Стадия: {{stage}}. Следующая — через {{count}} вечер.<br>_few: …через {{count}} вечера<br>_many: …через {{count}} вечеров<br>stageFull: Стадия: {{stage}}. Остров вырос полностью! |
| 28 | `items.toGet_*`, `items.got`, IslandStats.tsx:286 (`${how} · ${k}/${n}`), `items.*.how` | First week · 3 of 7 / First week · since Nov 3 / Bubbles on 7 days / Your own island / First test / A hunch checked | Первая неделя · 3 из 7 / … · с {{date}} / Пузыри 7 дней / Свой остров / Первая проверка / Догадка проверена | A how-to-earn line that is a telegram. Some "how" lines don't say what to do. | toGet_*: {{how}}: {{k}} of {{count}} so far<br>got: {{how}}. Yours since {{date}}<br>lavender.how: Pop bubbles on 7 days<br>signpost.how: Make your own island<br>easel.how: Finish your first test<br>sparkles.how: Check a hunch | toGet_*: {{how}}: пока {{k}} из {{count}}<br>got: {{how}}. У тебя с {{date}}<br>lavender: Лопать пузыри 7 дней<br>signpost: Создать свой остров<br>easel: Пройти первую проверку<br>sparkles: Проверить догадку |
| 29 | `path.nextTomorrow` (next-treasure card on the end card) | Tomorrow: {{k}} of {{n}} | Завтра: {{k}} из {{n}} | Fragment. | Tomorrow makes it {{k}} of {{n}} | Завтра будет {{k}} из {{n}} |
| 30 | `isle.hard` + `isle.usual` joined (IslandStats.tsx:116); chip `Yes · 3 days` (IslandStats.tsx:134) | This week: 2 hard days of 5 · more than usual / Yes · 3 days | На этой неделе: тяжёлых дней 2 из 5 · больше обычного / Да · 3 дня | Telegram. The chip doesn't say "answer". | New key `isle.hardUsual`: This week, {{k}} of {{count}} days were hard — {{usual}}.<br>New key `isle.ansDays_*`: “{{ans}}” on {{count}} day(s) | hardUsual: На этой неделе тяжёлых дней — {{k}} из {{count}}, {{usual}}.<br>ansDays_*: «{{ans}}» — {{count}} день / дня / дней |
| 31 | `path.chest.early`, `path.chest.insight`, WeekChest.tsx:203 and :218 (`${label} · ${kOfN}`) | Early / Insight / Fights · 3 of 7 days | Рано судить / Инсайт / Ссоры · 3 из 7 дней | "Early" is a single word. «Инсайт» is an anglicism. The label · number join is a telegram. | early: Early sign: needs more days<br>insight: What stood out<br>New key `path.chest.line_*`: {{label}}: {{k}} of {{count}} day(s) this week | early: Первый признак, нужно больше дней<br>insight: Главное за неделю<br>line_*: {{label}}: {{k}} из {{count}} дня / дней за неделю |
| 32 | `unload.doneToday` (bubbles step) | Done today · any time again | Сегодня уже было · можно ещё | Telegram. | You've played today. Play again any time. | Сегодня уже было. Можно ещё — в любой момент. |
| 33 | `world4.soon`, `world4.ofRules`, `world4.tryOne`, `world4.last2weeks` (the 4-part row on World; DaysOverview.tsx:151–173; tiny cards, keep them short) | ~10 evenings / of 3 rules / not yet / last 2 weeks | ~10 вечеров / из 3 / пока нет / 2 недели | "0" + "~10 evenings" is unclear. RU «из 3» doesn't say of what. | soon: in ~10 evenings<br>tryOne: try one change | soon: через ~10 вечеров<br>ofRules_one: из {{count}} правила<br>_few/_many: из {{count}} правил<br>tryOne: попробуй одно<br>last2weeks: последние 2 недели |
| 34 | `overviewCards.litOf_*` (RU) | of {{count}} rules reached | сработало из {{count}} | RU word order with the number in front: "1 сработало из 3". | (keep) | _one: из {{count}} правила сработало<br>_few/_many: из {{count}} правил сработало |
| 35 | `onb7.qAlso` (onboarding questions screen) | Also track · to spot patterns | Ещё отмечать · чтобы видеть совпадения | Telegram. | Also track these, to see what goes together | Ещё отмечать — чтобы видеть, что бывает вместе |
| 36 | `onb7.dayTonight` | Tonight — today | Вечером — за сегодня | Hard to read. | Today, this evening | За сегодня, вечером |
| 37 | `onb7.example.*` (inside `onb7.v2l`), `onb7.v3l` | e.g. short night → migraine: 6 of 7, other days 3 of 24 / Your own rule, e.g. 3 short nights in a week → phone away by 10 pm. | например, короткая ночь → мигрень: 6 из 7, в остальные дни 3 из 24 / Своё правило, например: 3 короткие ночи за неделю → телефон в сторону в 22:00. | Arrows and maths on the very first screens. | example.migraine: for example, after a short night a migraine came 6 times out of 7; after other nights, 3 out of 24 *(same pattern for the other 11)*<br>v3l: Your own rule, for example: after 3 short nights in a week, put the phone away by 10 pm. | example.migraine: например, после короткой ночи мигрень была 6 раз из 7, после других ночей — 3 из 24<br>v3l: Своё правило, например: после 3 коротких ночей за неделю убирать телефон в 22:00. |
| 38 | `onb7.nothingLine`, `onb7.idea2`, `onb7.idea3`, `onb7.idea4` (RU) | You answered “Not sure” to everything… / Did I drink 2 liters of water? / Did I call my family? / Did I spend over my budget? | Ты ответил(а) «Не знаю» на всё… / Выпил(а) 2 литра воды? / Позвонил(а) родным? / Потратил(а) больше, чем планировал(а)? | Bracket forms outside tracker titles. The new onboarding no longer asks for gender, so the brackets stay visible. | (keep) | nothingLine: На все вопросы был ответ «Не знаю». Мир начнётся с первого «да» или «нет».<br>idea2: Удалось выпить 2 литра воды?<br>idea3: Был звонок родным?<br>idea4: Траты вышли за бюджет? |
| 39 | `redFlags.line` (the "Something worrying?" sheet) | These signs aren't counted. They mean a doctor — tonight, today or soon. | Эти признаки не считаются. Они значат врача — сегодня вечером, сегодня или скоро. | "They mean a doctor" is unclear. "Tonight" doesn't match the sections, which are now / today / soon. | MeMap doesn't count these signs. They need a doctor: now, today or soon. | Эти признаки MeMap не считает: с ними нужно к врачу — сейчас, сегодня или в ближайшие дни. |
| 40 | `lib/cardText.ts` card questions: :41 `wanted-leave-job`, :47 `woke-at-night`, :53 `napped`, `screens-before-bed` | Did you seriously consider quitting today? / Screens in the hour before sleep? | Всерьёз думал(а) уволиться сегодня? / Просыпался(ась) ночью? / Спал(а) днём? | Bracket forms on the evening cards. "today" breaks the card rule. One EN card is not a whole question. | Did you seriously think about quitting? / Did you use screens in the hour before sleep? | Была всерьёз мысль уволиться? / Были ночные пробуждения? / Был дневной сон? |

---

## 3. Everything else, by area

### Today / path

| Key / where | Current EN | Current RU | Problem | Proposed EN | Proposed RU |
|---|---|---|---|---|---|
| `path.questions` + `path.minutes` joined (EveningPath.tsx:817) | 3 questions · ~1 min | 3 вопроса · ~1 мин | Telegram. | New key `path.howLong_*`: {{count}} question(s), about {{min}} min | {{count}} вопрос / вопроса / вопросов, около {{min}} мин |
| `path.weekN` · title (EveningPath.tsx:912) | Week 1 · My days | Неделя 1 · Мои дни | Telegram header. | New key `path.weekTitle`: Week {{n}}: {{title}} | Неделя {{n}}: {{title}} |
| `path.grew` | {{name}} grew | {{name}}: остров вырос | EN "Health grew" is odd. | Your {{name}} island grew | Остров «{{name}}» подрос |
| `path.earlierWeeks_*` | Earlier weeks · 3 | Прошлые недели · 3 | Telegram. | _one: {{count}} earlier week<br>_other: {{count}} earlier weeks | Прошлых недель: {{count}} |
| `path.nowAnswer` | Now: {{answer}} | Сейчас: {{answer}} | Fragment. | Your answer now: {{answer}} | Сейчас ответ: {{answer}} |
| `act.sub_*` (the "Time to act" step) | 1 rule reached | 1 правило сработало | Cold. | _one: {{count}} rule is reached. Your plan is waiting<br>_other: {{count}} rules are reached | (RU is fine) |
| `path.chest.nextUp` | Next up | Дальше | Vague kicker. | Coming next | Что будет дальше |
| WeekChest.tsx:259 (`${how} · ${p}`) | First week · 3/7 | Первая неделя · 3/7 | Telegram. | Use `items.toGet` (row 28) | — |
| `overview.qOf` (calendar switcher) | {{k}} of {{n}} · all questions | {{k}} из {{n}} · все вопросы | Telegram. | Question {{k}} of {{n}} | Вопрос {{k}} из {{n}} |
| `doors.hardDayTitle` (session done screen after a hard door answer) | Hard day. | Тяжёлый день. | Reads like a verdict. | That was a hard day. | День был тяжёлым. |
| `tour.helps.sample` | No coffee after 14:00 | Без кофе после 14:00 | Doesn't match the idea name in v96. | Skip coffee after 14:00 | Не пить кофе после 14:00 |

### When to act

| Key / where | Current EN | Current RU | Problem | Proposed EN | Proposed RU |
|---|---|---|---|---|---|
| `rules.watching` | Watching | Наблюдаем | One-word section title. | Keeping an eye on | Пока наблюдаем |
| `rules.bigDone_*` (RU) | {{k}} days in the last {{count}} | {{k}} дн. за последние {{count}} дней | Abbreviation «дн.». | (keep) | {{k}} из последних {{count}} дня / дней |
| `rules.title`, `overviewCards.lighthouses`, `settings.limitAlerts`, `rules.changeLimit` | Action point / Action points / When a limit is crossed / Change the limit | Точка действия / … / Когда порог перейдён / Изменить порог | Four words for one idea (action point, limit, rule, lighthouse). The new screens say "rule". | Pick "rule": `settings.limitAlerts`: When a rule is reached; `rules.changeLimit`: Change the rule | Когда правило срабатывает / Изменить правило |
| Library plans (`adviceAboveThreshold` in lib/lifeStreams.ts, researchTemplates.ts) used as the big card title | 3 workouts a week / 2 walks in nature a week | 3 тренировки в неделю | Noun phrases, while test ideas are now verbs. | Do 3 workouts a week | Тренироваться 3 раза в неделю |

### Tests / experiment

| Key / where | Current EN | Current RU | Problem | Proposed EN | Proposed RU |
|---|---|---|---|---|---|
| `experiment.few` | Only a few days: a first look. | Пока мало дней: это первый взгляд. | Fragment. | Only a few days so far, so this is just a first look. | Дней пока мало — это только первый взгляд. |
| `experiment.keep` / `.stop` | Keep asking / Stop asking | Спрашивать дальше / Больше не спрашивать | Asking about what? | Keep asking every evening / Stop asking about it | Спрашивать и дальше / Больше не спрашивать об этом |
| `experiment.idea.thankYou.q` | Did you say thank you to your partner today? | — | "today" breaks the card rule. | Did you say thank you to your partner? | — |
| `experiment.planQ` (RU; only for her own plans) | Did you do this: “{{plan}}”? | Получилось: «{{plan}}»? | OK; could be smoother. | (keep) | Получилось сделать: «{{plan}}»? |

### Notifications

| Key / where | Current EN | Current RU | Problem | Proposed EN | Proposed RU |
|---|---|---|---|---|---|
| `notifications.grows_*` | {{island}} island grows in {{count}} evening(s) | Остров «{{island}}» вырастет через… | EN lacks "Your". | Your {{island}} island grows in {{count}} evening(s) | (keep) |
| `notifications.treasure_*` | {{count}} more evenings to your {{treasure}} | До сокровища «…» — {{count}} вечера | "to your Balloon" is unclear. | {{count}} more evening(s) until you get the {{treasure}} | (keep) |
| `notifications.dailyBody` (fallback when there are no questions) | Time for today's check-in | Время для сегодняшней сессии | Robotic; "сессия". | Your evening questions are ready | Вечерние вопросы ждут |
| `notifications.dailyPromptBody` (classic only) | Tap to answer | Тапни чтобы ответить | Slang; missing comma. | (keep) | Нажми, чтобы ответить |

### World / links

| Key / where | Current EN | Current RU | Problem | Proposed EN | Proposed RU |
|---|---|---|---|---|---|
| LinkSheet.tsx:48 (`{{island}} · link.onIsland`) | Health · a link on this island | Здоровье · связь на этом острове | Telegram. | New key `link.onIslandOf`: A link on the {{island}} island | Связь на острове «{{island}}» |
| `map.hint` (RU) | Roll it with a finger, pinch to zoom | Крути пальцем, щипком — ближе | RU telegram. | (keep) | Крути шар пальцем, разведи два пальца — приблизить |
| `upgrade.line` | Your answers come with you · Switch back any time | Ответы останутся с тобой · Вернуться можно в любой момент | Two sentences glued with " · ". | Your answers come with you. You can switch back any time. | Ответы останутся с тобой. Вернуться можно в любой момент. |
| `islands.questionPh` (EN) | Walked the dog? | Была прогулка с собакой? | The example question isn't a whole question. | Did you walk the dog? | (keep) |
| `addTracker.autocompleteHeader` | Similar in the library — click to fill | Похожее в библиотеке — кликни, чтоб заполнить | "click" on a phone; «чтоб». | Similar in the library: tap to fill | Похожее в библиотеке — нажми, чтобы заполнить |

#### Short answer phrases (src/lib/answerPhrases.ts)

These are shown alone in FindingsView strips (FindingsView.tsx:133), SteadyCard rows, the Hunch header, and in links as "A → B".

| id | Current EN yes / no | Current RU yes / no | Problem | Proposed EN | Proposed RU |
|---|---|---|---|---|---|
| felt-calm (no) | no calm | без спокойствия | Odd. | not calm | неспокойный день |
| in-flow | flow / no flow | поток / без потока | Unclear alone. | in flow / not in flow | состояние потока / без состояния потока |
| didnt-like-friend-post | a skipped like / no skipped likes | пропущенный лайк / без пропущенных лайков | Meaning lost. | not liking a friend's post / liking as usual | без лайка другу / лайки как обычно |
| apologized-first (no) | no first apology | без первого шага | RU loses the apology. | not apologising first | без первого извинения |
| ordered-delivery (no) | no lazy delivery | без доставки из лени | Judgy, unclear. | no delivery | без доставки |
| local-institution-contact (no) | no offices | без госконтор | Fragment. | no banks or offices | без банков и госконтор |
| hobby-time (no) | no hobby | без хобби | Sounds like "has no hobby". | no hobby time | без времени на хобби |
| outside-30min (no) | no time outside | без улицы | Colloquial. | (keep) | без прогулки на улице |
| screen-time-long (no) | less screen time | меньше экрана | Vague. | under 4 hours on screens | меньше 4 часов в экране |
| paid-to-skip-effort | paying to skip effort / doing it all yourself | оплата вместо своих усилий / всё своими силами | Clumsy. | paying someone to do it / doing it yourself | платная помощь / всё своими силами |

### Report

| Key / where | Current EN | Current RU | Problem | Proposed EN | Proposed RU |
|---|---|---|---|---|---|
| `report.kind.short` / `.full` | Short · 1 page / Full · everything | Кратко · 1 стр. / Подробно · всё | Telegram; «стр.». | Short, 1 page / Full, every detail | Кратко, 1 страница / Подробно, всё |
| `report.qs` | Questions · {{k}} of {{count}} | Вопросы · {{k}} из {{count}} | Telegram. | Questions: {{k}} of {{count}} chosen | Вопросы: выбрано {{k}} из {{count}} |
| `report.statsLine`, `.statsLineFull` (PDF) | about {{pw}} a week · first half {{h1}} → second half {{h2}} · last "yes": {{last}} | около {{pw}} в неделю · первая половина … | Dense; acceptable for a doctor's PDF, but easier as sentences. | About {{pw}} a week. First half: {{h1}}, second half: {{h2}}. Last “yes”: {{last}}. | Около {{pw}} в неделю. Первая половина: {{h1}}, вторая: {{h2}}. Последнее «да»: {{last}}. |
| `report.pro.footer` (RU) | … self-reported daily answers … | …ежедневные ответы самого человека… | Clinical. | (keep) | MeMap · мои ежедневные ответы · закономерности, а не диагноз |

### Onboarding

The worst onboarding items are rows 35–38 in the Top 40. The rest of `onb7.*` reads well.

### You / settings

| Key / where | Current EN | Current RU | Problem | Proposed EN | Proposed RU |
|---|---|---|---|---|---|
| `settings.themeLiquid/Terra/Pop/Hush` (RU) | Liquid / Terra / Pop / Hush | Liquid / Terra / Pop / Hush | Left in Latin script in ru.ts. Decide: brand names, or translate. | — | Жидкое стекло / Терра / Поп / Тишина |
| `today.playRoundHint` (RU; play rounds in the Questions list) | Questions you opened in a round… | Вопросы которые ты открыла в раунде… | **Gendered (female).** Missing comma. | — | Вопросы из раунда — оставь или удали каждый |
| `dailySession.rowReviewPlayTitle` (RU; probably classic) | Review my play questions | Посмотреть, что я открыла | **Gendered (female).** | — | Посмотреть открытые вопросы |

### Other

| Where | Text | Problem | Proposal |
|---|---|---|---|
| lib/trackerLocalize.ts:339 (legacy advice pair) | "Consider talking to a neurologist about preventive treatment." / «…с неврологом о профилактическом лечении» | Names a specialist and a treatment, against the general-advice rule. Shown only to people who still have this old advice stored. | Add to RETIRED_ADVICE in lib/storage.ts so it migrates to the current "See a GP"-style plan. |
| lib/researchTemplates.ts:35 `sleep-aid` question | "Did you take a sleeping pill, melatonin or another sleep aid last night?" | Names a drug, but in a question, not as advice. Borderline. | "Did you take anything to help you sleep last night?" / «Этой ночью было что-то, чтобы уснуть?» |
| `rules.didIt` (RU) | Сделала: считать заново с сегодня | Gendered, but the key is unused. | Delete, or «Сделано — считать заново с сегодня». |
| Dead keys (no code uses them; no fix needed, could delete) | `lighthouse.*`, `growth.*`, `rules.{dotsHard,dotsGood,didIt,whyHard,whyGood,meterOf,meterDone,daysOf,daysWithout,bigOfWithout,bigDoneWithout,without,legendOther,try}`, `isle.{grows,answered,grown}`, `map.{maybeLine,bothDays}`, `path.{weekLabel,week0..3,lastReport,tonight,tonightUnlocks,doneTonight,missedDay,taskLabel,inEvenings,evenings,streak,weekProgress,partsDone,seeWorld,fillIn,chest.openReward}`, `link.{afterNextDay,without,withoutLow}`, `mission.testRunning`, `game.{linkQ,weekQ}`, `today.{answerTonight,tonightDone}`, `onb7.{secGood,moreTopics}` | Not on screen. | — |
| Legacy screens (not mounted in the new UI) | DoorHero, DoorOnboarding, OnboardingV2: most of `doors.*` (heroLabel, logTitle, chip, reasons, whenTitle with «выспался(ась)», «двигался(ась)», «думал(а)»…), the classic `onboarding.*` | Skipped as legacy. `doors.*.name` and `doors.echo.*` are still used and read fine. | — |

---

## 4. Lines built in code from fragments (the fix is in the component)

| # | File:line | What it builds now | Fix |
|---|---|---|---|
| 1 | components/EveningPath.tsx:293 (`stepName`) | `name + " 1/2"` | `t("path.part", { name, k, n })` |
| 2 | components/DailySession.tsx:1281–1291 | `stepTitle · countOf` → "Health 1/2 · 3 of 8" | Step title on line 1; `dailySession.questionOf` on line 2; no " · ". |
| 3 | components/DailySession.tsx:800 | `${stepTitle} · ${path.answers}` | `t("path.stepSaved", { count })` |
| 4 | components/EveningPath.tsx:817 | `left/questions · minutes` | `t("path.howLong" / "path.left", …)` as one sentence. |
| 5 | components/EveningPath.tsx:634–636 (`stageLine`), MapTab.tsx:291, GrowMoment.tsx:111 | `stage · toNext/fullyGrown` | `t("path.stageLine", { stage, count })` / `t("path.stageFull", { stage })` |
| 6 | components/EveningPath.tsx:326 and :711 | `path.end.title` used before the day is done | Use `path.end.titleAhead` while `!eveningDone`. |
| 7 | components/EveningPath.tsx:912 | `weekN · title` | `t("path.weekTitle", { n, title })` |
| 8 | components/ActionPoints.tsx:145 | `rules.testing · experiment.weekOf` | Two lines. |
| 9 | components/ActionPoints.tsx:109 | `label()` built from `answerPhrase`, no longer used | Remove the dead code. |
| 10 | components/HunchGame.tsx:145 | `cap(phrase) + " " + map.nextDay` | `t("hunch.dayBefore", { x })` when `result.nextDay`. |
| 11 | components/HunchGame.tsx:63 | x = lowercase `answerPhrase` inside askHard/askGood | Keep lowercase inside the quotes, as in the proposal. |
| 12 | components/SteadyCard.tsx:58–61 | Row label = bare `answerPhrase` | Add the `steady.col` header; row label `t("steady.on", { x })`. |
| 13 | components/IslandStats.tsx:116, :134, :286 | `isle.hard · isle.usual`; `Yes · N days`; `how · k/n` | `isle.hardUsual`, `isle.ansDays`, `items.toGet` |
| 14 | components/WeekChest.tsx:203, :218, :259 | `label · kOfN`; `how · p` | `path.chest.line`; `items.toGet` |
| 15 | components/LinkSheet.tsx:48 | `island · link.onIsland` | `t("link.onIslandOf", { island })` |
| 16 | lib/notifications.ts:323–327 (`tryWords`) | `{{change}}` with a capital letter after a colon; RU mid4 hard-coded "15" | Quote `{{change}}` in `try.start`; RU mid4 uses `{{left}}`. Also add the renamed idea names from row 18 to `lib/ideaNames.ts` so running tests keep their questions. |
