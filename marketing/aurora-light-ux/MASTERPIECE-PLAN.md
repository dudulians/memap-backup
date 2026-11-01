> Nov 2 note from Uliana, after the plan was written: she no longer likes the built Map/globe: "как будто просто накиданы разные элементы, планки, непонятные цифры, непонятно что к чему относится". The Map section must be redesigned for clarity before more work on it.

# MeMap: The Masterpiece Plan (final)

*Version 2.0 ("Aurora Light"), branch `design/aurora-ux`. The old 1.7.9 screens in `src/classic/` stay as they are and are not part of this plan.*

*Her ask today: "по бокам этих кружков на пути были какие-то штучки, чтоб пусто не было" and "тени или объёма добавить в стиле приложения". The full answer is in §3.2.5 (road and depth), §3.2.6 (decorations) and roadmap step 2.*

---

## 1. What is wrong right now

1. **The swipe doesn't work on the first card.**
   - On a new person's first card, the card does not move under the finger. The one-time wiggle (`index.css:1779`, fill-mode `both`) overrides the drag (`DailySession.tsx:1309-1318`).
   - The hint chevrons are drawn underneath the card (`:1280-1293`), so nobody sees them.
   - The hint is then switched off for good after the first answer, even when that answer was a button tap (`:514-521`).
   - On every later card, dragging shows no YES/NO and no card behind it.
   - Her words: *"не понимаю, где нужно свайпать карточки"*

2. **The path is a picture, not a game.**
   - 6 of 7 stops are `disabled` buttons (`EveningPath.tsx:107`). Tapping one gives no press, no haptic and opens nothing.
   - Tonight's stop shrinks 5% and drops you straight into the cards.
   - Her words: *"кружочки должны отжиматься… нажимаешь на путь, и что-то происходит"*

3. **Today looks cheap** (`audit-shots/en/06-today-full.png`).
   - Flat discs inside 4px white "sticker" rings.
   - The road is a dotted line at 16% opacity.
   - Five padlocks and a stock gift icon.
   - A radar ping that never stops.
   - "Week 9 · Keep going".
   - Two chips with the same number: "59 days in a row" and "59 evenings".
   - Bare space on both sides of the zigzag. The stops sit in a fixed 340 box (`EveningPath.tsx:16-20`, `XS=[140,220,250,200,120,90,150]`).
   - A 19-row grey list underneath.
   - Surfaces use a dark-theme recipe (`bg-foreground/[0.07]`, 24 uses in `src/`, from `grep -rho 'bg-foreground/\[0.07\]' src | wc -l`). On Light it turns flat grey.
   - Her words: *"блок «Сегодня» уже смотрится очень дёшево"*

4. **Questions don't read as questions.** Each question appears in three wordings:
   - onboarding: "Did you sleep OK the night before?"
   - the list: "Slept enough (7+ hours)"
   - the card: "Did you sleep at least 7 hours and feel rested?"

   The list shows statements, the Russian text is full of "(а)" brackets, and many questions join two things or say "today". The exact counts come from the script in step 4. No number is quoted until that script has run.
   - Her words: *"вопросы по-дурацки выглядят, на самом деле ни как вопросы"*

5. **The reward leads nowhere.**
   - "Report ready · Open", "Last week's report →" and "See my patterns" all switch to the bare globe (`TodayTab.tsx:912-918, 955-958` → `Index.tsx:161`).
   - There is no chest.
   - Findings say "about 14 evenings" while the path promised 7.
   - Her words: *"ещё чего-то не хватает"*

6. **Nobody explains the journey.**
   - Onboarding ends on a blank "Logged.".
   - The first answers are button taps, so the swipe first appears on day 2.
   - Each evening ends in a menu of five rows with confetti, even on a hard day.
   - Her words: *"что-то ничего не понимаю"*

7. **Some things break her standing rules.**
   - Limit pushes saying "Time to act" are on by default (`notifications.ts:69`).
   - A red "5" badge sits on Limits.
   - "STORMY WEEK" shows on almost every island (`islands.ts:91-99`).
   - "My mood" is the second tile on the first screen.
   - The lock screen shows question titles such as «Поссорился(ась) с партнёром».
   - The privacy line says "Everything stays on this phone", but analytics are sent.

8. **Hidden bugs she can feel.**
   - The reminder opens the evening on the UTC date, so in New York the answers save to tomorrow. If the app stays open overnight, it opens yesterday (`TodayTab.tsx:176-180, 229-239`).
   - The path count leaves out play cards but the deck includes them ("8 questions" vs "1 of 18").
   - Once half the cards are answered, the rest can't be reached.
   - Russian text never shows in the app font, because DM Sans has no Cyrillic.

9. **Nothing new is safe in git.** `git status` on `design/aurora-ux` shows these files untracked: `MapTab.tsx`, `WorldMap.tsx`, `src/lib/islands.ts`, `src/assets/map/` and `marketing/brand/map-assets/`. These have uncommitted changes: `FindingsView.tsx`, `PatternsTab.tsx`, `index.css`, `en.ts`, `ru.ts` and `Index.tsx`.

---

## 2. Fix first (P0)

**Four phone links in a fixed order.** Each one is its own commit, and she tries each one before the next starts:

1. step 1, bugs;
2. step 2, Today plus one decorated week, which she reviews;
3. step 3, cards;
4. step 4, words.

