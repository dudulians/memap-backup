# When to act: clinical thresholds and first actions (Nov 7 2026)

> **Information, not medical advice.** This file collects published thresholds and guideline recommendations so MeMap's default action points can be based on something real. It is not a diagnostic tool. Copy in the app should say "talk to a doctor", not "you have X".

Numbers in brackets point to `sources.md`.

## How a MeMap action point counts

- **The count.** It is the number of days, in the last `periodDays`, that got the *hard* answer (yes for a problem question, no for a good one).
- **When it lights.** When that count reaches `threshold` (`src/lib/lighthouses.ts`).
- **Unanswered days.** They do not count.
- **No rule.** A threshold of 0 means the question has no action point.

**Only a few real clinical frequency rules exist.** All other "N of M days" rules below are design choices and are marked as such.

| Clinical rule | Source |
|---|---|
| Headache or painkiller days per month | [1–4] |
| Insomnia 3 nights a week | [11] |
| "Nearly every day for 2 weeks" (depression) | [17] |
| "More days than not" (anxiety) | [22] |
| PMDD pattern over 2 cycles | [25] |

---

## 1. Don't count: act the same evening

Some answers should never wait for a threshold.

| Sign | What the app should do | Src |
|---|---|---|
| Worst headache ever / peaks within 5 minutes ("thunderclap") | Show urgent-care text now | 6, 7 |
| Headache with fever, new weakness, confusion, trouble speaking, or after a head injury | Show urgent-care text now | 6, 7 |
| New headache after age 65, in pregnancy, or a big change in the usual pattern | "See a doctor soon" | 7 |
| Thoughts of self-harm or suicide | Urgent help with **country-specific** numbers. MeMap needs this flow before it ever asks about self-harm. | 21 |
| Gasping, snorting or choking in sleep (seen by someone else) | "Mention this to a doctor" | 43 |

---

## 2. Thresholds

