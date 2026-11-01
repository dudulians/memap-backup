# Own islands, own questions, first-question guide, island fill ring: final spec

**Base: Angle A.** It is the smaller version and it meets her rules better. It adds no new tab and no new top-level screen. When a limit is reached, the controls just disappear, with no message. Deleting an island returns its questions to where they came from. Typed questions never get a silent Good/Bad default. A also found the real bugs in the current code: the inferred-cluster bug, the ball resetting itself, and play cards making islands.

**Taken from Angle B:**
- sun and storm tiles from her art for "Yes is…";
- the Add button that asks "Good or bad?" instead of sitting greyed out;
- a calm nudge toward yes/no questions that never blocks;
- automatic "?" and a capital first letter;
- name idea chips in the island creator;
- category set from the island, so the classic UI files questions sensibly;
- a saved "last fill seen" value, so the ring ticks forward after the evening even after the app restarts;
- the line "Starts tonight · 21:00" in the guide;
- a calm message when saving fails;
- a hidden screen-reader list of islands.

**Rejected from B:**
- a two-page island creator (more steps, same result);
- a 3-beat guide (A's 2 steps teach the same in less time);
- making slots permanent and migrating every built-in island (more risk for no benefit she can see);
- a "where do the questions go?" picker when deleting an island (an extra decision);
- the message "All 6 of your own islands are here" (a limit she would read; A just hides the control);
- guessing Good/Bad from keywords for typed questions (a silent wrong guess paints storms over good days);
- a faint empty ring track on day 1 (makes a new map look empty);
- looks built from lavender (lavender is kept for the first bloom).

---

## 0. Principles this spec follows

- One idea per view, big short labels, no subtitles. Anything longer goes behind a tap, such as a popover.
- Every empty state shows labelled examples she can tap.
- Nothing negative: no warnings, nothing red, no "limit reached". A control that can't be used is simply not there.
- Motion is 600–700 ms ease-out, with no idle motion and no bounce. With Reduce Motion on, every final state appears instantly.
- The swipe, the Duolingo path, charts and limits are not changed.
- Code is out of scope in `src/classic/`. The classic UI ignores every new field and key.

---

## 1. Screens in order

### 1.1 Map: entry points for a new island

All four open the same **Island sheet** (1.2).

1. **Tap an unexplored cloud** (on the globe, or the one cloud on the flat map). The existing bottom card becomes:
   - label: `NOT EXPLORED YET` / `ЕЩЁ НЕ ОТКРЫТО`
   - line (20 px semibold): `Make it your island` / `Сделай его своим островом`
   - teal button (h-14): `New island` / `Новый остров`
   - The island will grow in that cloud's place.
2. **Island picker inside the question card**: the last tile is a dashed `+ New island` / `+ Новый остров`, the "Your own" tile from picture 8.
3. **"All" sheet on the Map**: a row of island chips (icon inside its ring + name; tap opens the island), ending with the chip `+ New island` / `+ Новый остров`.
4. **Empty map** (no questions yet): the card `Your world is waiting` / `Твой мир ждёт` gets the button `Make my first island` / `Создать первый остров`.

When all 6 clouds are used, all four of these are simply not shown.

### 1.2 Island sheet (create / edit)

One screen, `h-[88vh]`, in the agreed avatar-picker layout: the chosen thing on top, a grid under it.

- **Title**: `New island` / `Новый остров`. In edit mode: `Edit island` / `Изменить остров`.
- **Live preview** (170 px tall, radius 24, sea gradient `#DDF2FA → #BCDDED`):
  - her island art for the current look, plus the name tag exactly as on the map;
  - round ‹ › buttons (44 px, aria `Another look` / `Другой вид`);
  - tapping the island also goes to the next look;
  - 250 ms crossfade, no hint text;
  - the preview stays above the keyboard.
- **Name field**:
  - h-14, 19 px, autofocus, `maxLength 20`, `enterKeyHint=done` (Return only hides the keyboard);
  - placeholder `Career, Dog, Home…` / `Карьера, Собака, Дом…`;
  - with an empty name the preview tag reads `My island` / `Мой остров`.
- **Idea chips** (from B), one horizontal row of 8 chips, each with her icon:
  - `Career/Карьера`, `Home/Дом`, `Food/Еда`, `Study/Учёба`, `Music/Музыка`, `Friends/Друзья`, `Travel/Поездки`, `Hobby/Хобби`;
  - a tap fills the name and the icon;
  - chips whose name already exists are hidden;
  - the whole row hides once she types.
- **Icon grid**:
  - her 15 icons as 56 px tiles, 5×3, in this order: career, home, books, music, food, coffee, hobbies, growth, travel, family, love, health, fitness, pets, wellbeing;
  - the selected tile gets a 3 px teal ring and a check badge;
  - each icon has an aria name in both languages (Career/Карьера … Wellbeing/Самочувствие).
- **Sticky button**: `Create island` / `Создать остров`, disabled while the name is empty. In edit mode: `Save` / `Сохранить`.
- **Edit mode, own islands only**: a quiet text button at the very bottom, `Delete island` / `Удалить остров`.
- **Same name as an island she already has** (case-insensitive; built-in names in the current language, or renamed ones): the button turns into `Open “Health”` / `Открыть «Здоровье»`. It opens that island instead of making a twin. No error text.

**Smart defaults** (she only has to type a name):

- **Icon before typing**: the first icon in grid order that no island on her map uses.
- **Icon while typing**: follows keywords (EN + RU, substring match) until she taps an icon herself.

  | Icon | Keywords |
  |---|---|
  | career | work, job, office, boss, работ, карьер, офис |
  | home | home, flat, дом, квартир, ремонт |
  | books | book, read, study, school, книг, чтени, учёб |
  | music | music, guitar, piano, музык, гитар |
  | food | food, eat, diet, cook, еда, питани, готов |
  | coffee | coffee, tea, кофе, чай |
  | hobbies | hobby, art, draw, хобби, рисова |
  | growth | goal, learn, цел, развити |
  | travel | travel, trip, flight, путешеств, поездк |
  | family | family, friend, mom, dad, семь, друз, мам, пап |
  | love | love, partner, date, любов, муж, жена, свидан |
  | health | health, doctor, pills, здоров, врач |
  | fitness | gym, sport, run, yoga, спорт, зал, бег, йог |
  | pets | dog, cat, pet, собак, кот, кош, питом |
  | wellbeing | sleep, rest, сон, отдых |

- **Look**: follows the icon until she uses ‹ ›.

  | Icons | Look |
  |---|---|
  | career | town |
  | home, family, coffee, pets | cottage |
  | books | library |
  | hobbies | studio |
  | music, travel | camp |
  | health, wellbeing | zen |
  | fitness | pines |
  | food, love, growth | grove |

  If another own island already has that look, take the next free one in this order: town, cottage, library, studio, camp, zen, pines, grove.

**The 8 looks.** All are built from her set, in the `ISLAND_DEFS` format:

| Look | Base | On top |
|---|---|---|
| town | island_plain | city_buildings |
| cottage | island_plain | house |
| library | island_plain | green_tree + books |
| studio | island_plain | art_easel |
| camp | island_plain | camping_tent |
| zen | island_rocky | zen_stones |
| pines | island_rocky | pine_tree |
| grove | island_plain | green_tree |

None of them uses lavender, the bridge, the flag, the lighthouse, the balloon or the rainbow. Those stay reserved for growth.

### 1.3 After Create

**From a cloud, the All sheet or the empty map:**
1. The sheet closes.
2. The ball turns to the spot with the existing `turnTo`, slowed to 600 ms.
3. The cloud fades out and grows a little (scale 1 → 1.25) while the island fades in. 700 ms ease-out, one light haptic.
4. The island's sheet opens on its empty state (1.5).

**From the picker:** there is no trip to the map. The island is selected on the card. Its cloud parts the next time the Map is shown (`revealed: false` until then).

### 1.4 Island sheet (the hub, MapTab)

- **Header**:
  - her icon (48 px) inside the fill ring (56 px box, 3 px stroke);
  - the island name; tap the name, or the pencil (44 px, aria `Edit island` / `Изменить остров`), to edit;
  - the weather line, hidden for an empty island.
- **Questions block**, above the existing tabs:
  - heading `Questions` / `Вопросы`, 19 px semibold, with the count;
  - one row per question, styled like Today's list: rounded 22 px, min-h 56 px, short title in 17 px semibold, chevron. A tap opens the edit sheet;
  - after 5 rows, a row `{{count}} more` / `Ещё {{count}}` that expands in place;
  - the last row: `+ Add a question` / `Добавить вопрос` (36 px teal plus circle + teal 17 px text).
- **Findings / Calendar / Charts / Limits** stay unchanged under the block.

### 1.5 Empty own island

The tabs stay hidden until the island has a question.

- Title (22 px bold): `First question` / `Первый вопрос`.
- 3 example rows for the island's icon: the question in 18 px semibold + a 40 px `+`.
  - A tap adds the question at once, with the library's tap guard.
  - Exception: before the first-question guide is done, a tap opens the guide prefilled.
- Outline button: `Write my own` / `Написать свой`.

### 1.6 Question card (AddTrackerModal; the editor is also the preview)

**Opened from:**
- the island sheet's `+ Add a question`, with `islandId` set and `startIn='own'`;
- `Write my own` on an empty island;
- Today `+` → `Write my own` / `Написать свой` (replaces the old custom form);
- editing, in TrackerSettingsModal, which uses the same card and island chip.

Render the sheet in a portal at `z-[60]`.

**Contents, top to bottom:**
- **Sheet title**: `New question` / `Новый вопрос`.
- **The card** (looks like the evening card: `card-premium`, radius 28, shadow, about 4:3, full width):
  - Top-left: the island chip. Her icon 28 px + island name 16 px semibold + ▾. aria `Island: Career. Change` / `Остров: Карьера. Сменить`.
  - Centre: a borderless textarea, 26 px bold, leading 1.15, max 90 characters.
  - Placeholder: the island's first example, in muted text.
- **Under the card**:
  - 3 example chips for the island. A tap fills the card and sets "Yes is".
  - Text button `More ideas` / `Ещё идеи`: the library, filtered to the island's theme. Every `+` there lands on this island; a back arrow returns to the card.
  - From 2 typed letters on, the chips become up to 3 matching library questions, titled `Ready questions` / `Готовые вопросы`. A tap fills question, short name, Yes-is, limit and advice.
- **Yes/no nudge** (from B), only when the text starts with How / What / Why / When / How many / Как / Что / Почему / Когда / Сколько / Какой:
  - a teal-outline chip: `Make it yes or no` / `Сделай вопрос да/нет`;
  - tapping it replaces the text with the island's first example, ready to edit;
  - it never blocks and is never red.
- **"Yes" is…** (`“Yes” is…` / `«Да» — это…`): two 52 px tiles with her art (from B):
  - sun: `Good` / `Хорошо` (sets `problemWhen: 'no'`);
  - thunder cloud: `Bad` / `Плохо` (sets `problemWhen: 'yes'`);
  - for typed text neither is selected;
  - examples and library picks preset it.
- **More settings** (`More settings` / `Ещё настройки`), folded:
  - short name;
  - the limit sentence `[10] days with “Yes” in [30] days`;
  - `When the limit is reached`;
  - **Theme is removed**.
- **Sticky button**:
  - no text yet: disabled `Add` / `Добавить`;
  - text but no Good/Bad choice: `Good or bad?` / `Хорошо или плохо?` (a tap scrolls to the tiles and gives them one soft glow);
  - both set: `Add` / `Добавить`.

**On save:**
- Trim, capitalise the first letter, and add `?` unless the text already ends in `?` or `.`.
- DuplicateTrackerDialog still runs.

**After Add:**
- the sheet closes;
- the new row glows soft teal for 1.2 s;
- toast `Question added` / `Вопрос добавлен`, with the line `On “Career”` / `Остров «Карьера»`.

Today's one-tap library add gets the same island line in its toast.

### 1.7 Island picker ("Which island?")

A view inside the same sheet. A back arrow returns; picking a tile returns too.

- **Title**: `Which island?` / `Какой остров?`
- **Grid**: 2 columns, white tiles in picture-8 style, her icon, name in 17 px, teal ring + check on the selected one.
- **Order**:
  1. islands on her map, busiest first (own islands included);
  2. built-in islands not on the map yet;
  3. the dashed `+ New island` / `+ Новый остров` tile, while a cloud is free.
- The island **is** the category: there is one choice, not two.

### 1.8 Moving a question

In the edit sheet she changes the chip and taps Save.
- Toast: `Now on “Career”` / `Теперь на острове «Карьера»`.
- Inside the old island's sheet, the row slides out (300 ms).
- The answers travel with the question, so both rings redraw.

### 1.9 Delete island (own islands only)

- **Dialog title**: `Delete the “Career” island?` / `Удалить остров «Карьера»?`
- **Body**, chosen by what the questions do:
  - they all go to one island: `Its questions and answers stay. They move to “Other”.` / `Вопросы и ответы останутся — переедут на остров «Другое».`
  - they go to several islands: `Its questions and answers stay, back on their islands.` / `Вопросы и ответы останутся — вернутся на свои острова.`
  - the island is empty: `It has no questions yet.` / `В нём пока нет вопросов.`
- **Buttons**: `Delete` / `Удалить` and `Cancel` / `Отмена`.
- **After delete**:
  - the island fades out and its cloud fades back in (700 ms);
  - toast `Island deleted` / `Остров удалён` with `Undo` / `Вернуть` for 8 s.

### 1.10 Editing a built-in island

Name and icon only; her signature art stays, and there is no delete. "Pet" can become "Dog". Clearing the name returns to the default name, which the placeholder shows.

---

## 2. First-question onboarding

**When:** the first time she writes a question anywhere: the island's `+ Add a question`, Today's `Write my own`, or an example on an empty island. Once per install.

**Skipped automatically if:**
- `memap_first_q_guide === 'done'`; or
- a hand-written question already exists (a tracker whose source is not `'play'` and that has no `cluster`).

**Where:** inside the Add sheet. Two progress dots at the top and an X.

### Step 1: write it

- **Title** (28 px bold, no subtitle): `Yes or no, about today` / `Да или нет — про сегодня`
- The card with the island chip (1.6), the 3 example chips, and the sun and storm tiles.
- **Button**: `Next` / `Далее`. It is enabled when there is text and a Good/Bad choice.
- `Next` **saves the question** with the island set explicitly, so closing later never loses it. DuplicateTrackerDialog can appear here.
- X on this step saves nothing, and the guide shows again next time.
- **Teaches**: one tap, Yes or No, about today.

### Step 2: the evening swipe

- **Title**: `Tonight, just swipe` / `Вечером просто свайпни`
- Her question on an evening-style card (30 px):
  - the existing calm first-card wiggle, once;
  - faint ‹ › chevrons;
  - edge labels `No` / `Нет` on the left and `Yes` / `Да` on the right;
  - No/Yes buttons under the card.
- Under the card, small: her island (art + name tag + its current ring).
- `Skip` / `Пропустить` sits top-left until she swipes.
- **On swipe** (same 90 px threshold and fly-out as the evening):
  1. the card glides down into the island (700 ms ease-in-out, shrinks to 25 %, fades);
  2. one notch of the ring (1/28) fills in teal;
  3. one light haptic;
  4. the title crossfades to `Yes or No, it fills your island` / `Да или нет — остров заполняется`;
  5. a caption appears: `Starts tonight · 21:00` / `Начнём вечером · 21:00`, using her reminder time. With reminders off: `Starts tonight` / `Начнём сегодня вечером`.
- **Button**: `Done` / `Готово`.
- The practice answer is **never saved**, and `memap_first_swipe_seen` is not touched.
- Closing on step 2 keeps the question and marks the guide done.

**End:** the sheet closes, the new row glows for 1.2 s, and `memap_first_q_guide = 'done'`.

**Reduce Motion:** no wiggle and no glide; the ring notch appears at once.

**Teaches:** the swipe (her signature), that Yes and No both count, and what the ring means.

### Examples

These feed the guide's chips, the card's chips and the empty-island rows. G = "Yes" is good (`problemWhen 'no'`); B = "Yes" is bad (`problemWhen 'yes'`). RU uses noun phrases, so no gender endings.

| Key | Examples |
|---|---|
| career | Stayed late at work? B — Работа допоздна? · Big deadline today? B — Дедлайн сегодня? · Worked from home? G — Работа из дома? |
| home | Cleaned up at home? G — Уборка дома? · Guests over? G — Были гости? · Noisy neighbours? B — Шумели соседи? |
| food | Ordered pizza? B — Заказ пиццы? · Ate after 9 pm? B — Еда после 21:00? · Cooked at home? G — Готовка дома? |
| coffee | More than 2 coffees? B — Больше 2 чашек кофе? · Coffee after 4 pm? B — Кофе после 16:00? · Skipped breakfast? B — Без завтрака? |
| music | Played my instrument? G — Игра на инструменте? · Practised 20 min? G — 20 минут практики? · Live music today? G — Живая музыка сегодня? |
| books | Read 10 pages? G — 10 страниц прочитано? · Studied today? G — Учёба сегодня? · Phone in bed? B — Телефон в кровати? |
| travel | On the road today? B — День в дороге? · Slept somewhere new? B — Ночь на новом месте? · Took a flight? B — Был перелёт? |
| fitness | Went to the gym? G — Зал сегодня? · 10,000 steps? G — 10 000 шагов? · Stretched today? G — Растяжка сегодня? |
| pets | Did the dog limp? B — Собака хромала? · Dog barked at night? B — Собака лаяла ночью? · Long walk today? G — Долгая прогулка? |
| family | Called mom? G — Звонок маме? · Family dinner? G — Ужин всей семьёй? · Argument at home? B — Ссора дома? |
| love | Date night? G — Было свидание? · Had a fight? B — Была ссора? · Hugged today? G — Объятия сегодня? |
| health | Took my pills? G — Таблетки выпиты? · Headache today? B — Болела голова? · Hot at night? B — Жарко ночью? |
| growth | A step toward my goal? G — Шаг к цели? · Took a lesson? G — Урок или курс? · Got up early? G — Ранний подъём? |
| hobbies | Time for my hobby? G — Время на хобби? · Drew or painted? G — Рисование сегодня? · Made something by hand? G — Что-то своими руками? |
| wellbeing | Slept 7+ hours? G — Сон 7+ часов? · Went outside? G — Прогулка на улице? · Phone after 11 pm? B — Телефон после 23:00? |
| kids | Nap today? G — Дневной сон был? · Woke at night? B — Ночные пробуждения? · Screens over 1 hour? B — Экран больше часа? |
| world | Very hot today? B — Сильная жара? · Traffic jams? B — Пробки сегодня? · Noisy night outside? B — Шумная ночь за окном? |
| other | Ordered pizza? B · Dog barked at night? B · Hot at night? B (RU as above) |

**Which list each island uses:**
- built-in islands: me → wellbeing, love → love, kids → kids, health → health, body → fitness, pet → pets, parents → family, world → world, other → other;
- own islands: the list for their icon.

### Question-writing rules (used for examples and future library entries)

- Yes or no only.
- About today, every day. No "lately" or "this week".
- One thing per question.
- About 40 characters; hard cap 90.
- Things that happen, not feelings. Mood stays possible only through the library.
- No judging words ("again", "failed", "bad").
- Amounts become a line to cross ("More than 2 coffees?").
- No one-off events.
- No double negatives.
- Russian as noun phrases, never "(а)".
- No medical numbers or advice.
- "Yes" is always decided as Good or Bad, never left on a silent default.

---

## 3. Fill indicator

**What it measures:** how much MeMap already knows about the island.
- It counts the **different days with at least one Yes or No answer** to any question on that island, over all time, including archived questions.
- `fill = min(1, answeredDays / 28)`, with `FILL_DAYS = 28` (4 path weeks).
- Skips and play-round cards don't count. Yes and No count the same.
- It never drops on its own. It changes only when a question is moved or deleted, and then it just redraws without animation.

**On the map (globe and flat), inside the existing name tag (`pill()` in WorldMap):**
- the icon goes from 24 to 22 px;
- a ring of radius 13 px with a 2.5 px stroke, so the tag stays 30 px tall;
- track `rgba(32,182,162,.16)`, arc `#20B6A2`, clockwise from 12 o'clock, round caps;
- at 0 days nothing is drawn;
- at 28/28 the ring closes in amber `#FBBF24`;
- no numbers, bars or badges on the map;
- the ring fades with the tag when the island rolls behind the ball.

**In the island sheet header:**
- the same ring, 56 px box, 3 px stroke. There is no % pill (dropped from A to keep numbers off the screen).
- Tapping the ring opens a one-line popover:
  - 0 days: `Fills as you answer here. Yes and No both count.` / `Заполняется, когда ты здесь отвечаешь. Считаются и «да», и «нет».`
  - partly filled: `Days with answers here: 12 of 28` / `Дней с ответами здесь: 12 из 28`
  - full: `Filled: 28 days with answers` / `Заполнен: 28 дней с ответами`
- aria-label: `43% filled` / `Заполнен на 43%`.

**In the "All" sheet:** the same ring on every chip. This is the side-by-side comparison she asked for, and the list version for screen readers.

**When it updates:**
- MapTab listens to `memap-entries-changed`, `memap-trackers-changed` and `memap-islands-changed`, in addition to `memap-settings-changed`.
- **Persisted** `memap_island_fill_seen = {[islandId]: days}` (from B).
  - When an island has grown and comes into view (z > .3), its arc grows from the stored value to the new one: 600 ms ease-out, once. Then the new value is stored.
  - Decreases are drawn silently.
- When a ring closes:
  - the arc turns amber;
  - `sparkles.png` glints over the tag for 1.2 s;
  - one light haptic;
  - no confetti.
- Reduce Motion: no animation.

**Consistency:** inside an island, the Findings empty state counts **that island's** answered days, the same number as the ring.

**Growth link:** the day a ring first closes is stored as `firstFullAt`. When the growth step ships, that date plants the island's first lavender. The ring ships on its own; growth does not need it.

---

## 4. Data model and migration

### 4.1 Tracker (`src/types/tracker.ts`)

- New field: `island?: string`. The value is a built-in id or `own-xxxxxxxx`.
- Absent means automatic (cluster → category → `'other'`), so **memap_trackers needs no migration**.
- Written when:
  - a question is added from the card or the guide, or from inside an island;
  - a question is moved.
- Not written by Today's one-tap library `+`.

New questions written on the card are saved with:
- `answerType: 'boolean'`, `periodDays: 30`, `threshold: 10`;
- `problemWhen` from her choice;
- `title` = the short name, or the text without `?`;
- `category`:
  - from a library pick: the template's category;
  - otherwise, from the island (taken from B): me → Emotions; love, kids, parents → Connections; health → Health; body → Body; world → Social; pet, other and own islands → Curious;
- `cluster`: **only from a library pick**, never derived from the island.

### 4.2 New key `memap_islands` (`src/lib/islandStore.ts`)

Read with `safeParse` inside try/catch. Every write dispatches `memap-islands-changed`.

```ts
type IconKey = 'books'|'career'|'coffee'|'family'|'fitness'|'food'|'growth'|'health'|'hobbies'|'home'|'love'|'music'|'pets'|'travel'|'wellbeing';
type LookKey = 'town'|'cottage'|'library'|'studio'|'camp'|'zen'|'pines'|'grove';
interface OwnIsland {
  id: string;                 // 'own-' + uuid().slice(0,8), never reused
  name: string;               // 1–20 chars, as typed
  icon: IconKey;
  look: LookKey;
  spot: 0|1|2|3|4|5;          // which cloud it grew from
  createdAt: string;          // ISO
  revealed?: boolean;         // cloud-parting already played
  firstFullAt?: string;
}
interface IslandStore {
  v: 1;
  own: OwnIsland[];
  edits: Partial<Record<BuiltInId, { name?: string; icon?: IconKey; firstFullAt?: string }>>;
}
```

**Migration:** the default is `{v:1, own:[], edits:{}}`, created on the first write. Nothing in the existing data is rewritten.

On the first Map load after the update:
- set `firstFullAt` to the current date for any island already at ≥28 days;
- seed `memap_island_fill_seen` with each island's current value.

This means her phone (59 days of answers) shows no sparkles and no ring sweeps.

### 4.3 Small keys

| Key | Value |
|---|---|
| `memap_first_q_guide` | `'done'` |
| `memap_last_island` | the last island used in the editor; the default when writing from Today, else `other` |
| `memap_island_fill_seen` | `{[id]: days}` |

### 4.4 `src/lib/islands.ts`

- `IslandId = BuiltInId | \`own-${string}\``.
- `islandOf(t, store) = live(t.island) ?? CLUSTER[t.cluster] ?? CATEGORY[t.category] ?? 'other'`. Unknown or deleted ids are ignored.
- `Island` gains: `own`, `name?`, `icon`, `look`, `globe {lon,lat}`, `flat {fx,fy}`, `fillDays`, `fill`.
- `buildIslands`:
  - leaves out `source: 'play'` trackers;
  - includes own islands with 0 questions;
  - computes the fill in one pass over entries, mapping trackerId → island and including archived trackers;
  - ignores entries of deleted trackers.
- Built-in islands keep their SLOTS by rank. Own islands use `OWN_SPOTS[spot]`.
- **OWN_SPOTS** (lon, lat), nearest to the front first: (36,40), (−38,31), (−32,−38), (58,12), (54,−38), (−62,−12).
  - Each is ≥24° from every built-in slot; tune them on the phone.
  - Scenery islands skip anything within 16° of a spot.
- **Flat map**: positions by rank. With more than 9 islands, switch to a staggered 3-column layout at 0.8× (x = 70 / 185 / 300, rows every 110 px, middle column +55 px).
- **Constants**: `FILL_DAYS`, `OWN_SPOTS`, `LOOKS`, `ICON_ORDER`, `ICON_KEYWORDS`, `NAME_IDEAS`, `EXAMPLES`, `ISLAND_LIBRARY_THEME`.
  - `ISLAND_LIBRARY_THEME`: love → partner, kids → parenting, health → health, body → habits, me → state, pet → pet, parents → elderly-parent, world → external-events; own islands and other → all.

### 4.5 Form changes

- AddTrackerModal and TrackerSettingsModal:
  - remove the Theme select;
  - add `island`;
  - **stop writing `inferClusterFromCategory`**.
- AddTrackerModal gets new props: `islandId?: string` and `startIn?: 'library' | 'own'`.

### 4.6 Assets (`src/assets/map`, webp, about 60 KB)

- **To add**: icon_books, icon_career, icon_coffee, icon_food, icon_home, icon_music, camping_tent, zen_stones, books, art_easel, sparkles. Source: `marketing/brand/map-assets/01_trimmed_png`.
- **To crop first**: neighbour slivers on food and pets (right side) and on home (clipped on the left).

### 4.7 Backup

Add `memap_islands` and `memap_first_q_guide` to `SETTINGS_KEYS` in SettingsModal. Older backups without them still restore: questions pointing at unknown islands fall back to automatic.

### 4.8 Analytics

Never names or question text.

| Event | Fields |
|---|---|
| `island_created` | `{icon, look, from: cloud\|picker\|all\|empty}` |
| `island_edited` | – |
| `island_deleted` | `{questions}` |
| `question_moved` | – |
| `first_q_guide` | `{step, action}` |
| `tracker_added` | gains `source: own\|example\|template` and `island_kind: builtin\|own` |

### 4.9 Locales

Every new string goes into both `en.ts` and `ru.ts`. `ru.ts` is typed by `en.ts`.

---

## 5. Edge cases

1. **Existing bug.** TrackerSettingsModal saves `tracker.cluster ?? inferClusterFromCategory(category)`, so editing any hand-written question silently moves it from Other to Body & habits.
   - Fix: never write an inferred cluster, and the explicit `island` wins in `islandOf`.
   - Questions already moved by this bug stay where they are. The chip lets her move them back.
2. **Map refresh.** MapTab today only listens to `memap-settings-changed`. Add listeners for entries, trackers and islands.
3. **Ball resets.** The WorldMap effect re-runs when `islands` or `routes` change and resets the ball to `MHOME`. Keep the rotation matrix in a ref across re-inits, so a new question or a ring tick never snaps the ball home.
4. **Sheet stacking.** AddTrackerModal is a plain fixed div at z-50. Over the vaul island sheet, render it in a portal at `z-[60]`.
5. **Play cards.** Exclude play-round trackers from islands and from the fill.
6. **Empty own island.** It shows a plain tag, no weather line and no ring. Never show "No answers this week". Built-in islands still appear only once they have a question.
7. **Unknown or deleted island id** (an old backup, another phone): fall back to the automatic island. Nothing is lost or hidden.
8. **All 6 clouds used.** The cloud card, the `+ New island` tile and chip, and the empty-map button are simply not shown. Deleting an own island brings its cloud back.
9. **Duplicate names.**
   - When creating: the button becomes `Open “X”`.
   - In edit mode duplicates are allowed; it is her call.
10. **Long names and emoji.** Input is capped at 20 characters. The canvas tag truncates with … past 150 px. The sheet header wraps to 2 lines.
11. **Language switch.** Own names stay as typed. Built-in names follow the language unless renamed. A cleared rename shows the default again.
12. **Archived questions** keep counting toward the ring and leave the island's list. A built-in island whose questions are all archived leaves the map; an own island stays.
13. **Deleting a question** (Today → question → Delete) leaves its entries orphaned, as today. The ring ignores orphans.
14. **Guide.**
    - X on step 1 saves nothing.
    - Closing on step 2 keeps the question and marks the guide done.
    - The practice swipe is never saved.
    - Old users, and anyone who typed a question in onboarding's "Something else", skip the guide.
15. **No Good/Bad default for typed text.** The button reads `Good or bad?` instead. Existing questions keep their value.
16. **Evening length.** Each new question adds a card to the evening, with no warning (her no-negativity rule). The evening redesign deals with length.
17. **Double taps.** Tapping an example twice quickly adds it once: reuse AddTemplateButton's tap guard and 10 px slop.
18. **Duplicate questions.** DuplicateTrackerDialog runs at Add and at guide step 1. Its "Open existing" from an island opens that question's edit sheet.
19. **Undo after deleting an island** restores the island, its spot and the `island` field on its questions. After 8 s the undo is gone.
20. **Built-in island picked before it is on the map.** The question is saved with that island, which appears at its rank slot on the next render. No cloud-parting.
21. **Renamed while open.** If an island is renamed while its sheet or the map is open, the tag and header update at once through `memap-islands-changed`.
22. **Storage write fails** (private mode, full storage): show the neutral `Couldn't save. Try again` / `Не получилось сохранить. Попробуй ещё раз`, keep what she typed, nothing red.
23. **Accessibility.**
    - The canvas gets a screen-reader-only list of island buttons ("Career, 43% filled") plus a `New island` button.
    - The All-sheet chips carry the same labels.
    - Every new control is at least 44 px.
24. **Reduce Motion.** No cloud-parting, no ring sweep, no glide or wiggle; final states appear instantly.
25. **Classic UI** ignores `island` and `memap_islands`, so switching looks back and forth keeps everything.

---

## 6. Ship in 3 steps (she approves each one)

1. **Data and map**:
   - islandStore;
   - `island` field and `islandOf`;
   - own islands at the clouds;
   - fill rings with the saved "last seen" value;
   - event listeners and keeping the ball's rotation;
   - excluding play cards;
   - the island-only Findings count.
2. **Island sheet hub and Island create/edit sheet**:
   - questions block and empty state;
   - create, edit and delete, with undo;
   - built-in renames;
   - the All-sheet chips.
3. **Card editor, island picker and guide**:
   - the card editor and island picker;
   - the 2-step first-question guide;
   - removing Theme and fixing the inferred-cluster bug;
   - toasts;
   - backup keys.