**Step 0: safety (no phone link)**
- Commit and push everything listed in §1.9 (untracked and modified) to `design/aurora-ux`.

**Step 1: bugs under her complaints (all small)**
- **First card frozen.**
  - Set `.ds-first-wiggle` to fill-mode `none`.
  - Remove the class on `pointerdown`.
  - Add `select-none` and `-webkit-touch-callout:none` to the card.
- **Date.**
  - Use `isoLocal` everywhere in TodayTab.
  - `memap-open-session` always opens tonight in local time.
  - On resume, if the day has changed, bump `refreshKey`.
  - Add the date to the EveningPath memo.
- **One "tonight's cards" function**, shared by the path, the pill and the deck. Play cards stay out until she taps Keep.
- **Report buttons.** A `memap-open-map` event `{island|'all', section}` that MapTab handles. All three buttons open the World sheet on Links, never the bare globe. This is a stopgap until the chest exists.
- **Limit pushes off by default.**
  - A one-time migration sets `memap_threshold_alerts='false'`.
  - The red badge is removed.
  - Classic keeps its own behaviour.
- **Smaller fixes:**
  - no question titles on the lock screen;
  - the privacy line from §3.7;
  - Android tap haptic = `impact Light`;
  - a global Reduce Motion rule.

**Step 2: Today stops looking cheap, and the path gets its scenery (her ask)**
- **Shared blocks from §6:** `Pressable`, `PathBubble`, white `.surface`, the depth road (§3.2.5), and 3D stops (§3.2.9).
- **Path details:**
  - her chest art on stop 7;
  - weekday letters instead of padlocks;
  - a still halo on tonight's stop instead of the ping;
  - one flame chip;
  - tonight keeps a visible "START" tag.
- **Decorations by the stops (§3.2.6).**
  - In P0 only the plain set, plus a flower next to each done stop.
  - No earned items, because `rewards` arrives in step 9.
  - Everything is static.
- **Art export first.** These pieces exist only as PNGs in `marketing/brand/map-assets/01_trimmed_png/{nature,islands,weather,buildings,objects}` and `extra/`: lavender, round_bush, rock_cluster, single_rock, water_ripple, cloud_small, wooden_bridge, marker_flag, rainbow, hot_air_balloon, moon_and_stars, zen_stones, camping_tent, wooden_signpost, sparkles, chest_closed, chest_open_map.
  - Export them to webp in `src/assets/map/`, which today holds 29 webp files.
- **"Try as a new user" in the phone link.** One button that resets to a door user on day 1 of week 1, next to the current 59-evening demo. She judges the scenery on both.
- **What she reviews:**
  - the phone link;
  - 4 PNG mockups at 390×844: demo week 9 and new-user week 1, each in light and dark;
  - saved to `marketing/aurora-light-ux/19-path-scenery-*.png`.

  She approves these before decorations go on past or coming weeks (step 5).

**Step 3: cards (the swipe made obvious, §3.3)**
- The next card peeks behind.
- A slate YES/NO stamp follows the drag.
- One haptic at the threshold.
- Small flat arrow hints.
- Lesson v2.
- The island chip and picture on the card.

**Step 4: words (§5)**
- A bundled Cyrillic font.
- About 30 of the most-seen questions rewritten in EN and RU.
- One text per question everywhere.
- Plural forms.
- Он/Она asked once.
- Run the counting script (§5) first and quote its output.

---

## 3. Screen by screen

### 3.1 Onboarding

| Now | Target |
|---|---|
| Language: a line icon in a mint circle, short "Next" | Her island scene (island_plain + cherry tree + sailboat, ~220pt), a full-width 56pt Next, top padding = safe area + 24 |
| "What brings you here? · Pick one or more." with **My mood** second; grey cards, dashed boxes | **"Something keeps happening?"**: Fights · Migraine · Drinking · My sleep · Kid's nights · Something else (mood lives under it). White cards, her 44pt category tiles, no helper line |
| "And around it?" as rows of buttons | **"What else was that day?"** as the real swipe deck (the same card component), 3 cards, with a practice coach on card 1 ("Swipe right = Yes"). **This is the first swipe lesson, so swiping starts on day 1.** |
| Blank "Logged." + Он/Она row + reminder | **"Tonight: 4 questions"**: a 3-stop mini path (✓ Today → Every evening · swipe · 1 min → Day 7 · your chest), the reminder row, then **"Got it"**. If tonight was already filled in: "Evening 1 ✓", and Today opens with the done stop's bubble open |
| The Map is never introduced | After this: optional "Build your world" area tiles (question 3), then the clouds part over her islands (~1.2s, one calm move) |

### 3.2 Today and the path

1. **Header.** Transparent over her sea-at-dawn picture. In dark theme, a night-sea version: the same picture at about 35% brightness under `hsl(205 40% 10%)`.
   - Left: one 3D flame chip, "59". It counts evenings in a row by the path's own rule, so it can never disagree with the path.
   - Centre: "MeMap".
   - Right: the gear, always.
   - If she chose an avatar, it sits inside the gear's place as a 32pt round picture, and **tapping it opens Settings**.
   - Remove the second chip and the hairline.