| Topic | Threshold (exact) | What it means | Src |
|---|---|---|---|
| **Migraine prevention** | **Offer** at ≥6 headache days a month (no disability), ≥4 (some disability), ≥3 (severe). **Consider** at 4–5 (none), 3 (some), 2 (severe). | Time to ask a doctor about prevention. *The exact 2-day tier wording could not be checked in the paywalled original.* | 3 |
| Acute medicine ceiling | Limit acute treatment to **about 2 days a week** on average | Early warning, before the overuse limits below | 4 |
| **Medication-overuse headache** | Headache ≥15 days a month for >3 months, plus simple painkillers on **≥15 days** a month or triptans, combination pills or opioids on **≥10 days** | Count painkiller days, not just headache days | 2, 6 |
| Chronic migraine | Headache ≥15 days a month for >3 months, ≥8 with migraine features | A diagnosis; needs a doctor | 1 |
| Headache diary | At least **8 weeks**: frequency, length, severity, medicines, triggers, link to the period | 56 days = the natural "take to the doctor" report | 6 |
| **Chronic insomnia** | Trouble falling asleep, staying asleep or waking too early, **≥3 nights a week for ≥3 months**, with daytime effects. Shorter = short-term insomnia. | 3 of 7 is the clinical line | 11 |
| Insomnia research rule | ≥31 minutes to fall asleep **or** awake at night, ≥3 nights a week | Turns into a yes/no question | 12 |
| Sleep amount | Adults **≥7 hours** a night, regularly | "Short night" = under 7 h | 13 |
| **Depressive episode** | ≥5 of 9 symptoms over **2 weeks**; low mood or **lost interest** "most of the day, nearly every day" | A 14-day window. A diary can track only 2–4 of the 9. | 17 |
| PHQ-9 / PHQ-2 | PHQ-9 ≥10 = moderate; PHQ-2 ≥3 → full check | Offer in the app when a mood rule lights | 18, 19 |
| Generalised anxiety | Hard-to-control worry **more days than not for ≥6 months**, plus ≥3 of 6 symptoms | "More days than not" = over half of days | 22 |
| GAD-7 | ≥10 | Offer in the app | 23 |
| **PMDD** | ≥5 symptoms in the week before the period, better within days of it starting, gone the week after, in most cycles. Confirmed by **daily ratings over ≥2 cycles**. | A daily diary *is* the diagnostic tool: a strong fit for MeMap | 25 |
| PMS (older ACOG wording) | ≥1 symptom in the 5 days before the period over 3 cycles in a row. ACOG 2023 summaries say track 2 cycles. | Wording differs between sources | 26, 27 |
| **Alcohol, any amount** | WHO: no safe level | Background message, not a rule | 28 |
| Alcohol, US | Binge = 4+ (women) / 5+ (men) in about 2 hours. Heavy = 4+/day or 8+/week (women), 5+/day or 15+/week (men). | One binge day already counts as "heavy" | 30 |
| Alcohol, UK | ≤14 units a week, spread over ≥3 days; **several drink-free days** when cutting down | — | 31 |
| Alcohol, Canada | 1–2 drinks a week = low risk; **no more than 2 on any day** | Strictest numbers | 32 |
| AUDIT-C | ≥4 (men), ≥3 (women) | Better than yes/no for amount | 33 |
| **Caffeine** | ≤400 mg a day; single dose ≤200 mg; pregnancy ≤200 mg a day; about 100 mg near bedtime may affect sleep | Safety ceilings, not sleep advice | 37 |
| Caffeine timing | Coffee ≥**8.8 h** before bed (meta-analysis); 400 mg 6 h before still disrupts sleep | For an 11 pm bedtime, that is about 2 pm. Our "after 2 pm" question fits. | 89, 90 |
| Physical activity | 150–300 min moderate (or 75–150 vigorous) a week; strength ≥2 days a week | 150 min ≈ 5 × 30 min | 38 |
| Steps | Benefit levels off around 7,000 a day (6,000–10,000 by age) | Our 7,000 question fits | 39, 40 |
| Light | Daytime ≥250 lux at the eye (daylight); evening ≤10 lux from 3 h before bed; bedroom ≤1 lux | Expert consensus | 41 |
| Water | 2.0 L (women) / 2.5 L (men) a day of **total** water, food included | More in heat (UAE) | 42 |
| Fatigue | See a GP if tired for "a few weeks" without a clear reason, or with weight loss, mood changes, gasping in sleep | No exact number | 43 |
| ME/CFS | Suspect at 6 weeks of core symptoms (worse after exertion); diagnose at 3 months | — | 44 |
| Postnatal depression (EPDS) | ≥10 possible, ≥13 probable; the self-harm item counts at any score | A 7-day questionnaire, not a daily rule | 45 |
| Social media (not a guideline) | One trial: about 30 min a day for 3 weeks; another: a 1-week break | Present as an experiment | 156, 162 |
| Loneliness | UCLA-3 has no agreed cut-off | Use as a check-in only | 46 |

---

## 3. Proposed default rules

*Design choice* = not a clinical number; picked to sit near the clinical rule.

### Existing questions

| Question (id) | Now | Proposed | Basis |
|---|---|---|---|
| `migraine` | 30 / 4 | **keep 30 / 4**; advice: "Ask a neurologist about prevention" | AHS "consider" tier at 4–5 days [3] |
| `headache` | 30 / 8 | **30 / 8** keep; add `took-painkiller` 30 / 9 beside it | Overuse is counted in painkiller days [2, 4] |
| `slept-enough` | 30 / 18 | **14 / 6** (design: mirrors 3 of 7) | 18 short nights before acting is late; AASM ≥7 h "regularly" [13] |
| `woke-at-night` | 30 / 10 | **7 / 3**; advice: stimulus control, not "no screens" | Insomnia frequency 3 nights a week [11, 14] |
| `felt-depressed` | 30 / 8 | **14 / 8**, plus offer PHQ-2. At 12 / 14 → "talk to a professional". | 2-week window; "more than half the days" ≈ PHQ score 2 [17, 19] |
| `felt-anxious` | 30 / 12 | **14 / 8** → self-help first; still about half of days after months → doctor | NICE stepped care; GAD "more days than not" [22, 24] |
| `period-symptoms` | 30 / 8 | Pattern rule once `period-day` exists: symptoms bunched in the week before, gone the week after, **2 cycles in a row** → "show these 2 cycles to a doctor" | DSM-5 PMDD [25] |
| `drank-alcohol` | 30 / 12 | **7 / 4** (design) → "add drink-free days" | UK "several drink-free days" [31] |
| `coffee-late` | 30 / 12 | **7 / 3** when sleep questions are also hard; later: cutoff = bedtime − 9 h | [90] |
| `felt-fatigued` | 30 / 12 | **21 / 14** (design: "a few weeks") → GP; keep the bloodwork advice | NHS [43]; iron trials [130, 131] |
| `exercised` | 30 / 12 | keep; note that WHO counts brisk walking too, not only "real workouts" | [38] |
| `walked-a-lot` | 30 / 15 | keep (7,000 steps fits the evidence) | [40] |
| `saw-daylight`, `outside-30min` | 30 / 15 | **7 / 4** (design) | Light consensus [41] |
| `screens-before-bed` | 30 / 15 | **7 / 4** (design) | Evening ≤10 lux from 3 h before bed [41] |
| `took-meds` | 30 / 3 | keep | — |

