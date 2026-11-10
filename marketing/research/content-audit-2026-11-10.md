# MeMap — Scientific Content & Medical Safety Audit: delivery report

Date: November 10, 2026 · branch `design/aurora-ux` · versions v123–v125 (VERSIONS.md)
Brief: "MeMap — Scientific Content & Medical Safety Audit" (her paste, Nov 10 2026).

## A. Implementation summary

**Removed**
- The medical red-flag feature: the "Something worrying?" / «Что-то тревожит?» chip on body question cards, the
  "When to see a doctor" sheet with its three urgency groups (call now / see a doctor today / book a doctor) and all
  30 signs, EN and RU. It had no route, tab, deep link, notification, scheduled reminder or stored data of its own.
  No user answers, history or insights were touched.
- Two urgency lines in When to act plans: a pet that ate nothing "call today", and an older parent's sudden confusion
  "call the doctor today". Both now just say to talk to the vet / tell their doctor and show these days; people who
  already have the old line get the new one (retired-advice refresh).
- The source line under Worth-watching tips (`tipDay.source`), with no replacement label or icon.
- Old two-line "not a diagnostic app" note (`patterns.disclaimer`, `patterns.disclaimer2`).

**Updated**
- All 36 Worth-watching tips: the brief's EN and RU copy, IDs and order unchanged.
- Tips 6 (hobby-time) and 33 (stomach-issues) are **held**: never picked while held.
- Every tip keeps its source inside the data with a review record: copy status, evidence limits, source verdict and note.
- Four citation fixes the checkers confirmed via Crossref (tips 20, 23, 24, 29).
- The general health note, in the brief's words, in its one existing place: Settings → Help (new and classic look).
- A panic-attack card offers "Talk to someone" again (it had moved to the removed sheet).

**Deliberately preserved**
- Daily yes/no tracking, links/patterns, reports, the doctor PDF, lighthouses and When to act (personal patterns).
- When-to-act plans that suggest a GP or doctor after the person's own rule is reached ("See a GP about the bloating"):
  no urgency, no diagnosis — listed under F for her decision.
- "Talk to someone" with "Not safe right now? If you might hurt yourself, or you're afraid of someone at home, call
  your local emergency number now." — a safety line for self-harm or fear at home, not symptom triage (F).
- "If you drink every day, talk to a doctor before stopping" in the alcohol tests (withdrawal safety, not triage).
- The body-question set still drives which onboarding-added questions can light (renamed `DOCTOR_RULE_IDS`).

## B. Files changed

| File | Purpose |
|---|---|
| `src/components/RedFlagsSheet.tsx` | deleted (the sheet) |
| `src/components/DailySession.tsx` | chip, sheet and state removed |
| `src/lib/bodyTemplates.ts` | `RED_FLAG_IDS` → `DOCTOR_RULE_IDS` (lighthouses only) |
| `src/lib/lighthouses.ts` | uses `DOCTOR_RULE_IDS` |
| `src/lib/supportLines.ts` | panic-attack back on "Talk to someone" |
| `src/lib/lifeStreams.ts` | two urgency lines removed from plans |
| `src/lib/storage.ts` | the two old lines added to retired advice (refreshed for existing users) |
| `src/lib/observeTips.ts` | `review` record type; held tips are never picked |
| `src/lib/observeTipsData.ts` | 36 tips: new copy, review status, source verdict + note, citation fixes |
| `src/components/ObserveTipSheet.tsx` | source line removed |
| `src/components/SettingsModal.tsx`, `src/classic/SettingsModal.tsx` | the general health note |
| `src/locales/en.ts`, `src/locales/ru.ts` | `redFlags.*`, `tipDay.source`, `patterns.disclaimer*` removed; `settings.healthNote` added |
| `marketing/app-store/nomination-2.0.md` | note: the submitted text still mentions the "When to see a doctor" list |
| tests (`marketing/tools/aurora-tests/`) | r63, r65, r120-tip-source updated; r123, r124 new; content-table without the chip |

## C. Content report

- All 36 tips reviewed; EN and RU copy replaced with the brief's text; RU checked gender-free (displayed questions too).
- No 2 pm / four-cup / 7,000-step / 400 mg numbers in tip copy; no "proves / will improve / causes".
- Held pending the source fit: **6 hobby-time** (MISMATCH: NICE NG222 is a depression-treatment guideline with nothing
  on hobbies; a checker opened Mak et al., Nat Med 2023 — adults 65+ only — not applied) and **33 stomach-issues**
  (IBS-only sample; the checker found the honest IBS wording acceptable — her call to un-hold).

### Source validation (3 independent checkers; every DOI/URL opened, metadata via Crossref, abstracts via PubMed)

Totals: **VERIFIED 20 · PARTIAL 15 · MISMATCH 1 · UNVERIFIED 0.** Every link resolves; author/year/journal correct for
all. Fixed labels: 20 → Burnell et al., SSM – Mental Health 2025 (doi 10.1016/j.ssmmh.2025.100459; the old label said
"RTI … 32 trials"); 23, 24, 29 → their DOIs instead of PDF/summary pages.

