# Triggers and links: what the evidence says, topic by topic (Nov 7 2026)

Numbers in brackets point to `sources.md`.

## How to read the tables

**Lag**
- **D0** = the same day or evening.
- **D+1** = the next day.
- **D+2** = two days later.
- **2 in a row** = two days in a row matter more than one.
- **cum** = builds up over weeks.

**Evidence**
- **Strong** = a meta-analysis, or several large studies that agree.
- **Moderate** = one good study, or several smaller ones.
- **Weak/mixed** = small or conflicting studies, or self-report only.

**Day-to-day studies (diary, EMA)** measure one person across many days. That is exactly what MeMap does, so we weight them highest. Where only between-person studies exist (cohorts, surveys), the table says so.

**"Our question"** names the library id that covers the factor. **new:** marks a proposed id from `proposed-library-additions.md`.

**Big picture (from all five research passes)**
1. **Effects within one person are usually small.** For example, r = 0.05 for activity → mood [149].
2. **They differ a lot between people.** Social media: 46% better, 44% no change, 10% worse [160]. Migraine trigger profiles are unique in 85% of people [58].
3. **Many links run both ways:** sleep ↔ mood [103], exercise ↔ sleep [99].
4. **Sleep is the hub with the clearest next-day lag.** It links to mood [109, 110], anxiety [111], pain [101], couple conflict [182], parenting stress [198] and attention [211].

So the honest wording is "on days when… you usually…" (linked), never "X causes Y". Show the count, as we already do.

---

## 1. Migraine and headache

| Factor | Direction | Lag | Strength | Evidence | Our question | Src |
|---|---|---|---|---|---|---|
| **Period start** (day −2 to +3) | ↑ attacks; worse attacks | around day 1 | OR 1.8 (2 days before), OR 2.0 (days 0–1); 1.7× / 2.5× in another diary study. The biggest factor in PAMINA; all others changed risk by <35%. | **Strong** | new: `period-day` | 55, 66, 67, 69 |
| Pill-free days (combined pill) | ↑ | pill-free days 3–6 | 4× | Moderate | new: `pill-free-day` | 70 |
| High stress | ↑ attacks and severity | D0 to D+2 | Small per day (OR about 1.1 per stress point). Only 7% of patients had most attacks after a stress rise, though 58–80% *believe* stress triggers them. | Moderate; causality unclear | `felt-stressed` | 56, 57, 60, 61, 64 |
| Stress let-down (a calm day after a stressful one) | ↑ | 6–18 h | OR 1.5–1.9, 17 people. PAMINA found the opposite. | Weak, conflicting | derive from `felt-stressed` yes → no | 52, 55 |
| 2 days in a row of high stress or short sleep | ↑ | prior 2 days | Called "strong"; 2 calm days protective | Weak–moderate (55 people) | `felt-stressed`, `slept-enough` | 54 |
| One short night (≤6.5 h) | **no link** | D0, D+1 | Null in 4,406 diary days with actigraphy | Moderate (one rigorous study) | `slept-enough` | 53 |
| Broken sleep (low efficiency) | ↑ | **D+2** | OR 1.39 | Weak–moderate | `woke-at-night` | 53 |
| Waking refreshed | ↓ pain | D0 | OR 0.84 | Moderate | `felt-recovered` | 62 |
| Neck pain | goes with worse pain; often an early sign | D0 | OR 1.94 | Moderate | new: `neck-pain` | 62, 88 |
| Skipped meal / fasting | ↑ | hours | 57% self-report; fasting RCT inconclusive (8 attacks in 131 sessions) | Weak–moderate | `ate-by-2pm` → new: `skipped-meal` | 56, 65 |
| Caffeine, high daily amount | ↑ at high intake (curved) | D0 | No single level significant; "3+ cups" is press wording | Weak–moderate | new: `caffeine-4-plus` | 71 |
| **Caffeine drop** (less than usual) | ↑ headache | 12–24 h, lasts 2–9 days | Headache in about 50%, even from 100 mg a day | **Strong** (general population) | new: `less-caffeine-than-usual` | 72 |
| Alcohol | **mixed** | evening to D+1 | 36% name it; 9% say "always". App diary: no effect at 24 h, lower at 24–48 h. | Mixed | `drank-alcohol` | 63, 73 |
| Weather: heat | small ↑ | 24 h | ER visits +7.5% per +5 °C; 6 of 12 studies positive | Weak–moderate | new: `hot-day` | 74, 79 |
| Weather: pressure drop | ↑ in a subgroup only | 48–72 h | Pooled null; "conflicting" | **Weak/mixed** | new: `weather-change` | 75–78 |
| Bright light, smells, exertion | ↑ for some | hours | Self-report 22–69%; provocation tests mostly negative | Weak | — | 80, 81, 82 |
| Low water | ? | — | 1.5 L extra a day: no fewer headache days | Weak | `drank-water` | 87 |
| Chocolate, cheese | **no effect** | — | Blinded chocolate test null | Null (cravings are an early sign) | — | 85, 86 |
| Early warning signs (yawning, tiredness, stiff neck, cravings) | **precede** an attack (not causes) | hours to 1 day | 29–66% have them; attacks predicted from 72% of such entries | Moderate | new: `early-migraine-signs` | 83, 84 |