### New questions (full list in `proposed-library-additions.md`)

| New id | Rule | Basis |
|---|---|---|
| `took-painkiller` | 30 / 9 | Just above the "2 days a week" ceiling; overuse starts at 10 or 15 [2, 4] |
| `headache-stopped-me` | 30 / 3 | AHS: prevention considered at 3 days with some disability [3] |
| `slow-to-fall-asleep` | 7 / 3 | Insomnia frequency + 31-minute rule [11, 12] |
| `woke-too-early` | 7 / 3 | Early waking is an insomnia complaint [11] |
| `lost-interest` | 14 / 8 | DSM-5 core sign, PHQ-2 [17, 19] |
| `pms-signs` | 60 / 10 (proxy) | The real check is timing over 2 cycles [25] |
| `alcohol-3-plus` | 30 / 4 | Canada: max 2 on any day; US heavy-use definitions [30, 32] |
| `caffeine-4-plus` | 30 / 8 | 400 mg ≈ 4 coffees [37] |
| `sleep-aid` | 30 / 10 (design) | CBT-I first [14, 15] |
| `snored-or-gasped` | 30 / 4 (design) | NHS [43] |
| `panic-attack` | 30 / 4 (design) | NICE: CBT for panic [24] |
| `period-day`, `travel-or-night-away`, `hot-day`, `weather-change`, `early-migraine-signs`, `pill-free-day` | 0 (marker, no rule) | Context for links |

### What a yes/no diary cannot capture

- **Migraine features.** Whether a headache day had migraine features (ICHD needs ≥8).
- **Drug type.** Whether a painkiller was simple, a triptan or a combination pill. This decides whether the overuse limit is 10 or 15 days.
- **Disability.** Its level. `headache-stopped-me` is a rough proxy.
- **Depression and anxiety symptom counts.** 5 of 9 for depression, 3 of 6 for anxiety. Daily answers cannot replace PHQ-9 or GAD-7.
- **Insomnia conditions.** Daytime impairment, and whether there was enough chance to sleep.
- **PMDD symptom count.** ≥5 distinct symptoms and their severity (the DRSP form).
- **Drinks per week.** Weekly totals are not captured.

---

## 4. First actions people can try

**Evidence levels**
- **Strong** = guideline strong recommendation, or consistent RCT meta-analyses.
- **Moderate** = conditional recommendation or Level B, or a meta-analysis of weaker trials.
- **Weak** = a single small trial, observational data, or expert opinion.

### Sleep

| Action | Evidence | Src |
|---|---|---|
| Full CBT-I course (app or therapist) | **Strong** | 14, 15 |
| Same wake-up time every day, weekends too | Moderate (part of stimulus control) | 14 |
| Bed only for sleep; if awake ~20 min, get up and come back when sleepy | Moderate. The "20 min" is from a patient handout. | 14, 16 |
| Sleep restriction, only inside a structured program (not with untreated sleep apnoea) | Moderate | 14 |
| Relaxation before bed | Moderate | 14 |
| **Don't** present "sleep hygiene tips" as the whole fix | Recommended *against* as the only therapy | 14 |
| Last coffee about 9 h before bed; ≤400 mg a day | Moderate | 89, 90, 37 |
| Daylight in the day; dim lights 3 h before bed; dark bedroom | Weak–moderate (expert consensus) | 41, 106 |