| # | Tip | Verdict | Main limit |
|---|---|---|---|
| 1 | Late coffee | VERIFIED | RCT n=12, 400 mg |
| 2 | Same wake-up time | VERIFIED | review, mostly observational |
| 3 | Worries at bedtime | VERIFIED | n=50 |
| 4 | Morning daylight | PARTIAL | n=20 students; light of any source, not daylight |
| 5 | Sleep and mood | PARTIAL | sleep quality, not hours |
| 6 | Time for a hobby | MISMATCH | NICE doesn't support it — held |
| 7 | Time in nature | VERIFIED | n=108 self-selected |
| 8 | Noticing good moments | VERIFIED | gratitude exercises |
| 9 | Water through the day | PARTIAL | n=25 women, lab dehydration |
| 10 | Drained days | VERIFIED | NHS page |
| 11 | Daytime naps | PARTIAL | about naps within 7 h of bed |
| 12 | Alcohol in the evening | VERIFIED | review of lab studies |
| 13 | Several coffees a day | PARTIAL | 8 small, very mixed studies |
| 14 | Skipped meals and headaches | VERIFIED | self-reported triggers |
| 15 | Meals before bed | VERIFIED | NHS page, review due 20 Nov 2026 |
| 16 | Walking more | VERIFIED | device-measured steps |
| 17 | Workouts and mood | VERIFIED | — |
| 18 | Hard workouts and sleep | PARTIAL | main finding: evening exercise didn't harm sleep |
| 19 | Screens before sleep | PARTIAL | ages 16–25 only |
| 20 | Time on social media | PARTIAL | small effect, mean age 23 |
| 21 | Too much news | PARTIAL | n=63; how negative, not how long |
| 22 | Stress that lingers | VERIFIED | — |
| 23 | Constant interruptions | VERIFIED | lab, students |
| 24 | Drained after work | PARTIAL | 30 mothers of preschoolers, 1989–90 |
| 25 | A few calm minutes | PARTIAL | multi-week app programs |
| 26 | Seeing people in person | VERIFIED | — |
| 27 | Real conversations | VERIFIED | likely students |
| 28 | Arguments after bad nights | VERIFIED | young couples |
| 29 | Help with the kids | VERIFIED | perceived support |
| 30 | Painkiller days | VERIFIED | ICHD-3 |
| 31 | Neck pain and migraine | PARTIAL | app data; "early symptom" is speculation (candidate: Giffin 2003, not applied) |
| 32 | Headaches and periods | PARTIAL | clinic sample |
| 33 | Stress and your stomach | PARTIAL | IBS only — held |
| 34 | Nicotine and sleep | PARTIAL | narrow sample; within 4 h of bed |
| 35 | Putting things off | VERIFIED | — |
| 36 | Less coffee than usual | VERIFIED | — |

Full per-tip notes are in `src/lib/observeTipsData.ts` (`review.sourceNote`).

**Copy changes the checkers suggested (not applied — the copy is hers):** 4 "daylight" → "light"; 11 "may affect" →
"has been linked to"; 18 say it is vigorous exercise ending within about an hour of bed, the main finding being that
evening exercise usually doesn't harm sleep; 7 "well-being" rather than "mood"; 31 add a second source.

## D. Question compatibility report

No question ID, wording or old answer was changed. Mismatches (exposure the tip/study means vs what the question asks):

| Question | Asks | Mismatch | Resolved by copy? |
|---|---|---|---|
| coffee-late | caffeine after 2 pm | study = hours before bed | mostly (copy has no 2 pm; question still does) |
| slept-enough | 7+ hours | source = sleep quality | no — needs a sleep-length source or a quality question |
| saw-daylight | outdoor daylight before noon | study = first light of any source | partly |
| napped | any nap | study = late naps | yes (copy: "see how nights after naps compare") |
| caffeine-4-plus | 4+ coffees, strong teas or energy drinks | study = ~400 mg doses | yes (copy: "several coffees", no threshold) |
| drank-water | more than 1.5 L | 1.5 L not from the study | yes (copy: "days when you drink less") |
| walked-a-lot | 7,000+ steps (one day) | study = usual daily average, measured | yes (no number in copy) |
| trained-hard | a real load | timing not asked | partly (copy names timing it can't see) |
| doomscrolled-news | too long in news or sports | study = negative news, not time; sports not studied | partly |
| burned-out-after-work | drained after work | study = workload, mothers of preschoolers | partly (copy says "small study… some parents") |
| meditated | meditate or breathe slowly | study = multi-week app programs | partly |
| took-painkiller | painkiller or migraine pill for a headache | — (already headache-only) | n/a |
| smoked | cigarette or vape, any time | study = within 4 h of bed | partly |
| time-in-nature | park, water or trees | RU copy says «на свежем воздухе» (outdoors) | minor |
| ate-late | EN: big late dinner · RU: <2 h before sleep | EN/RU differ; NHS says 3–4 h | not a tip issue |
| racing-thoughts-in-bed | worries kept you awake | mixes exposure with the sleep outcome | not a tip issue |

Existing answers keep their original meaning everywhere.

## E. Testing report

See the test summary in chat (and `marketing/tools/aurora-tests/work/suite-v125/summary.txt`, local).
Earlier today the full suite r60–r120 ran: 49 of 50 passed, the one failure (r118-no-toasts) passed on a rerun — it
had run while files were being edited. Not tested: a real iPhone/Android build (no TestFlight build since build 55).

## F. Decisions for her

1. Un-hold tip 33 with its IBS wording, or keep it held? Use the 65+ Nat Med source for tip 6, or keep it held?
2. The checkers' copy suggestions (4, 7, 11, 18) — apply or keep the brief's text?
3. Questions whose meaning differs from their tip (slept-enough, coffee-late, smoked, trained-hard): leave as they are,
   or add new questions (new IDs, old answers kept as they are)?
4. When-to-act plans that suggest a GP after a personal rule, the "Need to talk?" 12-of-14 hard days card, and the
   "Not safe right now" emergency line: keep (they are not triage) or soften?
5. The App Enhancements nomination (submitted Nov 7) still mentions the "When to see a doctor" list.
6. Store screenshot captures `session-06/11/14` (marketing/app-store/screens-2.0/capture-out) show the removed chip —
   recapture before using them.