**Key point for MeMap.** People believe in about 28 triggers each. About 2 are confirmed per person [59]. A diary that tests each person's own links is the right tool. It must say so, and must not confirm every belief.

## 2. Sleep: what affects tonight

| Factor | Direction | Lag | Strength | Evidence | Our question | Src |
|---|---|---|---|---|---|---|
| Stress / worry at bedtime | ↓ quality | same night | Main predictor of next-morning quality over 42 nights; racing thoughts beat pain as a predictor | Moderate | `felt-anxious` → new: `racing-thoughts-in-bed` | 100, 101 |
| Alcohol in the evening | Faster to sleep, broken second half; worse with each dose | same night | Efficiency −1 point; night-time recovery falls with dose (4,098 people) | **Strong**, dose-dependent | `drank-alcohol`, new: `alcohol-3-plus` | 91, 92, 93 |
| Nicotine in the evening | ↓ | same night | Efficiency −1.7 points | Moderate | `smoked` | 91 |
| Caffeine (dose, timing) | ↓ | same night | −45 min sleep on average. 400 mg even 6 h before bed cut sleep by >1 h, and people did not notice. **In real life**, caffeine within 4 h showed no link (785 people). | Strong in the lab, mixed in daily life | `coffee-late` | 89, 90, 91 |
| Evening screens / light | ↓, later body clock | same night | About +10 min to fall asleep after 4 h of iPad reading | Moderate in the lab; weak in real life (direction unclear) | `screens-before-bed` | 94, 95 |
| Exercise | small ↑ | same night | Small average benefit; **day to day, small and inconsistent**. Hard exercise <1 h before bed is the exception. | Strong for a small effect | `exercised` | 96, 97, 98 |
| Daylight in the day | ↑ (fewer awakenings, earlier clock) | same night, cum | Correlational | Weak–moderate | `saw-daylight` | 106 |
| Irregular schedule | ↓ | cum | Goes with stress, low mood, insomnia | Weak–moderate | new: `same-wake-time` | 107 |
| Frequent or late naps | more broken night | same night | Small | Weak | `napped` | 108 |
| Days before the period | worse *self-rated* sleep only with PMS or period pain | luteal days | Small | Moderate | new: `period-day` | 125, 126 |

**Not covered by a dedicated source:** late heavy meals, night noise. We have questions for both (`ate-late`, `noisy-neighbors`), but no research numbers.

## 3. Sleep: what a poor night affects the next day