2. **Endless weekly units.** Built in step 5; P0 shows only the current week.
   - Each week: a sticky banner (76pt, Pressable slab), 7 stops, then the chest.
   - Past weeks sit above with opened chests and load 4 at a time.
   - Two coming weeks sit below.
   - **New user:** week 1 is the current week, so it shows the full scenery at 100% ("сразу прочувствовал"). Only weeks *after* the current one get the 45% look.
   - **Old user:** their path starts at their own week 1. Past evenings fold into one "59 evenings so far" chip above it. No 8 empty past weeks.
   - **Scroll:** tonight sits at 42% of the screen height. The scroll runs after layout (after images have sizes, see rule 6g) and after Index resets the page to the top.

3. **Banner.** "WEEK 1" in 13pt caps, the title in 22pt bold.
   - Titles: W1 "Collect clues", W2 "Test one change", W3 "Open a new island", W4 "Your month", then the four repeat. Never "Keep going".
   - Colours per week: teal, gold, sky, lilac.
   - Right side: chest_closed at 44pt, a 7-segment ring and "3/7".
   - Tap: a bubble with the week's 7 tasks (icon + 2-4 words each).

4. **Geometry.**
   - STEP goes from 74 to 96.
   - XS keeps its rhythm but is scaled to the screen width: `x = XS[i] / 340 × (screenW − 32) + 16`.
   - Stops 68pt, tonight 84pt, chest 92pt (radius r = 34 / 42 / 46).
   - 16-24pt between the banner and the first stop.

5. **Road with depth (her "объём").** One SVG per week. Starting values, to be checked in both themes:

   | Layer | Light | Dark |
   |---|---|---|
   | Ribbon (16px) | `hsl(195 40% 97%)` | `hsl(200 25% 22%)` |
   | Under-stroke (18px, shifted 3px down) | `hsl(195 25% 82%)` | `hsl(205 30% 12%)` |
   | Drop shadow | `0 4px 10px rgba(16,42,56,.12)` | `0 4px 12px rgba(0,0,0,.45)` |
   | Walked dashes | teal `--primary` | teal `--primary` |
   | Dashes ahead | slate `hsl(200 15% 70%)` | `hsl(200 12% 45%)` |

6. **Decorations so the sides aren't empty (her ask).**

   a. **Placement algorithm** (for each gap between stop i and stop i+1):
      1. `minX`, `maxX` = the two stops' x values; `r` = the larger radius.
      2. Free bands = `[16, minX − r − 28]` and `[maxX + r + 28, screenW − 16]`. The bands use the full screen width minus the 16pt gutter, not the 340 box. On a 375pt screen the box leaves only about 17px outside it.
      3. Pick the wider band. If it is narrower than 44px, leave that gap empty.
      4. Centre the piece in the band. `y` = midpoint of the gap ± a seeded 8px jitter.
      5. Piece width = min(band width, its size limit, pixel width ÷ 2).

   b. **Size limits from the real art** (pixel width ÷ 2, so nothing looks soft on a 3× phone):

      | Piece | Pixels | Max on screen |
      |---|---|---|
      | lavender | 143×110 | 72pt |
      | round_bush | 111×73 | 56pt |
      | cloud_small | 106×63 | 53pt |
      | rock_cluster | 144×60 | 72pt |
      | pine_tree | 127×149 | 64pt |
      | sailboat | 123×131 | 62pt |
      | hot_air_balloon | 94×125 | 47pt |
      | water_ripple | 183×73 | 92pt |
      | island_plain | 272×141 | 96pt |
      | chest | 1004×849 | no limit |

      In parallel, ask her for 2-3× exports of these pieces (§6 Icons). When they arrive, the limits rise to the spec sizes (44-72pt, islands 96pt).

   c. **Collisions.**
      - Check only against things that don't move: stops, the START tag, banners, the avatar slot and tonight's label.
      - Bubbles float above everything (z-index) and never remove a piece.
      - **The avatar slot (60pt beside tonight) is always kept clear**, even with no avatar. Choosing Malu later then never reshuffles the scene.

   d. **Stable scene.** The seed is the week number. Weekly sets rotate by `set = SETS[(week − 1) % 4]`. Week 9 = set A. Only files that exist after the step 2 export are used:

      | Set | Pieces |
      |---|---|
      | A | island_plain + water_ripple, pine_tree, round_bush, cloud_small, rock_cluster, island_lotus + water_ripple |
      | B | green_tree, flowering_bush, lavender, single_rock, sailboat + water_ripple, cloud_small |
      | C | cherry_blossom_tree, orange_tree, zen_stones, round_bush, island_rocky + water_ripple, cloud_small |
      | D | palm_trees, lavender, rock_cluster, camping_tent, island_waterfall + water_ripple, wooden_signpost |

   e. **Earned items are never scenery.** Lighthouse, wooden_bridge, marker_flag, hot_air_balloon, rainbow and chest mean "you earned this" (growth = details added for actions). No set A-D contains them.
      - **Decision:** the path shows only flowers (a lavender tuft or a small flowering_bush next to each done stop). Earned items live only on the Map (step 9). One place, no duplicates.

   f. **Depth on the scenery.**
      - Every piece stands on a contact-shadow ellipse: light `rgba(20,60,80,.14)`, dark `rgba(0,0,0,.40)`.
      - Islands and boats also sit on water_ripple.
      - The coming-week look: 45% opacity in light. In dark, 60% opacity plus `saturate(.7)`, so it doesn't go muddy.

   g. **Technical rules.**
      - Explicit width and height on every `<img>`.
      - `decoding="async"`.
      - `loading="lazy"` outside ±1 week.
      - Pieces are `pointer-events:none` and `aria-hidden`.
      - Only ±1 week of SVG and scenery is rendered.

   h. **Motion.** In P0 every piece is fully static. A slow sailboat bob (±2px over 6s) is added only after she approves the static week, and it stops under Reduce Motion. Clouds never move.