### Migraine and headache

| Action | Evidence | Src |
|---|---|---|
| Keep a headache diary for 8 weeks and bring it to the doctor | Guideline | 6 |
| Painkillers on ≤2 days a week on average | Moderate (consensus) | 4, 2 |
| Stress techniques (CBT, relaxation, biofeedback) | Moderate (best-supported lifestyle step) | 8 |
| Aerobic exercise about 40 min, 3 times a week | Moderate–weak (one RCT, about as good as topiramate) | 10 |
| Regular sleep, regular meals, steady caffeine (<200 mg a day) | Weak | 8, 72 |
| Magnesium, riboflavin: ask a doctor or pharmacist first | Moderate (Level B) | 9, 6 |

### Mood and anxiety

| Action | Evidence | Src |
|---|---|---|
| Behavioural activation: plan one small valued or pleasant thing every day | Moderate; NICE first-line | 47, 20 |
| Walking, jogging, yoga or strength training | Moderate (low certainty, but consistent) | 148, 20 |
| CBT-based guided self-help | **Strong** (NICE first choice for less severe depression and GAD) | 20, 24 |
| CBT or applied relaxation if self-help is not enough | **Strong** | 24 |
| 5 minutes of slow breathing or cyclic sighing a day | Weak–moderate (no better than placebo breathing in 2 RCTs) | 175–178 |
| Worry time: postpone worries to one fixed 30-minute slot | Weak; the meta-analysis is not fully identified | 48 |
| Gratitude journaling | Weak (small effect) | 163, 164 |
| Social media about 30 min a day for 2–3 weeks, or a 1-week break | Weak (single trials) | 156, 162, 157 |
| Mindfulness app practice | Moderate | 179 |

### Cycle

| Action | Evidence | Src |
|---|---|---|
| Track daily for 2 cycles and show a doctor | Required for a PMDD diagnosis | 25 |
| CBT; SSRIs through a doctor | Strong (ACOG) | 26 |
| Calcium 1,000–1,200 mg a day for 3 cycles (ask a doctor first) | Weak–moderate | 118, 26 |
| Regular aerobic exercise or yoga | Weak | 26, 120 |
| Do **not** tell users to cut coffee for PMS | No link found | 121 |

### Alcohol

| Action | Evidence | Src |
|---|---|---|
| Several drink-free days a week; at most 2 drinks on any day | Moderate as guideline advice | 31, 32 |
| Short feedback after an AUDIT-C check | Moderate (Cochrane: about 20 g less a week) | 36, 35 |
| Decide the limit before the evening starts | Weak (our wording of brief-intervention advice) | 36 |

### Couples and parenting

| Action | Evidence | Src |
|---|---|---|
| Talk about hard things after a good night, not after a bad one | Moderate (sleep → worse fights) | 182 |
| Gentle start to hard talks; take a break when flooded | Weak (observational) | 49 |
| Shared new, enjoyable activity | Moderate (lab) | 194 |
| Ask for regular childcare help; share tasks | Moderate (burnout predictors) | 208, 197 |
| Structured infant-sleep program with a nurse or doctor | Weak–moderate | 50, 51 |
| Mindful-parenting course to cut stress | **Not supported** | 209 |

### Energy

| Action | Evidence | Src |
|---|---|---|
| Ask for ferritin, B12 and thyroid tests if tired for weeks | Moderate (iron RCTs, NHS) | 130, 131, 43 |
| Fixed sleep and wake times; no caffeine or big meals in the 2 h before bed | Weak (NHS advice) | 43 |
| Walk about 7,000 steps a day; strength training twice a week | Moderate for health; weak for mood | 40, 38 |

---

## 5. Check before shipping

- The exact 2-day disability tier in AHS 2021 [3] (paywalled).
- The primary ACOG wording for PMS (3 cycles; 4 or 5 days) [26, 27].
- The authors and DOI of the worry-postponement meta-analysis [48].
- The "20 minutes" stimulus-control rule from a primary AASM source [16].
- Every "design choice" rule above. These are product decisions, not clinical ones.
- Help-line numbers must be per country. The NHS page [21] gives only UK numbers.