| Outcome | Direction | Lag | Strength | Evidence | Src |
|---|---|---|---|---|---|
| Mood | Worse. Positive mood drops most (g −0.94); negative mood rises (g 0.45). Sleep → mood is stronger than mood → sleep. | D+1; consecutive nights under 6 h add up | Moderate–large | **Strong** | 103, 104, 105, 109, 110 |
| Anxiety | ↑, even after small drops in sleep | D+1 | SMD about 0.6 in experiments | **Strong** | 110, 111 |
| Pain | ↑, mostly in the morning; pain predicts sleep less well | D+1 | Moderate | Strong–moderate | 101, 102 |
| Fatigue | ↑ after unusually short *or* long nights | D+1 | — | Moderate | 105, 112 |
| Attention | Lapses ↑ (large); reasoning hardly changes | D+1 | g −0.78 | **Strong** | 211 |
| Couple conflict | ↑ conflict, worse resolution | D+1 | Moderate | Moderate | 182 |
| Parenting stress | ↑ | D+1 | Moderate | Moderate–weak (small samples) | 198, 200 |
| Exercise | less the next day | D+1 | — | Moderate | 99 |

## 4. Low mood

| Factor | Direction | Lag | Strength | Evidence | Our question | Src |
|---|---|---|---|---|---|---|
| Last night's sleep | see section 3 | D+1 | moderate–large | **Strong** | `slept-enough`, `felt-recovered` | 103, 109, 110 |
| Daily stressors | Negative mood ↑ the same day **and the next** | D0 + D+1 | Moderate; a stressor on 40% of days | **Strong** | `felt-stressed`, `heard-bad-news`, `boss-was-difficult` | 167, 168 |
| Physical activity, long-term | ↓ new depression | cum (years) | aOR 0.83; half the guideline amount −18% | Strong (cohorts, between-person) | `exercised`, `walked-a-lot` | 146, 147 |
| Exercise as treatment | ↓ symptoms | cum (weeks) | Walking/jogging g −0.62, yoga −0.55, strength −0.49 | Moderate (low certainty) | `exercised`, new: `strength-training` | 148 |
| Activity → mood within a day | ↑ energy and positive mood, less calm | same hours | Small (r = 0.05); runs both ways | Strong (67 studies) | `exercised` | 149, 150 |
| Social contact, amount and depth | ↑ well-being; in person best | D0 | Small–moderate | Moderate–strong | `saw-friends`, new: `deep-conversation` | 151, 152 |
| Daylight / nature | ↑ mood (day light), ↓ (night light) | D0 to cum | Nature 120+ min/week OR 1.23 | Moderate association; dose not proven | `outside-30min`, `saw-daylight`, new: `time-in-nature` | 153, 154, 155 |
| Cutting down social media | slightly ↓ depressive symptoms | cum (1–3 weeks) | g 0.25; **quitting fully: no effect** | Weak–mixed | `compared-on-social`, new: `social-media-hour` | 156–161 |
| Alcohol | People drink on **good**-mood days; next-day positive mood ↓ | D0 / D+1 | Small | Strong (same day); moderate (next day) | `drank-alcohol` | 136, 137 |
| Gratitude exercises | slightly ↑ well-being | cum | d 0.17; about 0 vs active comparisons | Moderate that the effect is small | `felt-grateful` | 163, 164 |
| Menstrual cycle | premenstrual low mood **not universal** (38% of studies found no link) | luteal days | — | Moderate | `period-symptoms`, new: `pms-signs` | 123, 124 |
| Diet quality | ↓ symptoms | cum | One small unblinded trial | Weak | `ate-vegetables`, `ate-fast-food` | 165, 166 |
| Long hours (≥55 h a week) | ↑ symptoms | cum | RR 1.14, none in North America | Moderate (between-person) | `worked-overtime` | 169 |

## 5. Anxiety and stress