7. **Avatar.**
   - Optional, and nothing is shown by default.
   - When chosen: 60pt in the reserved slot beside tonight's stop.
   - No breathing while tonight's halo is on screen.
   - After an evening it hops one stop forward.

8. **Under the current week.**
   - Keep one chip, "My questions · 19 →", which opens the list sheet.
   - Moving the list into the islands is her call (question 2).
   - Remove from Today:
     - the reminder banner (it moves to the end of the first evening);
     - the "Happened just now? + Fight" card (it moves into the mystery's island as "Log a fight").
   - Add a soft fade behind the floating tab bar.

9. **Stops: 3D coins and their states.**
   - **3D on a round stop.** A darker circle of the same size sits behind the face, shifted 6px down. That is the lip, built from the tokens `--lip-teal/-slate/-gold`. On top:
     - a face gradient 6% lighter at the top-left;
     - an inner top highlight `inset 0 2px 0 rgba(255,255,255,.35)`;
     - a ground ellipse shadow.
   - **Press:** the face sinks 4px and the lip shrinks from 6 to 2px.
   - **The 4px white "sticker" ring goes.** Its job (showing progress) moves to a 4px **teal progress ring** for questions answered, plus a gold arc for the bonus (step 11).
   - Tonight's stop always shows the "START" tag and the line "N questions" under it, without a tap.

   | Stop | Look | Tap |
   |---|---|---|
   | Tonight | 84pt teal coin, moon icon, "START" tag + "19 questions" | Bubble "Tonight · 19 questions · ~1 min" + START (medium haptic). A "Fill in Tuesday?" chip when one of the last 2 days is empty. On day 1 the bubble is already open |
   | Tonight, partly answered | Partial teal ring | "12 left · ~1 min" + CONTINUE. The leftovers stay reachable after the evening counts |
   | Done | Teal check, a flower beside it | Weekday and date, "18 answers", a row of dots (filled = yes, ring = no, grey = skipped; never red or green), "Open the day" |
   | Next | White face, moon_and_stars | Wiggle + "Opens tomorrow evening" |
   | Later | Weekday letters "WED" | "In 3 evenings" |
   | Chest, not ready | chest_closed on a gold coin, 7-segment ring | Wiggle + "4 evenings to go" |
   | Chest, ready | A still gold glow + sparkles (static in P0) | Opens the chest sequence (§3.4) |

   Stop labels next to the stops (as in target `5-every-stop-means-something.png`) are question 9. Until she answers, the side space goes to decorations, and tonight carries its own label.

### 3.3 Evening session and cards

**Now:** "Tonight · 1 of 19", a 7-day strip, a blank 366×466 white slab, grey No/Yes pills, 12 dashes at the bottom, and a "boomerang" where the next card flies back in from the side you threw the last one.

**Target. The swipe is the main way to answer; it is her signature ("прикольно что-то свайпать").**

- **Header.**
  - X on the left, Undo on the right.
  - In the centre, small coins for the current round, with a date chip "Tonight ▾" above them. The date strip is hidden by default, slides down on tap, starts from the install day and has dots on answered days.
  - Remove the bottom dashes.
- **Rounds of up to 7.** Between rounds there is a card inside the deck.
  - When half the cards (and at least 2) are answered: "Evening counted!" + KEEP GOING / "Done for tonight".
  - Otherwise: "Next: Love" for 1s.
- **Card.**
  - 342×~460, radius 28, solid white with the island colour at 6% at the top.
  - A shadow plus a slate lip, with two cards stacked behind.
  - Top to bottom: the island chip (her category icon + name), the island picture (150pt, the same one the Map uses), the question in 30pt bold, at most 3 lines.
  - Never translucent glass. Hover styles only under `@media (hover:hover)`.
- **The swipe.**
  - The next card peeks behind (.96 scale, 8px lower).
  - Tilt = dragX × 0.04°.
  - A slate YES/NO stamp (RU ДА/НЕТ) whose opacity follows the drag.
  - One `swipe` haptic at the threshold and one `medium` haptic on commit.
  - The top card flies off and the back card rises (200ms spring). No boomerang.
  - Driven by a ref and a CSS variable, not React state.
- **Hints, not buttons.**
  - Under the card, two small flat arrow hints, "← No" and "Yes →" (about 44pt tall, no 3D, slate text).
  - The hint on the dragged side darkens a little.
  - Tapping a hint answers too, as an accessibility fallback, with the same stamp and fly-off.
  - "Not sure" is a text link under them.
  - The hints sit outside the card's `data-vaul-no-drag` zone.
- **Lesson.** Onboarding's swipe deck is the first lesson.
  - Flag `memap_swipe_lesson_v2`: two practice cards with a ghost hand, answers not saved, "Skip lesson" at the top right.
  - It is shown only to people who never swiped in onboarding (old users, question 6).
  - The flag is set after 3 real swipes.
  - Under Reduce Motion: no hand, only the label pulses.
- **Order of cards.**
  1. a neutral world fact first;
  2. then test, mystery and lighthouse questions;
  3. then grouped by island, with hard ones in the middle;
  4. a light one last.

  Each template gets a `tone` tag.
- **Answer back (main question only).** "Noted · 2nd this week" for 1.6s. Counts only, never a comparison.

### 3.4 End of the evening and the week chest

**End of the evening.** Now there is confetti, "60 дн. подряд", "ответил(а) на 4 вопросов" and five rows. Target:

1. Tonight's coin at 96pt fills its ring (700ms), then a check pops in with a `success` haptic.
2. "Evening done!" + two 3D tiles, "🔥 60 in a row" and "19 answers", with correct plural forms.
3. An optional gold bonus card ("Go" / "Later").
4. First evening only: "Remind me at 21:00?" with Yes / Not now.
5. One button, CONTINUE. Back on Today, one thing at a time (~1.2s in total):
   - the ring closes;
   - the flower pops in;
   - the avatar hops;
   - the next stop shows "See you tomorrow".
6. **Hard day:** the same fill, slower. No confetti, no sparkles, a kind line.

**Week chest** (target `18-week-chest.png`):

1. The chest drops in: "Your chest is ready".
2. The lid opens (chest_open_map, `medium` haptic): "A map of your week".
3. The answer:
   - the main line from `doorCounts().last7` and `strongestContextFact` ("Fights · 2 of 7 evenings", "3 of 3 came after a bad night · early");
   - up to 3 more rows;
   - "No link yet" only after N days on both sides;
   - if nothing stands out: "Calm week · 0 fights in 7 evenings". Never "Nothing to show".
4. "You earned: a bridge", then **"Put it on my map"** (`success` haptic). The item drops onto the island on the Map, never onto the path.

The contents are saved as a snapshot when the chest is opened. Opened chests reopen at step 3.

### 3.5 Map and the island sheet

| Now | Target |
|---|---|
| "All", Globe/Map, "Roll it with your finger" | Title "Your world · this week". "All" becomes **World**. Globe/Flat as two icons. The hint shows once |
| Storms on every island | **Honest weather:** this week compared with her own last 4 weeks (calmer / usual / rougher than usual). Only problem-Yes questions count. Nothing before 3 answered days. Legend chips "Often · Sometimes · Calm" |
| Tap → Findings "Nothing to show yet" | **Island stats first:** this week's ring, hard days, weather, top link, links to other islands, lighthouse status. Then the tabs **Questions** (each written as a question, plus "+ Add a question here" and "Move to…"), Calendar (with Share as a picture/PDF), Charts, Lighthouses |
| World: n/a | World stats: evenings, streak, per-island fill bars, strongest links, lit lighthouses, the week chest. The same tabs for all questions |
| Route pills "11 of 14" | "🔗 11 of 14". Tap shows "Short night → headache next day · 11 of 14 times" |
| Limits: rose rows, "What now?", red badge | **Lighthouses:** "IF no workout 12+ days in 30 → THEN your plan". When crossed: gold "Lit up · time for your plan" and a lit lighthouse on the map; "Remind me" is off by default. Library rules show as "Example rule · Make it mine" |
| Dark theme: white-on-white controls | Fixed ink on light glass in both themes; a night globe in dark |
| Engine | No `roundRect` (iOS 15); DPR capped at 2; static layers cached; labels kept on screen; boat drawn before route pills; labels in the app font; the globe turns slowly (it made her dizzy before) |

**Islands and questions**
- **Migration order:** cluster → title match (`matchTemplateIdByTitle`) → category → "My own".
- **New islands:** WORK, Career, Money, Home.
- **Own islands:** a name, an icon from her category set, and an island look.
- **First own question:** a short guided flow.
- **Fill ring:** a calm ring per island.
- **Earned items** (bridge, balloon, flag, rainbow, lighthouse) appear only here (step 9).

### 3.6 Notes

- Title "Notes" with an eyebrow "0 notes" (no double title).
- Empty state: a faded EXAMPLE card ("Tue · Kid awake till 11 pm, room felt hot." + island tag) and a 56pt "Write a note" button.
- Notes are tagged by **island**, not by 19 question titles.
- Later: voice ("Tap and talk", on-device recognition where available).
- Sea-at-dawn background (night version in dark) and a transparent header, as on Today.

### 3.7 Settings

- White grouped `.surface` cards, 52pt rows, each with a 32pt tinted icon.
- Theme as a segmented control. Switches: on = solid primary teal.
- New rows:
  - Avatar (at the top);
  - "Remind me of my plan" (off);
  - **"Old look"**, which sets `memap_ui=classic` and reloads.
- Rename "Профиль" to "Как обращаться" until the gender-free copy makes it unnecessary.
- Privacy headline: **"Your answers are stored on this phone"**. Under "More": "We only see anonymous events like 'evening done' and the topic you picked. Never your answers or notes."
- The reminder never shows a question: "MeMap · Tonight · 4 questions · 1 minute".
- Sound is off by default. When on, one neutral "tock" for both Yes and No.

### 3.8 Old-user upgrade (target `10-old-users-upgrade.png`)

Ships after P0 and the date fix.

1. Classic Today shows the invite once: "Try the new MeMap?" with "Your answers come with you · Switch back any time" and Try it / Not now.
2. "Building your map · from your 34 evenings".
3. Three cards built from their own data: questions → islands, first link → sea route, limits → lighthouses.
4. "Open my map".

Their path starts at "Week 1 of your map", with past evenings folded into the "59 evenings so far" chip above it, never "Week 9" and never empty past weeks. Lesson v2 is shown once (question 6). No data migration: both versions share the same storage.

---

## 4. Roadmap in build order

| # | Ships | Smallest worthwhile version | Phone link | Depends on |
|---|---|---|---|---|
| 0 | Safety | Commit every untracked and modified file from §1.9; locale type `DeepString`; a `check` script (tsc + RU gender); add `memap_door/interview/theme/language/ui` to the backup | no | none |
| 1 | **Bugs she can feel** | Local date + rollover; shared tonight deck; report buttons → World/Links; limit pushes off, no red badge; first-card freeze; no lock-screen titles; privacy line; Android tap haptic; Reduce Motion rule | yes | 0 |
| 2 | **Today P0 + scenery** | Art export to webp; `Pressable`, `PathBubble`, `.surface`; depth road (light+dark tokens); 3D coin stops with the teal ring; chest art; no padlocks; still halo; one flame chip; static plain set A-D + flowers; "Try as a new user"; review PNGs `19-path-scenery-*` | yes, she approves | 1 |
| 3 | **Cards P0** | Stack + peek, stamps, flat arrow hints, threshold haptic, lesson v2, island chip + picture | yes | 1 |
| 4 | **Words P0** | Counting script; bundled Cyrillic font; ~30 most-seen questions in EN/RU; one display text everywhere; plural forms; Он/Она once | yes | 1 |
| 5 | Endless path | `weeks()` in eveningPath; sticky banners; past/coming weeks; scenery on every week (approved look); old-user folded chip; rounds + "Evening counted!"; new end of evening | yes | 2, 3 |
| 6 | Week chest | Chest sequence with snapshot (`memap_week_chests`); counts + early clue; "Put it on my map" | yes | 5 |
| 7 | World data | `memap_world` v1 (areas, avatar, mysteries, rewards, bonuses) + migration + backup; `tracker.island` override; `useMemapData()` | no | 0 |
| 8 | Map P1 | Island stats first + Questions tab; World sheet; honest weather; legend; route pills; dark controls; engine fixes | yes | 7 |
| 9 | Growth on the map | Bridge / balloon / flag / rainbow / lighthouse recorded once in `rewards`, shown only on the Map | yes | 6, 8 |
| 10 | Lighthouses | IF → THEN rules, lit state, "Your rule started" chart mark | yes | 8 |
| 11 | Weekly bonuses | Gold arc per stop; W1 tasks (calendar, practice*, first chart, note, rule) open the right sheet | yes | 5, 8, 10 |
| 12 | Avatars | Picker of 30 (Malu first, "No avatar"); in the header (opens Settings), in the reserved slot beside tonight | yes | 7 |
| 13 | Islands she makes | WORK / Career / Money / Home; own islands; move a question; first-question flow; fill ring | yes | 7, 8 |
| 14 | Full question rewrite | Every template the counting script lists, EN/RU, tone tags, `trackerLocalize` keys, live preview + gentle tip when writing | yes | 4 |
| 15 | Onboarding v2 | "Something keeps happening?", swipe context deck (= first lesson), "Tonight: 4 questions", clouds part | yes | 3, 7 |
| 16 | Old-user upgrade | Invite, 3 cards from their own data, "Old look" switch | yes | 1, 8, 10 |
| 17 | Mystery engine | Suspects screen; moon + weekday as virtual series; weekly test ("It works for you" / "No clear change yet"); flag on solve; rainbow when a storm clears | yes | 6, 7, 15 |
| 18 | Later | One sailboat bob (only if she approves); weather (iOS first, opt-in); voice notes; weekday chart; doctor one-pager; analytics events (`path_stop_tapped`, `session_finished{swiped,tapped}`…) | yes | 17 |

\* Practice copy is checked against sources before it ships.

---

## 5. Words

**How we count (step 4, before quoting any number)**
- A small node script in the scratchpad imports `src/lib/lifeStreams.ts` and the locales. It prints:
  - the number of question templates;
  - how many RU titles contain "(а)" or "(ась)";
  - how many EN titles contain " and ", " or " or "/";
  - how many contain "today" or «сегодня».
- `grep -c 'id: "' src/lib/lifeStreams.ts` returns 189, but that also counts ids that are not templates, so it is not the template count.
- The plan quotes only the script's output.

**Question rules**
- One fact per card: no "and", "or", "/" or brackets.
- At most 7 words in EN and 6 in RU, ending in "?".
- No "today" / «сегодня» (the header already names the day).
- Speak to "you". RU: verb first, no «ли», no «я/мне», gender-free.
- YES means it happened. No double negatives.
- Hard events in neutral words.
- Never rewrite her own questions.

**Glossary (one word per thing)**

| Concept | EN | RU |
|---|---|---|
| A night of answers | evening | вечер |
| Weekly reward | chest | сундук |
| A pair that goes together | link | связь |
| Her own rule | lighthouse | маяк |
| A life area | island | остров |
| The tab | map | карта |
| A written entry | note | заметка |

**Most visible strings**

| Where | Now (EN / RU) | New EN | New RU |
|---|---|---|---|
| Card | Did anxiety show up today? / Приходила тревога сегодня? | Felt anxious? | Было тревожно? |
| Card | Did you sleep at least 7 hours and feel rested? / Спал(а) ли минимум 7 часов… | Slept 7+ hours? | Удалось поспать 7+ часов? |
| Card | Did your partner bring you flowers today? / Партнёр подарил мне цветы сегодня? | Flowers from your partner? | Цветы от партнёра? |
| Card | Did you have a headache today? / Болела ли сегодня голова? | Had a headache? | Болела голова? |
| Card | Did you have a real argument with your partner today? | A fight with your partner? | Была ссора? |
| Card | Was outside at least 30 min? / Был хотя бы 30 минут на улице? | 30 minutes outside? | Полчаса на улице? |
| Card | Said yes when meant no / Сказал(а) «да» когда хотел(а) «нет» | Said yes, meant no? | Было «да» вместо «нет»? |
| Session header | Tonight · 1 of 19 / Вечер · 1 из 19 | Tonight ▾ (+ round coins) | Сегодня ▾ |
| Answer hints | No / Yes · Нет / Да (buttons) | ← No · Yes → (small hints) | ← Нет · Да → |
| Week title | Keep going / Продолжаем | Collect clues · Test one change · Open a new island · Your month | Собираем улики · Проверь одну вещь · Открой новый остров · Твой месяц |
| Chips | 59 days in a row + 59 evenings | 🔥 59 | 🔥 59 (bubble: 59 вечеров подряд) |
| Tonight stop | (ping, no label) | START · 19 questions | НАЧАТЬ · 19 вопросов |
| Gift | Week report · in 4 evenings / Отчёт недели | Chest · 4 more evenings | Сундук · ещё 4 вечера |
| Ready | Report ready · Open | Your chest is ready · Open | Сундук готов · Открыть |
| Future stop | 🔒 | Opens tomorrow evening / In 3 evenings | Откроется завтра вечером / Через 3 вечера |
| Missed | Answer for yesterday (below the fold) | Fill in Tuesday? | Заполнить вторник? |
| Old user | (Week 9) | 59 evenings so far | 59 вечеров уже позади |
| End | You answered 4 questions today / ответил(а) на 4 вопросов | Evening done! · 4 answers | Вечер готов! · 4 ответа |
| End | See my patterns | (removed) → CONTINUE | ДАЛЬШЕ |
| Halfway | (none) | Evening counted! · Keep going / Done for tonight | Вечер засчитан! · Дальше / На сегодня хватит |
| Onboarding | What brings you here? Pick one or more. | Something keeps happening? | Что-то повторяется? |
| Onboarding | And around it? / А вокруг? | What else was that day? | Что ещё было в тот день? |
| Onboarding end | Logged. · Go to today / Записано. · Начать | Tonight: 4 questions · Got it | Вечером — 4 вопроса · Понятно |
| Findings tab | Findings / Находки | Links | Связи |
| Finding | "Felt happy" came less often the day before "Worked out" | Bad night → fight next day · 4 of 5 times | Плохая ночь → ссора на следующий день · 4 из 5 раз |
| Status | Holds up · 11 of 11 / Подтверждается | 11 of 11 (+ "early" tag when young) | 11 из 11 (+ «рано судить») |
| Footer | …not proof of cause | Things that match, not causes. | Совпадения, не причины. |
| Limits | Limits · What now? / Пороги · Что делать? | IF no workout 12+ days in 30 → THEN your plan · Lit up | ЕСЛИ без тренировки 12+ дней из 30 → ТОГДА твой план · Маяк горит |
| Push | Action signal reached… Time to act. / Пора что-то с этим делать | Time for your plan (opt-in only) | Время для твоего плана |
| Reminder | (question title on the lock screen) | Tonight · 4 questions · 1 minute | Вечер · 4 вопроса · 1 минута |
| Map | All · Roll it with your finger | World · Your world · this week | Мир · Твой мир · эта неделя |
| Weather | STORMY WEEK / ШТОРМОВАЯ НЕДЕЛЯ | Rougher than usual · headache, 5 days | Тяжелее обычного · головная боль, 5 дней |
| Privacy | Everything stays on this phone | Your answers are stored on this phone | Ответы хранятся на этом телефоне |
| Notes empty | Nothing here yet | EXAMPLE card + Write a note | ПРИМЕР + Написать заметку |
| Close (a11y) | "Session complete", "Close" (hardcoded English) | Evening saved · Close | Вечер записан · Закрыть |

---

## 6. Polish system

**Type** (one bundled font with Cyrillic; body letter-spacing 0)

| Style | Size / weight / tracking | Used for |
|---|---|---|
| display | 32/700/-0.02em | page titles |
| title | 22/700/-0.015em | card and banner titles |
| card question | 30/700 | the evening question |
| body | 17/500 | rows, notes |
| secondary | 15/500 | supporting text |
| caption | 13/600 | eyebrows, stop tags; caps +0.06em |
| micro | 11/600 | tab labels |

- On the path, no second grey lines: each label is one short line.
- Radii: 12 for chips, 20 for cards, 28 for sheets and the evening card, full for coins and pills.

**Spacing**
- 16pt screen gutters, 8pt grid.
- Rows 52pt; tap targets at least 44×44 (extend hit areas with `before:-inset`).
- Main content padded to the nav height + 24, with a fade behind the floating tab bar.

**Depth** (one recipe, all values from tokens, both themes)
- **Surface:**
  - light: white .92, a 1px white border, shadow `0 1px 2px rgba(16,42,56,.05), 0 10px 24px -14px rgba(16,42,56,.18)`;
  - dark: `hsl(205 25% 16%)`, a 1px `rgba(255,255,255,.06)` border, shadow `0 10px 24px -12px rgba(0,0,0,.55)`.
- **Raised slab (Pressable):**
  - face gradient 6% lighter at the top-left;
  - inner top highlight `inset 0 2px 0 rgba(255,255,255,.35)`;
  - lip `0 6px 0` = the face colour darkened 18% (never black or grey), from `--lip-teal/-slate/-gold`;
  - a ground ellipse shadow.
- **Raised coin:** the same, but the lip is a darker circle of the same size behind the face, shifted 6px down (§3.2.9).
- Face, lip and halo are child spans, so the press animates `transform` only. This also escapes the Android `button:focus` box-shadow reset (`index.css:20-28`).
- **Road:** the token table in §3.2.5.
- **Scenery:** a contact-shadow ellipse, light `rgba(20,60,80,.14)`, dark `rgba(0,0,0,.40)`. The coming-week look is in §3.2.6f.
- **Sheets:** background `hsl(200 40% 96%)` (dark `hsl(205 25% 14%)`); scrim `rgba(12,38,50,.32)` + 2px blur.
- **Colour roles:**
  - `--primary-solid` 173 72% 32% for filled buttons and text (at least 4.5:1);
  - bright teal only for rings, glows and icons;
  - "Holds up" text 165 65% 24% on 160 50% 90%;
  - no red anywhere;
  - Yes and No never differ in colour.

**Icons**
- Her 3D art for things in her world: islands, category tiles, chest, rewards, weather, avatars, moon, path scenery.
- Line icons only for controls (tabs, close, chevrons, settings rows): stroke width 1.75, sizes 20/24, inside tinted 40pt circles.
- The tab icons stay as they are.
- **Export:** art to webp at 2× (chest ~300px; avatars 128px).
- **Ask her for 2-3× exports of:** the islands, plus lavender, round_bush, cloud_small, rock_cluster, pine_tree, sailboat, hot_air_balloon and water_ripple. Until then the ÷2 size limits in §3.2.6b apply.

**Motion (calm: at most one looping thing on screen at a time)**

| What | Spec |
|---|---|
| Press | sink 4px, lip 6→2px, 80ms `cubic-bezier(.2,.8,.2,1)`; release 180ms spring `(.34,1.56,.64,1)`; finger slides off = no action |
| Bubble in | 160ms (scale .92→1); fade out 120ms |
| Card fly-off | 280ms; next card rises 200ms spring |
| Tonight halo | the one allowed loop: breathes once every 4s |
| Ready chest | static glow in P0; a wiggle only on tap |
| Scenery | static in P0; one sailboat bob later, only after her approval |
| Avatar | no breathing while the halo is on screen |
| Endless loops | none besides the halo (no ping, no bobbing START tag, no drifting clouds) |
| Reduce Motion | a global CSS rule plus a `useReducedMotion()` hook; loops and travel off; single fades of 150ms or less stay; no confetti; demos replaced by a one-time label pulse |

**Haptics** (`src/lib/haptics.ts`; respects the Settings switch; nothing per frame, nothing on decorations or while rolling the globe)

| Haptic | When |
|---|---|
| tap | every Pressable |
| swipe | once per threshold crossing |
| medium | answer commits, START, chest lid opens |
| success | evening done, chest opened, "Put it on my map", island created, rule set |
| warning | delete confirms only |

- Yes and No get exactly the same haptic and sound.
- No `success` and no sparkles on a hard day.
- Android `tap` = `impact Light`, because `selectionChanged` is silent without `selectionStart`.

---

## 7. Risks and open questions only she can answer

**Questions for her**
1. **Font:** Manrope, Onest or Inter? All three have Cyrillic; DM Sans does not.
2. **"My questions":** keep it as a chip under the chest (the safe default), or move the list fully into the Map islands?
3. **Start order:** mystery first ("Something keeps happening?") or life areas first ("Build your world")?
4. **Russian voice:** fully gender-free wording, or ask Она/Он once at the start?
5. **Long evenings:** rounds of 7 with "Evening counted!" for everyone, or also a "Short evenings" switch?
6. **Swipe lesson:** shown once to existing users, herself included?
7. **Future stops:** weekday letters (the plan) or her picture-5 padlocks? Show both once.
8. **App icon:** waiting for her logo. May classic users see the new icon too? There is one home-screen icon.
9. **Side space on the path:** short 2-3-word stop labels with no second line (as in target `5-every-stop-means-something.png`: "First evening", "See your week"), or decorations there? Both want the same space. Show both on week 1.
10. **Tab icons:** keep the current Today icon (the default), or try Footprints?

**Risks to test on the phone (390×844 and 375×667, EN+RU, light+dark)**
- **Clutter and empty gaps.** On 375pt, some gaps will have no room (bands under 44px stay empty). Check that week 1 still looks full.
- **Soft art.** Check every piece on a 3× screen at its capped size.
- **Scroll jumps.** Tonight must land at 42% after the images load.
- **Sheet gestures.** The arrow hints sit outside `data-vaul-no-drag`, so a tap never reads as a swipe or a sheet drag.
- **Performance.** With 300+ evenings, render only ±1 week of SVG and scenery.
- **Honesty.** The week-1 chest shows counts and "early" clues, never invented links.
- **Old answers on wrong dates.** Entries carry no save time, so nothing is moved automatically.
- **Her preview.** Both demos ship in step 2: the 59-evening, 19-question demo and "Try as a new user" (a door user in week 1).