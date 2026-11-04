# Globe texture: what to ask the image AI (Nov 4 2026)

The globe must spin, so it needs a flat "unwrapped" picture of the whole
planet (equirectangular, 2:1). The app wraps it on a sphere and adds the
light, the rim glow and the islands itself. That is why the picture must
have no sun, no shadows and no islands.

Attach one of your island pictures (for example `island_plain.png`) so the
style matches.

## 1. Day, v2: open sea in the middle for the islands (Nov 4 2026)

Her first planet (`globe/planet-day-v1.webp`) is lovely, but its land fills
the middle band, so the ring of island pictures had to move up and away from
the front. v2 keeps the middle free. Attach `planet-day-v1.webp` as the style
reference.

```
Flat world map texture for wrapping onto a 3D globe in a mobile app, in the
exact same painted style, colors and detail as the attached picture: soft
turquoise sea with gentle painted waves, green land with sandy shores, soft
rounded hills, one small snowy peak.
Equirectangular projection, wide 2:1 image. The left edge must continue
seamlessly into the right edge.
Keep a big open sea in the middle of the picture: the area from one third to
two thirds of the width, and from 20% to 65% of the height, has no land at
all, not even tiny islets.
Put the land around that open sea: one larger landmass to its left, one to
its right, one below it in the lower third, a few small islets near them, and
one or two more landmasses near the left and right edges, meeting across the
seam. The top 12% and the bottom 12% of the picture are plain calm sea.
Flat, even lighting: no sun, no shadows, no highlights, no vignette, no globe
curvature. No buildings, no trees, no boats, no text, no labels, no grid
lines, no borders.
```

## 1a. Day, v1 (the first prompt, kept for reference)

```
Flat world map texture for wrapping onto a 3D globe in a mobile app.
Equirectangular projection, wide 2:1 image. Soft 3D pastel painted style
matching the attached island picture. Calm ocean in light turquoise fading
to deeper blue in open water, gentle painted wave texture. A few soft green
landmasses with sandy shores and gentle hills, about 20% of the surface,
spread around the middle band. The top 15% and bottom 15% are plain calm
ocean, no land, no ice. Flat, even lighting: no sun, no shadows, no
highlights, no vignette, no globe curvature. The left edge continues
seamlessly into the right edge. No buildings, no trees, no boats, no text,
no labels, no grid lines, no borders.
```

## 2. Night (send the day picture back with this)

```
Same image, night version. Keep every landmass exactly where it is, same
shapes. Deep navy and teal ocean, dark green land, a faint moonlit sheen.
Still flat, even lighting. No stars, no moon, no text.
```

## 3. Clouds (optional, a second layer that drifts slowly)

```
Same size and projection. Only soft white clouds on a pure black
background, scattered, covering about 25% of the image, flat, no shadows.
The left edge continues seamlessly into the right edge.
```

## 4. Sky behind the globe, day and night (portrait)

Attach `planet-day-v3.webp` for the colors. Pick the tall (portrait) size.

```
Tall portrait background for a mobile app screen, soft painted pastel sky
in the same style and colors as the attached picture: lilac at the top
fading to a warm peach glow lower down, a few soft fluffy clouds near the
left and right edges. A soft warm glow in the middle of the lower half, as
if a planet will rise there. No planet, no sun disk, no land, no sea, no
text, no frames. The bottom third is plain soft color.
```

Night: send the day sky back with "Same picture at night: deep navy and
violet sky, a few soft stars, the clouds darker and bluish, a faint cool
glow in the middle of the lower half. No moon, no text."

## 5. Today: the sea of the voyage, day and night (portrait, repeats downwards)

Today scrolls week after week, so its sea must repeat from top to bottom
without a seam. Attach `planet-day-v3.webp` for the colors. Pick the tall
(portrait) size.

```
Tall portrait background for a mobile app, a calm pastel sea seen from
above, in the same painted style and colors as the attached picture: soft
lilac-blue water, gentle painted waves and light glints. A few small soft
islets with sandy shores only near the left and right edges; the middle 60%
of the width is open water. The top edge continues seamlessly into the
bottom edge, so the picture can repeat downwards. Flat, even lighting, no
sun, no boats, no text, no frames.
```

Night: send it back with "Same picture at night: deep blue water with a
soft moonlit sheen, the islets dark green. Keep every islet in place."

## What needs a picture and what doesn't (Nov 4 2026)

- Globe: the planet (done, 3 versions) + a night planet (prompt 2).
- Sky behind the globe: works in code now; a painted sky (prompt 4) is richer.
- Map: no new picture. The map is the same planet unrolled, but it needs the
  planet about 3 times larger to stay sharp on the phone. I can enlarge it
  myself (a little softer) or an AI upscaler can do it.
- Today: one sea that repeats downwards (prompt 5), day and night.
- Islands, boat, chest, clouds: her existing pieces.

## Where

- **ChatGPT**: pick the widest (landscape) size. It is 3:2, not 2:1, so I
  crop it. The seam may not match exactly; I blend the edges in code.
- **Midjourney**: add `--tile --ar 2:1` at the end of the prompt. `--tile`
  makes the picture repeat without a seam.

Send me the files as they are (PNG); I crop, fix the seam, enlarge and
compress them.
