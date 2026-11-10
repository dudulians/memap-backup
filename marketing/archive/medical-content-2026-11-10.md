# Medical content — archive (Nov 10 2026)

Her decision (Nov 10 2026): "минимизируем мед советы… хочу быть спокойной в своём приложении" — and "не удаляй, а
архивируй, чтоб мы могли оптом к этому вернуться". Nothing below is lost. People's answers were never touched.

## How to bring it all back

| What | Where it lives now | How to bring it back |
|---|---|---|
| 43 When-to-act plans with a doctor / GP / therapist / dentist | still in `src/lib/lifeStreams.ts`, `bodyTemplates.ts`, `researchTemplates.ts`, unchanged | `src/lib/medicalArchive.ts`: `MINIMAL_MEDICINE = false`. Saved questions switch back by themselves on the next start. |
| 11 clinical body questions not offered to new people | same files, unchanged | the same switch |
| 5 Worth-watching tips about illnesses and medicines (skipped meals & headaches, painkiller days, neck pain & migraine, headaches & periods, stress & stomach) | `src/lib/observeTipsData.ts`, with their sources | the same switch (tip 33 and the hobby tip are also held for their sources: `review.status`) |
| "When to see a doctor" list (the "Something worrying?" chip, 30 signs in 3 urgency groups) | git tag `archive/medical-full-2026-11-10` (`src/components/RedFlagsSheet.tsx`, `redFlags` in `src/locales/en.ts` / `ru.ts`); the 30 texts are also in `marketing/research/tips-and-sources-for-gpt-2026-11-10.md`, section 2 | restore the file and strings from the tag; not recommended without a clinical check (the audit found unsafe urgency groups) |
| Source line under tips | git tag `archive/medical-full-2026-11-10` (`ObserveTipSheet.tsx`) | from the tag |
| Old tip copy (before the audit) | git tag `archive/medical-full-2026-11-10` (`observeTipsData.ts`) | from the tag |

The tag points at commit 10f6eda: the last version with all medical content (before v123).

## Words changed by hand (not behind the switch)

| Where | Was | Now |
|---|---|---|
| "Most days were hard for two weeks" card (`tips.moodLine`) | A good moment to talk to a doctor or therapist. / Хороший момент поговорить с врачом или психотерапевтом. | A good moment to talk to someone. / Хороший момент с кем-то поговорить. |
| Plan field examples (`fieldAdvicePh`, `advicePh`) | "Book a doctor" / «Записаться к врачу» | "Go for a walk" / «Выйти на прогулку» |
| Pet that ate nothing (v125) | Talk to the vet. If your pet has eaten nothing for a whole day, call today. | Talk to the vet and show these days |
| Older parent's confusion (v125) | Tell their doctor. If the confusion came on suddenly, call the doctor today. | Tell their doctor and show these days → with the switch: Look back at what came before the confused days |
| Settings → Help note (v125) | MeMap is a self-reflection tool – not a diagnostic app. / If your patterns feel overwhelming… | the audit's health note |

## What stayed on purpose

- The general health note in Settings → Help, and the report for a doctor (PDF) — her pick: the doctor stays only there.
- "Talk to someone" on mood cards and the support page (with its "A doctor or therapist can help — Make a report" card
  and "Not safe right now? … call your local emergency number"): care and safety, not medical advice.
- "If you drink every day, talk to a doctor before stopping" in the two alcohol tests: stopping suddenly can be unsafe.
- Couples / family therapist plans (thought about leaving, thought about divorce, a parent who pushes or hurts).
- "Talk to the vet" for pets.
