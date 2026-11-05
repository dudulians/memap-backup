# Промт для нового пакета островов (5 нояб. 2026)

Её просьба: подробный промт, потому что генератор то забывает делать отдельные файлы, то рисует день и ночь разными, то выдаёт «лажу». И для острова питомца — без нарисованных животных.

## Как пользоваться

1. Новый чат. Прикрепи 3 картинки из `island-prompt-refs/` (образцы стиля) и вставь **Блок 1** целиком. Он ответит «Ready».
2. Дальше проще всего — файл `island-pack-messages.md`: там все сообщения уже готовы по порядку (день, ночь, следующая стадия…), копировать сверху вниз. Блоки 2 и 3 ниже — то же самое в виде шаблона.
3. Сразу после дневной — **Блок 3**: ночь делается из этой же картинки, а не заново.
4. Если он сбился (склеил острова, нарисовал фон-шахматку, тарелку под островом, животное) — **Блок 4**, потом снова Блок 2.
5. Новый остров — лучше новый чат с Блоком 1: длинные чаты он забывает.

Всего 50 картинок: 10 островов × 4 стадии × день и ночь, плюс облако (день и ночь). Облако можно не делать — в приложении уже есть.

---

## Блок 1 — правила (вставить один раз, с 3 образцами стиля)

```
You are drawing island sprites for a calm mobile app called MeMap. Each island is one area of a person's life. An island grows in 4 stages as the person keeps answering questions about that area. I will ask for ONE image at a time. Do not draw anything until I ask for a specific file name. When you have read this, answer only: Ready.

STYLE (match the 3 attached reference images exactly)
- Soft painted 3D, pastel, matte, gentle gradients, cosy and calm. Like the attached islands: tender colours, soft light, small details.
- Not glossy plastic, not cartoon outlines, no thick black lines, no text, no letters, no numbers, no logos.
- Light comes from the top left. Soft shading on the island itself only.

VIEW AND SIZE (the same for every image, so all stages and all islands line up)
- Camera: three-quarter view from above, about 30 degrees down, island seen slightly from the front. Never side view, never straight top-down.
- Canvas: 1024 x 1024 pixels, square.
- The island stands in the middle, its base fills about 80% of the canvas width. Leave empty space above it (about the top 30% of the canvas) for tall things.
- Every stage of an island uses the same land shape and the same scale. The island grows by getting new things on it, not by being drawn bigger or smaller.

BACKGROUND AND WATER (very important)
- Real transparent background (PNG with alpha). Never a white, grey or coloured background. Never a drawn checkerboard pattern.
- The island sits in water with only a thin, soft, semi-transparent shallow-water glow around the shore that fades out to nothing.
- NO plate, NO disc, NO ring, NO rim, NO pedestal, NO round base under the island. No hard blue or lavender edge. No cast shadow on the background.

ONE ISLAND PER FILE
- Each image contains exactly one island at one stage. Never several islands, never a sheet, grid, collage, row or comparison. No captions.

DAY AND NIGHT
- First I ask for the day version. Then I ask for the night version of THAT SAME image: identical shapes, identical objects, identical positions, identical crop. Only the light changes to a moonlit night: deep blue and violet tones, cool soft highlights, warm glow in windows and lanterns where they exist. Never redraw the night version from scratch.

NEVER DRAW (the app adds some of these itself)
- No animals of any kind, no animal faces, no birds, no fish, no insects. No people, no figures.
- No lighthouse, no flag, no hot air balloon, no airplane, no rainbow, no stars or sparkles, no camera, no signpost, no books, no easel or painting, no bicycle, no boat.
- No text or symbols on anything.

THE ISLANDS (file names and what is on each stage)
Each stage must look clearly different from the one before, even when small on a phone screen. Stage 1 is small and simple, stage 4 is rich and glowing.

1. me  (calm, inner peace)
   me_1: a small green island with one smooth round stone and a tiny moss patch.
   me_2: a low stone circle with moss and a small lotus bud in a tiny pond.
   me_3: a small lotus pond in full bloom with a soft glowing crystal beside it.
   me_4: a gentle stone archway over the lotus pond, warm soft glow inside the arch, a few small lanterns.

2. health  (body, rest, energy)
   health_1: a small island with a tiny spring bubbling between two rocks.
   health_2: a small stream running down between mossy rocks.
   health_3: a clear waterfall between rocks and bushes, falling into a small pool.
   health_4: a taller, lush waterfall with many green plants, flowers and soft mist (no rainbow).

3. love  (love life)
   love_1: a small island with one heart-shaped pink flower bud.
   love_2: a young pink blossom tree, a few petals on the grass.
   love_3: a full pink blossom tree with petals falling softly.
   love_4: an arch of pink blossom over a small wooden swing, two warm lanterns.

4. kids  (children, play)
   kids_1: a small sandy island with a bucket and spade.
   kids_2: a small sandcastle and a young palm sprout.
   kids_3: a palm tree, a beach ball and a bigger sandcastle.
   kids_4: a big sandcastle with towers and shells, a palm tree, a little toy windmill (no flag).

5. body  (body and habits, steady routine)
   body_1: a small green hill with a narrow path winding up.
   body_2: the hill with two neat terraces.
   body_3: three terraces with little flower rows.
   body_4: a terraced hill with a small round garden pavilion on top and warm lights along the terraces.
   (No stacked stones here: stones belong to "me".)

6. work
   work_1: a small island with a little wooden desk.
   work_2: the desk with a laptop and a cup.
   work_3: the desk with a laptop, a desk lamp and a potted plant.
   work_4: a cosy open garden office: a pergola with climbing plants over the desk, warm string lights.

7. parents  (family home)
   parents_1: a small island with a low garden fence and a path.
   parents_2: a small cottage with a red roof.
   parents_3: the cottage with a tree and a small garden.
   parents_4: the cottage with warm lit windows, a garden bench, flower beds and a bigger tree.

8. pet  (a pet, shown ONLY by its things, never the animal)
   pet_1: a small island with a pet food bowl.
   pet_2: a small wooden kennel.
   pet_3: the kennel with a ball and a chew toy on the grass.
   pet_4: the kennel with a soft cushion, toys, a water bowl and a small flowering bush. The kennel is empty: no animal inside or anywhere.

9. world  (the world around: news, community, nature)
   world_1: a small island with one large weathered rock.
   world_2: a stone arch over shallow water.
   world_3: the arch with a softly glowing clear pool under it.
   world_4: the arch with trees on both sides, the glowing pool and small lanterns.

10. own  (an island the person names herself, any topic)
   own_1: a small flat meadow island.
   own_2: the meadow with patches of wild flowers.
   own_3: the meadow with one small round tree.
   own_4: the meadow with the tree grown bigger, flowers everywhere and a warm lantern on a post.

Optional:
   cloud: a soft pink-violet cloud floating over calm water, hiding an island (same view and size as the islands).
```