| Factor | Direction | Lag | Strength | Evidence | Our question | Src |
|---|---|---|---|---|---|---|
| Sleep loss | ↑ next-day anxiety | D+1 | SMD about 0.6 | **Strong** | `slept-enough` | 110, 111 |
| Caffeine, high dose | ↑ anxiety; panic in panic disorder (about half at 400–750 mg) | hours | Clear above 400 mg; **150 mg did not raise anxiety**, even in panic disorder | Strong (high dose), weak (normal dose) | new: `caffeine-4-plus` | 170, 171, 172 |
| Daily stressors | ↑ negative mood | D0 + D+1 | Moderate | Strong | `felt-stressed` | 167, 168 |
| One exercise session | slightly ↓ state anxiety | D0 | g 0.16 | Moderate | `exercised` | 173 |
| Exercise programme | ↓ anxiety | cum | SMD −0.41 | Moderate | `exercised` | 174 |
| Slow breathing | ↓ stress in a meta-analysis; **no better than placebo breathing** in 2 RCTs | D0 to cum | g −0.35 | **Mixed** | `meditated` | 175–178 |
| Mindfulness apps | ↓ stress, anxiety | cum | Stress g 0.46, anxiety 0.28 | Moderate | `meditated` | 179 |
| News felt as negative | ↑ negative mood | D0 | Small–moderate | Weak–moderate | `doomscrolled-news` | 180, 181 |
| Hangover anxiety | ↑ only in very shy people | D+1 | — | Weak (97 people) | `drank-alcohol` | 139 |

## 6. Period, PMS, PMDD

| Factor | Direction | Lag | Strength | Evidence | Our question | Src |
|---|---|---|---|---|---|---|
| Perceived stress | ↑ symptom severity | same cycle | Top stress quarter: OR 7.2 for many moderate or severe symptoms | Moderate | `felt-stressed` | 119 |
| Alcohol | ↑ PMS | cum | OR 1.45; may be reverse (PMS → drinking) | Moderate | `drank-alcohol` | 114 |
| Smoking | ↑ | years | RR 2.1 | Moderate | `smoked` | 115 |
| Calcium, vitamin D | ↓ | months | Calcium 1,200 mg: −48% vs −30% (placebo) | Moderate | — | 117, 118 |
| Exercise | ↓ | weeks | Large, but trials at high risk of bias | Weak–moderate | `exercised` | 120 |
| Caffeine | **no link** | — | OR 0.79 (CI crosses 1) | Moderate (debunks "cut coffee for PMS") | — | 121 |
| Cycle → migraine | ↑ around day 1 | day −2 to +3 | see section 1 | **Strong** | new: `period-day` | 66, 67 |
| Cycle → mood (PMDD) | clear late-luteal pattern in 1.6–3.2%; 7.7% if not confirmed by daily ratings | week before the period | — | Strong | new: `pms-signs` + `period-day` | 122 |
| Cycle → sleep | measured sleep unchanged in healthy cycles; worse self-rated only with symptoms | luteal days | — | Moderate | — | 125, 126 |

## 7. Energy and fatigue

| Factor | Direction | Lag | Strength | Evidence | Our question | Src |
|---|---|---|---|---|---|---|
| Last night's sleep (short *or* long) | ↑ fatigue | D+1; nights in a row add up | — | Moderate | `slept-enough` | 105, 112 |
| Caffeine drop | fatigue, fogginess | 12 h to 9 days | — | **Strong** | new: `less-caffeine-than-usual` | 72 |
| Hangover | fatigue in 96% of hangovers | D+1 | — | Moderate | `drank-alcohol` | 143 |
| Single bout of activity | ↑ mood, some energy | next hours | Consistent across 14 studies | Moderate | `exercised` | 129 |
| Regular exercise | ↑ energy | weeks | Δ 0.37; none against placebo | Moderate | `exercised` | 128 |
| Mild dehydration (~1.5% of body weight) | ↑ fatigue, headache | hours | Small–moderate | Moderate (small lab studies) | `drank-water` | 132, 133 |
| Iron deficiency without anaemia | fatigue; iron helped only with ferritin ≤50 | weeks | Fatigue −48% vs −29% | Moderate (2 RCTs); invisible day to day → blood test | `felt-fatigued` (advice) | 130, 131 |
| Recent infection | lasting fatigue in 12% at 6 months | weeks–months | — | Moderate | new: `sick-day` | 134 |
| Depression | fatigue in >90% | ongoing | Large | Strong | `felt-depressed` | 135 |

## 8. Relationship conflict

