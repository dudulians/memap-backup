# Proposed body questions (Nov 7 2026, round 2)

25 new yes/no questions about the body topics people rarely talk about, highest value first. They are followed by:
- topics that should **not** be asked daily
- rewording of existing questions
- context sets
- the **red-flag list** (don't count, act tonight)

The evidence for each topic is in `body-sensitive-topics.md`. Numbers in brackets point to `sources.md` (round 2 = 268–448).

**Ranking.** Each question was ranked on four things:
- how common the problem is;
- how much people suffer, and how rarely they tell anyone;
- how well a daily yes/no captures it;
- how much a pattern helps, either to act or to show a doctor.

**Ids.** All checked against every id in `src/lib/lifeStreams.ts` and `src/lib/researchTemplates.ts` (the 221 questions plus stream and trending ids): no collisions.

**Rules (same as round 1).**
- A rule counts hard-answer days in `periodDays` and lights at `threshold`.
- **0 = marker**: no action point, drawn neutral. `problemWhen` is "yes" only because the field needs a value.
- *(design)* = not a clinical number.
- *(proxy)* = a day count standing in for a clinical rule that counts something else.

**Russian.**
- Titles, questions and phrases have no gendered forms.
- Questions are impersonal or present tense.
- Advice is in the infinitive.

**Gentle wording.**
- Plain words: "poop", "pee"; «по-большому», «в туалет».
- No clinical terms where a plain one exists.
- No blame.
- "Hard" answers are facts about the body, never about the person.

**Three design requests (no code changed in this round)**
1. **Follow-up questions.** These three should appear only when their parent answer is yes. On other days they must stay unanswered, not "no".
   - `heavy-flow-day` after `period-day`
   - `erection-trouble` and `pain-during-sex` after `had-sex`
2. **A quiet "no" for `pooped-today`.** One day without a poo is normal [268–270].
   - Draw single "no" days neutral, not rose red.
   - Only the rule (5 of 7) is a signal.
3. **A "private body" tier.**
   - Bowel, bladder, piles and sweating are not sexual, so they shouldn't be hidden behind "Show sensitive topics".
   - But they should never appear in "Idea of the day", share cards or the Year recap.
   - Suggest a `private` flag with these rules:
     - offered in a "Body" door and in search only;
     - off share cards and out of `getRandomIdeas`;
     - kept in the doctor PDF only if the person ticks it.
   - `sensitive: true` stays for the sexual and genital ones.

**Don't switch them all on.** Too many questions is the most common complaint about tracking apps [232, 266]. These belong in the library and in a Body door, not in anyone's default list.

---

## Table 1. The questions

| # | id | area | title | titleRu | questionText | questionTextRu |
|---|---|---|---|---|---|---|
| 1 | `pooped-today` | health | Pooped today | Был стул | Did you poop today? | Сегодня получилось сходить в туалет по-большому? |
| 2 | `hard-to-poop` | health | Hard to poop | Трудно сходить в туалет | Was it hard to poop today — hard or lumpy poop, straining, or you couldn't go? | Сегодня было трудно сходить в туалет — твёрдый стул, приходилось тужиться или не получилось? |
| 3 | `heartburn` | health | Heartburn or reflux | Изжога | Did you have heartburn or a sour taste rising in your throat, today or last night? | Сегодня или ночью была изжога или кислое подступало к горлу? |
| 4 | `bloated` | health | Bloated belly | Вздутие живота | Did your belly feel bloated or swollen today? | Сегодня пучило или распирало живот? |
| 5 | `night-pee-2-plus` | health | Up 2+ times to pee | Ночью в туалет 2+ раза | Did you get up 2 or more times to pee last night? | Этой ночью пришлось вставать в туалет 2 раза или больше? |
| 6 | `bladder-leak` | health | Leaked a little pee | Подтекание мочи | Did you leak any pee today — when coughing, laughing, lifting, or before reaching the toilet? | Сегодня подтекала моча — при кашле, смехе, нагрузке или по дороге в туалет? |
| 7 | `loose-stool` | health | Loose or watery poop | Жидкий стул | Did you have loose or watery poop today? | Сегодня был жидкий или очень мягкий стул? |
| 8 | `heavy-flow-day` | health | Heavy period day | Обильные месячные | Was your period heavy today — changing within 2 hours, leaking through, or needing two products at once? | Месячные сегодня обильные — менять средство приходится чаще, чем раз в 2 часа, протекает или нужно два средства сразу? |
| 9 | `hot-flushes` | health | Hot flushes | Приливы жара | Did hot flushes bother you today? | Сегодня мешали приливы жара? |
| 10 | `night-sweats` | health | Woke up sweating | Ночная потливость | Did you wake up sweaty or soaked last night? | Этой ночью приходилось просыпаться в поту? |
| 11 | `breakout` | health | New breakout | Новые прыщи | Did you get new spots or a breakout today? | Сегодня появились новые прыщи? |
| 12 | `dizzy` | health | Dizzy or light-headed | Головокружение | Did you feel dizzy or light-headed today? | Сегодня кружилась голова или темнело в глазах? |
| 13 | `erection-trouble` | health | Erection trouble | Трудности с эрекцией | If you had sex or tried today, was it hard to get or keep an erection? | Если сегодня была близость или попытка — были трудности с эрекцией? |
| 14 | `pain-during-sex` | health | Pain during sex | Боль при близости | If you had sex today, did it hurt? | Если сегодня была близость — было больно? |
| 15 | `medicine-change` | health | Started or changed a medicine | Новое лекарство или смена дозы | Did you start, stop or change a medicine or supplement today? | Сегодня появилось новое лекарство или добавка, что-то отменилось или поменялась доза? |
| 16 | `vaginal-dryness` | health | Vaginal dryness or soreness | Сухость и дискомфорт во влагалище | Did vaginal dryness, itching or soreness bother you today? | Сегодня беспокоили сухость, зуд или жжение во влагалище? |
| 17 | `jaw-sore-morning` | health | Sore jaw on waking | Утром болит челюсть | Did your jaw feel sore or tight when you woke up? | Утром болела или была зажата челюсть? |
| 18 | `pelvic-floor-exercises` | health | Pelvic floor exercises | Упражнения для тазового дна | Did you do your pelvic floor squeezes today? | Сегодня были упражнения для мышц тазового дна? |
| 19 | `pee-burning` | health | Burning when peeing | Жжение при мочеиспускании | Did it burn or sting when you peed today? | Сегодня было жжение или резь при мочеиспускании? |
| 20 | `bladder-urgency` | health | Sudden urge to pee | Срочные позывы в туалет | Did you get a sudden urge to pee that was hard to hold today? | Сегодня был внезапный позыв в туалет, который трудно сдержать? |
| 21 | `piles-bothered` | health | Piles bothered me | Беспокоит геморрой | Did piles bother you today — itching, soreness or a swelling? | Сегодня беспокоил геморрой — зуд, боль или припухлость? |
| 22 | `sweated-a-lot` | health | Heavy sweating | Сильная потливость | Did heavy sweating bother you today, not from heat or exercise? | Сегодня мешала сильная потливость — не от жары и не от спорта? |
| 23 | `tinnitus-louder` | health | Ringing ears louder | Шум в ушах сильнее | Was the ringing or buzzing in your ears louder or more bothersome today? | Сегодня звон или шум в ушах был громче или мешал сильнее? |
| 24 | `breast-tender` | health | Sore breasts | Болит грудь | Were your breasts sore or tender today? | Сегодня грудь болела или была чувствительной? |
| 25 | `fingers-white-cold` | health | Fingers went white in the cold | Пальцы белеют от холода | Did your fingers or toes turn white or blue in the cold today? | Сегодня пальцы рук или ног белели или синели от холода? |

**Category and subcategory** (for `researchTemplates.ts`; the round-1 table didn't carry them):
- **Body / Digestion**: 1–4, 7, 21
- **Body / Bladder**: 5, 6, 18, 19, 20
- **Body / Cycle**: 8, 24
- **Body / Menopause**: 9, 10
- **Body / Sexual**: 13, 14, 16
- **Body / Skin**: 11, 22
- **Health / Treatment**: 15
- **Body / Pain**: 17
- **Body / Ears**: 23
- **Body / Circulation**: 25

## Table 2. Rule, advice, why

| # | id | problemWhen | periodDays / threshold | advice | adviceRu | sensitive | why [sources] |
|---|---|---|---|---|---|---|---|
| 1 | `pooped-today` | no | 7 / 5 *(proxy: poo on 2 or fewer days a week ≈ Rome "under 3 a week")* | Eat 2 kiwis a day for 4 weeks | 4 недели съедать по 2 киви в день | no (private) | The question the founder asked for. Normal is 3 a day to 3 a week (98% and 95.9% of adults) [268, 269]; daily is a minority habit [270]. Diaries beat memory [304, 305]. Kiwi is as good as psyllium with fewer side effects [280, 282]. Tracked by Bearable, Cara Care, mySymptoms, Bowelle [231, 433]. Needs the quiet "no". |
| 2 | `hard-to-poop` | yes | 30 / 8 *(proxy: about 1 in 4 days, Rome's "more than 25%")* | Take psyllium every day for 4 weeks, with water | 4 недели каждый день принимать псиллиум, запивая водой | no (private) | Rome IV items: straining, hard stool, can't go [271]. Constipation affects 10–16% [272, 277]. Psyllium is the only fibre with good evidence: 66% vs 41% respond [278, 279]. Links: travel, period, medicines [277, 293–296]. |
| 3 | `heartburn` | yes | 14 / 4 *(Montreal convention: 2+ days a week)* | Finish eating 3 hours before bed for 2 weeks | Две недели заканчивать есть за 3 часа до сна | no | Weekly in 9–33% (Middle East up to 33%) [311]. Dinner under 3 h before bed: OR 7.45 [312]; ACG conditional [308]. No food-elimination trials exist, so personal links are the honest tool [313]. Pairs with existing `ate-late`. |
| 4 | `bloated` | yes | 30 / 8 *(design; Rome counts bloating days a week)* | Ask a doctor or dietitian about a low-FODMAP trial | Спросить врача или диетолога про пробную диету low-FODMAP | no (private) | 16–31% have bloating [277]. Low-FODMAP is the top-ranked diet for bloating (RR 0.72) [298]; ACG suggests a time-limited trial [297]. Link with period days [293–295]. |
| 5 | `night-pee-2-plus` | yes | 7 / 3 *(design)* | Stop drinks 2 hours before bed for 2 weeks | Две недели ничего не пить за 2 часа до сна | no (private) | One night pee is normal; quality of life drops at 2+ [324, 331]. 28–62% of people over 70 [323]. Evening caffeine and alcohol; sleep apnoea [325–327]. "Last night" pairs with the previous evening. |
| 6 | `bladder-leak` | yes | 14 / 3 *(design; NHS: any leaking is worth a GP visit)* | Do pelvic floor squeezes 3 times a day for 3 months | 3 месяца делать упражнения для тазового дна 3 раза в день | no (private) | 25–45% of women [341]; only 28% seek help [343]. Training cures stress leaking in 56% vs 6% (high quality) [342]. NHS: 8 squeezes, 3 times a day, 3+ months [339]. |
| 7 | `loose-stool` | yes | 30 / 8 *(proxy: Rome "more than 25%")* | Show 4 weeks of answers to a GP | Показать терапевту ответы за 4 недели | no (private) | WHO: 3+ loose a day [275]; functional diarrhoea >25% [271]. Binge drinking → next-day loose stool [288]; day 1 of the period [293, 294]; antibiotics [277]. NHS: IBS-type symptoms over 4 weeks → GP [300]. |
| 8 | `heavy-flow-day` | yes | 60 / 4 *(design: about 2 heavy days in each of 2 cycles)* | Ask a GP to check heavy periods and iron | Попросить врача проверить обильные месячные и уровень железа | no | Follow-up to `period-day`. 27% have 2+ signs; 46% never saw a doctor; 63% had iron deficiency or anaemia [344]. Signs from NHS [345]; NICE defines it by impact [348]. Treatments work [347]. |
| 9 | `hot-flushes` | yes | 14 / 7 *(design: half the days)* | Ask a doctor about HRT or CBT for hot flushes | Спросить врача про ЗГТ или КПТ от приливов | no | Up to 80% in the transition, median 7.4 years [349, 350]. "Bothered" rather than "any", because frequent flushers would say yes daily [358]. HRT most effective [351, 352]; CBT and hypnosis Level I [350]. |
| 10 | `night-sweats` | yes | 14 / 4 *(design; NHS: regular sweats that wake you → GP)* | Tell a doctor about the night sweats | Рассказать врачу про ночную потливость | no | Menopause, anxiety, alcohol, medicines and infection all cause them [354]. Link with next-day tiredness [353]. Red flags with fever or weight loss [354]. |
| 11 | `breakout` | yes | 30 / 10 *(design)* | Use one acne treatment for 12 weeks before judging it | 12 недель пользоваться одним средством от прыщей и только потом оценивать | no | Premenstrual flare in 44–65% of women with acne, up to 7 days before [383, 384]. NICE: judge after 12 weeks [387]; AAD strong for benzoyl peroxide and retinoids [385]. Diet advice is not supported [385, 386]. |
| 12 | `dizzy` | yes | 30 / 5 *(design; NHS: keeps coming back → GP)* | Show my dizzy days to a doctor | Показать врачу дни с головокружением | no | Common, fixable causes: standing fast, fluids, heat, skipped meals, anaemia, new medicines [407]. Links with `skipped-meal`, `drank-water`, `hot-day`, `heavy-flow-day`, `medicine-change`. Red flags go to the same-evening card [408–410]. |
| 13 | `erection-trouble` | yes | 60 / 4 *(design; NHS: keeps happening → GP)* | Ask a doctor to check heart, blood pressure and sugar | Попросить врача проверить сердце, давление и сахар | **yes** | Follow-up to `had-sex`. 52% of men 40–70 have some degree [370]. ED raises cardiovascular risk (RR about 1.45) [372]; it came first in 93% of men with coronary disease and ED [373]. Lifestyle change: 31% vs 5% back to normal [374]. |
| 14 | `pain-during-sex` | yes | 60 / 3 *(design)* | Book a gynaecologist or GP about the pain | Записаться к гинекологу или терапевту из-за боли | **yes** | Follow-up to `had-sex`. 7.5% of women, 24% at 18 months after birth [366, 367]. Dryness OR 7.9 [366]. Treatable: lubricants, oestrogen, physiotherapy, CBT [368]. Deep pain → endometriosis check [369]. |
| 15 | `medicine-change` | yes (marker) | 30 / 0 | — | — | no | Explains bowel changes (opioids, iron, antibiotics) [277], dizziness [407], sweating [404], low desire (SSRIs) [368] and ED [377] without a false "habit" link. Different from `took-meds` (taking them as planned). |
| 16 | `vaginal-dryness` | yes | 30 / 8 *(design; NHS: lasting a few weeks → GP)* | Ask a doctor about vaginal moisturisers or local oestrogen | Спросить врача про увлажняющие средства или местные эстрогены | **yes** | 27–84% after menopause, under-diagnosed [359]; also with breastfeeding and the pill [360]. Moisturisers for mild cases; vaginal oestrogen even with HRT [359, 352]. Slow-changing: the value is the action point. |
| 17 | `jaw-sore-morning` | yes | 14 / 5 *(design)* | Ask a dentist about a night guard | Спросить стоматолога про ночную капу | no | Sleep grinding 13–21% [412, 413]. Stress; alcohol about 2×; smoking; heavy coffee; sleep apnoea [414, 416]. Self-reported night grinding is unreliable, so ask about the morning jaw [412]. |
| 18 | `pelvic-floor-exercises` | no | 14 / 7 *(design)* | Do them right after brushing your teeth | Делать их сразу после чистки зубов | no (private) | The "what helps" partner of `bladder-leak`: progress over 3 months is hard to feel without a record [339, 342]. The Tät app worked in an RCT, mostly through reminders [437, 438]. |
| 19 | `pee-burning` | yes | 7 / 2 *(NHS: not better in 48 h → GP)* | Ask a pharmacist or doctor about a urine infection | Спросить фармацевта или врача, нет ли цистита | no (private) | First yes shows the same-evening check (fever, back pain, blood, men, pregnancy) [334]. Recurrent = 2 in 6 months [335]. Prevention: +1.5 L water if drinking little [336]; cranberry RR 0.70 [337]. |
| 20 | `bladder-urgency` | yes | 14 / 5 *(design)* | Try bladder training for 6 weeks | 6 недель тренировать мочевой пузырь | no (private) | Bladder training: AUA strong, Grade A [330]; 6+ weeks [339]. Urgency is the least reliable diary item (κ −0.22), so the wording asks about a concrete event [333]. |
| 21 | `piles-bothered` | yes | 14 / 7 *(NHS: not better after 7 days of home care → GP)* | Book a GP about the piles | Записаться к врачу из-за геморроя | no (private) | 39% have piles at colonoscopy [302]. Fibre halves symptoms and bleeding [303]. Link with `hard-to-poop`. Any bleeding → red-flag card, not a count [300]. |
| 22 | `sweated-a-lot` | yes | 30 / 8 *(design; NHS: weekly → GP)* | Put on a strong antiperspirant at bedtime for 2 weeks | Две недели наносить сильный антиперспирант на ночь | no (private) | 4.8%; half never told a professional [403]. Stronger antiperspirant first [404]; aluminium chloride at bedtime [406]. |
| 23 | `tinnitus-louder` | yes | 30 / 10 *(design)* | Ask a doctor about tinnitus support and CBT | Спросить врача про помощь при шуме в ушах и КПТ | no | Only for people who have it. 14.4% of adults [423]. NICE: CBT-based steps, hearing aids if needed, no medicine [424, 425]. Tracking doesn't make it worse [428]. |
| 24 | `breast-tender` | yes | 60 / 16 *(design: about 8 days per cycle)* | Get a well-fitting supportive bra | Подобрать удобный поддерживающий бюстгальтер | no | 68% cyclical; 11–22% moderate–severe [362]. Bra and reassurance help most; NSAID gel next [364]. Evening primrose oil doesn't work [363]. **Offer only without `pms-signs`** (which already lists sore breasts), or on the pill or HRT. |
| 25 | `fingers-white-cold` | yes | 30 / 8 *(design)* | Keep the whole body warm and wear gloves outside | Держать в тепле всё тело и носить перчатки на улице | no | Raynaud's 4.85% [430]. Cold and stress are same-day triggers [431]. Red flags (one side, ulcers, onset after 30–40) → GP [431, 432]. Ask only in the cold season. |

## Table 3. Phrases (format of `answerPhrases.ts` and `answerSentences.ts`)

- **Labels** are lowercase noun phrases.
- **Clauses** are present tense, second person. "~" marks where the frequency word goes.
- **"cause|result"** where the two read better apart.
- **RU** has no gendered forms.

| # | id | label yes / no (EN) | label yes / no (RU) | clause yes / no (EN) | clause yes / no (RU) |
|---|---|---|---|---|---|
| 1 | `pooped-today` | poop day / no poop | день со стулом / день без стула | you ~poop / you ~don't poop | стул ~есть / стула ~нет |
| 2 | `hard-to-poop` | hard to poop / no trouble pooping | трудно сходить в туалет / без трудностей с туалетом | pooping ~is hard / you ~have no trouble pooping | сходить в туалет ~трудно / с туалетом ~без трудностей |
| 3 | `heartburn` | heartburn / no heartburn | изжога / без изжоги | you ~have heartburn / you ~have no heartburn | у тебя изжога\|~бывает изжога / изжоги ~нет |
| 4 | `bloated` | bloating / no bloating | вздутие / без вздутия | your belly ~feels bloated / your belly ~feels calm | живот ~пучит / живот ~спокойный |
| 5 | `night-pee-2-plus` | 2+ night trips to pee / 0–1 night trips | ночью 2+ раза в туалет / ночью в туалет не больше раза | you ~get up 2+ times to pee / you ~get up once or not at all | ночью ты ~встаёшь в туалет 2+ раза / ночью ты ~встаёшь в туалет не больше раза |
| 6 | `bladder-leak` | bladder leak / no leaks | подтекание мочи / без подтеканий | you ~leak a little / you ~stay dry | моча ~подтекает / подтеканий ~нет |
| 7 | `loose-stool` | loose poop / no loose poop | жидкий стул / без жидкого стула | your poop ~is loose / your poop ~isn't loose | стул ~жидкий / жидкого стула ~нет |
| 8 | `heavy-flow-day` | heavy period day / lighter period day | обильные месячные / необильные месячные | your period ~is heavy / your period ~is lighter | месячные ~обильные / месячные ~необильные |
| 9 | `hot-flushes` | hot flushes / no hot flushes | приливы / без приливов | hot flushes ~bother you / hot flushes ~leave you alone | приливы ~мешают / приливы ~не мешают |
| 10 | `night-sweats` | night sweats / dry night | ночная потливость / ночь без пота | you ~wake up sweating / your night ~stays dry | ты ~просыпаешься в поту / ночь ~проходит без пота |
| 11 | `breakout` | new spots / no new spots | новые прыщи / без новых прыщей | you ~get new spots / your skin ~stays clear | ~появляются новые прыщи / новых прыщей ~нет |
| 12 | `dizzy` | dizziness / no dizziness | головокружение / без головокружения | you ~feel dizzy / you ~feel steady | ~кружится голова / голова ~не кружится |
| 13 | `erection-trouble` | erection trouble / no erection trouble | трудности с эрекцией / без трудностей с эрекцией | erections ~are hard to get or keep / erections ~are fine | с эрекцией ~трудно / с эрекцией ~всё в порядке |
| 14 | `pain-during-sex` | painful sex / pain-free sex | боль при близости / близость без боли | sex ~hurts / sex ~is pain-free | близость ~болезненная / близость ~проходит без боли |
| 15 | `medicine-change` | medicine change / same medicines | смена лекарств / привычные лекарства | your medicines ~change / your medicines ~stay the same | лекарства ~меняются / лекарства ~прежние |
| 16 | `vaginal-dryness` | vaginal dryness / no vaginal discomfort | сухость во влагалище / без дискомфорта | dryness ~bothers you / dryness ~doesn't bother you | сухость ~беспокоит / сухость ~не беспокоит |
| 17 | `jaw-sore-morning` | sore jaw on waking / relaxed jaw on waking | челюсть болит утром / спокойная челюсть утром | your jaw ~is sore in the morning / your jaw ~is relaxed in the morning | утром ~болит челюсть / утром челюсть ~спокойная |
| 18 | `pelvic-floor-exercises` | pelvic floor exercises / no pelvic floor exercises | упражнения для тазового дна / без упражнений | you ~do your pelvic floor exercises / you ~skip your pelvic floor exercises | ты ~делаешь упражнения для тазового дна / упражнений ~нет |
| 19 | `pee-burning` | burning when peeing / no burning | жжение при мочеиспускании / без жжения | peeing ~burns / peeing ~is comfortable | при мочеиспускании ~жжёт / жжения ~нет |
| 20 | `bladder-urgency` | sudden urge to pee / no sudden urges | срочные позывы / без срочных позывов | you ~have to rush to pee / you ~don't have to rush | ~приходится бежать в туалет / бежать в туалет ~не приходится |
| 21 | `piles-bothered` | piles trouble / no piles trouble | геморрой беспокоит / без геморроя | piles ~bother you / piles ~don't bother you | геморрой ~беспокоит / геморрой ~не беспокоит |
| 22 | `sweated-a-lot` | heavy sweating / usual sweating | сильная потливость / обычная потливость | you ~sweat heavily / you ~sweat as usual | ты ~сильно потеешь / потливость ~обычная |
| 23 | `tinnitus-louder` | louder ringing / usual ringing | шум в ушах сильнее / шум как обычно | the ringing ~is louder / the ringing ~is as usual | шум в ушах ~сильнее / шум в ушах ~как обычно |
| 24 | `breast-tender` | sore breasts / no breast pain | болит грудь / грудь не болит | your breasts ~are sore / your breasts ~don't hurt | грудь ~болит / грудь ~не болит |
| 25 | `fingers-white-cold` | white or blue fingers / fingers keep their colour | белеющие пальцы / пальцы не белеют | your fingers ~turn white or blue / your fingers ~keep their colour | пальцы ~белеют от холода / пальцы ~не белеют |

(In the table, `\|` is the "cause|result" separator, escaped for Markdown.)

**Sample sentences, read aloud**
- "On days when you're travelling, you **often** don't poop — 5 of 7 times."
- "On nights after you have 3+ drinks, you **usually** get up 2+ times to pee — 4 of 5 times."
- «В дни, когда у тебя месячные, живот **часто** пучит — 4 из 6 раз.»
- «В дни, когда ты в поездке, стула **часто** нет — 5 из 7 раз.»
- Not a link: «В дни, когда стула нет, живот часто пучит». These two answers come together by nature, so say "often come together" (see `body-sensitive-topics.md` §20).

---

## Not proposed as daily questions (and why)

| Topic | Why not | Instead |
|---|---|---|
| Blood in poo or on the paper | A red flag, not a count. A daily "did you see blood?" would frighten people and teach them to wait for a number. | A "Something worrying?" chip on the body questions opens the red-flag list below [300]. |
| Black or tarry poo, vomiting blood | Same | Same; tonight [318] |
| Wind / gas count | Up to 20 a day is normal [276]; counting helps nobody | Covered by `bloated` |
| Bristol type 1–7 every evening | Too fine for a yes/no app; types 2 and 3 get mixed up [274] | `hard-to-poop` and `loose-stool` |
| Bowel urgency on its own | 36% of healthy people have it sometimes [268]; it mostly travels with loose stool | Covered by `loose-stool` |
| Pee count per day | A number, not a yes/no; a 3-day bladder diary is the clinical tool [333, 340] | A 3-day diary could be a later "doctor mode" |
| Hair shedding | The trigger is about 3 months earlier [399]; day links would blame the wrong days | A monthly check and a look back 3 months |
| Weight loss without trying, lumps | Red flags, not daily items | Red-flag list |
| Gas, burping, "stomach noises" | Low burden; no action | — |
| Plain "cold hands" | Too vague; most people with cold hands don't have Raynaud's | `fingers-white-cold` (colour change) |
| Laxative day | Rome counts poos *without* laxatives [271], but a separate marker adds a question for few people | `medicine-change` covers starting one; revisit if people ask |
| Low desire (new question) | Already have `morning-libido` | Reword it (below) |
| Eczema / dry eyes (new questions) | Already have `skin-allergy` and `eye-strain` | Reword them (below) |

## Reword existing questions

| id | Problem now | Proposal | Why |
|---|---|---|---|
| `stomach-issues` | Round 1 already took nausea out. With the new bowel and heartburn questions, "digestion trouble" would double-count. The advice "Log what I ate the day before to find the food trigger" points to a weakly supported method. Its RU advice has a gendered verb («ела»). | **"Stomach ache"**: EN "Did your belly hurt today?" RU «Сегодня болел живот?» Advice: EN "Book a GP with 4 weeks of answers", RU «Записаться к врачу с ответами за 4 недели». | NHS: IBS-type symptoms over 4 weeks → GP [300]. No food-elimination trials for heartburn [313]; low-FODMAP needs a guided trial [297, 298]. |
| `skin-allergy` | The advice "Log foods and skincare" points to the wrong suspects for adults | Rename to **"Itchy skin or rash"**. Advice: EN "Moisturise twice a day, even when skin is clear", RU «Мазать кожу увлажняющим кремом дважды в день, даже когда она чистая». | Adult itch triggers: stress, sweat, weather, dry air, heat [393]. Daily emollient is the base of care [395]. |
| `eye-strain` | RU question includes «двоилось» (double vision). Sudden double vision is a stroke sign [409]. | EN "Did your eyes feel tired, dry or gritty today?" RU «Сегодня глаза уставали, были сухими или будто с песком?» Advice: EN "Ask a pharmacist about lubricating eye drops", RU «Спросить в аптеке увлажняющие капли для глаз». | Drops, humidity and screen breaks are the NHS steps [422]; omega-3 failed [420]. Double vision goes to the red-flag card. |
| `morning-libido` | "Physical response" reads male; the rule (12 "no" days in 30) treats normal swings as a problem; advice "testosterone, cortisol" bloodwork is not the guideline path | EN "Did you feel sexual desire today?" RU «Сегодня было сексуальное желание?» Rule **60 / 45** *(design)*. Advice: EN "Talk to a doctor or sex therapist about desire", RU «Поговорить с врачом или сексологом о влечении». | The clinical line is 6 months plus distress [368]. ISSWSH path: education and modifiable factors first [379]. Daily desire logs are reliable [381]. |
| `had-sex` | — | Keep. It becomes the parent of `erection-trouble` and `pain-during-sex`. | Follow-ups avoid false "no pain" days |
| `pms-signs` | Lists bloating and sore breasts | If `bloated` or `breast-tender` is on, don't count those words twice. Either don't offer both, or treat co-occurrence as "comes together". | No double counting (round-1 rule) |
| `drank-water` | — | Keep. In "What helps" say: water helps constipation only if intake is low or alongside fibre [278, 283, 284]; +1.5 L a day cut UTIs in women who drank little [336]. | Honest claim |
| `heart-palpitations` | — | With `dizzy` on the same day, show the safety card once (chest pain, fainting → 999) [408, 410]. | Safety |

## Context sets for body topics (3 context questions each)

For when a Body door is added. All the context questions already exist.

| Door | Context questions | Why |
|---|---|---|
| Gut (`pooped-today`, `hard-to-poop`, `loose-stool`, `bloated`) | `period-day`, `felt-stressed` (same day), `travel-or-night-away` (+ `alcohol-3-plus` for loose stool) | The period is the strongest day-level pattern [293–295]. Stress acts the same day [292]. Travel [296]. Binge drinking → next-day loose stool [288]. Not sleep: it predicted pain, not bowel change [289]. |
| Heartburn | `ate-late`, `drank-alcohol`, `smoked` | Late dinner OR 7.45 [312]; alcohol and smoking in ACG [308]. Coffee is mixed, so it's not a default [314, 315]. |
| Night peeing | `drank-alcohol`, `coffee-late`, `snored-or-gasped` | Evening drinks [325]; sleep apnoea [326, 329] |
| Hot flushes / night sweats | `hot-day`, `alcohol-3-plus`, `felt-stressed` | Personal patterns only; NAMS rates general trigger avoidance not recommended [350]. Heavy drinking only [357]. |
| Skin (`breakout`) | `period-day`, `felt-stressed`, `slept-enough` | Cycle [383, 384]; stress [389]. Sleep was not checked; it's in as context, not a claim. |
| Dizziness | `skipped-meal`, `drank-water`, `hot-day` (+ `heavy-flow-day`, `medicine-change`) | NHS causes [407] |
| Bladder leaking | `pelvic-floor-exercises`, `caffeine-4-plus`, `sick-day` (coughing) | Training [342]; caffeine [339]; cough-triggered stress leaking [339] |

---

## Red flags: don't count, suggest a doctor the same evening

**How the app should show these.** Each body question gets a quiet "Something worrying?" chip, which opens this list for its topic. A tap on a red flag never counts toward a rule or a link.

The card:
- shows the right urgency, in calm words;
- shows a **country-specific** number (UAE 999 / 998, Russia 112 / 103, UK 999 / 111);
- is not shown again for the same flag that week.

Round 1 already says MeMap needs country numbers before it asks about self-harm (`when-to-act.md` §1). The same applies here.

### Tonight: emergency (999 / A&E)

| Sign | Src |
|---|---|
| Chest pain that spreads to the arm, jaw, neck or back, or comes with sweating, sickness or breathlessness, even if it feels like heartburn | 317, 410 |
| Vomiting blood, or vomit that looks like coffee grounds | 318 |
| Black, sticky poo | 318 |
| Sudden, severe belly pain | 318 |
| Bleeding from the bottom that won't stop, a lot of blood, or large clots | 300 |
| Fainting with chest pain or palpitations, during exercise or lying down, or not coming round | 408 |
| Dizziness with a drooping face, arm weakness, slurred speech, sudden double vision or vision loss, even if it has passed (stroke) | 409 |
| Heavy sweating with chest pain, light-headedness or nausea | 405, 410 |
| Confusion or drowsiness with urine-infection signs | 334 |
| Tinnitus after a head injury, or with sudden hearing loss, face weakness or vertigo | 426 |
| Sudden vision change, light hurting the eyes, or a red eye with headache and nausea | 422 |
| An erection lasting more than 3–4 hours | 377 |

### Tonight: urgent same-day doctor or helpline (111-type)

| Sign | Src |
|---|---|
| Dark-red poo, or bloody diarrhoea | 300 |
| Painless bleeding from the bottom | 300 |
| Constipation with vomiting, not passing wind, or constant belly pain | 277 |
| Diarrhoea with signs of dehydration, a high fever, or 6+ loose stools a day | 277 |
| Burning when peeing plus fever, shivering, back or side pain, or blood in the urine; or any burning in men, in pregnancy, at 65+, with diabetes or a catheter | 334 |
| Not able to pee | 318, 328 |
| Soaking through 1–2 pads or tampons an hour for 2+ hours, or heavy bleeding with faintness or breathlessness | 346 |
| Breast pain with fever, or a hot, swollen or discoloured area | 361 |
| Groups of small painful blisters on eczema with fever, or weeping, crusted, hot, fast-spreading skin | 395, 396 |
| New jaw pain when chewing or talking, with headache, tender temples or vision change | 417 |
| A painful red eye, or a red eye with contact lenses | 422 |
| Hearing loss that came on over 3 days or less (to be seen within 24 hours) | 425 |
| Piles with a high temperature, shivering, or pus | 300 |

### Book a doctor now: don't wait for the count

| Sign | Src |
|---|---|
| Blood in poo, or poo softer or thinner, for 3 weeks | 300 |
| A new change in bowel habit at 50+ / 60+, or unexplained weight loss with belly pain at 40+ | 301 |
| Diarrhoea that wakes you at night, or a family history of bowel cancer or IBD, with ongoing symptoms | 297 |
| Food sticking, or trouble swallowing | 308, 319 |
| 55+ with new heartburn or indigestion and weight loss | 319 |
| Weight loss without trying, with any gut symptom | 277, 300 |
| Blood in the urine, even once and without pain | 328 |
| Urine infections 2 times in 6 months, or 3 in 12 months | 335, 338 |
| Any bleeding after menopause, even once; bleeding between periods or after sex | 345, 353, 360 |
| A new breast lump, nipple discharge with blood or from one side, dimpled skin, or pain in one spot that ignores the cycle | 361 |
| Night sweats with fever, cough, diarrhoea or weight loss | 354 |
| Tinnitus that beats with the pulse, or on one side only | 425, 426 |
| Fingers turning white on one side only, with ulcers, or first starting after 30–40 | 431, 432 |
| Erection trouble that keeps happening (check heart, blood pressure and sugar) | 371, 377 |