---

## Блок 2 — одна картинка (менять только имя файла)

```
Draw file: love_1_day
One island only, day light, following every rule above: transparent PNG 1024x1024, three-quarter view from above, the island base about 80% of the width, soft fading water glow, NO plate or ring under the island, no animals, no people, no text.
Give it to me as a downloadable PNG named love_1_day.png.
```

## Блок 3 — ночь из этой же картинки

```
Now the night version of this exact image: file love_1_night.
Keep every shape, object, position and the crop exactly the same; change only the lighting to a moonlit night (deep blue and violet, cool soft highlights, warm glow in windows or lanterns if there are any). Transparent background, no plate under the island.
Give it to me as a downloadable PNG named love_1_night.png.
```

## Блок 4 — если сбился

```
Stop. That image breaks the rules. Please re-read them:
- exactly ONE island in the image, no sheet, no grid, no second island;
- real transparent background, not white, not a checkerboard;
- no plate, disc, ring or rim under the island, only a soft fading water glow;
- no animals or people anywhere;
- the night image must be the same picture as the day one, only re-lit.
Redo the same file name.
```

---

## Проверка каждой картинки (за 5 секунд)

- [ ] Один остров, без подписей.
- [ ] Фон прозрачный (в превью — не белый и не шахматка, нарисованная прямо в картинке).
- [ ] Под островом нет тарелки, кольца, ободка.
- [ ] Нет животных, людей, флажка, маяка, шара, радуги, звёзд, книг, мольберта, велосипеда.
- [ ] Ночь — та же картинка, что день, только темнее.
- [ ] Стадия заметно отличается от предыдущей.
- [ ] Остров того же размера, что на прошлых стадиях.

Готовые файлы — в одну папку с такими же именами (`love_1_day.png` …). Обрезка, размер для телефона и подключение в приложение — на мне.