| Factor | Direction | Lag | Strength | Evidence | Our question | Src |
|---|---|---|---|---|---|---|
| Poor sleep (either partner) | ↑ conflict, ↓ empathy, worse resolution | D+1 | Moderate | Moderate (diary + lab) | `slept-enough` | 182 |
| Outside stress spilling over | ↑ conflict, worst when both are stressed | D0 | Moderate | **Strong** (day-to-day) | `felt-stressed`, `worked-overtime` | 183–186 |
| Alcohol | ↑ verbal and physical aggression | within ~4 h | Clinical samples: >8× odds of physical aggression | Strong (clinical), moderate (community) | `drank-alcohol`, new: `alcohol-3-plus` | 187, 188 |
| Hunger / low blood sugar | ↑ aggressive impulse | D0 | Small | Weak (criticised) | `ate-by-2pm` | 189, 190 |
| Phones during couple time | ↓ satisfaction, ↑ conflict | D0 to cum | r about 0.1–0.3 | Moderate association, weak causality | new: `phones-together` | 191, 192, 193 |
| New, exciting time together | ↑ relationship quality | D0 | Moderate | Moderate (old lab studies) | `good-time-together` | 194 |
| Money | not the most frequent topic, but recurrent and unresolved | cum | — | Moderate | `financial-issue`, new: `money-worry` | 195 |
| Unfair chores (as felt) | ↓ satisfaction; appreciation cancels it | cum | Small–moderate | Weak–moderate | new: `unfair-chores` | 196 |

## 9. Parenting stress

| Factor | Direction | Lag | Strength | Evidence | Our question | Src |
|---|---|---|---|---|---|---|
| Parent's sleep | Better night → less parenting stress next day | D+1 | Moderate | Moderate–weak (small samples) | `slept-enough` | 198, 199, 200 |
| Parent's sleep, long-term | worse sleep → less positive parenting | cum (1 year) | Small–moderate | Moderate (314 mothers, actigraphy) | `slept-enough` | 201, 202 |
| Child's sleep | Late or broken → tantrums and parent stress next day | D+1 | Moderate | Moderate–weak (22–26 families) | `child-slept-poorly`, new: `bedtime-battle` | 203, 204 |
| Infant sleep programme | ↓ mother's depression | months | short-term in one RCT; 10–12 months in another | Moderate | — | 50, 51 |
| Stressful workday | more withdrawal from the child that evening | D0 | Moderate | Moderate (small diary studies) | `burned-out-after-work` | 205, 200 |
| Low support, co-parenting disagreement, chaos, perfectionism | → parental burnout → neglect, harsh behaviour | cum | Moderate–large associations | **Strong** (49 studies, 35,170 parents) | new: `got-help-with-kids` | 206, 207, 208, 197 |
| Mindful parenting programmes | **no effect** on parenting stress | cum | — | Moderate (11 RCTs) | — | 209 |
| Parent's phone use | small link to child behaviour problems, both ways | cum | Small | Weak | — | 210 |

No study we found measured **yelling** the day after a parent's poor night. The evidence is for next-day stress and frustration [198, 200]. So the link `slept-enough` → `yelled-at-kid` is plausible but not proven. MeMap can test it per person.

## 10. Focus and productivity

| Factor | Direction | Lag | Strength | Evidence | Our question | Src |
|---|---|---|---|---|---|---|
| Sleep loss | attention lapses ↑ | D+1 | Large for simple attention | **Strong** | `slept-enough` | 211 |
| Caffeine | ↑ alertness and reaction time | hours | 40–300 mg works | Strong; watch that night's sleep | `coffee-late` | 220, 90 |
| Interruptions | work finished faster, but more stress and effort | D0 | Moderate | Moderate | new: `many-interruptions` | 217, 218 |
| Phone simply nearby ("brain drain") | **little or no effect** | D0 | d about −0.02 | **Failed to replicate** | `phone-free-morning`, `focus-hour` | 212–216 |
| One exercise session | slightly ↑ cognition | D0 | g about 0.10 | Strong that it is small | `exercised` | 219 |
| Aversive task, low self-belief | → procrastination | D0 | Strongest predictors | Moderate (mostly trait-level) | `procrastinated` | 221, 222 |
| Nature → attention | small gains | D0 | 3 of 13 measures | Weak–mixed | new: `time-in-nature` | 223, 224 |

