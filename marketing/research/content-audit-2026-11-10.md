# Content audit — what was built (Nov 10 2026, v123)

Her brief: "MeMap — Scientific Content & Medical Safety Audit" (pasted in chat, Nov 10 2026). The paste ended in the
middle of tip 8, so tips 8–36 and the parts after them (source corrections, disclaimer details) have not arrived yet.

## Done
- **Medical red flags removed** (P0): the "Something worrying?" chip on body question cards, the "When to see a doctor"
  sheet (`RedFlagsSheet.tsx` deleted) and all 30 signs in EN and RU (`redFlags.*`). No notifications or rules used it.
  Answers and history are untouched. The set of body questions stays as `DOCTOR_RULE_IDS` (bodyTemplates.ts) because
  the lighthouses use it (questions with a doctor rule light even when onboarding added them) — Time to Act is kept.
- A panic attack card gets "Talk to someone" again (it had moved to the removed sheet).
- **Source line removed from tip cards**; `tipDay.source` removed. Every tip keeps `source {name, url}` in
  `src/lib/observeTipsData.ts`, plus `review {status, limits, date}` for the checked ones.
- **Tips 1–7: the new EN/RU copy**, IDs and order kept. `hobby-time` is **held** (not shown): the NICE source doesn't
  support it, per the brief.
- Kept on purpose: "Talk to someone" with "Not safe right now? … call your local emergency number" (a safety line for
  self-harm or being afraid at home, not symptom triage); When to act advice per question.

## Where a tip and its question don't match (the brief asked to report)
1. **Late coffee** — the tip now speaks of caffeine close to bedtime; the question still asks "Did you have caffeine
   after 2 pm?" / «Был кофеин после 14:00?». Changing the question changes what old answers mean.
2. **Sleep and mood** — the tip says "nights when you felt you had enough sleep"; the question asks about 7+ hours.
   The source (mainly sleep quality) is marked `needs-source-check`.
3. **Time in nature** — the RU line says «на свежем воздухе» (outdoors); the question asks about a park, water or trees.
- Morning daylight: the question asks about daylight before noon — matches.

## Waiting
- Tips 8–36 copy and the rest of the brief.
- A direct source for the hobby tip (or keep it held).
