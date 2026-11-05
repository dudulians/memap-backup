# Онбординг v2: хватает ли вопросов и тем (5 нояб. 2026)

Проверено по коду: библиотека вопросов `src/lib/lifeStreams.ts` (173 вопроса) и «двери» онбординга `src/lib/doors.ts` (сейчас 5).

## Библиотека по островам

| Остров | Вопросов | Трудных | Хороших |
|---|---|---|---|
| Me | 42 | 21 | 21 |
| World | 28 | 18 | 10 |
| Body & habits | 26 | 23 | 3 |
| Health | 22 | 11 | 11 |
| Love life | 19 | 11 | 8 |
| Kids | 12 | 9 | 3 |
| Work | 10 | 9 | **1** |
| Parents | 7 | 5 | 2 |
| Pet | 7 | 6 | 1 |

Трудных вопросов хватает везде. Хороших мало у Work (1), Pet (1), Parents (2), Body (3), Kids (3).

## Ветка «Something keeps happening»

| Пункт | Главный вопрос | Что есть |
|---|---|---|
| Fights with my partner | argued-with-partner | ✅ готова (дверь, 3 соседних вопроса, «что было перед») |
| Migraines | migraine | ✅ готова |
| Drinking | drank-alcohol | ✅ готова |
| **Bad nights** | — | ⚠️ **двери нет.** Вопросы есть: «Slept enough (7+ hours)», «Recovered after sleep», «In bed before midnight», «Coffee after 2pm», «Stuck to a screen 4h+». Нужны дверь и «What kept you up?» |
| Snapping at my kid | yelled-at-kid | ✅ готова |
| Low mood | felt-depressed | ✅ готова |
| Something else | свой остров | ✅ есть |

## Ветка «I want more good days» (дверей нет ни одной)

| Пункт | Главный вопрос | Соседи | Хватает? |
|---|---|---|---|
| Energy | Had energy (Me) | сон, тренировка, 30 мин на улице, вода, еда до 14:00, кофе после 14:00, алкоголь | ✅ |
| Calm | «Day without irritation» (Me) | тревога, утро без телефона, новости, улица | ⚠️ главный вопрос звучит через «без» — лучше новый «Felt calm» |
| Good sleep | Slept enough, Recovered after sleep, In bed before midnight | кофе, экраны | ✅ |
| Closeness | Felt close to partner, Had a good time together; без пары — Saw friends | | ✅ |
| **Focus** | только «Was in flow» | «Procrastinated», утро без телефона, экраны | ⚠️ **мало** |
| Movement | Worked out, Stretched, 30 min outside | | ✅ |
| Joy | Felt happy, Couldn't stop laughing, Did something creative | | ✅ |

Во всей библиотеке нет вопроса про **время для себя / отдых** — а он нужен соседом для Calm, Energy и Joy.

## Что предлагаю добавить (6 вопросов)

| Вопрос | По-русски | Остров | Тип | Для чего |
|---|---|---|---|---|
| Felt calm | Было спокойно | Me | хороший | главный для Calm |
| Had time for myself | Было время для себя | Me | хороший | сосед для Calm, Energy, Joy |
| Got the main thing done | Сделала главное за день | Work | хороший | главный для Focus |
| An hour of focus, no phone | Час без отвлечений на телефон | Work | хороший | сосед для Focus |
| Woke up at night | Просыпалась ночью | Health | трудный | для Bad nights |
| Ate late in the evening | Поздно ела вечером | Body & habits | трудный | сосед для Bad nights и Energy |

И сделать в коде:
1. Дверь **Bad nights** (главный — «Slept enough», «нет» = плохая ночь) с «What kept you up?»: кофе, экраны, мысли, поздняя еда, шум, ребёнок, боль, не знаю.
2. Семь дверей **хороших дней** (главный хороший вопрос + 3 соседа) и «What helped?»: Slept well, Moved, Outside, Ate well, Good people, Rest, Sun, Don't know.
3. Развилку и обещание её словами (доски 49 и 50).