## 11. Alcohol: what drives drinking days

| Driver | Direction | Lag | Evidence | Src |
|---|---|---|---|---|
| Good mood | ↑ drinking and heavy drinking | D0 | **Strong** (69 studies) | 136 |
| Bad mood / stress | **no** more drinking on bad days (raises the coping motive, not the amount) | D0 | **Strong** — "drinking to relieve stress" is not supported day to day | 136, 138 |
| Company | goes with drinking; company lifts mood by itself | D0 | Moderate | 137 |
| Loneliness | mixed: lonelier people drink more, but lonelier-than-usual days → less | D0 | Mixed | 140, 141, 142 |

For the Drinking door this means the reason chips "stress" and "loneliness" will often *not* show up as links. "Company" and "celebration" are more likely. That is worth knowing before a user is told their stress makes them drink.

---

## Weak, mixed, failed to replicate, or a popular myth

1. **"One short night → migraine tomorrow."** Not supported in the best diary-plus-actigraphy study [53]. Broken sleep (2 days later) and 2 bad days in a row matter more [53, 54].
2. **Weather and pressure.** Only a subgroup is sensitive. Pooled results are null and attacks are not predictable from weather [75–78].
3. **Chocolate (and probably cheese).** Null in a blinded test; the craving is likely an early sign [83, 85].
4. **Alcohol as a migraine trigger.** Many believe it; few report it consistently. App diary data show no effect [63, 73].
5. **Stress let-down.** One study of 17 people, contradicted by PAMINA [52, 55].
6. **"3+ coffees → migraine"** is press wording; the paper found a curved trend with no significant single dose [71].
7. **Water for headache.** No fewer headache days in a trial [87].
8. **Caffeine and screens in real life** have smaller effects than in the lab [91, 94].
9. **Caffeine worsens PMS:** not supported [121].
10. **"Everyone has premenstrual low mood or bad sleep":** not supported in the general population [123, 125].
11. **"People drink because they feel bad":** not supported day to day [136].
12. **"Brain drain" from a nearby phone; "a phone on the table hurts the talk":** both failed to replicate [193, 213, 215].
13. **"Hangry" aggression:** correlational, criticised [189, 190].
14. **Social media:** small and person-specific. Quitting fully showed no effect; cutting down showed a small one [157, 158, 160]. "30 minutes a day" comes from one 3-week student trial [156].
15. **Breathwork:** positive meta-analysis, but no better than placebo breathing in two RCTs [175–177].
16. **Mindful parenting** did not lower parenting stress [209].
17. **Gratitude journaling:** a small effect [163, 164].
18. **"120 minutes of nature a week"** is an association, not a proven dose [154].
19. **"23 minutes to refocus"** is a misread figure [218].
20. **Funding caveat.** Several smartphone migraine-trigger studies were funded by the app maker (Curelator / N1-Headache) [58–63].

## What this means for the link engine (our inference, not from any one paper)

1. **Test several lags.** Check same day, next day and 2 days later, plus "2 days in a row". Show the lag in the sentence ("the day after a short night…").
2. **Cycle windows.** When `period-day` exists, compare migraine on days −2 to +3 against other days. Require 2 cycles before saying anything about PMS or PMDD.
3. **Early signs are not causes.** Yawning, tiredness, cravings or neck pain on the attack day (or the day before) should be flagged "may be an early sign", not reported as a trigger.
4. **Context markers.** Leave out or flag days marked `sick-day`, `travel-or-night-away`, `sleep-aid`. Otherwise the app will blame coffee for a cold.
5. **Both directions.** Sleep ↔ mood and exercise ↔ sleep run both ways. Phrase links as "on days when…", never as cause.
6. **Small effects need many days.** A link in a ~10-day window is fragile. The "9 of 10 times" style is good; keep a minimum count before showing a link. Be careful with long question lists, which multiply chance findings. This is also the most common user complaint about other apps [231, 255, 261].
7. **Say when a belief is not supported.** "You think late coffee keeps you awake. In your 30 days it didn't change much." This is honest, and research shows it is common [59].
